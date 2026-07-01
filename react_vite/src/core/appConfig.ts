/**
 * appConfig.ts
 * TypeScript mirror of flutter_app/lib/core/app_config.dart.
 *
 * Field names are camelCase in TS; (de)serializers translate to/from the
 * snake_case JSON used by Supabase `config_json` and local storage so the
 * React app is byte-for-byte wire-compatible with the Flutter app.
 */

// ═══════════════════════════════════════════════════════════════
// JSON helpers
// ═══════════════════════════════════════════════════════════════

type Json = Record<string, any>;

const num = (v: unknown, fallback: number): number =>
  typeof v === 'number' && !Number.isNaN(v) ? v : fallback;
const int = (v: unknown, fallback: number): number => Math.trunc(num(v, fallback));
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);
const str = <T extends string>(v: unknown, fallback: T): T =>
  typeof v === 'string' ? (v as T) : fallback;
const strOrNull = (v: unknown): string | null => (typeof v === 'string' ? v : null);

// ═══════════════════════════════════════════════════════════════
// MasjidProfile
// ═══════════════════════════════════════════════════════════════

export interface MasjidProfile {
  name: string;
  nameArabic: string | null;
  tenantId: string | null;
  latitude: number;
  longitude: number;
  timezoneId: string;
  calculationMethod: string;
  asrJuristicMethod: string;
}

export const defaultMasjidProfile = (): MasjidProfile => ({
  name: 'Local Mosque',
  nameArabic: null,
  tenantId: null,
  latitude: 11.100030590411507,
  longitude: 76.22848915791933,
  timezoneId: 'Asia/Kolkata',
  calculationMethod: 'Karachi',
  asrJuristicMethod: 'Standard',
});

export const masjidProfileFromJson = (j: Json): MasjidProfile => ({
  name: str(j.name, 'Local Mosque'),
  nameArabic: strOrNull(j.name_arabic),
  tenantId: strOrNull(j.tenant_id),
  latitude: num(j.latitude, 11.100030590411507),
  longitude: num(j.longitude, 76.22848915791933),
  timezoneId: str(j.timezone_id, 'Asia/Kolkata'),
  calculationMethod: str(j.calculation_method, 'Karachi'),
  asrJuristicMethod: str(j.asr_juristic_method, 'Standard'),
});

export const masjidProfileToJson = (p: MasjidProfile): Json => ({
  name: p.name,
  name_arabic: p.nameArabic,
  tenant_id: p.tenantId,
  latitude: p.latitude,
  longitude: p.longitude,
  timezone_id: p.timezoneId,
  calculation_method: p.calculationMethod,
  asr_juristic_method: p.asrJuristicMethod,
});

// ═══════════════════════════════════════════════════════════════
// TimeAdjustments / PrayerOffset
// ═══════════════════════════════════════════════════════════════

export interface PrayerOffset {
  adhanOffset: number; // minutes, can be negative
  iqamahWait: number; // minutes after adhan
}

export type PrayerKey = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

export interface TimeAdjustments {
  fajr: PrayerOffset;
  dhuhr: PrayerOffset;
  asr: PrayerOffset;
  maghrib: PrayerOffset;
  isha: PrayerOffset;
}

export const defaultTimeAdjustments = (): TimeAdjustments => ({
  fajr: { adhanOffset: 0, iqamahWait: 25 },
  dhuhr: { adhanOffset: -2, iqamahWait: 15 },
  asr: { adhanOffset: 0, iqamahWait: 15 },
  maghrib: { adhanOffset: 0, iqamahWait: 5 },
  isha: { adhanOffset: 0, iqamahWait: 15 },
});

const offsetFromJson = (j: Json, prefix: string): PrayerOffset => ({
  adhanOffset: int(j[`${prefix}_adhan_offset`], 0),
  iqamahWait: int(j[`${prefix}_iqamah_wait`], 15),
});

export const timeAdjustmentsFromJson = (j: Json): TimeAdjustments => ({
  fajr: offsetFromJson(j, 'fajr'),
  dhuhr: offsetFromJson(j, 'dhuhr'),
  asr: offsetFromJson(j, 'asr'),
  maghrib: offsetFromJson(j, 'maghrib'),
  isha: offsetFromJson(j, 'isha'),
});

