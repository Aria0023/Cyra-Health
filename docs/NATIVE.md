# Cyra on iPhone and Android

The phone apps are the same web app (`dist/`) running inside a small native shell
built with Capacitor 8. `ios/` is an Xcode project (Swift Package Manager, no
CocoaPods) and `android/` is an Android Studio project. Both use the app id
`com.cyrahealth.app` and the name "Cyra".

What the shell adds:

- **Storage on the phone.** The whole health record is one file,
  `NoCloud/cyra-state.json`: on iPhone in the app's `Library` folder (marked excluded from
  backup, with complete file protection), on Android in the app's private internal `files`
  folder (Capacitor's `Directory.Library`, with Android backup and transfer switched off).
  The file itself is never uploaded. Each save writes `NoCloud/cyra-state.json.tmp` first
  and then moves it into place, so a crash can't leave half a record. While the person
  saves an encrypted backup, an encrypted copy sits in the app's cache until sharing
  finishes (on Android, when the app she chose hands back to Cyra), and is then deleted; if
  Cyra was closed first, it is deleted the next time Cyra opens, and Delete everything or
  Start over also removes it (§7b).
- **Apple Health / Health Connect.** Read on the phone by Cyra's own plugin
  (`CyraHealth`). Cyra never sends it to its server or to anyone else; it is kept only in
  the on-device record (and, encrypted, inside a backup file if the person exports one to
  a place she chooses).
- **Reminders.** Scheduled on the phone as local notifications. No server and no push
  service are involved.
- **Sign-in and connecting Oura or Fitbit/Garmin/Whoop.** These open in a sign-in window
  (iOS: Apple's private sign-in sheet, which shares nothing with Safari; Android: a Custom
  Tab, normally from the default browser, which shares that browser's sign-ins and history)
  and come back to the app through a Cyra link (details below).

The phone app sends Cyra's backend the same things the website does, except reminders,
which never involve the server on the phone: the stage-less read of last week's anonymous
counts, and, only after the person turns them on, the weekly counts, Ask Cyra's AI, Oura,
Fitbit/Garmin/Whoop and sign-in. The README's "Privacy" section lists what each one sends.

All plugin access goes through one file, `src/lib/native.js`. In the web build every
plugin call is skipped (each caller checks `isNative()` first), so no native plugin and no
plugin web fallback is ever used on the website.

---

## 1. What you need

| | Version | Source |
|---|---|---|
| Node.js | 22 or newer | Capacitor 8 requirement; `@capacitor/cli` declares `node >=22` |
| Xcode (Mac only) | 26.0 or newer | Capacitor 8 requirement |
| Android Studio | Otter 2025.2.1 or newer | Capacitor 8 requirement |
| iPhone | iOS 15 or newer | deployment target of `ios/App` |
| Android phone | Android 8.0 (API 26) or newer; Health Connect needs Android 9 or newer | `android/variables.gradle` |

The Capacitor 8 requirements come from the Capacitor 8 upgrade guide
(`ionic-team/capacitor-docs`, `docs/main/updating/8-0.md`).

## 2. Build the web part and copy it into the phone projects

The phone app has no web server of its own, so it has to be told where the Cyra
backend is **when you build it**:

```sh
npm install
export VITE_API_BASE=https://cyra-backend.onrender.com   # or put it in .env.local, which git ignores
npm run cap:sync      # vite build, then copy dist/ and the plugins into ios/ and android/
npm run cap:ios       # the same, then open ios/App/App.xcodeproj in Xcode
npm run cap:android   # the same, then open android/ in Android Studio
```

If `VITE_API_BASE` is missing, the app still works on the phone and makes no request to a
backend at all: every helper in `src/lib/api.js` fails at once without calling `fetch`.
Sign-in shows "Sign-in isn't set up in this version of the app yet — continue with email",
and connecting Oura, Fitbit, Garmin or Whoop shows "This version of the app isn't set up to
connect accounts yet". The anonymous counts say they're "not available in this version of
the app", no weekly counts are sent, and Ask Cyra answers from its on-device library only. Apple Health / Health Connect and
reminders work as usual, because they never use the server.

Also set `VITE_TERMS_URL` and `VITE_PRIVACY_URL` (the published Terms and Privacy Policy)
before a public release. Without them the build still passes, prints a warning, and the
consent step says the documents are still being finalized instead of linking them.

Run `npm run cap:sync` again after any change to `src/`, `capacitor.config.json` or the
Capacitor packages.

## 3. iPhone (Xcode)

1. Run `npm run cap:ios`. Xcode opens `ios/App/App.xcodeproj`. Wait for the Swift
   packages to finish resolving.
2. Select the **App** target, then **Signing & Capabilities**:
   - Under **Team**, pick your Apple Developer team. Leave "Automatically manage
     signing" switched on.
   - **Bundle Identifier** is `com.cyrahealth.app`. If that id isn't available to your
     team, change it here (for example `com.yourcompany.cyra`) and put the same value in
     `appId` in `capacitor.config.json`. The `cyrahealth://` link scheme doesn't depend
     on the bundle id.
3. **HealthKit and Data Protection capabilities.** `ios/App/App/App.entitlements` already
   turns on HealthKit and Data Protection
   (`com.apple.developer.default-data-protection` = `NSFileProtectionComplete`). In the
   same tab you should see **HealthKit** and **Data Protection** listed. If one isn't there,
   click **+ Capability** and add it, then check that `App.entitlements` still says
   `NSFileProtectionComplete`. Apple's documentation for the entitlement says: "To add this
   entitlement to your app, enable the Data Protection capability in Xcode." The entitlement
   and the provisioning profile have to agree, or code signing fails; with automatic
   signing, Xcode normally takes care of both. Leave **Clinical Health Records** and **Background
   Delivery** unticked. Apple's "Setting up HealthKit" guide warns that App Review may
   reject apps that turn on Clinical Health Records without using it.
4. Connect an iPhone and press **Run**. To get real wrist temperature, HRV, resting
   heart rate and sleep data, use an iPhone paired with an Apple Watch. The simulator
   has no watch data.

Already set up in `ios/App/App`: the HealthKit read-permission text
(`NSHealthShareUsageDescription` in `Info.plist`), the `cyrahealth` URL scheme
(`CFBundleURLTypes`), the privacy manifest (`PrivacyInfo.xcprivacy`) and registration
of the `CyraHealth` and `CyraAuth` plugins (`CyraViewController.swift`).

**Where the record lives on iPhone:** `Library/NoCloud/cyra-state.json`. iOS backs up
`Library/` to iCloud by default, so at every launch, and every time the app goes to the
background, the app creates `Library/NoCloud` if needed, marks it and every file in it as
excluded from backup, and gives them complete file protection (`CyraNoCloud` in
`AppDelegate.swift`). Apple calls the backup exclusion guidance to the system, not a
guarantee.

A save writes `cyra-state.json.tmp` and then moves it over `cyra-state.json`. iOS won't
move a file onto an existing one (`FileManager.moveItem`), so `src/lib/storage.js` deletes
the old record first; if the app dies in between, the next launch reads the complete temp
file. So every save leaves a new file in place. The Data Protection entitlement makes
complete protection the default for files the app creates, so on an app installed from
scratch the new file is protected from the moment it exists. Apple's developer support
describes that default as applying to an install from scratch; on a phone that updated from
a build without the entitlement, a record saved since the last launch or background pass
has the system default (complete until first user authentication) until the next pass.
Locking the phone sends the app to the background, which runs that pass.

On an iPhone with a passcode, complete protection means the file can't be read from about
10 seconds after the iPhone locks until it is next unlocked. If Cyra starts in that state,
it shows **"Your record couldn't be opened"** with a **Try again** button instead of the
welcome screen, and saves nothing until the record has been read, so an empty record can
never overwrite the real one. Only a missing file (`OS-PLUG-FILE-0008` from the Filesystem
plugin, for both the record and the temp file) counts as "no record yet". If the file is
damaged and never opens, the person can choose to delete it and start over.

## 4. Android (Android Studio)

1. Run `npm run cap:android`. Android Studio opens `android/`. Let Gradle sync. It
   downloads from Google's Maven repository, so you need a normal internet connection.
2. Connect a phone with USB debugging switched on and press **Run**.
3. **Health Connect.** On Android 14 and newer, Health Connect is part of Android and
   needs no setup. On Android 13 and lower (down to Android 9), install the **Health
   Connect** app from the Play Store first. Source: developer.android.com, "Get started
   with Health Connect". On Android 8.x Cyra installs, but Apple Health / Health Connect
   reports "isn't available on this device".
4. Cyra only asks to **read** resting heart rate, heart-rate variability, sleep and skin
   temperature. Before a Play Store release, the Health Connect permissions
   declaration in Play Console has to list exactly these.
5. **Partial permission.** The person can allow only some of these types. The plugin then
   reports which ones (`requestAuthorization` returns `granted`, `grantedTypes` and
   `requestedTypes`), reads only those, and Cyra says "Cyra can read only some of the health
   data it asked for. You can change this in Health Connect → App permissions → Cyra." Only
   when none is allowed does it say "Cyra wasn't given permission to read health data". The
   plugin asks Health Connect which permissions it holds before every read, because
   developer.android.com says users "can grant or revoke permissions at any time".
6. **Privacy policy link.** Health Connect's privacy link opens Cyra's rationale screen,
   which has to link to the same privacy policy as the Play Console listing. Put that
   published `https://` address in `privacy_policy_url` in
   `android/app/src/main/res/values/strings.xml` (the same address as `VITE_PRIVACY_URL`).
   Until then the link is hidden, and release builds fail on purpose
   (`checkPrivacyPolicyUrl` in `android/app/build.gradle`).

**Where the record lives on Android:** `files/NoCloud/cyra-state.json` in the app's
private internal storage. The Filesystem plugin maps `Directory.Library` to the app's
internal files folder. A save writes `cyra-state.json.tmp` and the Filesystem plugin's
rename deletes the old record and moves the temp file into its place; if the app dies in
between, the next launch reads the temp file. App backup is switched off
(`android:allowBackup="false"`, plus backup and data-extraction rules that exclude
everything), so the file never reaches Google's backup servers or device-to-device transfer.

## 5. How sign-in and connecting a wearable come back to the app

On the web these flows use a redirect (sign-in) or a popup (Oura, Terra). The phone
app does this instead:

1. Cyra makes a new return link for this attempt, with a random attempt id:
   `cyrahealth://auth/<flow>?a=<attempt id>`.
2. Cyra opens the backend's start page in a sign-in window:
   - **iOS:** Cyra's own `CyraAuth` plugin (`ios/App/App/CyraAuthPlugin.swift`), which
     uses Apple's `ASWebAuthenticationSession`. Apple's documentation says it "ensures
     that only the calling app's session receives the authentication callback, even when
     more than one app registers the same callback URL scheme". It runs as an ephemeral
     session, so it shares no cookies or browsing data with Safari.
   - **Android:** a Custom Tab (`@capacitor/browser`), normally from the phone's default
     browser, so it shares that browser's cookies and history. The link comes back through
     the App plugin's `appUrlOpen` event.
3. The person signs in with Apple, Google or Facebook, or approves Oura or the Terra
   widget. Before Oura or the Terra widget opens, Cyra shows what that connection sends
   and waits for **Continue**.
4. The backend sends the window to the return link, with the result after `#`:

   | Flow | Link | Carries |
   |---|---|---|
   | Sign-in | `cyrahealth://auth/oauth?a=<id>#oauth=<code>` or `#oauth_error=…` | one-time code |
   | Oura | `cyrahealth://auth/oura?a=<id>#oura=<code>` or `#oura_error=1` | one-time code |
   | Fitbit / Garmin / Whoop | `cyrahealth://auth/terra?a=<id>#terra=1` or `#terra_error=1` | nothing secret |

5. Cyra only accepts the exact link of the current attempt. On iOS the sign-in sheet
   closes itself. On Android, opening Cyra already replaces the Custom Tab, so the app
   doesn't call close again, because a second close can race the browser shutting itself
   down. Cyra then swaps the code for the result with one call to the backend: for
   sign-in, the provider, the person's name and, only when Apple or Google says it is
   verified, her email (Facebook's email is never passed on); for Oura, the tokens. The
   backend deletes the result at that moment, and a timer deletes it 5 minutes after the
   callback if nobody collects it.

If the person closes the window without finishing, Cyra says so in plain words. If
nothing comes back within 5 minutes, it stops waiting (and on iOS closes the sheet).

### Why each attempt has its own link

Capacitor keeps an `appUrlOpen` link that arrives while nothing is listening and hands
it to the next listener (`retainUntilConsumed` in the App plugin). Without an attempt id,
an old link could finish a new attempt before the browser even opened. That old link
might come from an attempt that timed out, from a late "Open in Cyra?" tap, or from
another app or web page that opens `cyrahealth://auth/terra#terra=1` on purpose. Cyra
ignores every link that doesn't carry the current attempt's id.

The backend accepts only these exact shapes: `<scheme>://auth/oauth` for sign-in and
`/auth/oura` or `/auth/terra` for the matching connect flow, each optionally followed by
`?a=<16 to 64 characters of A-Z, a-z, 0-9, - or _>`, with the scheme written in lowercase.
Any other host, path or query, any `#`, and a scheme in any other case are refused (400).

### Why there's a verifier

Any app on a phone can register the `cyrahealth://` scheme. On Android, or anywhere the
link goes through the system browser, a malicious app that did this could receive the
link and read the one-time code. The Capacitor security guide
(`docs/main/guides/security.md`, "Authentication and Deep Linking") warns about exactly
this and recommends PKCE.

Cyra uses the same idea for its own handoff:

- Before opening the window, the app makes a random secret, the **verifier**. It sends
  only its SHA-256 fingerprint (`app_challenge`) on the start URL.
- The backend seals that fingerprint into its encrypted state (AES-256-GCM, with a key
  derived from `AUTH_SECRET`) and keeps it next to the one-time code.
- `POST /api/oauth/exchange` and `POST /api/integrations/oura/exchange` work on a
  **both or neither** rule:
  - A code made for the app is only redeemed **with** its matching verifier.
  - A code made for the web (no `app_challenge`) is refused when **any** verifier comes
    with it. The app always sends one, so a code someone got from the website can't be
    planted into the app's link to sign the person in as someone else, or to connect
    someone else's Oura ring.
  - A refused attempt gets the same 404 as an unknown code, and the code is used up, so
    nobody can keep guessing.
- The verifier is never saved. It lives in the app's memory for one sign-in or connect
  attempt and is sent once, in the body of the exchange request, to Cyra's backend, which
  checks it and doesn't keep it.
- For sign-in and Oura, an app-link return without an `app_challenge` is refused at the
  start (400), and so is an `app_challenge` on a web return. Terra's start takes no
  challenge (next point).
- Terra's return link carries no code, only `#terra=1`, so an app that intercepts it learns
  nothing it could use, and Terra needs no verifier. The Fitbit/Garmin/Whoop readings wait
  on Cyra's server, held in memory (not encrypted) for up to 7 days, in a mailbox that can
  be opened only with this phone's secret key. A device you restore your encrypted backup
  to gets that key too and can collect them. Collecting empties the mailbox. The app makes a secret mailbox key (32 random
  bytes), keeps it in the on-device record (so it is also inside an encrypted backup), and
  sends it only in request bodies, never in a URL: when the connection starts, and with each
  collect or disconnect request. The backend registers only a one-way hash of the key with
  Terra, as the connection's reference id. Terra adds that reference id to the address it
  sends the window back to, so it can appear in request logs and browser history, but it
  can't open the mailbox: collecting needs the key. (A connection made by the older app
  version used its reference id as its secret, so that one can still be ended, never read,
  with it.)
- Web flows don't send `app_challenge` and work as before.

## 6. Server settings (Render → cyra-backend → Environment)

| Variable | Value | Why |
|---|---|---|
| `CORS_ORIGIN` | `https://cyra-health.onrender.com,capacitor://localhost,https://localhost` | Lets the website, the iOS app and the Android app call the backend. Already in `render.yaml`. |
| `APP_RETURN_SCHEMES` | `cyrahealth` | The app link scheme the backend may send people back to. This is also the default when unset. Already in `render.yaml`. |
| `NODE_ENV` | `production` | With no return allowlist, web sign-in/connect returns are refused instead of allowed for any site. Already in `render.yaml`. |
| `RETURN_ORIGINS` | usually unset | Optional. The web origins a sign-in/connect flow may return to. Unset means the `http(s)` entries of `CORS_ORIGIN`. |
| `ADMIN_KEY` | a long random string | Required in production: the server refuses to start without a real value. |
| `AUTH_SECRET` | a different long random string | Required in production. Seals (encrypts and authenticates) the sign-in/connect state, including the app challenge. |
| `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` | from Apple | Sign in with Apple |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | from Google | Google sign-in |
| `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` | from Meta | Facebook sign-in |
| `OURA_CLIENT_ID`, `OURA_CLIENT_SECRET` | from Oura | Oura |
| `TERRA_DEV_ID`, `TERRA_API_KEY`, `TERRA_SIGNING_SECRET` | from Terra | Fitbit / Garmin / Whoop |

Paste the secret values in the Render dashboard, never into the repo. `.env.example`
lists every variable.

About the two native origins: Capacitor serves the iOS app from
`capacitor://localhost` and the Android app from `https://localhost`. These are
Capacitor's defaults, and they're pinned in `capacitor.config.json` (`server`) so they
can't drift away from `CORS_ORIGIN`. `backend/server.js` compares the request's
`Origin` header with each `CORS_ORIGIN` entry exactly, so the strings above have to
match character for character.

`https://localhost` (and `http://localhost`) are only allowed to **call** the backend.
They are never accepted as a web sign-in or connect return, even though they're in
`CORS_ORIGIN`, because on a computer they could be any local program
(`backend/src/modules/oauth/returns.js`).

`javascript:`, `data:`, `file:`, `intent:` and other dangerous schemes can never be
enabled through `APP_RETURN_SCHEMES` (see `backend/src/modules/oauth/returns.js`).

Nothing changes in the Apple, Google, Facebook or Oura developer consoles. Their
redirect URL is still the backend
(`<backend>/api/oauth/<provider>/callback`, `<backend>/api/integrations/oura/callback`).
Only the backend sends people on to `cyrahealth://`.

The phone app doesn't need `VAPID_*`. Those keys are only for browser push reminders.

**Capacitor's bridge logging is off.** `capacitor.config.json` sets
`"loggingBehavior": "none"`, so the bridge doesn't write plugin calls or their data to the
Xcode console or logcat. Cyra's own native code still writes a few diagnostic lines (file
names, file-protection status and error descriptions on iOS; exception class names on
Android), never health values. Capacitor's default (`debug`) turns bridge logging on in
debug builds. On Android it writes every plugin call's options to logcat, which includes
the whole health record passed to `Filesystem.writeFile`, and call results can follow
through the forwarded web console. On iOS it prints each call's plugin and method plus the
first 256 characters of every result to the Xcode console, for example the start of the
record from `Filesystem.readFile` and of the `CyraHealth.readDaily` rows. If you need bridge
logs to debug something, switch it to `"debug"` locally, use test data only, and don't
commit the change.

## 7. Reminders on the phone

Reminders are off until the person turns them on. They are local notifications: one
weekly-repeating notification per chosen weekday, at the chosen time, with a generic text
("Time for your 30-second check-in."). Turning reminders off, choosing "When I feel like
it" or "Never remind me", Delete everything and Start over each cancel every pending
notification, whether or not reminders were on (Cyra cancels its own reminder ids as well
as everything the plugin reports as pending). They are scheduled as **inexact** on Android
(`isExactNotification: false`). A gentle check-in can arrive a few minutes late, and
asking for exact alarms would make Android 12+ open the "Alarms & reminders" settings
screen. Android 14 denies that permission by default to apps that aren't alarm-clock or
calendar apps (developer.android.com, "Schedule exact alarms are denied by default").

On Android, `allowWhileIdle` lets the **first** alarm for each weekday fire while the
phone is in Doze. After a reminder fires, `@capacitor/local-notifications` 8.3.1 sets up
the next week's alarm without that option (`TimedNotificationPublisher.kt` uses
`AlarmManager.set`). So in later weeks Doze can delay a reminder until Cyra is next
opened, and Cyra schedules all reminders again every time it opens.

