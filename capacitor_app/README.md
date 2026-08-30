# capacitor_app — Android shell for the Mosque TV Display

Wraps the built `react_vite` app in a single APK that runs on Android TV boxes
and on phones. Everything the display needs is packaged inside the APK, so a
device with no internet still shows correct prayer times on first launch.

- Package: `com.pro26.masjid_display` — deliberately *not* the Flutter app's
  `com.pro26.masjid_app`, so both can be installed side by side during migration.
- Web assets: `../react_vite/dist`, copied into `android/app/src/main/assets/public`
  by `cap sync`. There is no remote URL to load and no first-run download.

## What the native layer adds

| Concern | Where | Why the web layer cannot do it |
| --- | --- | --- |
| Adhan plays with no user gesture | `MainActivity.onCreate` | Browsers block autoplay until a tap; a wall-mounted TV is never tapped. |
| Screen never sleeps | `FLAG_KEEP_SCREEN_ON` | `navigator.wakeLock` is unreliable in the Android WebView. |
| Adhan fires while backgrounded | `AzanAlarmPlugin` + `AzanAlarmReceiver` | A backgrounded WebView's timers are throttled or frozen. |
| Restart after a power cut | `BootReceiver` (TV only) | No web equivalent. |
| Appears on the TV home row | `LEANBACK_LAUNCHER` + `@drawable/tv_banner` | No web equivalent. |

The web tick in `appStore` still fires alerts while the display is on screen.
The native alarm is a backstop, not a replacement — whichever comes first plays.

## Build

Requires JDK 21 and the Android SDK.

```sh
export JAVA_HOME="/c/Program Files/Android/Android Studio/jbr"
export ANDROID_HOME=/c/DATA/Android/Sdk

npm install
npm run sync          # builds react_vite with VITE_NATIVE=1, copies into android/
cd android && ./gradlew assembleDebug
```

`VITE_NATIVE=1` skips the service-worker registration. The APK already ships
every asset, and a worker caching them would keep serving the previous build's
JS after an app update.

## Install and test on a device

```sh
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb logcat -s AzanAlarm Capacitor chromium
```

On Xiaomi/POCO (MIUI), `adb install` fails with `INSTALL_FAILED_USER_RESTRICTED`
until *Install via USB* and *USB debugging (Security settings)* are enabled in
Developer options, with the USB mode set to File Transfer.

## Release

Fill in `android/keystore.properties` from the example, then:

```sh
cd android && ./gradlew assembleRelease   # or bundleRelease for Play
```

Reuse the Flutter app's key only if this shell is meant to replace that listing.

## Known limits

- The congregation page (`/m/<slug>`) is Supabase-backed and is not part of the
  APK; it stays a web page. The APK ships the display and its settings screen.
- UI changes need a new APK. If that becomes a problem, add an OTA updater that
  downloads a new `dist` into app storage and prefers it over the bundled copy.
- A device with no internet has no NTP. Cheap TV boxes drift, and some boot to
  1970 after a power cut, which moves every prayer time. The clock is the
  weakest link in a fully offline install, not the wrapper.
