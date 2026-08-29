import java.util.Properties

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Release signing credentials, kept out of the repo. key.properties, *.jks and
// *.keystore are all git-ignored; see ../key.properties.example and
// RELEASING.md. Absent on a machine without the keystore, in which case the
// release build falls back to the debug key so `flutter build apk` still works
// for testing.
val keystorePropertiesFile = rootProject.file("key.properties")
val keystoreProperties =
    Properties().apply {
        if (keystorePropertiesFile.exists()) {
            keystorePropertiesFile.inputStream().use { load(it) }
        }
    }
val hasReleaseKeystore = keystorePropertiesFile.exists()

android {
    namespace = "com.pro26.masjid_app"
    compileSdk = 36
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        applicationId = "com.pro26.masjid_app"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        // Pinned rather than inherited from flutter.minSdkVersion: the supported
        // floor for the TV fleet is Android 7.0, and a Flutter upgrade must not
        // silently raise it and cut sets off the bottom of the range. 24 is also
        // the lowest modern Flutter supports, so this cannot go lower without
        // changing toolchain.
        minSdk = 24
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (hasReleaseKeystore) {
            create("release") {
                storeFile = file(keystoreProperties.getProperty("storeFile"))
                storePassword = keystoreProperties.getProperty("storePassword")
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            // Android identifies an app by its signing key: a release signed
            // with a different key is refused as an update by every device that
            // already has the app. Without key.properties this falls back to the
            // debug key so a build still succeeds for sideload testing -- that
            // output must never be published. RELEASING.md has the check.
            signingConfig =
                if (hasReleaseKeystore) {
                    signingConfigs.getByName("release")
                } else {
                    logger.warn(
                        "No key.properties found — signing the release build with the DEBUG key. " +
                            "For testing only; see RELEASING.md before publishing.",
                    )
                    signingConfigs.getByName("debug")
                }
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
