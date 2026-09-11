import XCTest
import UIKit

final class NativeScreenshots: XCTestCase {
    func testStoreScreenshots() throws {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launch()
        let create = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Create a card")).firstMatch
        XCTAssertTrue(create.waitForExistence(timeout: 30), "Bundled web app must render before capture")
        capture(app, name: "01-welcome")
        create.tap()
        let spanish = app.textFields["Mexican Spanish"]
        XCTAssertTrue(spanish.waitForExistence(timeout: 15), "Card authoring must open in the native app")
        spanish.tap()
        spanish.typeText("Hola")
        let english = app.textFields["English"]
        english.tap()
        english.typeText("Hello")
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
        capture(app, name: "02-create")
        app.terminate()
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
