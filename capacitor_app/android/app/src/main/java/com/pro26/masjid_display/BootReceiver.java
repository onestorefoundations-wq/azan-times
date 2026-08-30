package com.pro26.masjid_display;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Restarts the display after a power cut. A mosque screen is switched on at the
 * wall, not by a person opening an app, so without this a blackout leaves the
 * TV sitting on the launcher until someone notices.
 */
public class BootReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        boolean isBoot = Intent.ACTION_BOOT_COMPLETED.equals(action)
                || Intent.ACTION_LOCKED_BOOT_COMPLETED.equals(action)
                // Sent to the app's own package after it is updated.
                || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action);
        if (!isBoot) return;

        // Only take over the screen on a TV. Auto-launching a full-screen app on
        // someone's phone every reboot would be hostile.
        if (!MainActivity.isTelevision(context)) return;

        Intent launch = new Intent(context, MainActivity.class);
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(launch);
    }
}
