import UIKit
import WebKit
import Capacitor

/// Cyra's bridge view controller: the stock CAPBridgeViewController plus Cyra's
/// app-local plugins, and a guard for the health record's file protection.
///
/// Plugins that live in the App target (not in an npm package) are not in
/// capacitor.config.json's packageClassList, so Capacitor never auto-registers
/// them; they must be registered on the bridge here. Capacitor calls
/// capacitorDidLoad() from loadView(), after the bridge exists and before the web
/// view loads the app, so the plugins' JS proxies are ready before any page script runs.
///
/// SceneDelegate creates this controller as the window's root (since the Capacitor
/// 8.5 UIScene template, the scene delegate, not Main.storyboard, provides the root
/// view controller). Main.storyboard names this class too, so both stay in agreement.
class CyraViewController: CAPBridgeViewController {
    private var loadingObservation: NSKeyValueObservation?
    /// True when the web app started loading while protected data was unavailable.
    private var loadedWhileLocked = false

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(CyraHealthPlugin())
        bridge?.registerPluginInstance(CyraAuthPlugin())
        reloadAfterUnlockIfNeeded()
    }

    /// The health record (Library/NoCloud/cyra-state.json) has Complete protection, so it
    /// can't be read while the device is locked. Usually the web app only loads in the
    /// foreground, but Capacitor reloads the page straight away when iOS ends the web
    /// content process (WebViewDelegationHandler.webViewWebContentProcessDidTerminate),
    /// and that can happen in the background while the device is locked. The page would
    /// then fail to read the record and start as if there were none.
    ///
    /// So: note any page load that starts while protected data is unavailable, and when
    /// the device is next unlocked, load the page again so it reads the real record.
    /// Nobody can use the page between those two moments, because the device is locked.
    /// The web app should still treat a failed read as "unavailable", never as "empty".
    private func reloadAfterUnlockIfNeeded() {
        // WKWebView is KVO compliant for isLoading. WebKit changes it on the main thread,
        // so the handler runs there too.
        loadingObservation = webView?.observe(\.isLoading, options: [.new]) { [weak self] _, change in
            guard change.newValue == true, !UIApplication.shared.isProtectedDataAvailable else { return }
            self?.loadedWhileLocked = true
        }
        NotificationCenter.default.addObserver(self,
                                               selector: #selector(protectedDataDidBecomeAvailable(_:)),
                                               name: UIApplication.protectedDataDidBecomeAvailableNotification,
                                               object: nil)
    }

    @objc private func protectedDataDidBecomeAvailable(_ notification: Notification) {
        guard loadedWhileLocked else { return }
        loadedWhileLocked = false
        NSLog("[Cyra] The app loaded while the device was locked; reloading now that the record is readable.")
        // A navigation, so Capacitor resets the bridge first (didStartProvisionalNavigation).
        webView?.reload()
    }
}
