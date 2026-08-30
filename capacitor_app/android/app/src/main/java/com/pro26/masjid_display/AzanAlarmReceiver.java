package com.pro26.masjid_display;

import android.app.KeyguardManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.res.AssetFileDescriptor;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.PowerManager;
import android.util.Log;

import java.io.IOException;

/**
 * Plays the adhan when AlarmManager fires, whether or not the WebView is alive.
 *
 * Audio comes from the same files the web app uses -- they are packaged under
 * assets/public/audio by the Capacitor sync, so there is one copy, not two.
 */
public class AzanAlarmReceiver extends BroadcastReceiver {

    static final String ACTION_FIRE = "com.pro26.masjid_display.AZAN_FIRE";
    static final String EXTRA_AUDIO = "audio";
    static final String EXTRA_LABEL = "label";

    private static final String TAG = "AzanAlarm";

    /** Long enough for the longest bundled adhan; released early when playback ends. */
    private static final long WAKELOCK_TIMEOUT_MS = 6 * 60 * 1000L;

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !ACTION_FIRE.equals(intent.getAction())) return;

        String audio = intent.getStringExtra(EXTRA_AUDIO);
        if (audio == null || audio.isEmpty()) return;

        PowerManager power = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wakeLock = null;
        if (power != null) {
            // A broadcast receiver's implicit wakelock ends when onReceive
            // returns, which is long before a five-minute adhan finishes.
            wakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "masjid:azan");
            wakeLock.acquire(WAKELOCK_TIMEOUT_MS);
        }

        bringDisplayForward(context);
        play(context, audio, wakeLock);
    }

    /**
     * Wakes the display so the adhan overlay is actually visible. On a wall-
     * mounted TV the screen is already on; on a phone it may not be.
     */
    private void bringDisplayForward(Context context) {
        try {
            Intent launch = new Intent(context, MainActivity.class);
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            context.startActivity(launch);
        } catch (Exception e) {
            // Android 10+ blocks background activity starts unless the app is
            // exempt; the audio still plays, so this is not fatal.
            Log.i(TAG, "could not foreground the display: " + e.getMessage());
        }
    }

    private void play(Context context, String audio, PowerManager.WakeLock wakeLock) {
        AudioManager audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);

        AudioAttributes attributes = new AudioAttributes.Builder()
                // USAGE_ALARM rather than MEDIA so the adhan is audible even
                // when the device's media volume is muted.
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();

        requestFocus(audioManager, attributes);

        MediaPlayer player = new MediaPlayer();
        try {
            AssetFileDescriptor fd = context.getAssets().openFd("public/audio/" + audio);
            player.setDataSource(fd.getFileDescriptor(), fd.getStartOffset(), fd.getLength());
            fd.close();
            player.setAudioAttributes(attributes);
            player.setOnCompletionListener(mp -> release(mp, audioManager, wakeLock));
            player.setOnErrorListener((mp, what, extra) -> {
                Log.w(TAG, "playback error " + what + "/" + extra);
                release(mp, audioManager, wakeLock);
                return true;
            });
            player.prepare();
            player.start();
        } catch (IOException | IllegalStateException e) {
            Log.w(TAG, "could not play " + audio, e);
            release(player, audioManager, wakeLock);
        }
    }

    private void requestFocus(AudioManager audioManager, AudioAttributes attributes) {
        if (audioManager == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            AudioFocusRequest request = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                    .setAudioAttributes(attributes)
                    .build();
            audioManager.requestAudioFocus(request);
        } else {
            audioManager.requestAudioFocus(null, AudioManager.STREAM_ALARM,
                    AudioManager.AUDIOFOCUS_GAIN_TRANSIENT);
        }
    }

    private void release(MediaPlayer player, AudioManager audioManager, PowerManager.WakeLock wakeLock) {
        try {
            player.release();
        } catch (Exception ignored) {
            // Already released.
        }
        if (audioManager != null) audioManager.abandonAudioFocus(null);
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
    }
}
