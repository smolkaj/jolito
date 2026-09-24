import XCTest

// Drives the bundled iOS app, including its real authentication and native speech.
// Mailbox credentials belong to the UI-test runner only, never the application.
final class NativeWalkthrough: XCTestCase {
    private let app = XCUIApplication()
    private struct Mailbox: Codable { let address: String; let password: String }
    private struct Token: Decodable { let token: String }
    private struct Message: Decodable { let id: String; let subject: String; let createdAt: String }
    private struct Messages: Decodable {
        let messages: [Message]
        enum CodingKeys: String, CodingKey { case messages = "hydra:member" }
    }
    private enum CaptureError: Error { case response, missingCode, configuration }

    func testWalkthrough() throws {
        executionTimeAllowance = 900
        continueAfterFailure = false
        guard let address = ProcessInfo.processInfo.environment["WALKTHROUGH_EMAIL"],
              let password = ProcessInfo.processInfo.environment["WALKTHROUGH_MAILBOX_PASSWORD"] else {
            throw CaptureError.configuration
        }
        let reviewer = Mailbox(address: address, password: password)
        app.launch()
        let create = button("Create a card")
        XCTAssertTrue(create.waitForExistence(timeout: 90))
        app.terminate()
        XCUIDevice.shared.press(.home)
        print("WALKTHROUGH_START \(Date().timeIntervalSince1970)")
        pause(3)
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        let icon = springboard.icons["Jolito"].firstMatch
        XCTAssertTrue(icon.waitForExistence(timeout: 15))
        icon.tap()
        XCTAssertTrue(create.waitForExistence(timeout: 60))
        pause(5)

        chapter("Save a restaurant phrase and sign in")
        tap(create)
        type("Mexican Spanish", "¿Me trae la cuenta, por favor?")
        dismissSuggestions()
        type("English", "Could you bring me the bill, please?")
        dismissKeyboard()
        pause(3)
        tap(button("Sign in to save"))
        try signIn(reviewer)
        pause(5)
        closeSheetIfOpen()

        chapter("Build a useful personal deck")
        createCard("Para llevar, por favor", "To go, please")
        createCard("Provecho", "Enjoy your meal")
        tap(button("Deck"))
        pause(5)
        app.swipeUp(velocity: .slow)
        pause(3)
        app.swipeDown(velocity: .slow)
        pause(3)

        chapter("Listen, recall, reveal and grade with touch gestures")
        tap(button("Practice"))
        let cards = app.buttons["Cards"].firstMatch
        if cards.waitForExistence(timeout: 2) { tap(cards) }
        for index in 0..<4 {
            let reveal = button("Reveal answer")
            XCTAssertTrue(reveal.waitForExistence(timeout: 20))
            dismissPracticeKeyboard()
            pause(7)
            // Start on the noninteractive prompt area. Up reveals; right grades Good.
            let frame = app.frame
            let origin = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.22))
            let upwards = origin.withOffset(CGVector(dx: 0, dy: -min(100, frame.height * 0.1)))
            origin.press(forDuration: 0.08, thenDragTo: upwards, withVelocity: .slow, thenHoldForDuration: 0.15)
            XCTAssertTrue(button("Good").waitForExistence(timeout: 10), "Swipe up must reveal the answer")
            pause(7)
            if index == 1 {
                tap(app.buttons["Play answer audio"].firstMatch)
                pause(4)
            }
            let grading = app.coordinate(withNormalizedOffset: CGVector(dx: 0.4, dy: 0.25))
            grading.press(forDuration: 0.08, thenDragTo: grading.withOffset(CGVector(dx: 210, dy: 0)), withVelocity: .slow, thenHoldForDuration: 0.2)
            XCTAssertTrue(reveal.waitForExistence(timeout: 10), "Swipe right must advance the study session")
            pause(2)
        }

        chapter("Return to the same account")
        tap(button("Sync"))
        tap(button("Sign out"))
        pause(4)
        try signIn(reviewer)
        pause(5)
        closeSheetIfOpen()
        tap(button("Deck"))
        XCTAssertTrue(app.staticTexts["¿Me trae la cuenta, por favor?"].firstMatch.waitForExistence(timeout: 15))
        pause(5)
        print("WALKTHROUGH_END \(Date().timeIntervalSince1970)")
    }

    private func button(_ prefix: String) -> XCUIElement {
        app.buttons.matching(NSPredicate(format: "label BEGINSWITH[c] %@", prefix)).firstMatch
    }

    private func tap(_ element: XCUIElement) {
        XCTAssertTrue(element.waitForExistence(timeout: 20))
        element.tap()
        pause(2)
    }

    private func type(_ label: String, _ text: String) {
        let field = app.textFields[label].firstMatch
        XCTAssertTrue(field.waitForExistence(timeout: 15))
        field.tap()
        field.typeText(text)
        pause(2)
    }

    private func createCard(_ spanish: String, _ english: String) {
        tap(button("Create"))
        type("Mexican Spanish", spanish)
        dismissSuggestions()
        type("English", english)
        dismissKeyboard()
        pause(3)
        tap(button("Save card"))
        pause(3)
    }

    private func dismissSuggestions() {
        let dismiss = app.buttons["Dismiss suggestions"]
        if dismiss.waitForExistence(timeout: 2) { dismiss.tap(); pause(1) }
    }

    private func dismissKeyboard() {
        app.staticTexts["New flashcard"].firstMatch.tap()
        pause(2)
        XCTAssertFalse(app.keyboards.firstMatch.exists)
    }

    private func dismissPracticeKeyboard() {
        if app.keyboards.firstMatch.exists {
            app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.16)).tap()
            pause(2)
        }
        XCTAssertFalse(app.keyboards.firstMatch.exists, "Practice should remain in touch mode")
    }

    private func closeSheetIfOpen() {
        if button("Sign out").exists {
            // Drag the sheet down from its visible heading, leaving the account signed in.
            let heading = app.staticTexts["Cloud sync"].firstMatch
            XCTAssertTrue(heading.exists)
            let start = heading.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: -1.2))
            start.press(forDuration: 0.08, thenDragTo: start.withOffset(CGVector(dx: 0, dy: 400)), withVelocity: .slow, thenHoldForDuration: 0.1)
            pause(3)
        }
    }

    private func signIn(_ mailbox: Mailbox) throws {
        type("Email address", mailbox.address)
        let sentAfter = Date().addingTimeInterval(-2)
        let saveAndSend = button("Save card & send link")
        tap(saveAndSend.exists ? saveAndSend : button("Send sign-in link"))
        let codeField = app.textFields["6-digit code or sign-in link"].firstMatch
        XCTAssertTrue(codeField.waitForExistence(timeout: 20))
        let code = try deliveredCode(mailbox, after: sentAfter)
        codeField.tap()
        codeField.typeText(code)
        pause(2)
        tap(button("Sign in &"))
        XCTAssertTrue(button("Sign out").waitForExistence(timeout: 30), "Real account sign-in must complete")
    }

    private func deliveredCode(_ mailbox: Mailbox, after: Date) throws -> String {
        let token: Token = try request("/token", body: JSONEncoder().encode(mailbox))
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        for _ in 0..<40 {
            let inbox: Messages = try request("/messages", token: token.token)
            for message in inbox.messages {
                let date = formatter.date(from: message.createdAt) ?? ISO8601DateFormatter().date(from: message.createdAt)
                guard let date, date >= after else { continue }
                if let range = message.subject.range(of: "\\b[0-9]{6,8}\\b", options: .regularExpression) {
                    return String(message.subject[range])
                }
            }
            pause(3)
        }
        throw CaptureError.missingCode
    }

    private func request<T: Decodable>(_ path: String, token: String? = nil, body: Data? = nil) throws -> T {
        var request = URLRequest(url: URL(string: "https://api.mail.tm" + path)!)
        request.timeoutInterval = 20
        if let token { request.setValue("Bearer " + token, forHTTPHeaderField: "Authorization") }
        if let body {
            request.httpMethod = "POST"
            request.httpBody = body
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        let done = expectation(description: "Test mailbox request")
        var result: Result<T, Error>?
        URLSession.shared.dataTask(with: request) { data, response, error in
            defer { done.fulfill() }
            if let error { result = .failure(error); return }
            guard let response = response as? HTTPURLResponse, (200..<300).contains(response.statusCode), let data else {
                result = .failure(CaptureError.response); return
            }
            result = Result { try JSONDecoder().decode(T.self, from: data) }
        }.resume()
        wait(for: [done], timeout: 25)
        guard let result else { throw CaptureError.response }
        return try result.get()
    }

    private func chapter(_ title: String) { print("WALKTHROUGH_CHAPTER \(Date().timeIntervalSince1970) \(title)") }
    private func pause(_ seconds: TimeInterval) { RunLoop.current.run(until: Date().addingTimeInterval(seconds)) }

    override func tearDown() {
        if testRun?.hasSucceeded == false { print(app.debugDescription) }
        super.tearDown()
    }
}
