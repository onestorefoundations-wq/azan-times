/**
 * nativeAlarms.ts
 * Mirrors the upcoming adhan/iqamah times into the Android AlarmManager.
 *
 * The web tick in appStore fires alerts while the display is on screen, which is
 * all a wall-mounted TV ever needs. A phone is different: once the app is
 * backgrounded the WebView's timers are throttled or frozen, so the tick simply
 * does not run and the prayer passes in silence. The native shell registers an
 * exact alarm per alert as a backstop; whichever fires first plays the audio.
 *
 * No-ops in a browser, so the same build runs on the web unchanged.
 */

import { AppConfig } from './appConfig';
import { calculatePrayers, PrayerConfig } from './prayerEngine';

interface ScheduledAlert {
  at: number;
  audio: string;
  label: string;
}

interface AzanAlarmPlugin {
  schedule(options: { alerts: ScheduledAlert[] }): Promise<{ scheduled: number; exact: boolean }>;
  cancelAll(): Promise<void>;
  status(): Promise<{ available: boolean; exact: boolean; isTelevision: boolean }>;
}

/** Two days of alerts: today's remainder plus tomorrow, so a device left alone overnight still rings. */
const HORIZON_DAYS = 2;

/** AzanAlarmPlugin caps what it will register; staying under it keeps cancel/replace exact. */
const MAX_ALERTS = 32;

const plugin = (): AzanAlarmPlugin | null => {
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; Plugins?: Record<string, unknown> } })
    .Capacitor;
  if (!cap?.isNativePlatform?.()) return null;
  return (cap.Plugins?.AzanAlarm as AzanAlarmPlugin) ?? null;
};

/** True when running inside the Android shell rather than a browser tab. */
export const isNative = (): boolean => plugin() !== null;

const alertsFrom = (config: AppConfig): ScheduledAlert[] => {
  const now = Date.now();
  const out: ScheduledAlert[] = [];

  for (let day = 0; day < HORIZON_DAYS; day++) {
    const date = new Date();
    date.setDate(date.getDate() + day);
    const prayers: PrayerConfig[] = calculatePrayers(config, date);

    for (const prayer of prayers) {
      const adhanAt = prayer.adhanTime.getTime();
      if (adhanAt > now) {
        out.push({ at: adhanAt, audio: config.features.adhanAudio, label: `${prayer.key}:adhan` });
      }
      // A prayer with no iqamah (Jumuah on some configs) has no second alert.
      if (!prayer.noIqamah) {
        const iqamahAt = prayer.iqamahTime.getTime();
        if (iqamahAt > now) {
          out.push({ at: iqamahAt, audio: config.features.iqamahAudio, label: `${prayer.key}:iqamah` });
        }
      }
    }
  }

  out.sort((a, b) => a.at - b.at);
  return out.slice(0, MAX_ALERTS);
};

/**
 * Replaces every pending native alarm with the current config's upcoming alerts.
 * Safe to call on every recalculation -- it is a replace, not an append.
 */
export async function syncNativeAlarms(config: AppConfig, alertsEnabled: boolean): Promise<void> {
  const azan = plugin();
  if (!azan) return;

  try {
    if (!alertsEnabled) {
      await azan.cancelAll();
      return;
    }
    await azan.schedule({ alerts: alertsFrom(config) });
  } catch (e) {
    // A failed sync leaves the web tick as the only alert path, which is still
    // correct while the display is on screen.
    console.warn('[nativeAlarms] sync failed', e);
  }
}

/** Reports whether the OS will honour exact timing, for a settings-screen warning. */
export async function nativeAlarmStatus(): Promise<{ exact: boolean; isTelevision: boolean } | null> {
  const azan = plugin();
  if (!azan) return null;
  try {
    const status = await azan.status();
    return { exact: status.exact, isTelevision: status.isTelevision };
  } catch {
    return null;
  }
}
