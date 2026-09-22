import UIKit
import Capacitor
import GameController
import WebKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    private weak var bridgeViewController: CAPBridgeViewController?
    private var keyboardConnectedObserver: Any?
    private var keyboardDisconnectedObserver: Any?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        // This delegate is the sole window owner; the scene has no storyboard.
        window = UIWindow(windowScene: windowScene)
        let bridgeVC = CAPBridgeViewController()
        bridgeViewController = bridgeVC
        window?.rootViewController = bridgeVC
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
        setupKeyboardMonitoring()
    }

    private func setupKeyboardMonitoring() {
        bridgeViewController?.loadViewIfNeeded()
        let isConnected = GCKeyboard.coalesced != nil
        notifyKeyboardState(connected: isConnected)

        keyboardConnectedObserver = NotificationCenter.default.addObserver(
            forName: .GCKeyboardDidConnect,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.notifyKeyboardState(connected: true)
        }

        keyboardDisconnectedObserver = NotificationCenter.default.addObserver(
            forName: .GCKeyboardDidDisconnect,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            let isConnected = GCKeyboard.coalesced != nil
            self?.notifyKeyboardState(connected: isConnected)
        }
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        let isConnected = GCKeyboard.coalesced != nil
        notifyKeyboardState(connected: isConnected)
    }

    private func notifyKeyboardState(connected: Bool) {
        bridgeViewController?.webView?.configuration.userContentController.removeAllUserScripts()
        if connected {
            let script = WKUserScript(
                source: "document.documentElement.dataset.keyboard = 'true';",
                injectionTime: .atDocumentStart,
                forMainFrameOnly: true
            )
            bridgeViewController?.webView?.configuration.userContentController.addUserScript(script)
        }

        let js = connected
            ? "document.documentElement.dataset.keyboard = 'true'; window.dispatchEvent(new CustomEvent('jolito:hardware-keyboard', { detail: { connected: true } }));"
            : "delete document.documentElement.dataset.keyboard; window.dispatchEvent(new CustomEvent('jolito:hardware-keyboard', { detail: { connected: false } }));"
        bridgeViewController?.webView?.evaluateJavaScript(js, completionHandler: nil)
    }

    deinit {
        if let observer = keyboardConnectedObserver {
            NotificationCenter.default.removeObserver(observer)
        }
        if let observer = keyboardDisconnectedObserver {
            NotificationCenter.default.removeObserver(observer)
        }
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
