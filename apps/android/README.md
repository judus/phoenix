# PHOENIX for Android — experimental shell

This app opens the PHOENIX interface served by your gaming computer. It does not run the
server, read Elite journals or bundle a second frontend. Your computer must be running PHOENIX,
and both devices must be able to reach it over your network.

## Try it

Requires Android 11 or newer and an up-to-date Android System WebView.

1. Install the local debug APK (allow installation from your file manager when Android asks).
2. Open **Settings → Pairing** in PHOENIX on your computer. In the Android app, tap **Scan QR code**
   and allow camera access. Scanning stays on-device; it needs no other scanner app or Google account.
3. Check the detected server address, then tap **Connect**. The app pairs and opens PHOENIX directly,
   without a second browser authorization form.

Choose **Manual** if you prefer not to use the camera. Enter the **tablet access address** shown
on your computer (including `http://` and the port) and its pairing code. Do not use `localhost`
on your tablet. A copied PHOENIX `/#pair=…` link also works in the address field. Missing camera
hardware or denied permission switches to manual entry automatically. A cancelled scan returns
to the connection card without connecting.

The server address, WebView preferences and pairing cookie survive app restarts. The pairing
code itself is not saved by the shell. Uninstalling/clearing app data or revoking the paired device
requires pairing again. The debug app has a separate application ID from future release builds;
it will not share their pairing sessions.

The interface runs fullscreen and keeps the screen awake while it is visible. Swipe inward from
a system edge to reveal Android's navigation controls. The web rail hides F11 only in this app
(identified by its `PhoenixAndroid/…` user-agent marker); browsers keep it. F13 focus view remains.
Android Back navigates page history; at the first page it returns to the connection screen,
where you can edit the address or resume.
Another Back from the connection screen closes the app. A failed top-level page load returns
there with an error; Connect retries. There is no background reconnection service.

External HTTP(S) links and downloads open in your browser. Other URL schemes are blocked.
The shell does not intercept PHOENIX's workspace swipes, map gestures or deck editing.

## Build locally

From the repository root, build, install and open the debug app with:

```sh
npm run android:install
```

The helper uses the only ready ADB device, or asks you to choose when several are connected.
With none connected, it offers wireless pairing or connection to an already paired tablet.
Use Android's pairing popup address/code to **pair**, then the address/port on the main Wireless
debugging screen to **connect** if automatic discovery did not connect it. These ports differ.
The ADB code is entered directly into adb, never saved or passed as a command-line argument.
This developer setup is separate from the PHOENIX QR/code shown by your gaming computer.

Optional: `npm run android:install -- --serial DEVICE_SERIAL` targets a specific connected device;
`--no-build` installs the existing debug APK. Reinstallation uses `-r`, preserving app data.
The helper never uninstalls, clears data, bypasses signature checks or changes desktop release jobs.
Enable USB or Wireless debugging yourself; the helper does not change device security settings.

Install JDK 17 or 21, Android SDK Platform 36 and Build Tools 35.0.0. Configure `ANDROID_HOME`
or an ignored `local.properties` with `sdk.dir=/path/to/Android/Sdk`. Android Studio can also
open this directory directly. No Android SDK is needed for normal PHOENIX development.

```sh
cd apps/android
./gradlew testDebugUnitTest lintDebug assembleDebug
```

On Windows use `gradlew.bat`. The wrapper pins Gradle 8.14.3 with the official distribution
SHA-256; Android Gradle Plugin is pinned to 8.11.0. The first build downloads dependencies.
Version name/code derive from the root `package.json`, not a second hand-maintained version.

APK: `app/build/outputs/apk/debug/app-debug.apk`. It is signed with your local Android debug
key and is **for review/testing, not a published release**. Install on a chosen emulator/device:

```sh
adb -s DEVICE_SERIAL install -r app/build/outputs/apk/debug/app-debug.apk
```

`assembleRelease` produces an **unsigned** APK. Signing-key ownership, release APK publication
and GitHub release integration remain a separate review checkpoint. No key is stored in this repo,
and existing desktop CI/release jobs are unchanged. Keep future APK publishing on explicit release
builds rather than rebuilding installers on every `dev` merge.

## Security and limits

- Only the configured origin stays inside the WebView. No JavaScript-to-native bridge, file/content
  access, third-party cookies or certificate-error bypass is enabled. Web debugging is debug-only.
- HTTP is deliberately allowed for PHOENIX's LAN server. Use a trusted network: HTTP does not
  encrypt the pairing code, cookie or subsequent traffic. HTTPS works with a certificate trusted
  by Android; self-signed certificate errors are not bypassed.
- Pairing/session storage is device-local and excluded from backup/device transfer.
- Camera permission is requested only when you tap Scan. Camera hardware is optional; images
  are decoded locally with ZXing and are not saved or uploaded. No microphone, file-picker or
  location permission is requested. Copilot text chat works
  through the existing frontend; microphone/voice support is not claimed. LAN HTTP lacks the secure
  context required by browser microphone APIs, and native permission handling needs separate work.
- Discovery, offline storage and automatic connection recovery are not included. A changed
  computer address can be entered or scanned on the connection screen. Revoked sessions return
  there for pairing again. Pairing uses the existing server API and WebView's cookie store;
  the native app does not introduce another authentication system.

Revoking this device on the computer returns the app to its QR/manual card on the next protected
API request, or within five seconds while idle. Returning to a visible page also rechecks the
session. The old web page and its streams are discarded, and Return to PHOENIX stays unavailable
until paired again. Ordinary network failures and incorrect pairing codes do not count as revocation.

The wrapper uses AndroidX Activity 1.10.1 for lifecycle, Back and permission/results handling,
and ZXing Android Embedded 4.3.0 (ZXing Core 3.4.1) for offline scanning. Their Apache-2.0
licence and attribution notices are bundled in the APK's `assets/licenses/` directory.
JUnit, JSON-Java and MockWebServer are test-only and are not shipped in the APK.

## Acceptance before shipping

- Pair from a real tablet over LAN, then force-stop/reopen; verify no second code is needed.
- Scan a real PHOENIX QR code; verify the detected address, Connect, cancellation and invalid QR feedback.
- Deny camera access and verify manual URL/code pairing, invalid-code feedback and keyboard submission.
- Revoke the tablet from the computer while it is idle and while changing pages; verify automatic
  return to the native card and successful re-pairing without restarting the app.
- Verify both themes, portrait/landscape, soft keyboard, fullscreen and Android Back/gesture Back.
- Exercise actual desk/workspace swipes, map pan/pinch and deck editing without native interception.
- Open an external link (including a new-tab link), return, and verify PHOENIX's session is intact.
- Check server-unavailable feedback, retry and changing servers without crossing Back history.
- Verify keep-awake only while the interface is visible, and no player data is included in backups.
- Test the eventual signed APK on target Android versions before adding it to releases.

References: [Android WebView](https://developer.android.com/develop/ui/views/layout/webapps/webview),
[AGP 8.11 compatibility](https://developer.android.com/build/releases/agp-8-11-0-release-notes),
[Android backup rules](https://developer.android.com/identity/data/autobackup#xml-syntax-android-12).
