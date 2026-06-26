/**
 * prayerEngine.ts
 * Prayer-time calculation + state machine. Mirrors flutter_app/lib/core/prayer_engine.dart.
 *
 * adhan-js computes absolute instants; we convert each into the masjid's IANA
 * timezone wall clock and rebuild a *local* Date from those components — exactly
 * like the Dart `toConfigTz` helper — so the state machine and countdowns behave
 * identically to the Flutter app.
 */

import {
  CalculationMethod,
  CalculationParameters,
  Coordinates,
  Madhab,
  PrayerTimes,
} from 'adhan';
import { DateTime } from 'luxon';
import { AppConfig } from './appConfig';

export type PrayerState =
  | 'idle'
  | 'preAdhan'
  | 'adhanTime'
  | 'iqamahCountdown'
  | 'postPrayer';

export interface PrayerConfig {
  name: string;
  key: string;
  adhanTime: Date;
  iqamahTime: Date;
  noIqamah: boolean;
}

export interface PrayerStateResult {
  state: PrayerState;
  prayer: PrayerConfig | null;
}

const methodFor = (name: string): CalculationParameters => {
  switch (name) {
    case 'UmmAlQura':
      return CalculationMethod.UmmAlQura();
    case 'MoonsightingCommittee':
      return CalculationMethod.MoonsightingCommittee();
    case 'NorthAmerica':
      return CalculationMethod.NorthAmerica();
    case 'Muslim_World_League':
      return CalculationMethod.MuslimWorldLeague();
    case 'Egyptian':
      return CalculationMethod.Egyptian();
    case 'Karachi':
      return CalculationMethod.Karachi();
    default:
      return CalculationMethod.UmmAlQura();
  }
};

const addMinutes = (d: Date, mins: number): Date => new Date(d.getTime() + mins * 60_000);

/** Convert an absolute instant to a local Date holding the masjid-tz wall clock. */
const toConfigTz = (instant: Date, timezoneId: string): Date => {
  try {
    const dt = DateTime.fromJSDate(instant).setZone(timezoneId);
    return new Date(dt.year, dt.month - 1, dt.day, dt.hour, dt.minute, dt.second);
  } catch {
    return new Date(instant);
  }
};

/** Calculate prayer times for [date] (defaults to today), adjusted to config tz. */
export function calculatePrayers(config: AppConfig, date?: Date): PrayerConfig[] {
  const now = date ?? new Date();
  const { profile, adjustments: adj, jumuah, features } = config;
  const useArabic = features.useArabicLabels;

  const coords = new Coordinates(profile.latitude, profile.longitude);
  const params = methodFor(profile.calculationMethod);
  params.madhab = profile.asrJuristicMethod === 'Hanafi' ? Madhab.Hanafi : Madhab.Shafi;

  // adhan-js uses the date's y/m/d to pick the day.
  const dayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const times = new PrayerTimes(coords, dayDate, params);

  const adhanFor = (base: Date, offset: number) =>
    toConfigTz(addMinutes(base, offset), profile.timezoneId);
  const iqamahFor = (adhan: Date, wait: number) => addMinutes(adhan, wait);

  const fajrAdhan = adhanFor(times.fajr, adj.fajr.adhanOffset);
  const dhuhrAdhan = adhanFor(times.dhuhr, adj.dhuhr.adhanOffset);
  const asrAdhan = adhanFor(times.asr, adj.asr.adhanOffset);
  const maghribAdhan = adhanFor(times.maghrib, adj.maghrib.adhanOffset);
  const ishaAdhan = adhanFor(times.isha, adj.isha.adhanOffset);

  const prayers: PrayerConfig[] = [
    {
      name: useArabic ? 'الفجر' : 'Fajr',
      key: 'fajr',
      adhanTime: fajrAdhan,
      iqamahTime: iqamahFor(fajrAdhan, adj.fajr.iqamahWait),
      noIqamah: false,
    },
    {
      name: useArabic ? 'الشروق' : 'Sunrise',
      key: 'sunrise',
      adhanTime: toConfigTz(times.sunrise, profile.timezoneId),
      iqamahTime: toConfigTz(times.sunrise, profile.timezoneId),
      noIqamah: true,
    },
    {
      name: useArabic ? 'الظهر' : 'Dhuhr',
      key: 'dhuhr',
      adhanTime: dhuhrAdhan,
      iqamahTime: iqamahFor(dhuhrAdhan, adj.dhuhr.iqamahWait),
      noIqamah: false,
    },
    {
      name: useArabic ? 'العصر' : 'Asr',
      key: 'asr',
      adhanTime: asrAdhan,
      iqamahTime: iqamahFor(asrAdhan, adj.asr.iqamahWait),
      noIqamah: false,
    },
    {
      name: useArabic ? 'المغرب' : 'Maghrib',
      key: 'maghrib',
      adhanTime: maghribAdhan,
      iqamahTime: iqamahFor(maghribAdhan, adj.maghrib.iqamahWait),
      noIqamah: false,
    },
    {
      name: useArabic ? 'العشاء' : 'Isha',
      key: 'isha',
      adhanTime: ishaAdhan,
      iqamahTime: iqamahFor(ishaAdhan, adj.isha.iqamahWait),
      noIqamah: false,
    },
  ];

  // Friday Jumu'ah override — replaces the Dhuhr row.
  if (now.getDay() === 5 && jumuah.enabled) {
    const idx = prayers.findIndex((p) => p.key === 'dhuhr');
    if (idx !== -1) {
      const [kh, km] = jumuah.khutbahTime.split(':').map((n) => parseInt(n, 10));
      const [ih, im] = jumuah.iqamahTime.split(':').map((n) => parseInt(n, 10));
      const jAdhan = new Date(now.getFullYear(), now.getMonth(), now.getDate(), kh, km || 0);
      const jIqamah = new Date(now.getFullYear(), now.getMonth(), now.getDate(), ih, im || 0);
      prayers[idx] = {
        name: useArabic ? 'الجمعة' : jumuah.displayLabel,
        key: 'jumuah',
        adhanTime: jAdhan,
        iqamahTime: jIqamah,
        noIqamah: false,
      };
    }
  }

  return prayers;
}

