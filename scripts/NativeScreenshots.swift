import XCTest

final class NativeScreenshots: XCTestCase {
    func testStoreScreenshots() throws {
        let app = XCUIApplication()
        app.launch()
        let create = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Create a card")).firstMatch
        XCTAssertTrue(create.waitForExistence(timeout: 30), "Bundled web app must render before capture")
        capture(app, name: "01-welcome")
        create.tap()
        let spanish = app.textFields.firstMatch
        XCTAssertTrue(spanish.waitForExistence(timeout: 15), "Card authoring must open in the native app")
        capture(app, name: "02-create")
        app.terminate()
    }

    private func capture(_ app: XCUIApplication, name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
