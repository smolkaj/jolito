import Foundation
import Capacitor
import ActivityKit

@objc(LiveActivityPlugin)
public class LiveActivityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LiveActivityPlugin"
    public let jsName = "LiveActivity"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "startPractice", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "updatePractice", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "endPractice", returnType: CAPPluginReturnPromise)
    ]

    private var currentActivity: Any? = nil

    @objc func startPractice(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve(["supported": false, "started": false])
            return
        }

        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            call.resolve(["supported": true, "enabled": false, "started": false])
            return
        }

        let total = call.getInt("total") ?? 0
        let prompt = call.getString("prompt") ?? ""
        let title = call.getString("title") ?? "Practice"

        Task {
            // End any active leftover activities first for deterministic single-activity hygiene
            for activity in Activity<PracticeActivityAttributes>.activities {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
            self.currentActivity = nil

            let attributes = PracticeActivityAttributes(sessionTitle: title)
            let state = PracticeActivityAttributes.ContentState(
                completedCount: 0,
                remainingCount: total,
                totalCount: total,
                progressPercentage: 0,
                currentPrompt: prompt
            )

            do {
                let activity = try Activity<PracticeActivityAttributes>.request(
                    attributes: attributes,
                    content: .init(state: state, staleDate: nil)
                )
                self.currentActivity = activity
                call.resolve([
                    "supported": true,
                    "enabled": true,
                    "started": true,
                    "id": activity.id
                ])
            } catch {
                call.resolve([
                    "supported": true,
                    "started": false,
                    "error": error.localizedDescription
                ])
            }
        }
    }

    @objc func updatePractice(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve(["supported": false, "updated": false])
            return
        }

        let activity = (currentActivity as? Activity<PracticeActivityAttributes>) ?? Activity<PracticeActivityAttributes>.activities.first
        guard let targetActivity = activity else {
            call.resolve(["supported": true, "updated": false])
            return
        }

        let completed = call.getInt("completed") ?? 0
        let remaining = call.getInt("remaining") ?? 0
        let total = call.getInt("total") ?? (completed + remaining)
        let percentage = call.getInt("percentage") ?? (total > 0 ? Int((Double(completed) / Double(total)) * 100) : 0)
        let prompt = call.getString("prompt") ?? ""

        let state = PracticeActivityAttributes.ContentState(
            completedCount: completed,
            remainingCount: remaining,
            totalCount: total,
            progressPercentage: percentage,
            currentPrompt: prompt
        )

        Task {
            self.currentActivity = targetActivity
            await targetActivity.update(ActivityContent(state: state, staleDate: nil))
            call.resolve(["supported": true, "updated": true])
        }
    }

    @objc func endPractice(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve(["supported": false, "ended": false])
            return
        }

        Task {
            for activity in Activity<PracticeActivityAttributes>.activities {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
            self.currentActivity = nil
            call.resolve(["supported": true, "ended": true])
        }
    }
}
