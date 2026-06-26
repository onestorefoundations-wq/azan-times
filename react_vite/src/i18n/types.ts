/**
 * i18n/types.ts
 * String keys mirror flutter_app/lib/l10n/app_localizations.dart exactly.
 */
export interface Strings {
  loading: string;
  // Prayer names
  prayerFajr: string;
  prayerSunrise: string;
  prayerDhuhr: string;
  prayerAsr: string;
  prayerMaghrib: string;
  prayerIsha: string;
  prayerJumuah: string;
  // Table headers
  headerPrayer: string;
  headerAdhan: string;
  headerIqamah: string;
  // Clock / alerts
  nextPrayer: string;
  adhanIn: string;
  iqamahIn: string;
  adhanActive: string;
  iqamahActive: string;
  adhanTime: string;
  iqamahTime: string;
  iqamahStartingIn: string;
  dismiss: string;
  // Settings chrome
  settingsPanel: string;
  saveChanges: string;
  discard: string;
  logout: string;
  loggedOut: string;
  incorrectPin: string;
  cancel: string;
  tabGeneral: string;
  tabLocation: string;
  tabPrayerOffsets: string;
  tabSlideshow: string;
  tabTicker: string;
  tabSystemPrefs: string;
  tabMediaLibrary: string;
  tabCloud: string;
  displayLanguage: string;
  // Language names
  langEnglish: string;
  langArabic: string;
  langMalayalam: string;
  langAmharic: string;
  langAzerbaijani: string;
  langBengali: string;
  langChinese: string;
  langDutch: string;
  langFrench: string;
  langGerman: string;
  langGujarati: string;
  langHausa: string;
  langHindi: string;
  langIndonesian: string;
  langItalian: string;
  langKannada: string;
  langKurdish: string;
  langMalay: string;
  langPashto: string;
  langPersian: string;
  langPortuguese: string;
  langRussian: string;
  langSinhala: string;
  langSomali: string;
  langSpanish: string;
  langSwahili: string;
  langTagalog: string;
  langTamil: string;
  langTelugu: string;
  langTurkish: string;
  langUrdu: string;
  langUzbek: string;
  langYoruba: string;
  // Settings field labels
  masjidName: string;
  masjidNameArabic: string;
  enableSlideshow: string;
  tvScreenDisplayTime: string;
  slideshowRunDuration: string;
  durationPerImage: string;
  sectionJumuah: string;
  overrideDhuhrJumuah: string;
  khutbahTime: string;
  jumuahIqamahTime: string;
  displayLabel: string;
  enableTicker: string;
  noMessagesYet: string;
  addMessage: string;
  sectionAppearance: string;
  analogClock: string;
  use24Hour: string;
  useArabicLabels: string;
  enableSoundAlerts: string;
  adhanAlertMode: string;
  alertFullScreen: string;
  alertDismissible: string;
  alertSidePanel: string;
  displayFont: string;
  displayOrientation: string;
  orientAuto: string;
  orientLandscape: string;
  orientPortrait: string;
  requirePin: string;
  newPin: string;
  setPin: string;
  deleteImage: string;
  noImagesYet: string;
  importFromDevice: string;
  pendingUpload: string;
  getMyLocation: string;
  calcMethod: string;
  asrMethod: string;
  prayerCol: string;
  adhanOffsetCol: string;
  iqamahWaitCol: string;
}

export type LocaleCode =
  | 'en' | 'ar' | 'ml' | 'am' | 'az' | 'bn' | 'zh' | 'nl' | 'fr' | 'de'
  | 'gu' | 'ha' | 'hi' | 'id' | 'it' | 'kn' | 'ku' | 'ms' | 'ps' | 'fa'
  | 'pt' | 'ru' | 'si' | 'so' | 'es' | 'sw' | 'tl' | 'ta' | 'te' | 'tr'
  | 'ur' | 'uz' | 'yo';
