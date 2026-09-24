import XCTest
import GameController

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
        executionTimeAllowance = 300
        continueAfterFailure = false
        app.launch()
        tap(button("Practice"))
        pause(20)
        tap(button("Reveal answer"))
        pause(20)
        tap(app.buttons["Play answer audio"].firstMatch)
        pause(15)
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
        if let value = field.value as? String, value != field.placeholderValue, !value.isEmpty {
            for _ in value { app.keyboards.keys["delete"].tap() }
        }
        typeOnscreen(text)
        XCTAssertEqual(field.value as? String, text, "Onscreen typing must preserve the intended phrase")
        pause(2)
    }

    private func typeOnscreen(_ text: String) {
        let keyboard = app.keyboards.firstMatch
        XCTAssertTrue(keyboard.waitForExistence(timeout: 15))
        // Resolve each keyboard layout once. Re-querying WebKit's entire
        // accessibility tree for every key makes touch typing unnaturally slow.
        func targets() -> [String: CGPoint] {
            guard let snapshot = try? keyboard.snapshot() else { return [:] }
            var result: [String: CGPoint] = [:]
            func visit(_ element: XCUIElementSnapshot) {
                if element.elementType == .key || element.elementType == .button {
                    let point = CGPoint(x: element.frame.midX, y: element.frame.midY)
                    result[element.label] = point
                    if !element.identifier.isEmpty { result[element.identifier] = point }
                }
                element.children.forEach(visit)
            }
            visit(snapshot)
            return result
        }
        func press(_ point: CGPoint) {
            app.coordinate(withNormalizedOffset: .zero)
                .withOffset(CGVector(dx: point.x, dy: point.y)).tap()
        }
        var keys = targets()
        for character in text {
            let value = String(character)
            let identifier = character == " " ? "space" : value
            if keys[identifier] == nil {
                let opposite = value == value.uppercased() ? value.lowercased() : value.uppercased()
                let toggle = opposite != value && keys[opposite] != nil ? "shift" : "more"
                guard let point = keys[toggle] else {
                    XCTFail("The software keyboard must expose its layout switch")
                    return
                }
                press(point)
                keys = targets()
                if keys[identifier] == nil, opposite != value, keys[opposite] != nil,
                   let shift = keys["shift"] {
                    press(shift)
                    keys = targets()
                }
            }
            guard let point = keys[identifier] else {
                XCTFail("The software keyboard must expose the requested key")
                return
            }
            press(point)
            // Capitals release Shift; a space can return punctuation to letters.
            if character.isUppercase || character == " " { keys = targets() }
            if character == " " { pause(0.2) }
        }
    }

    private func createCard(_ spanish: String, _ english: String) {
        type("Mexican Spanish", spanish)
        dismissSuggestions()
        type("English", english)
        dismissKeyboard()
        pause(3)
        scrollToSave()
        tap(button("Save card"))
        pause(3)
        dismissKeyboard()
    }

    private func dismissSuggestions() {
        let dismiss = app.buttons["Dismiss suggestions"]
        if dismiss.waitForExistence(timeout: 2) { dismiss.tap(); pause(1) }
    }

    private func scrollToSave() {
        let start = app.coordinate(withNormalizedOffset: CGVector(dx: 0.04, dy: 0.72))
        start.press(forDuration: 0.05, thenDragTo: start.withOffset(CGVector(dx: 0, dy: -220)), withVelocity: .slow, thenHoldForDuration: 0.1)
        pause(2)
    }

    private func dismissKeyboard() {
        if !app.keyboards.firstMatch.exists { return }
        // Tap the visible page margin. Resolving an offscreen heading can scroll
        // it underneath the status bar and leave the keyboard focused.
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.02, dy: 0.25)).tap()
        let gone = XCTNSPredicateExpectation(
            predicate: NSPredicate { _, _ in !self.app.keyboards.firstMatch.exists }, object: nil
        )
        XCTAssertEqual(XCTWaiter.wait(for: [gone], timeout: 10), .completed)
        pause(2)
    }

    private func closeSheetIfOpen() {
        if button("Sign out").exists {
            tap(button("Close dialog"))
        }
    }

    private func signIn(_ mailbox: Mailbox) throws {
        if !app.textFields["Email address"].firstMatch.exists {
            tap(button("Not signed in."))
        }
        type("Email address", mailbox.address)
        let sentAfter = Date().addingTimeInterval(-2)
        let saveAndSend = button("Save card & send link")
        tap(saveAndSend.exists ? saveAndSend : button("Send sign-in link"))
        let codeField = app.textFields["6-digit code or sign-in link"].firstMatch
        XCTAssertTrue(codeField.waitForExistence(timeout: 20))
        let code = try deliveredCode(mailbox, after: sentAfter)
        codeField.tap()
        typeOnscreen(code)
        pause(2)
        tap(button("Sign in &"))
        let authenticated = app.buttons.matching(NSPredicate(format: "label IN %@", ["Sign out", "Deck synced with cloud. Tap to manage sync."])).firstMatch
        XCTAssertTrue(authenticated.waitForExistence(timeout: 30), "Real account sign-in and synchronization must complete")
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
