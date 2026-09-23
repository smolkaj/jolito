import Foundation
import Capacitor
import AuthenticationServices
import CryptoKit

private func randomNonceString(length: Int = 32) -> String {
    precondition(length > 0)
    var randomBytes = [UInt8](repeating: 0, count: length)
    let errorCode = SecRandomCopyBytes(kSecRandomDefault, randomBytes.count, &randomBytes)
    if errorCode != errSecSuccess {
        fatalError("Unable to generate nonce: \(errorCode)")
    }
    let charset: [Character] = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
    let nonce = randomBytes.map { byte in
        charset[Int(byte) % charset.count]
    }
    return String(nonce)
}

private func sha256(_ input: String) -> String {
    let inputData = Data(input.utf8)
    let hashed = SHA256.hash(data: inputData)
    return hashed.compactMap { String(format: "%02x", $0) }.joined()
}

@objc(AppleSignInPlugin)
public class AppleSignInPlugin: CAPPlugin, CAPBridgedPlugin, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    public let identifier = "AppleSignInPlugin"
    public let jsName = "AppleSignIn"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise)
    ]

    private var activeCall: CAPPluginCall?
    private var currentNonce: String?

    @objc func signIn(_ call: CAPPluginCall) {
        if activeCall != nil {
            call.reject("Apple Sign-In is already in progress")
            return
        }

        self.activeCall = call

        DispatchQueue.main.async {
            let appleIDProvider = ASAuthorizationAppleIDProvider()
            let request = appleIDProvider.createRequest()
            request.requestedScopes = [.fullName, .email]

            let rawNonce = randomNonceString()
            self.currentNonce = rawNonce
            request.nonce = sha256(rawNonce)

            let authorizationController = ASAuthorizationController(authorizationRequests: [request])
            authorizationController.delegate = self
            authorizationController.presentationContextProvider = self
            authorizationController.performRequests()
        }
    }

    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        if let window = self.bridge?.viewController?.view.window {
            return window
        }
        if let window = UIApplication.shared.windows.first(where: { $0.isKeyWindow }) {
            return window
        }
        return UIWindow()
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let call = activeCall else { return }
        defer {
            activeCall = nil
            currentNonce = nil
        }

        if let appleIDCredential = authorization.credential as? ASAuthorizationAppleIDCredential {
            let identityToken = appleIDCredential.identityToken.flatMap { String(data: $0, encoding: .utf8) } ?? ""
            let authorizationCode = appleIDCredential.authorizationCode.flatMap { String(data: $0, encoding: .utf8) } ?? ""
            let user = appleIDCredential.user
            let email = appleIDCredential.email
            let givenName = appleIDCredential.fullName?.givenName
            let familyName = appleIDCredential.fullName?.familyName

            call.resolve([
                "identityToken": identityToken,
                "authorizationCode": authorizationCode,
                "nonce": currentNonce ?? "",
                "user": user,
                "email": email as Any,
                "givenName": givenName as Any,
                "familyName": familyName as Any
            ])
        } else {
            call.reject("Unsupported credential type")
        }
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        guard let call = activeCall else { return }
        defer {
            activeCall = nil
            currentNonce = nil
        }

        let nsError = error as NSError
        if nsError.domain == ASAuthorizationError.errorDomain,
           nsError.code == ASAuthorizationError.canceled.rawValue {
            call.resolve(["canceled": true])
            return
        }

        call.reject("Apple Sign In failed: \(error.localizedDescription)")
    }
}