export const timeAdjustmentsToJson = (a: TimeAdjustments): Json => ({
  fajr_adhan_offset: a.fajr.adhanOffset,
  fajr_iqamah_wait: a.fajr.iqamahWait,
  dhuhr_adhan_offset: a.dhuhr.adhanOffset,
  dhuhr_iqamah_wait: a.dhuhr.iqamahWait,
  asr_adhan_offset: a.asr.adhanOffset,
  asr_iqamah_wait: a.asr.iqamahWait,
  maghrib_adhan_offset: a.maghrib.adhanOffset,
  maghrib_iqamah_wait: a.maghrib.iqamahWait,
  isha_adhan_offset: a.isha.adhanOffset,
  isha_iqamah_wait: a.isha.iqamahWait,
});

// ═══════════════════════════════════════════════════════════════
// FeaturesFormat
// ═══════════════════════════════════════════════════════════════

export type AdhanAlertMode = 'full_screen' | 'dismissible' | 'side_panel';

export interface FeaturesFormat {
  use24HourFormat: boolean;
  useArabicLabels: boolean;
  audioAlertsEnabled: boolean;
  adhanAlertMode: AdhanAlertMode;
  adhanAudio: string;
  iqamahAudio: string;
  showAnalogClock: boolean;
  analogClockSize: number;       // 50–200
  digitalClockSizePercent: number; // 40–120; scales the digital clock font
  displayLanguage: string;
}

export const defaultFeaturesFormat = (): FeaturesFormat => ({
  use24HourFormat: false,
  useArabicLabels: false,
  audioAlertsEnabled: true,
  adhanAlertMode: 'full_screen',
  adhanAudio: 'alert1.mp3',
  iqamahAudio: 'alert2.mp3',
  showAnalogClock: false,
  analogClockSize: 55,
  digitalClockSizePercent: 75,
  displayLanguage: 'en',
});

export const featuresFormatFromJson = (j: Json): FeaturesFormat => ({
  use24HourFormat: bool(j.use_24_hour_format, false),
  useArabicLabels: bool(j.use_arabic_labels, false),
  audioAlertsEnabled: bool(j.audio_alerts_enabled, true),
  adhanAlertMode: str(j.adhan_alert_mode, 'full_screen'),
  adhanAudio: str(j.adhan_audio, 'alert1.mp3'),
  iqamahAudio: str(j.iqamah_audio, 'alert2.mp3'),
  showAnalogClock: bool(j.show_analog_clock, false),
  analogClockSize: int(j.analog_clock_size, 55),
  digitalClockSizePercent: int(j.digital_clock_size_percent, 75),
  displayLanguage: str(j.display_language, 'en'),
});

export const featuresFormatToJson = (f: FeaturesFormat): Json => ({
  use_24_hour_format: f.use24HourFormat,
  use_arabic_labels: f.useArabicLabels,
  audio_alerts_enabled: f.audioAlertsEnabled,
  adhan_alert_mode: f.adhanAlertMode,
  adhan_audio: f.adhanAudio,
  iqamah_audio: f.iqamahAudio,
  show_analog_clock: f.showAnalogClock,
  analog_clock_size: f.analogClockSize,
  digital_clock_size_percent: f.digitalClockSizePercent,
  display_language: f.displayLanguage,
});

// ═══════════════════════════════════════════════════════════════
// TickerSettings
// ═══════════════════════════════════════════════════════════════

export interface TickerSettings {
  enabled: boolean;
  messages: string[];
  speed: number; // pixels per second
}

export const defaultTickerSettings = (): TickerSettings => ({
  enabled: true,
  messages: ['Welcome to our Masjid!'],
  speed: 50,
});

export const tickerSettingsFromJson = (j: Json): TickerSettings => ({
  enabled: bool(j.enabled, true),
  messages: Array.isArray(j.messages) ? (j.messages as string[]) : ['Welcome to our Masjid!'],
  speed: int(j.speed, 50),
});

export const tickerSettingsToJson = (t: TickerSettings): Json => ({
  enabled: t.enabled,
  messages: t.messages,
  speed: t.speed,
});

// ═══════════════════════════════════════════════════════════════
// SlideshowSettings / SlideAsset
// ═══════════════════════════════════════════════════════════════

export interface SlideAsset {
  id: string;
  filename: string;
  localPath: string; // url, data: URI, or cached blob URL
  uploadedAt: number; // epoch ms
}