## 7b. Backups on the phone

The phone app offers **Encrypted backup** through the system share sheet: the file is
encrypted on the device, written briefly to the app cache, handed to the share sheet, and
the cache copy is deleted afterwards. In detail: the record is encrypted with a key derived
from the person's passphrase (PBKDF2-SHA256, 600,000 rounds, AES-256-GCM), written as
`cyra-backup-<date>.cyra.json` to the app's cache (`Directory.Cache`), and handed to the
share sheet (`@capacitor/share`, installed), so the person chooses where it goes (Files,
iCloud Drive, Google Drive, AirDrop, Mail…). The cache copy is deleted when sharing
finishes (on iPhone when the sheet or the chosen action closes; on Android when the chosen
app returns to Cyra), also when she cancels or sharing fails, and if the app was closed
before that, Cyra deletes the leftover copy the next time it opens, whether or not the
record can be read then (Delete everything and Start over remove it too). The button reads
"Save encrypted backup…" on the phone, also after a save to the phone failed. The file's
contents are unreadable without the passphrase (its name shows the date it was made), and
Cyra never receives it.

The web version saves the backup as a browser download instead. Neither Capacitor web view
saves downloads (iOS has no download handling in Capacitor; Android has no
`DownloadListener`), which is why the phone uses the share sheet. **Restore** opens a backup
made on the web or on a phone. The delete warning says, on every platform, that the log
can't be recovered unless the person saved a backup.

