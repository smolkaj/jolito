import XCTest
import UIKit

final class NativeScreenshots: XCTestCase {
    func testStoreScreenshotsAndSceneLifecycle() throws {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launch()
        let create = waitForWelcome(app)
        capture(app, name: "01-welcome")
        create.tap()
        let spanish = app.textFields["Mexican Spanish"]
        XCTAssertTrue(spanish.waitForExistence(timeout: 30), "Card authoring must open in the native app")
        spanish.tap()
        spanish.typeText("Hola")
        // The suggestion list overlays the next field. Dismiss it before
        // editing the translation so a tap cannot select a suggestion.
        let dismissSuggestions = app.buttons["Dismiss suggestions"]
        XCTAssertTrue(dismissSuggestions.waitForExistence(timeout: 10))
        dismissSuggestions.tap()
        let english = app.textFields["English"]
        english.tap()
        english.typeText("Hello")
        dismissKeyboard(app)
        capture(app, name: "02-create")

        // Suspending a scene must preserve the active draft and re-arm input.
        XCUIDevice.shared.press(.home)
        let backgrounded = XCTNSPredicateExpectation(
            predicate: NSPredicate { _, _ in
                app.state == .runningBackground || app.state == .runningBackgroundSuspended
            }, object: nil
        )
        XCTAssertEqual(XCTWaiter.wait(for: [backgrounded], timeout: 10), .completed)
        app.activate()
        XCTAssertTrue(app.wait(for: .runningForeground, timeout: 15))
        XCTAssertTrue(english.waitForExistence(timeout: 30))
        XCTAssertEqual(spanish.value as? String, "Hola")
        XCTAssertEqual(english.value as? String, "Hello")
        english.tap()
        english.typeText(" again")
        XCTAssertEqual(english.value as? String, "Hello again")
        dismissKeyboard(app)
        capture(app, name: "03-resumed-draft")

        // A terminated lifetime stays inert; only an explicit new launch starts one.
        app.terminate()
        XCTAssertTrue(app.wait(for: .notRunning, timeout: 10))
        XCUIDevice.shared.press(.home)
        XCTAssertEqual(app.state, .notRunning)
        app.launch()
        _ = waitForWelcome(app)
        capture(app, name: "04-relaunched-welcome")
        app.terminate()
    }

    private func waitForWelcome(_ app: XCUIApplication) -> XCUIElement {
        let create = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Create a card")).firstMatch
        // Cold Simulator WebKit startup has exceeded 35 seconds in recorded CI.
        // Wait for real app readiness once, without retrying or relaunching a failure.
        XCTAssertTrue(create.waitForExistence(timeout: 90), "Bundled web app must render before capture")
        return create
    }

    private func dismissKeyboard(_ app: XCUIApplication) {
        // Blur the editor through the visible page, just as a learner would.
        let dismissKeyboard = app.buttons.matching(NSPredicate(
            format: "label IN %@", ["Done", "Hide keyboard", "Dismiss keyboard"]
        )).firstMatch
        if dismissKeyboard.exists {
            dismissKeyboard.tap()
        } else {
            app.staticTexts["New flashcard"].tap()
        }
        let keyboardGone = XCTNSPredicateExpectation(
            predicate: NSPredicate { _, _ in !app.keyboards.firstMatch.exists }, object: nil
        )
        XCTAssertEqual(XCTWaiter.wait(for: [keyboardGone], timeout: 10), .completed)
        app.staticTexts["New flashcard"].tap()
    }

    override func tearDown() {
        if testRun?.hasSucceeded == false {
            print(XCUIApplication().debugDescription)
        }
        super.tearDown()
    }

    private func capture(_ app: XCUIApplication, name: String) {
        // WebKit exposes accessibility elements before the compositor paints.
        // Check actual central image content, excluding the status bar/loader.
        let painted = XCTNSPredicateExpectation(
            predicate: NSPredicate { _, _ in self.hasPaintedContent(app.screenshot().image) }, object: nil
        )
        XCTAssertEqual(XCTWaiter.wait(for: [painted], timeout: 30), .completed, "Refusing a blank native screenshot")
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    private func hasPaintedContent(_ image: UIImage) -> Bool {
        guard let cgImage = image.cgImage else { return false }
        var pixels = [UInt8](repeating: 0, count: 32 * 32 * 4)
        return pixels.withUnsafeMutableBytes { buffer in
            guard let context = CGContext(
                data: buffer.baseAddress, width: 32, height: 32, bitsPerComponent: 8,
                bytesPerRow: 32 * 4, space: CGColorSpaceCreateDeviceRGB(),
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
            ) else { return false }
            context.draw(cgImage, in: CGRect(x: 0, y: 0, width: 32, height: 32))
            var ink = 0
            for y in 4..<27 {
                for x in 3..<29 {
                    let offset = (y * 32 + x) * 4
                    if buffer[offset] < 220 || buffer[offset + 1] < 210 || buffer[offset + 2] < 210 {
                        ink += 1
                    }
                }
            }
            return ink > 25
        }
    }
}