export const slideAssetFromJson = (j: Json): SlideAsset => ({
  id: str(j.id, ''),
  filename: str(j.filename, ''),
  localPath: str(j.local_path, ''),
  uploadedAt: int(j.uploaded_at, 0),
});

export const slideAssetToJson = (s: SlideAsset): Json => ({
  id: s.id,
  filename: s.filename,
  local_path: s.localPath,
  uploaded_at: s.uploadedAt,
});

export type SlideshowDisplayMode = 'full_screen' | 'corner_overlay' | 'split_screen';
export type OverlayCorner = 'top_right' | 'top_left' | 'bottom_right' | 'bottom_left';

export interface SlideshowSettings {
  enabled: boolean;
  tvScreenDurationMins: number;
  tvScreenExtraSecs: number;
  slideshowRunDurationMins: number;
  slideshowRunExtraSecs: number;
  durationPerImageSeconds: number;
  pauseBeforeAdhanMins: number;
  pauseAfterIqamahMins: number;
  displayMode: SlideshowDisplayMode;
  overlayCorner: OverlayCorner;
  overlaySizePercent: number;
  images: SlideAsset[];
  landscapeImages: SlideAsset[];
  portraitImages: SlideAsset[];
}

export const defaultSlideshowSettings = (): SlideshowSettings => ({
  enabled: false,
  tvScreenDurationMins: 5,
  tvScreenExtraSecs: 0,
  slideshowRunDurationMins: 3,
  slideshowRunExtraSecs: 0,
  durationPerImageSeconds: 5,
  pauseBeforeAdhanMins: 2,
  pauseAfterIqamahMins: 15,
  displayMode: 'full_screen',
  overlayCorner: 'top_right',
  overlaySizePercent: 25,
  images: [],
  landscapeImages: [],
  portraitImages: [],
});

export const tvScreenTotalSecs = (s: SlideshowSettings): number =>
  s.tvScreenDurationMins * 60 + s.tvScreenExtraSecs;
export const slideshowRunTotalSecs = (s: SlideshowSettings): number =>
  s.slideshowRunDurationMins * 60 + s.slideshowRunExtraSecs;

/** Right image list for the given orientation; falls back to legacy [images]. */
export const imagesForOrientation = (s: SlideshowSettings, isPortrait: boolean): SlideAsset[] => {
  if (isPortrait) return s.portraitImages.length ? s.portraitImages : s.images;
  return s.landscapeImages.length ? s.landscapeImages : s.images;
};

const parseAssets = (raw: unknown): SlideAsset[] =>
  Array.isArray(raw) ? raw.map((e) => slideAssetFromJson(e as Json)) : [];

export const slideshowSettingsFromJson = (j: Json): SlideshowSettings => ({
  enabled: bool(j.enabled, false),
  tvScreenDurationMins: int(j.tv_screen_duration_mins ?? j.interval_minutes, 5),
  tvScreenExtraSecs: int(j.tv_screen_extra_secs, 0),
  slideshowRunDurationMins: int(j.slideshow_run_duration_mins, 3),
  slideshowRunExtraSecs: int(j.slideshow_run_extra_secs, 0),
  durationPerImageSeconds: int(j.duration_per_image_seconds, 5),
  pauseBeforeAdhanMins: int(j.pause_before_adhan_mins, 2),
  pauseAfterIqamahMins: int(j.pause_after_iqamah_mins, 15),
  displayMode: str(j.display_mode, 'full_screen'),
  overlayCorner: str(j.overlay_corner, 'top_right'),
  overlaySizePercent: int(j.overlay_size_percent, 25),
  images: parseAssets(j.images),
  landscapeImages: parseAssets(j.landscape_images),
  portraitImages: parseAssets(j.portrait_images),
});

export const slideshowSettingsToJson = (s: SlideshowSettings): Json => ({
  enabled: s.enabled,
  tv_screen_duration_mins: s.tvScreenDurationMins,
  tv_screen_extra_secs: s.tvScreenExtraSecs,
  slideshow_run_duration_mins: s.slideshowRunDurationMins,
  slideshow_run_extra_secs: s.slideshowRunExtraSecs,
  duration_per_image_seconds: s.durationPerImageSeconds,
  pause_before_adhan_mins: s.pauseBeforeAdhanMins,
  pause_after_iqamah_mins: s.pauseAfterIqamahMins,
  display_mode: s.displayMode,
  overlay_corner: s.overlayCorner,
  overlay_size_percent: s.overlaySizePercent,
  images: s.images.map(slideAssetToJson),
  landscape_images: s.landscapeImages.map(slideAssetToJson),
  portrait_images: s.portraitImages.map(slideAssetToJson),
});