App Review Guideline 5.1.3(ii): apps "may not store personal health information in
iCloud". So the person has to choose where the file goes, and the app must never write it
into an iCloud-synced folder on its own. It doesn't: it only writes to its own cache.

## 8. What has and hasn't been verified

The phone code was written against the official documentation and the installed
Capacitor sources. **Nothing has been built with Xcode or Gradle, or run on a phone.** The
authoring environment had no Xcode, no Android SDK, and no access to Google's Maven
repository.

**Checked without a phone:**

- `Info.plist`, `App.entitlements` and `PrivacyInfo.xcprivacy` parse as property lists
  (Python `plistlib`), and the Android manifest and resource XML files parse (Python
  `xml.etree`).
- The Swift files pass a tree-sitter Swift syntax check. That is a parse, not a compile:
  no type checking.
- `CyraHealthPlugin.kt` and `HealthPermissionsRationaleActivity.kt` compile with the
  Kotlin 2.3.21 compiler against hand-written stubs of the Android, Health Connect and
  Capacitor APIs they use, not against the real libraries. The permission result
  (`granted`, `grantedTypes`, `requestedTypes`) was run on the JVM for full, partial and no
  grants.
- Backend smoke tests (`npm run smoke:oauth`, `npm run smoke:integrations` in
  `backend/`) pass, covering:
  - `cyrahealth://auth/<flow>?a=<id>` returns, and refusal of every other shape (other
    host, path, query, `#`, upper-case scheme, opaque `cyrahealth:auth/…`, the wrong flow
    for the endpoint)
  - right, wrong and missing verifiers
  - the both-or-neither rule (a web code plus any verifier gives 404 and is used up)
  - refused schemes (`evil://`, `javascript:`, `data:`, `file:`, `intent:`)
  - `https://localhost` and `http://localhost` refused as web returns, `RETURN_ORIGINS`,
    and `NODE_ENV=production` refusing web returns when there's no allowlist
  - `APP_RETURN_SCHEMES` overrides
  - an uncollected sign-in hand-off deleted by its timer
  - the Terra mailbox: opened only with the key, in a `POST` body; the reference id Terra
    sees is the hash of the key and can't open it; the finish page never repeats Terra's
    query; disconnect needs the key
  - the web flows
