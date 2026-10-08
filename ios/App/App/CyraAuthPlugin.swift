import Foundation
import UIKit
import AuthenticationServices
import Capacitor

/// Cyra's sign-in and connect window on iOS ("CyraAuth" in JS).
///
/// Why: the backend returns sign-in (#oauth=<code>) and Oura (#oura=<code>) one-time
/// codes to cyrahealth://auth/<flow>. Any app can register the cyrahealth scheme, and
/// when several do, iOS picks one of them ("the app the system targets is undefined").
/// A link opened from Safari (the Browser plugin plus App.appUrlOpen) can therefore land
/// in another app, which could spend the code or learn that this person uses Cyra.
/// ASWebAuthenticationSession hands the callback only to the session that started it,
/// "even when more than one app registers the same callback URL scheme". The app's
/// one-time verifier stays in place as well.
///
/// Contract (promise methods; JS: registerPlugin("CyraAuth")):
///   open({ url: "https://…", ephemeral?: boolean = true }) -> { url: "cyrahealth://auth/<flow>#…" }
///     Rejects with code "CANCELED" when the person closes the window, "BUSY" when a
///     window is already open, "INVALID_URL" for anything but an https URL, and
///     "FAILED" or "UNAVAILABLE" otherwise.
///     ephemeral = true asks the browser not to share cookies or other browsing data with
///     Safari, so the sign-in leaves nothing behind there.
///   cancel() -> {}   closes an open window (for example when the JS times out); the
///     pending open() call rejects with "CANCELED".
///
/// Registered on the bridge by CyraViewController.capacitorDidLoad().
@objc(CyraAuthPlugin)
public class CyraAuthPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CyraAuthPlugin"
    public let jsName = "CyraAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancel", returnType: CAPPluginReturnPromise)
    ]

    /// The only scheme the window returns through (Info.plist CFBundleURLSchemes).
    static let callbackScheme = "cyrahealth"

    private struct Pending {
        let token: UUID
        let session: ASWebAuthenticationSession
        /// presentationContextProvider is a weak reference, so the provider is kept here.
        let anchor: CyraAuthAnchor
        let call: CAPPluginCall
    }

    /// The one open window. Read and written only on the main thread.
    private var pending: Pending?

    @objc func open(_ call: CAPPluginCall) {
        guard let text = call.getString("url"), let url = URL(string: text),
              url.scheme?.lowercased() == "https", url.host != nil else {
            call.reject("open needs an https URL.", "INVALID_URL")
            return
        }
        let ephemeral = call.getBool("ephemeral") ?? true

        DispatchQueue.main.async {
            if self.pending != nil {
                call.reject("A sign-in window is already open.", "BUSY")
                return
            }
            let token = UUID()
            // The system may call this on any queue; settle on the main thread.
            let handler: ASWebAuthenticationSession.CompletionHandler = { callbackURL, error in
                DispatchQueue.main.async {
                    self.complete(token: token, callbackURL: callbackURL, error: error)
                }
            }
            let session: ASWebAuthenticationSession
            if #available(iOS 17.4, *) {
                session = ASWebAuthenticationSession(url: url,
                                                     callback: .customScheme(CyraAuthPlugin.callbackScheme),
                                                     completionHandler: handler)
            } else {
                session = ASWebAuthenticationSession(url: url,
                                                     callbackURLScheme: CyraAuthPlugin.callbackScheme,
                                                     completionHandler: handler)
            }
            let anchor = CyraAuthAnchor(window: self.bridge?.viewController?.view.window)
            session.presentationContextProvider = anchor
            // Must be set before start().
            session.prefersEphemeralWebBrowserSession = ephemeral
            self.pending = Pending(token: token, session: session, anchor: anchor, call: call)
            if !session.start() {
                self.pending = nil
                call.reject("Couldn't open the sign-in window on this device.", "UNAVAILABLE")
            }
        }
    }

    @objc func cancel(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if let pending = self.pending {
                self.pending = nil
                pending.session.cancel()
                pending.call.reject("The connection window was closed", "CANCELED")
            }
            call.resolve()
        }
    }

    /// Settles the open() call once; a late answer for a window that cancel() already
    /// settled is ignored. Main thread only.
    private func complete(token: UUID, callbackURL: URL?, error: Error?) {
        guard let pending = pending, pending.token == token else { return }
        self.pending = nil
        if let callbackURL = callbackURL {
            pending.call.resolve(["url": callbackURL.absoluteString])
        } else if let error = error as? ASWebAuthenticationSessionError, error.code == .canceledLogin {
            pending.call.reject("The connection window was closed", "CANCELED")
        } else {
            pending.call.reject("Couldn't finish signing in on this device.", "FAILED", error)
        }
    }
}

/// Presents the window over Cyra's own window.
@MainActor
final class CyraAuthAnchor: NSObject, ASWebAuthenticationPresentationContextProviding {
    private weak var window: UIWindow?

    init(window: UIWindow?) {
        self.window = window
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        window ?? ASPresentationAnchor()
    }
}
