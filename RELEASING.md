# Releasing the Android TV app

The shipped app is **`capacitor_app/`** — a Capacitor shell that bundles the
built `react_vite/` web app into an APK. `flutter_app/` is the previous
generation and is not what gets released; nothing here touches it except the
signing key, which still lives in its directory.

The landing page at `/about` links to
`https://github.com/onestorefoundations-wq/azan-times/releases/latest`, so
publishing a GitHub Release is what makes a new APK downloadable. The page reads
the release over the GitHub API at runtime — tag name, the first asset whose
name ends in `.apk`, and that asset's size — so it needs no edit when you
publish. The only contract is that the asset is named `*.apk`.

## Prerequisites

`java` is not on PATH on the build machine. Point `JAVA_HOME` at the JDK bundled
with Android Studio before any Gradle command:

```bash
JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
```

The Android SDK location comes from `capacitor_app/android/local.properties`
(`sdk.dir`), which is machine-local and not in git.

## One time: signing

Android identifies an app by its signing key. If a later release is signed with
a different key, every device that already has the app **refuses the update** —
people have to uninstall first and lose their settings. So the key is created
once and kept forever.

The key already exists: `flutter_app/android/masjid-release.jks`, alias
`masjid`, with the passwords in `flutter_app/android/key.properties`. Both are
git-ignored, and so is `capacitor_app/android/keystore.properties`. **Back the
`.jks` file up somewhere you will still have it in five years**, along with the
passwords. There is no recovery.

Do not put the keystore or the passwords in this repo, in an issue, or in a chat
message.

To sign the Capacitor build with it, copy the example and fill in the two
passwords:

```bash
cd capacitor_app/android
cp keystore.properties.example keystore.properties
```

The example already points `storeFile` at the existing key. Reuse it only if
this shell is meant to replace the Flutter app's identity — it is, since both
build `com.pro26.masjid_display`.

### The current field state

Releases up to and including **v1.0.1 are signed with the Android debug key**
(`CN=Android Debug`), because they were built with `assembleDebug` and no
`keystore.properties` was present. They install and update among themselves, but
a debug-signed APK is trivially re-signable by anyone and must not be what the
project ships long-term.

Moving to the real key is a one-way door for anyone who already installed a
debug-signed build: the signature will not match and they must uninstall first.
The number of devices that affects only grows, so do it at the next release
rather than later.

## Each release

Bump the version first. `versionCode` and `versionName` live in
`capacitor_app/android/app/build.gradle`:

```gradle
versionCode 3
versionName "1.0.2"
```

Android refuses to install an APK whose `versionCode` is not higher than the
installed one, and the failure is a bare "App not installed" with no
explanation. Bump it on **every** published release.

Then build, from `capacitor_app/`:

```bash
npm run apk:release
```

That runs the web build with `VITE_NATIVE=1` (which skips service-worker
registration — a kiosk must not be able to pin itself to a stale cached shell),
syncs `react_vite/dist` into the Android project, and runs `assembleRelease`.

Output: `capacitor_app/android/app/build/outputs/apk/release/app-release.apk`

If `keystore.properties` is absent the release build produces
`app-release-unsigned.apk` instead, which no device will install. That is the
signal that signing is not configured — do not work around it by publishing an
`assembleDebug` build.

## Checks before publishing

Confirm it is signed with the real key, not the debug key:

```bash
"$ANDROID_HOME/build-tools/37.0.0/apksigner.bat" verify --print-certs app-release.apk
```

The certificate DN should be what you entered at `keytool -genkey` time, **not**
`CN=Android Debug`.

Then confirm the Android TV metadata survived:

```bash
"$ANDROID_HOME/build-tools/37.0.0/aapt2.exe" dump badging app-release.apk
```

- `sdkVersion:'24'` — the Android 7.0 floor the landing page advertises
- an `application: ... banner=` — without a banner the app installs but never
  appears in the Android TV launcher
- a `leanback-launchable-activity`
- `uses-feature-not-required: name='android.hardware.touchscreen'`

Build a **universal** APK. Do not split per ABI for the download link: it emits
one file per architecture, and someone sideloading the wrong one gets an install
failure with no useful message.

## Publishing

Tag `v<version>` and attach the APK under a name ending in `.apk`:

The asset keeps the filename it is uploaded under — `gh`'s `path#label` syntax
sets a display label, not the name — so rename the copy first:

```bash
cp android/app/build/outputs/apk/release/app-release.apk masjid-display-v1.0.2.apk

gh release create v1.0.2 masjid-display-v1.0.2.apk \
  --target main --title "Masjid Display v1.0.2" --notes-file notes.md
```

`/releases/latest` resolves to the newest non-prerelease automatically, so the
landing page picks it up with no deploy. Verify what the page will read:

```bash
curl -s https://api.github.com/repos/onestorefoundations-wq/azan-times/releases/latest
```

`tag_name` becomes the version shown under the download button, and the first
`.apk` asset supplies the link and the size in MB.

## Cheap TV boxes

The Hi3521 panels report Android 11 but ship a much older AOSP System WebView.
`react_vite/vite.config.ts` builds to `es2015` and emits a `nomodule` legacy
bundle with polyfills for exactly this reason — a bundle the WebView cannot
parse renders a blank screen rather than an error. If a release ever comes up
blank on a TV, check that the legacy chunks are in the APK
(`android/app/src/main/assets/public/assets/*-legacy-*.js`) before looking
anywhere else, and read the real error over `adb logcat -s chromium:E` —
`webContentsDebuggingEnabled` is on, so `chrome://inspect` also works.
