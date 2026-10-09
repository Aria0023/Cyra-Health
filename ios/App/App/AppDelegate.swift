import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Runs before any scene (and so before the web view) exists: the health record's
        // directory, and every file already in it, are excluded from backup and given Complete
        // protection before the web app can read or write them.
        CyraNoCloud.prepare()
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}

/// Library/NoCloud is where Cyra's whole health record lives on iPhone and iPad. The web app
/// (src/lib/storage.js) reads and writes it with the Filesystem plugin as Directory.Library +
/// "NoCloud/cyra-state.json".
///
/// Why this exists: Library/ is included in iCloud Backup (and in Finder backups) by default.
/// Cyra never sends the record itself to its servers, and the record file must not reach
/// iCloud: App Review Guideline 5.1.3(ii) says apps "may not store personal health information
/// in iCloud". The whole record leaves the phone only as the passphrase-encrypted backup file
/// the user exports herself through the share sheet. Smaller pieces leave only by her choice:
/// the doctor summary she emails or copies; the anonymous weekly counts (stage group and
/// symptom flags) if she opted in; for Oura, the tokens, which Cyra's server uses to fetch her
/// Oura readings and passes straight back without storing them; for Fitbit/Garmin/Whoop, the
/// Terra mailbox key: Terra sends her readings to Cyra's server, which holds them in memory for
/// up to 7 days until this device collects them with the key; and, if she turned on "Also ask
/// Cyra's AI", a question the on-device library can't answer, which goes as typed to Cyra's
/// server and on to Anthropic. Backup exclusion below is guidance to iOS, not a guarantee.
///
/// How a save works (storage.js): the record is written to NoCloud/cyra-state.json.tmp, which
/// is a new file each time, and then moved over cyra-state.json. FileManager.moveItem refuses
/// to replace an existing file, so storage.js deletes cyra-state.json and moves the temp file
/// into its place; if the app dies in between, storage.load() reads the complete temp file.
/// So after every save, cyra-state.json is a NEW file that keeps the protection class the temp
/// file was created with. Both files sit directly in Library/NoCloud, and everything below
/// covers every regular file there.
///
/// - Encryption: Complete data protection. On a device with a passcode, the files can be read
///   only while the device is unlocked; about 10 seconds after locking, reads and writes fail
///   until the next unlock. The web app normally touches the record in the foreground, but
///   nothing in it checks for that: a page reload after iOS ends the web content process can
///   read the record in the background, and so can a weekly-counts send that finishes after
///   the app leaves the foreground (flushPulse). While the device is locked those reads and
///   writes fail. A failed read at startup (hydrate) is treated as "unavailable", never as
///   "empty", so nothing is saved over the file; flushPulse falls back to the copy it read when
///   the send began. CyraViewController reloads the page after the next unlock if it was loaded
///   while the device was locked.
///   - New files: App.entitlements sets com.apple.developer.default-data-protection to
///     NSFileProtectionComplete (the Data Protection capability), so a file the app creates
///     without naming a protection level, as the Filesystem plugin's String.write(to:
///     atomically: false) does, gets Complete instead of the system default, Complete until
///     first user authentication. Apple DTS describes that entitlement as deciding the default
///     for an app installed from scratch; on a device that updated from a build without it, new
///     files may still get the old default. So Complete is also set explicitly:
///   - Explicitly: prepare() gives the directory and every regular file directly inside it
///     Complete protection at every launch, before any web code runs, and every time the app
///     goes to the background (SceneDelegate.sceneDidEnterBackground), which happens when the
///     device locks, before the 10-second grace period ends. A record saved after the last pass
///     on such an updated install has the old default until the next launch or background pass.
/// - Backup: isExcludedFromBackup = true on the directory, and on each file in it. Apple's
///   "Optimizing Your App's Data for iCloud Backup" says marking a directory lets the system
///   exclude the related files inside it, that certain file operations can reset the value
///   (so set it each time a file is saved), and that it is guidance to the system, not a
///   guarantee. The moved-in record is a new file, so the same launch and background pass sets
///   the value on it again.
/// - Nothing here creates the record. A placeholder record made at launch would hide the
///   complete temp file that an interrupted save leaves behind (storage.load() reads the temp
///   file only when cyra-state.json is missing), so a missing record stays missing until the
///   web app's first save.
enum CyraNoCloud {
    static func directory() -> URL? {
        FileManager.default.urls(for: .libraryDirectory, in: .userDomainMask).first?
            .appendingPathComponent("NoCloud", isDirectory: true)
    }

    /// Creates Library/NoCloud if missing, then excludes it and every regular file directly
    /// inside it (the record, cyra-state.json, and a cyra-state.json.tmp left by an interrupted
    /// save) from backup and gives them Complete protection. Never creates, writes or deletes a
    /// file. Safe to call repeatedly.
    static func prepare() {
        guard let directory = directory() else { return }
        let fileManager = FileManager.default
        do {
            // Succeeds without changes when the directory already exists.
            try fileManager.createDirectory(at: directory, withIntermediateDirectories: true, attributes: nil)
        } catch {
            NSLog("[Cyra] Couldn't create Library/NoCloud: %@", error.localizedDescription)
            return
        }
        harden(directory)

        // Every file there now: the record as last moved into place, and any temp file.
        let entries = (try? fileManager.contentsOfDirectory(at: directory,
                                                            includingPropertiesForKeys: [.isRegularFileKey],
                                                            options: [])) ?? []
        for entry in entries where (try? entry.resourceValues(forKeys: [.isRegularFileKey]).isRegularFile) == true {
            harden(entry)
        }
    }

    private static func harden(_ url: URL) {
        var item = url
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        do {
            try item.setResourceValues(values)
        } catch {
            NSLog("[Cyra] Couldn't exclude %@ from backup: %@", item.lastPathComponent, error.localizedDescription)
        }

        // Complete protection. FileAttributeKey.protectionKey is the file-attribute form;
        // Apple's "Encrypting Your App's Files" documents the NSURL fileProtectionKey call for
        // changing an existing item's class. Both are idempotent, and each step is logged
        // separately if it fails.
        do {
            try FileManager.default.setAttributes([.protectionKey: FileProtectionType.complete], ofItemAtPath: item.path)
        } catch {
            NSLog("[Cyra] Couldn't set file protection attribute on %@: %@", item.lastPathComponent, error.localizedDescription)
        }
        do {
            try (item as NSURL).setResourceValue(URLFileProtection.complete, forKey: .fileProtectionKey)
        } catch {
            NSLog("[Cyra] Couldn't set file protection on %@: %@", item.lastPathComponent, error.localizedDescription)
        }

        #if DEBUG
        // Data protection is enforced on devices with a passcode, not in the Simulator.
        let protection = (try? item.resourceValues(forKeys: [.fileProtectionKey]))?.fileProtection
        let excluded = (try? item.resourceValues(forKeys: [.isExcludedFromBackupKey]))?.isExcludedFromBackup
        if protection != .complete || excluded != true {
            NSLog("[Cyra] %@: protection=%@ excludedFromBackup=%@", item.lastPathComponent,
                  protection?.rawValue ?? "unknown", excluded.map { String($0) } ?? "unknown")
        }
        #endif
    }
}