// ═══════════════════════════════════════════════════════════════
// JumuahSettings
// ═══════════════════════════════════════════════════════════════

export interface JumuahSettings {
  enabled: boolean;
  khutbahTime: string; // HH:mm
  iqamahTime: string; // HH:mm
  displayLabel: string;
}

export const defaultJumuahSettings = (): JumuahSettings => ({
  enabled: true,
  khutbahTime: '13:00',
  iqamahTime: '13:30',
  displayLabel: "Jumu'ah",
});

export const jumuahSettingsFromJson = (j: Json): JumuahSettings => ({
  enabled: bool(j.enabled, true),
  khutbahTime: str(j.khutbah_time, '13:00'),
  iqamahTime: str(j.iqamah_time, '13:30'),
  displayLabel: str(j.display_label, "Jumu'ah"),
});

export const jumuahSettingsToJson = (j: JumuahSettings): Json => ({
  enabled: j.enabled,
  khutbah_time: j.khutbahTime,
  iqamah_time: j.iqamahTime,
  display_label: j.displayLabel,
});

// ═══════════════════════════════════════════════════════════════
// SyncMeta (device-local; display fields synced via display_settings)
// ═══════════════════════════════════════════════════════════════

export type DisplayOrientation =
  | 'auto'
  | 'landscape'
  | 'landscape-flip'
  | 'portrait'
  | 'portrait-flip';

export interface SyncMeta {
  deviceId: string | null;
  supabaseConfigVersion: number;
  lastSuccessfulSync: number | null; // epoch ms
  linkedUsername: string | null;
  linkedMobile: string | null;
  linkedEmail: string | null;
  linkedMosqueName: string | null;
  displayOrientation: DisplayOrientation;
  customBackgroundPath: string | null;
  displayFontFamily: string | null;
  primaryTextColor: string | null;
  secondaryTextColor: string | null;
  prayerNameColor: string | null;
  prayerTimeColor: string | null;
  dateTextColor: string | null;
  tickerTextColor: string | null;
  adminLightTheme: boolean;
  pinEnabled: boolean;
  pinHash: string | null;
  backgroundImages: string[];
  activeBackgroundMediaId: string | null;
  showOrientationFab: boolean;
}

export const defaultSyncMeta = (): SyncMeta => ({
  deviceId: null,
  supabaseConfigVersion: 0,
  lastSuccessfulSync: null,
  linkedUsername: null,
  linkedMobile: null,
  linkedEmail: null,
  linkedMosqueName: null,
  displayOrientation: 'auto',
  customBackgroundPath: null,
  displayFontFamily: null,
  primaryTextColor: null,
  secondaryTextColor: null,
  prayerNameColor: null,
  prayerTimeColor: null,
  dateTextColor: null,
  tickerTextColor: null,
  adminLightTheme: false,
  pinEnabled: false,
  pinHash: null,
  backgroundImages: [],
  activeBackgroundMediaId: null,
  showOrientationFab: true,
});

export const syncMetaFromJson = (j: Json): SyncMeta => ({
  deviceId: strOrNull(j.device_id),
  supabaseConfigVersion: int(j.supabase_config_version, 0),
  lastSuccessfulSync: typeof j.last_successful_sync === 'number' ? j.last_successful_sync : null,
  linkedUsername: strOrNull(j.linked_username),
  linkedMobile: strOrNull(j.linked_mobile),
  linkedEmail: strOrNull(j.linked_email),
  linkedMosqueName: strOrNull(j.linked_mosque_name),
  displayOrientation: str(j.display_orientation, 'auto'),
  customBackgroundPath: strOrNull(j.custom_background_path),
  displayFontFamily: strOrNull(j.display_font_family),
  primaryTextColor: strOrNull(j.primary_text_color),
  secondaryTextColor: strOrNull(j.secondary_text_color),
  prayerNameColor: strOrNull(j.prayer_name_color),
  prayerTimeColor: strOrNull(j.prayer_time_color),
  dateTextColor: strOrNull(j.date_text_color),
  tickerTextColor: strOrNull(j.ticker_text_color),
  adminLightTheme: bool(j.admin_light_theme, false),
  pinEnabled: bool(j.pin_enabled, false),
  pinHash: strOrNull(j.pin_hash),
  backgroundImages: Array.isArray(j.background_images) ? (j.background_images as string[]) : [],
  activeBackgroundMediaId: strOrNull(j.active_background_media_id),
  showOrientationFab: bool(j.show_orientation_fab, true),
});

