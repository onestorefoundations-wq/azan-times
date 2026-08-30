package com.pro26.masjid_display;

import android.app.UiModeManager;
import android.content.Context;
import android.content.res.Configuration;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

/**
 * Hosts the react_vite display. The web layer owns the pixels; this class owns
 * the three things a browser cannot do on a kiosk: play the adhan without a
 * user gesture, hold the screen on for weeks, and stay fullscreen.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AzanAlarmPlugin.class);
        super.onCreate(savedInstanceState);

        // A signage screen must never sleep, and the device's own screen-timeout
        // setting is not ours to change -- this flag overrides it while we are
        // in the foreground.
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);

        WebView webView = getBridge().getWebView();
        WebSettings settings = webView.getSettings();

        // AudioService.unlock() exists because browsers block autoplay until a
        // tap. A TV on a wall is never tapped, so without this the adhan would
        // stay silent forever.
        settings.setMediaPlaybackRequiresUserGesture(false);

        // Kiosks run for months on one process; let the WebView keep its cache
        // rather than re-parsing the bundle on every resume.
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);

        // The display is a fixed-width design; TV browsers otherwise apply an
        // overview zoom that letterboxes it.
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(false);

        applyImmersive();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        // System UI comes back on its own after dialogs, IME, or a remote's
        // home-press round trip, so re-assert rather than setting once.
        if (hasFocus) applyImmersive();
    }

    /**
     * Hides the status and navigation bars, sticky so a swipe only reveals them
     * briefly. The old setSystemUiVisibility flags are deprecated and MIUI
     * ignores them outright, leaving a white navigation bar under the display.
     */
    private void applyImmersive() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat controller =
                WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.hide(WindowInsetsCompat.Type.systemBars());
        controller.setSystemBarsBehavior(
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }

    /** True when running on Android TV rather than a phone or tablet. */
    static boolean isTelevision(Context context) {
        UiModeManager uiMode = (UiModeManager) context.getSystemService(Context.UI_MODE_SERVICE);
        return uiMode != null && uiMode.getCurrentModeType() == Configuration.UI_MODE_TYPE_TELEVISION;
    }
}
