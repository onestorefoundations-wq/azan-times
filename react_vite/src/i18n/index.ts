/**
 * i18n/index.ts
 * Locale registry + helpers. Phase 2 ships English; Phase 6 adds the other
 * 33 locales by extending `registry`. Missing locales fall back to English.
 */
import { en } from './en';
import { Strings } from './types';
import { generatedLocales } from './locales';

export type { Strings, LocaleCode } from './types';

const RTL_LOCALES = new Set<string>(['ar', 'ur', 'fa', 'ps']);

export const isRtl = (locale: string): boolean => RTL_LOCALES.has(locale);

/** English base merged with the locale's translations (missing keys fall back to English). */
export const getStrings = (locale: string): Strings => {
  if (locale === 'en') return en;
  const partial = generatedLocales[locale];
  return partial ? { ...en, ...partial } : en;
};

const ARABIC_NAMES: Record<string, string> = {
  fajr: 'الفجر',
  sunrise: 'الشروق',
  dhuhr: 'الظهر',
  asr: 'العصر',
  maghrib: 'المغرب',
  isha: 'العشاء',
  jumuah: 'الجمعة',
};

/**
 * Localized prayer name. `useArabicLabels` overrides the localized name unless
 * we're already in an Arabic-script locale (ar/ur) — mirrors the Flutter widgets.
 */
export const localizedPrayerName = (
  s: Strings,
  key: string,
  fallbackName: string,
  useArabic: boolean,
  lang: string,
): string => {
  if (useArabic && lang !== 'ar' && lang !== 'ur') {
    return ARABIC_NAMES[key] ?? fallbackName;
  }
  switch (key) {
    case 'fajr':
      return s.prayerFajr;
    case 'sunrise':
      return s.prayerSunrise;
    case 'dhuhr':
      return s.prayerDhuhr;
    case 'asr':
      return s.prayerAsr;
    case 'maghrib':
      return s.prayerMaghrib;
    case 'isha':
      return s.prayerIsha;
    case 'jumuah':
      return s.prayerJumuah;
    default:
      return fallbackName;
  }
};