export const syncMetaToJson = (m: SyncMeta): Json => ({
  device_id: m.deviceId,
  supabase_config_version: m.supabaseConfigVersion,
  last_successful_sync: m.lastSuccessfulSync,
  linked_username: m.linkedUsername,
  linked_mobile: m.linkedMobile,
  linked_email: m.linkedEmail,
  linked_mosque_name: m.linkedMosqueName,
  display_orientation: m.displayOrientation,
  custom_background_path: m.customBackgroundPath,
  display_font_family: m.displayFontFamily,
  primary_text_color: m.primaryTextColor,
  secondary_text_color: m.secondaryTextColor,
  prayer_name_color: m.prayerNameColor,
  prayer_time_color: m.prayerTimeColor,
  date_text_color: m.dateTextColor,
  ticker_text_color: m.tickerTextColor,
  admin_light_theme: m.adminLightTheme,
  pin_enabled: m.pinEnabled,
  pin_hash: m.pinHash,
  background_images: m.backgroundImages,
  active_background_media_id: m.activeBackgroundMediaId,
  show_orientation_fab: m.showOrientationFab,
});

// ── Color resolution (hex → CSS color string, with Flutter defaults) ──

const parseHex = (hex: string | null, fallback: string): string => {
  if (!hex) return fallback;
  let h = hex.replace('#', '');
  if (h.length === 6 || h.length === 8) return `#${h}`;
  return fallback;
};

/** Read a CSS var from :root at call-time (SSR-safe: falls back to staticFallback). */
const cssVar = (name: string, staticFallback: string): string => {
  if (typeof document === 'undefined') return staticFallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || staticFallback;
};

export const resolvedColors = (m: SyncMeta) => ({
  primary:    parseHex(m.primaryTextColor,   cssVar('--c-primary',    '#FFFFFF')),
  secondary:  parseHex(m.secondaryTextColor, cssVar('--c-secondary',  '#00D4AA')),
  prayerName: parseHex(m.prayerNameColor,    cssVar('--c-prayer-name','#B8D4E8')),
  prayerTime: parseHex(m.prayerTimeColor,    cssVar('--c-prayer-time','#B8D4E8')),
  dateText:   parseHex(m.dateTextColor,      cssVar('--c-date',       '#7FA8C4')),
  ticker:     parseHex(m.tickerTextColor,    cssVar('--c-ticker',     '#00D4AA')),
});

// ═══════════════════════════════════════════════════════════════
// Root AppConfig
// ═══════════════════════════════════════════════════════════════

export interface AppConfig {
  profile: MasjidProfile;
  adjustments: TimeAdjustments;
  features: FeaturesFormat;
  slideshow: SlideshowSettings;
  jumuah: JumuahSettings;
  ticker: TickerSettings;
  meta: SyncMeta;
}

export const defaultAppConfig = (): AppConfig => ({
  profile: defaultMasjidProfile(),
  adjustments: defaultTimeAdjustments(),
  features: defaultFeaturesFormat(),
  slideshow: defaultSlideshowSettings(),
  jumuah: defaultJumuahSettings(),
  ticker: defaultTickerSettings(),
  meta: defaultSyncMeta(),
});

export const isLinked = (c: AppConfig): boolean =>
  c.profile.tenantId != null && c.profile.tenantId !== '';

/** Deserialize from the local-storage section map. */
export const appConfigFromStorageMap = (map: Json): AppConfig => ({
  profile: map.masjid_profile ? masjidProfileFromJson(map.masjid_profile) : defaultMasjidProfile(),
  adjustments: map.time_adjustments
    ? timeAdjustmentsFromJson(map.time_adjustments)
    : defaultTimeAdjustments(),
  features: map.features_format ? featuresFormatFromJson(map.features_format) : defaultFeaturesFormat(),
  slideshow: map.slideshow_settings
    ? slideshowSettingsFromJson(map.slideshow_settings)
    : defaultSlideshowSettings(),
  jumuah: map.jumuah_settings ? jumuahSettingsFromJson(map.jumuah_settings) : defaultJumuahSettings(),
  ticker: map.ticker_settings ? tickerSettingsFromJson(map.ticker_settings) : defaultTickerSettings(),
  meta: map.sync_meta ? syncMetaFromJson(map.sync_meta) : defaultSyncMeta(),
});

