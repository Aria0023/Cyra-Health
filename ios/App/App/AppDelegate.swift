import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Runs before any scene (and so before the web view) exists: the health record's
        // directory is excluded from backup and protected before the app can read or write it,
        // and the record file is created with Complete protection if it doesn't exist yet.
        CyraNoCloud.prepare(createRecord: true)
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

/// Library/NoCloud is where Cyra's whole health record lives on iPhone and iPad. The web app writes
/// it with the Filesystem plugin as Directory.Library + "NoCloud/cyra-state.json".
///
/// Why this exists: Library/ is included in iCloud Backup (and in Finder/iTunes backups) by
/// default. The health record must never reach a server, iCloud included; App Review
/// Guideline 5.1.3(ii) also says apps "may not store personal health information in iCloud".
/// The only backup Cyra offers is the encrypted file whose key the user alone holds.
///
/// - Backup: isExcludedFromBackup = true on the directory, and on each file in it. Apple
///   calls this guidance to the system, not a guarantee, and says some file operations can
///   reset it, so it is re-applied at every launch and every time the app goes to the
///   background (SceneDelegate.sceneDidEnterBackground).
/// - Encryption: Complete data protection. The files can be read only while the device is
///   unlocked; about 10 seconds after locking, reads and writes fail until the next unlock. The
///   web app touches the record only in the foreground, and must treat a failed read as
///   "unavailable", never as "empty". CyraViewController reloads the page after the next
///   unlock if it was loaded while the device was locked.
/// - New files: Apple documents that a file created without a protection level gets the
///   default class (Complete until first user authentication); inheriting the directory's
///   class is not documented. The Filesystem plugin writes the record with
///   String.write(to:atomically: false) (ion-ios-filesystem saveFile), which sets no class
///   and writes into the existing file rather than replacing it. So at launch, before any
///   web code runs, the record file is created with Complete protection when it is missing,
///   holding "null" (what the web app reads as "no record yet"); the first real save then
///   writes into that file. The background pass re-applies Complete in any case.
enum CyraNoCloud {
    static func directory() -> URL? {
        FileManager.default.urls(for: .libraryDirectory, in: .userDomainMask).first?
            .appendingPathComponent("NoCloud", isDirectory: true)
    }

    /// The record file the web app reads and writes (storage.js FILE.path).
    static let recordName = "cyra-state.json"

    /// Creates Library/NoCloud if missing, then excludes it and the files directly inside it
    /// from backup and gives them Complete protection. Safe to call repeatedly.
    ///
    /// createRecord: also create the record file (with Complete protection) when it is
    /// missing. Pass true only at launch, before the web view exists: later, the web app
    /// may be writing the file at the same moment, and createFile would overwrite it.
    static func prepare(createRecord: Bool = false) {
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

        if createRecord {
            let record = directory.appendingPathComponent(recordName, isDirectory: false)
            if !fileManager.fileExists(atPath: record.path) {
                // May fail if the device is locked at launch. Then the web app's first save
                // creates the file and the next background pass (SceneDelegate) hardens it.
                if !fileManager.createFile(atPath: record.path,
                                           contents: Data("null".utf8),
                                           attributes: [.protectionKey: FileProtectionType.complete]) {
                    NSLog("[Cyra] Couldn't create the record file with Complete protection")
                }
            }
        }

        // Also cover files written before this ran, or written without picking up the
        // directory's settings.
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
