package com.pro26.masjid_display;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * Exact-alarm backstop for the adhan.
 *
 * The web layer's own tick fires the adhan while the display is on screen, but
 * a WebView that is backgrounded, dozed, or throttled stops running timers --
 * on a phone that means a missed prayer. This plugin mirrors the next day's
 * alert times into AlarmManager so the OS wakes us even if the WebView does not.
 */
@CapacitorPlugin(name = "AzanAlarm")
public class AzanAlarmPlugin extends Plugin {

    /** Request codes are derived from this base so we can cancel exactly what we set. */
    private static final int REQUEST_BASE = 7100;

    /** How many alarms we keep pending; also the count we cancel before rescheduling. */
    private static final int MAX_ALARMS = 32;

    /**
     * Replaces every pending alarm with the supplied list.
     * Call with the full upcoming set -- this is a replace, not an append.
     */
    @PluginMethod
    public void schedule(PluginCall call) {
        JSArray alerts = call.getArray("alerts");
        if (alerts == null) {
            call.reject("alerts array is required");
            return;
        }

        Context context = getContext();
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) {
            call.reject("AlarmManager unavailable");
            return;
        }

        cancelPending(context, alarmManager);

        List<JSONObject> list;
        try {
            list = alerts.toList();
        } catch (org.json.JSONException e) {
            call.reject("alerts is not a list of objects", e);
            return;
        }

        long now = System.currentTimeMillis();
        int scheduled = 0;

        for (int i = 0; i < list.size() && scheduled < MAX_ALARMS; i++) {
            JSONObject alert = list.get(i);
            long at = alert.optLong("at", 0L);
            // A time already past would fire immediately on the next boot, which
            // is how a "missed adhan" turns into an adhan at 3am.
            if (at <= now) continue;

            Intent intent = new Intent(context, AzanAlarmReceiver.class);
            intent.setAction(AzanAlarmReceiver.ACTION_FIRE);
            intent.putExtra(AzanAlarmReceiver.EXTRA_AUDIO, alert.optString("audio", ""));
            intent.putExtra(AzanAlarmReceiver.EXTRA_LABEL, alert.optString("label", ""));

            PendingIntent pending = PendingIntent.getBroadcast(
                    context,
                    REQUEST_BASE + scheduled,
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

            if (canScheduleExact(alarmManager)) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending);
            } else {
                // Without the exact-alarm permission the OS may slide the fire
                // time by minutes. Still better than silence.
                alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending);
            }
            scheduled++;
        }

        JSObject result = new JSObject();
        result.put("scheduled", scheduled);
        result.put("exact", canScheduleExact(alarmManager));
        call.resolve(result);
    }

    /** Drops every pending alarm, e.g. when alerts are turned off in settings. */
    @PluginMethod
    public void cancelAll(PluginCall call) {
        Context context = getContext();
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager != null) cancelPending(context, alarmManager);
        call.resolve();
    }

    /** Lets the web layer show a warning when the OS will only fire inexact alarms. */
    @PluginMethod
    public void status(PluginCall call) {
        AlarmManager alarmManager = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
        JSObject result = new JSObject();
        result.put("available", true);
        result.put("exact", alarmManager != null && canScheduleExact(alarmManager));
        result.put("isTelevision", MainActivity.isTelevision(getContext()));
        call.resolve(result);
    }

    private void cancelPending(Context context, AlarmManager alarmManager) {
        List<PendingIntent> stale = new ArrayList<>();
        for (int i = 0; i < MAX_ALARMS; i++) {
            Intent intent = new Intent(context, AzanAlarmReceiver.class);
            intent.setAction(AzanAlarmReceiver.ACTION_FIRE);
            // NO_CREATE so we only touch alarms that actually exist.
            PendingIntent pending = PendingIntent.getBroadcast(
                    context,
                    REQUEST_BASE + i,
                    intent,
                    PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE);
            if (pending != null) stale.add(pending);
        }
        for (PendingIntent pending : stale) {
            alarmManager.cancel(pending);
            pending.cancel();
        }
    }

    private boolean canScheduleExact(AlarmManager alarmManager) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true;
        return alarmManager.canScheduleExactAlarms();
    }
}
