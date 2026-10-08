# Cyra on iPhone and Android

The phone apps are the same web app (`dist/`) running inside a small native shell
built with Capacitor 8. `ios/` is an Xcode project (Swift Package Manager, no
CocoaPods) and `android/` is an Android Studio project. Both use the app id
`com.cyrahealth.app` and the name "Cyra".

What the shell adds:

- **Storage on the phone.** The whole health record is one file,
  `NoCloud/cyra-state.json`, inside the app's Library folder. Nothing is uploaded.
- **Apple Health / Health Connect.** Read on the phone by Cyra's own plugin
  (`CyraHealth`). Nothing is uploaded.
- **Reminders.** Scheduled on the phone as local notifications. No server and no push
  service are involved.
- **Sign-in and connecting Oura or Fitbit/Garmin/Whoop.** These open in a sign-in
  window (iOS: Apple's secure sign-in sheet; Android: a Chrome Custom Tab) and come back
  to the app through a Cyra link (details below).

All plugin access goes through one file, `src/lib/native.js`. In the web build
(Render static site) none of it runs, so the website behaves exactly as before.

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

If `VITE_API_BASE` is missing, the app still works on the phone, but sign-in and
connecting Oura, Fitbit, Garmin or Whoop show a plain "isn't set up in this version
of the app yet" message. The app never tries to reach a server that doesn't exist.

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
3. **HealthKit capability.** `ios/App/App/App.entitlements` already turns HealthKit on.
   In the same tab you should see **HealthKit** listed. If it isn't there, click
   **+ Capability** and add **HealthKit**. Leave **Clinical Health Records** and
   **Background Delivery** unticked. Apple's "Setting up HealthKit" guide warns that App
   Review may reject apps that turn on Clinical Health Records without using it.
4. Connect an iPhone and press **Run**. To get real wrist temperature, HRV, resting
   heart rate and sleep data, use an iPhone paired with an Apple Watch. The simulator
   has no watch data.

Already set up in `ios/App/App`: the HealthKit read-permission text
(`NSHealthShareUsageDescription` in `Info.plist`), the `cyrahealth` URL scheme
(`CFBundleURLTypes`), the privacy manifest (`PrivacyInfo.xcprivacy`) and registration
of the `CyraHealth` and `CyraAuth` plugins (`CyraViewController.swift`).

**Where the record lives on iPhone:** `Library/NoCloud/cyra-state.json`. iOS backs up
`Library/` to iCloud by default, so at every launch the app creates `Library/NoCloud`,
marks it (and the files in it) as excluded from backup, and gives it complete file
protection (`CyraNoCloud` in `AppDelegate.swift`).

Complete protection means the file can't be read while the iPhone is locked. If Cyra
starts in that state, it shows **"Your record couldn't be opened"** with a **Try again**
button instead of the welcome screen, and saves nothing until the record has been read,
so an empty record can never overwrite the real one. Only a missing file
(`OS-PLUG-FILE-0008` from the Filesystem plugin) counts as "no record yet". If the file
is damaged and never opens, the person can choose to delete it and start over.

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

**Where the record lives on Android:** `files/NoCloud/cyra-state.json` in the app's
private internal storage. The Filesystem plugin maps `Directory.Library` to the app's
internal files folder. App backup is switched off (`android:allowBackup="false"`, plus
backup and data-extraction rules that exclude everything), so the file never reaches
Google's backup servers or device-to-device transfer.

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
   - **Android:** a Chrome Custom Tab (`@capacitor/browser`). The link comes back
     through the App plugin's `appUrlOpen` event.
3. The person signs in with Apple, Google or Facebook, or approves Oura or the Terra
   widget.
4. The backend sends the window to the return link, with the result after `#`:

   | Flow | Link | Carries |
   |---|---|---|
   | Sign-in | `cyrahealth://auth/oauth?a=<id>#oauth=<code>` or `#oauth_error=…` | one-time code |
   | Oura | `cyrahealth://auth/oura?a=<id>#oura=<code>` or `#oura_error=1` | one-time code |
   | Fitbit / Garmin / Whoop | `cyrahealth://auth/terra?a=<id>#terra=1` or `#terra_error=1` | nothing secret |

5. Cyra only accepts the exact link of the current attempt. On iOS the sign-in sheet
   closes itself. On Android, opening Cyra already replaces the Custom Tab, so the app
   doesn't call close again, because a second close can race the browser shutting itself
   down. Cyra then swaps the code for the result (verified email, or Oura tokens) with one
   call to the backend.

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
`?a=<16 to 64 characters of A-Z, a-z, 0-9, - or _>`. Any other host, path, query or form
is refused.

### Why there's a verifier

Any app on a phone can register the `cyrahealth://` scheme. On Android, or anywhere the
link goes through the system browser, a malicious app that did this could receive the
link and read the one-time code. The Capacitor security guide
(`docs/main/guides/security.md`, "Authentication and Deep Linking") warns about exactly
this and recommends PKCE.

Cyra uses the same idea for its own handoff:

- Before opening the window, the app makes a random secret, the **verifier**. It sends
  only its SHA-256 fingerprint (`app_challenge`) on the start URL.
- The backend seals that fingerprint into its signed state and keeps it next to the
  one-time code.
- `POST /api/oauth/exchange` and `POST /api/integrations/oura/exchange` work on a
  **both or neither** rule:
  - A code made for the app is only redeemed **with** its matching verifier.
  - A code made for the web (no `app_challenge`) is refused when **any** verifier comes
    with it. The app always sends one, so a code someone got from the website can't be
    planted into the app's link to sign the person in as someone else, or to connect
    someone else's Oura ring.
  - A refused attempt gets the same 404 as an unknown code, and the code is used up, so
    nobody can keep guessing.
- The verifier exists only in the app's memory, for that single request.
- An app-link return without an `app_challenge` is refused at the start (400). So is an
  `app_challenge` on a web return.
- Terra's link carries no code. The data is collected later under an id that never
  leaves the phone except in the body of the collect request, so Terra needs no verifier.
- Web flows don't send `app_challenge` and work as before.

## 6. Server settings (Render → cyra-backend → Environment)

| Variable | Value | Why |
|---|---|---|
| `CORS_ORIGIN` | `https://cyra-health.onrender.com,capacitor://localhost,https://localhost` | Lets the website, the iOS app and the Android app call the backend. Already in `render.yaml`. |
| `APP_RETURN_SCHEMES` | `cyrahealth` | The app link scheme the backend may send people back to. This is also the default when unset. Already in `render.yaml`. |
| `NODE_ENV` | `production` | With no return allowlist, web sign-in/connect returns are refused instead of allowed for any site. Already in `render.yaml`. |
| `RETURN_ORIGINS` | usually unset | Optional. The web origins a sign-in/connect flow may return to. Unset means the `http(s)` entries of `CORS_ORIGIN`. |
| `AUTH_SECRET` | a long random string | Signs the sign-in/connect state, including the app challenge. |
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

**Native logging is off.** `capacitor.config.json` sets `"loggingBehavior": "none"`.
Capacitor's default (`debug`) prints every plugin call's options and results to the Xcode
console and to logcat in debug builds. That would include the whole health record
(`Filesystem.writeFile`) and the `CyraHealth.readDaily` rows. If you need bridge logs to
debug something, switch it to `"debug"` locally, use test data only, and don't commit
the change.

## 7. Reminders on the phone

Reminders are local notifications. One weekly-repeating notification per chosen
weekday, at the chosen time, with a generic text ("Time for your 30-second check-in.").
"Never remind me" cancels all of them. They are scheduled as **inexact** on Android
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

The phone app doesn't offer **Encrypted backup** yet. The web version saves the backup
as a browser download, and neither Capacitor web view saves downloads: iOS has no
download handling in Capacitor, and Android has no `DownloadListener`. So the button is
hidden in the phone app. The settings say so, and the delete warning no longer mentions
a backup. **Restore** still works: it opens a backup file made on the web.

Adding backups to the phone app later means writing the encrypted file with
`Filesystem` and handing it to a share sheet (for example `@capacitor/share`, which isn't
installed). Keep in mind App Review Guideline 5.1.3(ii): apps "may not store personal
health information in iCloud". So the person has to choose where the file goes, and the
app must never write it into an iCloud-synced folder on its own.

## 8. What has and hasn't been verified

The phone code was written against the official documentation and the installed
Capacitor sources. **It has not been compiled or run on a phone in the authoring
environment**, which had no Xcode, no Android SDK, and no access to Google's Maven
repository.

**Checked:**

- `npm run build` passes and the build shows `BUILD 2026.10.07-D`.
- ESLint reports no errors.
- Backend smoke tests (`npm run smoke:oauth`, `npm run smoke:integrations` in
  `backend/`) pass, covering:
  - `cyrahealth://auth/<flow>?a=<id>` returns, and refusal of every other shape (other
    host, path, query, opaque `cyrahealth:auth/…`, the wrong flow for the endpoint)
  - right, wrong and missing verifiers
  - the both-or-neither rule (a web code plus any verifier gives 404 and is used up)
  - refused schemes (`evil://`, `javascript:`, `data:`, `file:`, `intent:`)
  - `https://localhost` and `http://localhost` refused as web returns, `RETURN_ORIGINS`,
    and `NODE_ENV=production` refusing web returns when there's no allowlist
  - `APP_RETURN_SCHEMES` overrides
  - the Terra mailbox emptied with `POST` only
  - the web flows
- A browser test ran the production bundle with the iOS Capacitor bridge emulated the
  way `@capacitor/core` expects it. It confirmed:
  - the record is written and read through Filesystem at Library +
    `NoCloud/cyra-state.json`, and IndexedDB is never opened
  - an unreadable record (error `OS-PLUG-FILE-0013`) shows "Your record couldn't be
    opened", nothing is written or deleted, and **Try again** opens it once it's readable
  - reminders are scheduled through LocalNotifications
  - `CyraHealth.readDaily` imports wearable days and is asked for local calendar days
    (checked at UTC+14)
  - sign-in through `CyraAuth.open({ url, ephemeral: true })` when the plugin is
    present, and through the system browser plus `appUrlOpen` when it isn't (the
    Android path). Each sends a per-attempt `cyrahealth://auth/oauth?a=…` return and an
    `app_challenge`, finishes only on that attempt's link, ignores stale or foreign
    links, and sends the matching verifier
  - Oura and Terra work the same way, and the Terra mailbox is collected with `POST`
  - closing or cancelling the window gives a plain message
  - the phone build hides Encrypted backup
