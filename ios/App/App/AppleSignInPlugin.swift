import Foundation
import Capacitor
import AuthenticationServices

@objc(AppleSignInPlugin)
public class AppleSignInPlugin: CAPPlugin, CAPBridgedPlugin, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    public let identifier = "AppleSignInPlugin"
    public let jsName = "AppleSignIn"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise)
    ]

    private var activeCall: CAPPluginCall?

    @objc func signIn(_ call: CAPPluginCall) {
        self.activeCall = call

        DispatchQueue.main.async {
            let appleIDProvider = ASAuthorizationAppleIDProvider()
            let request = appleIDProvider.createRequest()
            request.requestedScopes = [.fullName, .email]

            let authorizationController = ASAuthorizationController(authorizationRequests: [request])
            authorizationController.delegate = self
            authorizationController.presentationContextProvider = self
            authorizationController.performRequests()
        }
    }

    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        return self.bridge?.viewController?.view.window ?? UIWindow()
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let call = activeCall else { return }
        defer { activeCall = nil }

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
        defer { activeCall = nil }

        let nsError = error as NSError
        if nsError.domain == ASAuthorizationError.errorDomain,
           nsError.code == ASAuthorizationError.canceled.rawValue {
            call.resolve(["canceled": true])
            return
        }

        call.reject("Apple Sign In failed: \(error.localizedDescription)")
    }
}