// ── State machine ──────────────────────────────────────────────

export function getCurrentPrayerState(
  prayers: PrayerConfig[],
  pauseBeforeAdhanMins = 2,
  pauseAfterIqamahMins = 15,
): PrayerStateResult {
  const now = new Date();

  for (const prayer of prayers) {
    if (prayer.noIqamah) continue;

    const preAdhanStart = addMinutes(prayer.adhanTime, -pauseBeforeAdhanMins);
    const postPrayerEnd = addMinutes(prayer.iqamahTime, pauseAfterIqamahMins);

    if (now >= postPrayerEnd) continue;
    if (now < preAdhanStart) continue;

    if (now < prayer.adhanTime) return { state: 'preAdhan', prayer };
    if (now < prayer.iqamahTime) return { state: 'adhanTime', prayer };
    return { state: 'iqamahCountdown', prayer };
  }

  return { state: 'idle', prayer: getNextPrayer(prayers) };
}

export function getNextPrayer(prayers: PrayerConfig[]): PrayerConfig | null {
  const now = new Date();
  for (const p of prayers) {
    if (p.adhanTime > now) return p;
  }
  return null;
}

// ── Formatters ─────────────────────────────────────────────────

const pad = (n: number) => n.toString().padStart(2, '0');

export function formatTime(time: Date, use24Hour = false): string {
  if (use24Hour) return `${pad(time.getHours())}:${pad(time.getMinutes())}`;
  const h24 = time.getHours();
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${pad(time.getMinutes())} ${ampm}`;
}

export function formatTimeWithSeconds(time: Date, use24Hour = false): string {
  if (use24Hour) return `${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}`;
  const h24 = time.getHours();
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${pad(time.getMinutes())}:${pad(time.getSeconds())} ${ampm}`;
}

export function formatCountdown(target: Date): string {
  const diffMs = target.getTime() - Date.now();
  if (diffMs <= 0) return '00:00:00';
  const totalSec = Math.floor(diffMs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function formatGregorianDate(date: Date, locale = 'en-GB'): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/** Hijri date via the built-in Islamic calendar, e.g. "23 Dhul Hijjah 1447". */
export function getHijriDate(date: Date, locale = 'en-GB'): string {
  try {
    const parts = new Intl.DateTimeFormat(`${locale}-u-ca-islamic`, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
    return parts.replace(/\s*AH$/, '').trim();
  } catch {
    return '';
  }
}
