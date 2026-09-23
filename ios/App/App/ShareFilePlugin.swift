import Foundation
import Capacitor
import UIKit

@objc(ShareFilePlugin)
public class ShareFilePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ShareFilePlugin"
    public let jsName = "ShareFile"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "shareFile", returnType: CAPPluginReturnPromise)
    ]

    @objc func shareFile(_ call: CAPPluginCall) {
        guard let filename = call.getString("filename"),
              let content = call.getString("content") else {
            call.reject("Filename and content are required")
            return
        }

        DispatchQueue.main.async {
            guard let viewController = self.bridge?.viewController else {
                call.reject("No view controller available to present share sheet")
                return
            }

            do {
                let tempDir = FileManager.default.temporaryDirectory
                let fileURL = tempDir.appendingPathComponent(filename)
                try content.write(to: fileURL, atomically: true, encoding: .utf8)

                let activityViewController = UIActivityViewController(
                    activityItems: [fileURL],
                    applicationActivities: nil
                )

                if let popover = activityViewController.popoverPresentationController {
                    popover.sourceView = viewController.view
                    popover.sourceRect = CGRect(
                        x: viewController.view.bounds.midX,
                        y: viewController.view.bounds.midY,
                        width: 0,
                        height: 0
                    )
                    popover.permittedArrowDirections = []
                }

                activityViewController.completionWithItemsHandler = { _, completed, _, _ in
                    try? FileManager.default.removeItem(at: fileURL)
                    call.resolve(["completed": completed])
                }

                viewController.present(activityViewController, animated: true)
            } catch {
                call.reject("Failed to prepare file for sharing: \(error.localizedDescription)")
            }
        }
    }
}
