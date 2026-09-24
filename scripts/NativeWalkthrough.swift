import XCTest
import AVFoundation
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
        executionTimeAllowance = 900
        continueAfterFailure = false
        guard let address = ProcessInfo.processInfo.environment["WALKTHROUGH_EMAIL"],
              let password = ProcessInfo.processInfo.environment["WALKTHROUGH_MAILBOX_PASSWORD"] else {
            throw CaptureError.configuration
        }
        let reviewer = Mailbox(address: address, password: password)
        guard let deletionAddress = ProcessInfo.processInfo.environment["WALKTHROUGH_DELETE_EMAIL"],
              let deletionPassword = ProcessInfo.processInfo.environment["WALKTHROUGH_DELETE_PASSWORD"] else {
            throw CaptureError.configuration
        }
        let disposable = Mailbox(address: deletionAddress, password: deletionPassword)
        print("WALKTHROUGH_VOICES \(AVSpeechSynthesisVoice.speechVoices().map { $0.identifier })")
        print("WALKTHROUGH_HARDWARE_KEYBOARD \(GCKeyboard.coalesced != nil)")
        XCTAssertNil(GCKeyboard.coalesced, "Capture must start without a connected hardware keyboard")
        app.launch()
        let create = button("Create a card")
        XCTAssertTrue(create.waitForExistence(timeout: 90))
        XCUIDevice.shared.press(.home)
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        pause(3)
        var launchIcon: XCUIElement?
        for _ in 0..<3 {
            launchIcon = springboard.icons.matching(identifier: "Jolito").allElementsBoundByIndex.first {
                $0.isHittable && $0.frame.width > 0
            }
            if launchIcon != nil { break }
            springboard.swipeLeft(velocity: .slow)
            pause(2)
        }
        guard let icon = launchIcon else {
            XCTFail("Jolito must be visible on the Home Screen before capture begins")
            return
        }
        print("WALKTHROUGH_START \(Date().timeIntervalSince1970)")
        pause(3)
        icon.tap()
        XCTAssertTrue(create.waitForExistence(timeout: 60))
        pause(5)

        chapter("Save a restaurant phrase and sign in")
        tap(create)
        type("Mexican Spanish", "La cuenta, por favor")
        dismissSuggestions()
        type("English", "The bill, please")
        dismissKeyboard()
        pause(3)
        scrollToSave()
        tap(button("Sign in to save"))
        try signIn(reviewer)
        pause(5)
        if !button("Sign out").exists {
            // Saving a pending card closes the sheet and focuses the next draft.
            dismissKeyboard()
        }
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

        print("WALKTHROUGH_HARDWARE_KEYBOARD_AFTER_TYPING \(GCKeyboard.coalesced != nil)")
        chapter("Listen, recall, reveal and grade with touch gestures")
        tap(button("Cards"))
        for index in 0..<2 {
            let reveal = button("Reveal answer")
            XCTAssertTrue(reveal.waitForExistence(timeout: 20))
            XCTAssertFalse(button("Reveal answer Enter").exists, "Study must use touch mode without hardware-keyboard hints")
            dismissKeyboard()
            pause(7)
            // Start on the noninteractive prompt area. Up reveals; right grades Good.
            let frame = app.frame
            let origin = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.22))
            let upwards = origin.withOffset(CGVector(dx: 0, dy: -min(100, frame.height * 0.1)))
            origin.press(forDuration: 0.08, thenDragTo: upwards, withVelocity: .slow, thenHoldForDuration: 0.15)
            XCTAssertTrue(button("3 Good").waitForExistence(timeout: 10), "Swipe up must reveal the answer")
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

        dismissKeyboard()
        chapter("Practice verb forms in context")
        tap(button("Grammar"))
        pause(4)
        tap(button("Start practice"))
        for _ in 0..<2 {
            XCTAssertTrue(button("Reveal answer").waitForExistence(timeout: 20))
            dismissKeyboard()
            pause(6)
            tap(button("Reveal answer"))
            pause(7)
            tap(button("3 Good"))
        }

        dismissKeyboard()
        chapter("Return to the same account")
        tap(button("Deck synced with cloud."))
        tap(button("Sign out"))
        pause(4)
        try signIn(reviewer)
        pause(5)
        closeSheetIfOpen()
        tap(button("Deck"))
        XCTAssertTrue(app.staticTexts["La cuenta, por favor"].firstMatch.waitForExistence(timeout: 15))
        pause(5)
        chapter("Create and delete a separate disposable account")
        tap(button("Deck synced with cloud."))
        tap(button("Sign out"))
        try signIn(disposable)
        pause(5)
        if !button("Delete cloud account & data").exists {
            tap(button("Deck synced with cloud."))
        }
        tap(button("Delete cloud account & data"))
        pause(6)
        let backup = app.switches["Save an offline backup before deleting"].firstMatch
        if backup.exists { tap(backup) }
        else { tap(app.checkBoxes["Save an offline backup before deleting"].firstMatch) }
        let confirmation = app.textFields.matching(NSPredicate(format: "placeholderValue == %@", "DELETE")).firstMatch
        tap(confirmation)
        typeOnscreen("DELETE")
        app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "Permanently deletes your account")).firstMatch.tap()
        pause(3)
        tap(button("Yes, delete cloud data"))
        XCTAssertTrue(app.staticTexts["Cloud account and backup data deleted."].firstMatch.waitForExistence(timeout: 30))
        XCTAssertTrue(button("Not signed in.").waitForExistence(timeout: 15))
        pause(7)
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
            // A single capital automatically releases Shift after its key tap.
            if character.isUppercase { keys = targets() }
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
