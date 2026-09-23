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

            guard viewController.presentedViewController == nil else {
                call.reject("A share sheet is already presented")
                return
            }

            do {
                let sanitizedFilename = (filename as NSString).lastPathComponent
                let safeName = sanitizedFilename.isEmpty ? "backup.json" : sanitizedFilename
                let shareFolder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
                try FileManager.default.createDirectory(at: shareFolder, withIntermediateDirectories: true)
                let fileURL = shareFolder.appendingPathComponent(safeName)
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

                activityViewController.completionWithItemsHandler = { _, completed, _, error in
                    try? FileManager.default.removeItem(at: shareFolder)
                    if let error = error {
                        call.reject("Share failed: \(error.localizedDescription)")
                    } else {
                        call.resolve(["completed": completed, "canceled": !completed])
                    }
                }

                viewController.present(activityViewController, animated: true)
            } catch {
                call.reject("Failed to prepare file for sharing: \(error.localizedDescription)")
            }
        }
    }
}
