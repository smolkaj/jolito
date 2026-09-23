import UIKit
import Capacitor
import GameController
import WebKit

class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(AppReviewPlugin())
        bridge?.registerPluginInstance(LiveActivityPlugin())
        bridge?.registerPluginInstance(ShareFilePlugin())
        bridge?.registerPluginInstance(AppleSignInPlugin())
    }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate, WKScriptMessageHandler {
    var window: UIWindow?
    private weak var bridgeViewController: CAPBridgeViewController?
    private var keyboardConnectedObserver: Any?
    private var keyboardDisconnectedObserver: Any?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        // This delegate is the sole window owner; the scene has no storyboard.
        window = UIWindow(windowScene: windowScene)
        let bridgeVC = MainViewController()
        bridgeViewController = bridgeVC
        window?.rootViewController = bridgeVC
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
        setupKeyboardMonitoring()
    }

    private func setupKeyboardMonitoring() {
        bridgeViewController?.loadViewIfNeeded()
        bridgeViewController?.webView?.configuration.userContentController.add(self, name: "jolitoKeyboard")

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

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == "jolitoKeyboard" {
            let isConnected = GCKeyboard.coalesced != nil
            notifyKeyboardState(connected: isConnected)
        }
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        let isConnected = GCKeyboard.coalesced != nil
        notifyKeyboardState(connected: isConnected)
    }

    private func notifyKeyboardState(connected: Bool) {
        let js = connected
            ? "document.documentElement.dataset.keyboard = 'true'; window.dispatchEvent(new CustomEvent('jolito:hardware-keyboard', { detail: { connected: true } }));"
            : "delete document.documentElement.dataset.keyboard; window.dispatchEvent(new CustomEvent('jolito:hardware-keyboard', { detail: { connected: false } }));"
        bridgeViewController?.webView?.evaluateJavaScript(js, completionHandler: nil)
    }

    func sceneDidDisconnect(_ scene: UIScene) {
        bridgeViewController?.webView?.configuration.userContentController.removeScriptMessageHandler(forName: "jolitoKeyboard")
    }

    deinit {
        bridgeViewController?.webView?.configuration.userContentController.removeScriptMessageHandler(forName: "jolitoKeyboard")
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