- In the web build, Capacitor stays inactive, the record stays in IndexedDB, Encrypted
  backup is still offered, and an axe-core audit of 22 screens finds no violations. The
  phone-only "record couldn't be opened" screen also has no axe violations, and every
  button on it is at least 44px tall.
- Plugin options and error codes were checked against the installed type definitions
  and native sources: `@capacitor/local-notifications` 8.3.1,
  `@capacitor/filesystem` 8.1.4 (plus `ion-ios-filesystem` and
  `ionfilesystem-android` 1.1.1, which raise "not found" for a missing file),
  `@capacitor/browser` 8.0.5, `@capacitor/app` 8.1.2.

**Not verified (needs a real device):**

- That the Swift and Kotlin code compiles, including `CyraAuthPlugin`, and that
  HealthKit / Health Connect return real data.
- That `Library/NoCloud` is really left out of an iCloud backup, and that Android backup
  contains nothing.
- That a locked iPhone really reports a read error other than `OS-PLUG-FILE-0008`. The
  iOS library checks `fileExists` first, and that check works while the phone is locked,
  so it should report `operationFailed` (`0013`) instead.
- How each window hands the `cyrahealth://` link back:
  - On iOS, whether `ASWebAuthenticationSession` catches the backend's 302 to
    `cyrahealth://…` and the Oura/Terra page's script redirect. The finish page also has
    a "Return to Cyra" link to tap.
  - Chrome Custom Tabs may need a tap if a redirect is blocked.
- The Android choice not to call `Browser.close()` after the link arrives.
- Notification timing on a real phone.
- **If the phone closes Cyra while the window is open** (rare, low memory), the
  verifier only lived in memory, so the person has to start sign-in or connecting again.
