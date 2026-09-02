/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Injected by vite.config.ts → define: { __BUILD_TIME__ }
declare const __BUILD_TIME__: string;

/**
 * The Android versionName in the APK build, null in a web build — so it doubles
 * as the "am I running inside the APK?" test wherever that changes behaviour.
 */
declare const __NATIVE_VERSION__: string | null;
