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
(`sdk.dir`), which is machine-local and not in git. On the current build machine
that is `C:/DATA/Android/Sdk`, so the tools below live under
`C:/DATA/Android/Sdk/build-tools/37.0.0/`.

`npm run apk:debug` and `apk:release` invoke `.\gradlew.bat` — the `.\` matters,
because Windows sets `NoDefaultCurrentDirectoryInExePath=1` here and cmd will
not otherwise find an executable in the working directory.

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

This is **already configured on the current build machine** —
`capacitor_app/android/keystore.properties` exists and `apk:release` produces a
signed APK. The rest of this section is for setting it up somewhere else, or
after a reinstall.

`flutter_app/android/key.properties` uses the same four property names as
`keystore.properties.example`, so the file can be copied wholesale rather than
retyping the passwords anywhere:

```bash
cp flutter_app/android/key.properties capacitor_app/android/keystore.properties
# then edit only the storeFile line to an absolute path:
# storeFile=C:/DATA_02/masjid-azan-times/flutter_app/android/masjid-release.jks
```

Use an absolute path. The example's `../../flutter_app/...` is relative to the
wrong directory: `file()` inside `app/build.gradle` resolves against the app
module, not the android root, so it lands a level short and the build silently
falls back to producing `app-release-unsigned.apk`.

Reuse this key only if the Capacitor shell is meant to carry the Flutter app's
identity — it is, since both build `com.pro26.masjid_display`.

### The current field state

**v1.0.5 is the first release signed with the real key**
(`CN=Masjid App by Pro26, OU=Masjid Azan Times, O=Pro26, C=IN`). Everything
before it — v1.0.0-preview through v1.0.4 — carries the Android debug key,
because those were built with `assembleDebug` before `keystore.properties`
existed.

The two signatures are incompatible, so **a device running v1.0.4 or earlier
cannot update to v1.0.5**: Android rejects the install as a signature mismatch,
and the app has to be uninstalled first. Uninstalling clears the device's local
settings; a display linked to a cloud account gets them back on sign-in, one
that was configured locally does not.

That break happens exactly once. Every release from v1.0.5 on updates normally,
provided `keystore.properties` stays in place and points at the same `.jks`.

## Each release

Bump the version first. `versionCode` and `versionName` live in
`capacitor_app/android/app/build.gradle`:

```gradle
versionCode 8
versionName "1.0.7"
```

(v1.0.6 shipped as `versionCode 7`.)

Android refuses to install an APK whose `versionCode` is not higher than the
installed one, and the failure is a bare "App not installed" with no
explanation. Bump it on **every** published release.

Commit the bump on its own, as `chore(android): bump to versionCode <n> /
versionName <x.y.z>`, separate from the changes being shipped. `git log` is then
a list of releases as well as of work, and the commit a tag points at says which
release it is without opening a diff. Do not fold the bump into a feature or fix
commit.

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

Expected, and **not** `CN=Android Debug`:

```
CN=Masjid App by Pro26, OU=Masjid Azan Times, O=Pro26, C=IN
SHA-256: f887e536b93764b5ff2f240f4aa54d4b4e8af7b35deb9291e8666eddf2b149f4
```

If that digest ever changes, stop: it means the build picked up a different
key, and shipping it would lock every existing install out of updates.

Then confirm the fix you are shipping is actually in the APK, **in both the
modern and the legacy chunk**. The TV boxes run the legacy ES5 bundle, so
something present in only one of the two works on your phone and silently does
not on the display it was written for:

```bash
unzip -l app-release.apk | grep -c "assets/public/assets/.*legacy.*\.js"   # expect 7
unzip -p app-release.apk "assets/public/assets/<chunk>-*.js" | grep <something distinctive>
```

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
`.apk` asset supplies the link and the size in MB. **The same call is what the
app's own update check reads** (`useApkUpdate`), so a release with no `.apk`
asset, or a tag that is not `v<dotted version>`, silently fails to reach both
the landing page and every installed display.

Finally, verify the artifact that is actually published rather than the one on
your disk — a truncated or wrong upload looks fine locally:

```bash
gh release download v1.0.6 -R onestorefoundations-wq/azan-times -p "*.apk" -O dl.apk
sha256sum dl.apk app-release.apk     # the two must match
```

### What publishing now does on its own

Since v1.0.6 the app checks GitHub for a newer release every few hours and
offers the download from Settings → App. Publishing is therefore how installed
displays find out; nothing else has to be done to notify them.

Two limits worth remembering. A display only checks if it is running a build
that contains the checker, so anything on v1.0.5 or earlier needs one manual
sideload before it will ever self-announce. And the app can only *offer* the
download — installing is a human tapping the file, because automating it needs
`REQUEST_INSTALL_PACKAGES`, a far larger permission than this app should hold.

## Cheap TV boxes

The Hi3521 panels report Android 11 but ship a much older AOSP System WebView.
`react_vite/vite.config.ts` builds to `es2015` and emits a `nomodule` legacy
bundle with polyfills for exactly this reason — a bundle the WebView cannot
parse renders a blank screen rather than an error. If a release ever comes up
blank on a TV, check that the legacy chunks are in the APK
(`android/app/src/main/assets/public/assets/*-legacy-*.js`) before looking
anywhere else, and read the real error over `adb logcat -s chromium:E` —
`webContentsDebuggingEnabled` is on, so `chrome://inspect` also works.
