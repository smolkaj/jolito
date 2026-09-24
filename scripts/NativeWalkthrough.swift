import XCTest

// Drives the bundled iOS application. This harness is never part of the app target.
final class NativeWalkthrough: XCTestCase {
    func testWalkthrough() throws {
        executionTimeAllowance = 600
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launch()
        let welcome = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Create a card")).firstMatch
        XCTAssertTrue(welcome.waitForExistence(timeout: 90))
        app.terminate()
        XCUIDevice.shared.press(.home)
        print("WALKTHROUGH_START \(Date().timeIntervalSince1970)")
        pause(3)
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        let icon = springboard.icons["Jolito"].firstMatch
        XCTAssertTrue(icon.waitForExistence(timeout: 15))
        icon.tap()
        XCTAssertTrue(welcome.waitForExistence(timeout: 60))
        pause(4)
        let practice = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", "Try")).firstMatch
        XCTAssertTrue(practice.waitForExistence(timeout: 10), app.debugDescription)
        practice.tap()
        pause(8)
        let reveal = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Reveal answer")).firstMatch
        XCTAssertTrue(reveal.waitForExistence(timeout: 10), app.debugDescription)
        reveal.tap()
        pause(7)
        print("WALKTHROUGH_END \(Date().timeIntervalSince1970)")
    }

    private func pause(_ seconds: TimeInterval) {
        RunLoop.current.run(until: Date().addingTimeInterval(seconds))
    }

    override func tearDown() {
        if testRun?.hasSucceeded == false {
            print(XCUIApplication().debugDescription)
        }
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.lifetime = .keepAlways
        add(attachment)
        super.tearDown()
    }
}