/**
 * Serialize to the Supabase config_json shape.
 * meta (device-local fields) is excluded, but display config is explicitly synced.
 */
export const appConfigToCloudJson = (c: AppConfig): Json => ({
  masjid_profile: masjidProfileToJson(c.profile),
  time_adjustments: timeAdjustmentsToJson(c.adjustments),
  features_format: featuresFormatToJson(c.features),
  slideshow_settings: slideshowSettingsToJson(c.slideshow),
  jumuah_settings: jumuahSettingsToJson(c.jumuah),
  ticker_settings: tickerSettingsToJson(c.ticker),
  display_settings: {
    custom_background_path: c.meta.customBackgroundPath,
    display_font_family: c.meta.displayFontFamily,
    primary_text_color: c.meta.primaryTextColor,
    secondary_text_color: c.meta.secondaryTextColor,
    prayer_name_color: c.meta.prayerNameColor,
    prayer_time_color: c.meta.prayerTimeColor,
    date_text_color: c.meta.dateTextColor,
    ticker_text_color: c.meta.tickerTextColor,
    display_orientation: c.meta.displayOrientation,
    admin_light_theme: c.meta.adminLightTheme,
    pin_enabled: c.meta.pinEnabled,
    pin_hash: c.meta.pinHash,
    background_images: c.meta.backgroundImages,
    active_background_media_id: c.meta.activeBackgroundMediaId,
    show_orientation_fab: c.meta.showOrientationFab,
  },
});

/**
 * Deserialize from Supabase config_json, preserving [localMeta] device-local
 * fields while applying cloud display settings.
 */
export const appConfigFromCloudJson = (j: Json, localMeta?: SyncMeta): AppConfig => {
  const ds: Json = j.display_settings ?? {};
  const base = localMeta ?? defaultSyncMeta();
  const mergedMeta: SyncMeta = {
    ...base,
    customBackgroundPath: strOrNull(ds.custom_background_path),
    displayFontFamily: strOrNull(ds.display_font_family),
    primaryTextColor: strOrNull(ds.primary_text_color),
    secondaryTextColor: strOrNull(ds.secondary_text_color),
    prayerNameColor: strOrNull(ds.prayer_name_color),
    prayerTimeColor: strOrNull(ds.prayer_time_color),
    dateTextColor: strOrNull(ds.date_text_color),
    tickerTextColor: strOrNull(ds.ticker_text_color),
    displayOrientation: str(ds.display_orientation, base.displayOrientation),
    adminLightTheme: bool(ds.admin_light_theme, base.adminLightTheme),
    pinEnabled: bool(ds.pin_enabled, base.pinEnabled),
    pinHash: strOrNull(ds.pin_hash) ?? base.pinHash,
    backgroundImages: Array.isArray(ds.background_images) ? (ds.background_images as string[]) : [],
    activeBackgroundMediaId: strOrNull(ds.active_background_media_id),
    showOrientationFab: bool(ds.show_orientation_fab, base.showOrientationFab),
  };

  return {
    profile: j.masjid_profile ? masjidProfileFromJson(j.masjid_profile) : defaultMasjidProfile(),
    adjustments: j.time_adjustments
      ? timeAdjustmentsFromJson(j.time_adjustments)
      : defaultTimeAdjustments(),
    features: j.features_format ? featuresFormatFromJson(j.features_format) : defaultFeaturesFormat(),
    slideshow: j.slideshow_settings
      ? slideshowSettingsFromJson(j.slideshow_settings)
      : defaultSlideshowSettings(),
    jumuah: j.jumuah_settings ? jumuahSettingsFromJson(j.jumuah_settings) : defaultJumuahSettings(),
    ticker: j.ticker_settings ? tickerSettingsFromJson(j.ticker_settings) : defaultTickerSettings(),
    meta: mergedMeta,
  };
};
