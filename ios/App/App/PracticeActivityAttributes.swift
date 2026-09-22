import Foundation
import ActivityKit

@available(iOS 16.2, *)
public struct PracticeActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        public var completedCount: Int
        public var remainingCount: Int
        public var totalCount: Int
        public var progressPercentage: Int
        public var currentPrompt: String

        public init(
            completedCount: Int,
            remainingCount: Int,
            totalCount: Int,
            progressPercentage: Int,
            currentPrompt: String
        ) {
            self.completedCount = completedCount
            self.remainingCount = remainingCount
            self.totalCount = totalCount
            self.progressPercentage = progressPercentage
            self.currentPrompt = currentPrompt
        }
    }

    public var sessionTitle: String

    public init(sessionTitle: String = "Practice") {
        self.sessionTitle = sessionTitle
    }
}
