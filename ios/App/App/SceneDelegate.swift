import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        // Cyra's subclass registers the app-local CyraHealth plugin on the bridge.
        // Under UIScene the root view controller comes from here, not Main.storyboard.
        window?.rootViewController = CyraViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }

    func sceneDidEnterBackground(_ scene: UIScene) {
        // Re-apply backup exclusion and Complete protection to Library/NoCloud and the
        // files written there this session (see CyraNoCloud in AppDelegate.swift).
        CyraNoCloud.prepare()
    }
}
