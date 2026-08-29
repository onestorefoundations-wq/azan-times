# Releasing the Android TV app

The landing page at `/about` links to
`https://github.com/onestorefoundations-wq/azan-times/releases/latest`, so
publishing a GitHub Release is what makes a new APK downloadable. Nothing else
needs changing to ship an update.

## One time: create the signing key

Android identifies an app by its signing key. If a later release is signed with
a different key, every device that already has the app **refuses the update** —
people have to uninstall first and lose their settings. So this key is created
once and kept forever.

```bash
keytool -genkey -v \
  -keystore C:\path\to\masjid-release.jks \
  -storetype JKS \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias masjid
```

Then copy `flutter_app/android/key.properties.example` to
`flutter_app/android/key.properties` and fill it in.

`key.properties`, `*.jks` and `*.keystore` are all git-ignored. **Back the `.jks`
file up somewhere you will still have it in five years**, along with the
passwords. There is no recovery: a lost key means a new app identity and a
forced uninstall/reinstall for every existing user.

Do not put the keystore or the passwords in this repo, in an issue, or in a chat
message.

## Each release

From `flutter_app/`, with `JAVA_HOME` pointed at Android Studio's JDK
(`C:\Program Files\Android\Android Studio\jbr` — `java` is not otherwise on PATH):

```bash
C:\flutter\bin\flutter.bat pub get
C:\flutter\bin\flutter.bat analyze
C:\flutter\bin\flutter.bat build apk --release
```

Output: `flutter_app/build/app/outputs/flutter-apk/app-release.apk`

Build a **universal** APK. Do not use `--split-per-abi` for the download link:
it emits one file per architecture, and someone sideloading the wrong one gets
an install failure with no useful message.

Confirm it is signed with the real key, not the debug key:

```bash
keytool -printcert -jarfile app-release.apk
```

The owner line should be what you entered at `keytool -genkey` time, not
`CN=Android Debug`.

Also worth checking before publishing:

```bash
aapt dump badging app-release.apk | grep -E "sdkVersion|application-banner|launchable"
```

- `sdkVersion:'24'` — the Android 7.0 floor
- an `application-banner` — without it the app installs but never appears in the
  Android TV launcher
- a leanback `launchable-activity`

## Version numbers

`versionName` / `versionCode` come from `pubspec.yaml` (`version: 1.0.0+1`).
Bump the number after `+` on every release: Android refuses to install an APK
whose `versionCode` is not higher than the installed one.

## Publishing

Create a GitHub Release, tag it `v<version>`, and attach `app-release.apk`. The
`/releases/latest` link the landing page uses resolves to the newest one
automatically.

## If the build is unsigned

When `key.properties` is absent the release build falls back to the **debug**
key so `flutter build apk` still works for anyone without the keystore. That
build is fine for sideload testing and must never be published — debug-signed
APKs cannot be upgraded from, and are trivially re-signable by anyone.