- Plugin options and error codes were checked against the installed type definitions
  and native sources: `@capacitor/local-notifications` 8.3.1,
  `@capacitor/filesystem` 8.1.4 (plus `ion-ios-filesystem`, whose rename refuses an
  existing destination, and `ionfilesystem-android` 1.1.1, whose rename deletes the
  destination first; both raise "not found" for a missing file), `@capacitor/browser`
  8.0.5, `@capacitor/app` 8.1.2.

**Not verified (needs a real device):**

- That the Swift and Kotlin code compiles, including `CyraAuthPlugin`, and that
  HealthKit / Health Connect return real data, including a partial Health Connect grant.
- That the Data Protection entitlement signs with your provisioning profile, and that a
  record saved on an installed-from-scratch iPhone really has complete protection
  (`FileProtectionType.complete`) from the first save.
- That `Library/NoCloud` is really left out of an iCloud backup, and that Android backup
  contains nothing.
- That a locked iPhone really reports a read error other than `OS-PLUG-FILE-0008`. The
  iOS library checks `fileExists` first, and that check works while the phone is locked,
  so it should report `operationFailed` (`0013`) instead.
- How each window hands the `cyrahealth://` link back:
  - On iOS, whether `ASWebAuthenticationSession` catches the backend's 302 to
    `cyrahealth://…` and the Oura/Terra page's script redirect. The finish page also has
    a "Return to Cyra" link to tap.
  - Custom Tabs may need a tap if a redirect is blocked.
- The Android choice not to call `Browser.close()` after the link arrives.
- Notification timing on a real phone.
- **If the phone closes Cyra while the window is open** (rare, low memory), the
  verifier only lived in memory, so the person has to start sign-in or connecting again.
  For Fitbit/Garmin/Whoop, the mailbox key is saved before the window opens, so **Sync**
  can still collect the readings once the connection finishes.
