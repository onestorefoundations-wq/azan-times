import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_am.dart';
import 'app_localizations_ar.dart';
import 'app_localizations_az.dart';
import 'app_localizations_bn.dart';
import 'app_localizations_de.dart';
import 'app_localizations_en.dart';
import 'app_localizations_es.dart';
import 'app_localizations_fa.dart';
import 'app_localizations_fr.dart';
import 'app_localizations_gu.dart';
import 'app_localizations_ha.dart';
import 'app_localizations_hi.dart';
import 'app_localizations_id.dart';
import 'app_localizations_it.dart';
import 'app_localizations_kn.dart';
import 'app_localizations_ku.dart';
import 'app_localizations_ml.dart';
import 'app_localizations_ms.dart';
import 'app_localizations_nl.dart';
import 'app_localizations_ps.dart';
import 'app_localizations_pt.dart';
import 'app_localizations_ru.dart';
import 'app_localizations_si.dart';
import 'app_localizations_so.dart';
import 'app_localizations_sw.dart';
import 'app_localizations_ta.dart';
import 'app_localizations_te.dart';
import 'app_localizations_tl.dart';
import 'app_localizations_tr.dart';
import 'app_localizations_ur.dart';
import 'app_localizations_uz.dart';
import 'app_localizations_yo.dart';
import 'app_localizations_zh.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
      : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
    delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
  ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('am'),
    Locale('ar'),
    Locale('az'),
    Locale('bn'),
    Locale('de'),
    Locale('en'),
    Locale('es'),
    Locale('fa'),
    Locale('fr'),
    Locale('gu'),
    Locale('ha'),
    Locale('hi'),
    Locale('id'),
    Locale('it'),
    Locale('kn'),
    Locale('ku'),
    Locale('ml'),
    Locale('ms'),
    Locale('nl'),
    Locale('ps'),
    Locale('pt'),
    Locale('ru'),
    Locale('si'),
    Locale('so'),
    Locale('sw'),
    Locale('ta'),
    Locale('te'),
    Locale('tl'),
    Locale('tr'),
    Locale('ur'),
    Locale('uz'),
    Locale('yo'),
    Locale('zh')
  ];

  /// No description provided for @loading.
  ///
  /// In en, this message translates to:
  /// **'Loading prayer times...'**
  String get loading;

  /// No description provided for @prayerFajr.
  ///
  /// In en, this message translates to:
  /// **'Fajr'**
  String get prayerFajr;

  /// No description provided for @prayerSunrise.
  ///
  /// In en, this message translates to:
  /// **'Sunrise'**
  String get prayerSunrise;

  /// No description provided for @prayerDhuhr.
  ///
  /// In en, this message translates to:
  /// **'Dhuhr'**
  String get prayerDhuhr;

  /// No description provided for @prayerAsr.
  ///
  /// In en, this message translates to:
  /// **'Asr'**
  String get prayerAsr;

  /// No description provided for @prayerMaghrib.
  ///
  /// In en, this message translates to:
  /// **'Maghrib'**
  String get prayerMaghrib;

  /// No description provided for @prayerIsha.
  ///
  /// In en, this message translates to:
  /// **'Isha'**
  String get prayerIsha;

  /// No description provided for @prayerJumuah.
  ///
  /// In en, this message translates to:
  /// **'Jumu\'ah'**
  String get prayerJumuah;

  /// No description provided for @headerPrayer.
  ///
  /// In en, this message translates to:
  /// **'Prayer'**
  String get headerPrayer;

  /// No description provided for @headerAdhan.
  ///
  /// In en, this message translates to:
  /// **'Adhan'**
  String get headerAdhan;

  /// No description provided for @headerIqamah.
  ///
  /// In en, this message translates to:
  /// **'Iqamah'**
  String get headerIqamah;

  /// No description provided for @nextPrayer.
  ///
  /// In en, this message translates to:
  /// **'Next Prayer'**
  String get nextPrayer;

  /// No description provided for @adhanIn.
  ///
  /// In en, this message translates to:
  /// **'Adhan in'**
  String get adhanIn;

  /// No description provided for @iqamahIn.
  ///
  /// In en, this message translates to:
  /// **'Iqamah in'**
  String get iqamahIn;

  /// No description provided for @adhanActive.
  ///
  /// In en, this message translates to:
  /// **'ADHAN ACTIVE'**
  String get adhanActive;

  /// No description provided for @iqamahActive.
  ///
  /// In en, this message translates to:
  /// **'IQAMAH ACTIVE'**
  String get iqamahActive;

  /// No description provided for @adhanTime.
  ///
  /// In en, this message translates to:
  /// **'ADHAN TIME'**
  String get adhanTime;

  /// No description provided for @iqamahTime.
  ///
  /// In en, this message translates to:
  /// **'IQAMAH TIME'**
  String get iqamahTime;

  /// No description provided for @iqamahStartingIn.
  ///
  /// In en, this message translates to:
  /// **'Iqamah starting in'**
  String get iqamahStartingIn;

  /// No description provided for @dismiss.
  ///
  /// In en, this message translates to:
  /// **'Dismiss'**
  String get dismiss;

  /// No description provided for @settingsPanel.
  ///
  /// In en, this message translates to:
  /// **'Settings Panel'**
  String get settingsPanel;

  /// No description provided for @saveChanges.
  ///
  /// In en, this message translates to:
  /// **'Save Changes'**
  String get saveChanges;

  /// No description provided for @discard.
  ///
  /// In en, this message translates to:
  /// **'Discard'**
  String get discard;

  /// No description provided for @logout.
  ///
  /// In en, this message translates to:
  /// **'Logout'**
  String get logout;

  /// No description provided for @loggedOut.
  ///
  /// In en, this message translates to:
  /// **'Logged out successfully'**
  String get loggedOut;

  /// No description provided for @incorrectPin.
  ///
  /// In en, this message translates to:
  /// **'Incorrect PIN. Try again.'**
  String get incorrectPin;

  /// No description provided for @cancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get cancel;

  /// No description provided for @tabGeneral.
  ///
  /// In en, this message translates to:
  /// **'General Info'**
  String get tabGeneral;

  /// No description provided for @tabLocation.
  ///
  /// In en, this message translates to:
  /// **'Location & Calc'**
  String get tabLocation;

  /// No description provided for @tabPrayerOffsets.
  ///
  /// In en, this message translates to:
  /// **'Prayer Offsets'**
  String get tabPrayerOffsets;

  /// No description provided for @tabSlideshow.
  ///
  /// In en, this message translates to:
  /// **'Slideshow & Jumu\'ah'**
  String get tabSlideshow;

  /// No description provided for @tabTicker.
  ///
  /// In en, this message translates to:
  /// **'Scrolling Ticker'**
  String get tabTicker;

  /// No description provided for @tabSystemPrefs.
  ///
  /// In en, this message translates to:
  /// **'System Preferences'**
  String get tabSystemPrefs;

  /// No description provided for @tabMediaLibrary.
  ///
  /// In en, this message translates to:
  /// **'Media Library'**
  String get tabMediaLibrary;

  /// No description provided for @tabCloud.
  ///
  /// In en, this message translates to:
  /// **'Cloud & Sync'**
  String get tabCloud;

  /// No description provided for @displayLanguage.
  ///
  /// In en, this message translates to:
  /// **'Display Language'**
  String get displayLanguage;

  /// No description provided for @langEnglish.
  ///
  /// In en, this message translates to:
  /// **'English'**
  String get langEnglish;

  /// No description provided for @langArabic.
  ///
  /// In en, this message translates to:
  /// **'العربية'**
  String get langArabic;

  /// No description provided for @langMalayalam.
  ///
  /// In en, this message translates to:
  /// **'മലയാളം'**
  String get langMalayalam;

  /// No description provided for @langAmharic.
  ///
  /// In en, this message translates to:
  /// **'አማርኛ'**
  String get langAmharic;

  /// No description provided for @langAzerbaijani.
  ///
  /// In en, this message translates to:
  /// **'Azərbaycan'**
  String get langAzerbaijani;

  /// No description provided for @langBengali.
  ///
  /// In en, this message translates to:
  /// **'বাংলা'**
  String get langBengali;

  /// No description provided for @langChinese.
  ///
  /// In en, this message translates to:
  /// **'中文'**
  String get langChinese;

  /// No description provided for @langDutch.
  ///
  /// In en, this message translates to:
  /// **'Nederlands'**
  String get langDutch;

  /// No description provided for @langFrench.
  ///
  /// In en, this message translates to:
  /// **'Français'**
  String get langFrench;

  /// No description provided for @langGerman.
  ///
  /// In en, this message translates to:
  /// **'Deutsch'**
  String get langGerman;

  /// No description provided for @langGujarati.
  ///
  /// In en, this message translates to:
  /// **'ગુજરાતી'**
  String get langGujarati;

  /// No description provided for @langHausa.
  ///
  /// In en, this message translates to:
  /// **'Hausa'**
  String get langHausa;

  /// No description provided for @langHindi.
  ///
  /// In en, this message translates to:
  /// **'हिन्दी'**
  String get langHindi;

  /// No description provided for @langIndonesian.
  ///
  /// In en, this message translates to:
  /// **'Bahasa Indonesia'**
  String get langIndonesian;

  /// No description provided for @langItalian.
  ///
  /// In en, this message translates to:
  /// **'Italiano'**
  String get langItalian;

  /// No description provided for @langKannada.
  ///
  /// In en, this message translates to:
  /// **'ಕನ್ನಡ'**
  String get langKannada;

  /// No description provided for @langKurdish.
  ///
  /// In en, this message translates to:
  /// **'Kurdî'**
  String get langKurdish;

  /// No description provided for @langMalay.
  ///
  /// In en, this message translates to:
  /// **'Bahasa Melayu'**
  String get langMalay;

  /// No description provided for @langPashto.
  ///
  /// In en, this message translates to:
  /// **'پښتو'**
  String get langPashto;

  /// No description provided for @langPersian.
  ///
  /// In en, this message translates to:
  /// **'فارسی'**
  String get langPersian;

  /// No description provided for @langPortuguese.
  ///
  /// In en, this message translates to:
  /// **'Português'**
  String get langPortuguese;

  /// No description provided for @langRussian.
  ///
  /// In en, this message translates to:
  /// **'Русский'**
  String get langRussian;

  /// No description provided for @langSinhala.
  ///
  /// In en, this message translates to:
  /// **'සිංහල'**
  String get langSinhala;

  /// No description provided for @langSomali.
  ///
  /// In en, this message translates to:
  /// **'Soomaali'**
  String get langSomali;

  /// No description provided for @langSpanish.
  ///
  /// In en, this message translates to:
  /// **'Español'**
  String get langSpanish;

  /// No description provided for @langSwahili.
  ///
  /// In en, this message translates to:
  /// **'Kiswahili'**
  String get langSwahili;

  /// No description provided for @langTagalog.
  ///
  /// In en, this message translates to:
  /// **'Filipino'**
  String get langTagalog;

  /// No description provided for @langTamil.
  ///
  /// In en, this message translates to:
  /// **'தமிழ்'**
  String get langTamil;

  /// No description provided for @langTelugu.
  ///
  /// In en, this message translates to:
  /// **'తెలుగు'**
  String get langTelugu;

  /// No description provided for @langTurkish.
  ///
  /// In en, this message translates to:
  /// **'Türkçe'**
  String get langTurkish;

  /// No description provided for @langUrdu.
  ///
  /// In en, this message translates to:
  /// **'اردو'**
  String get langUrdu;

  /// No description provided for @langUzbek.
  ///
  /// In en, this message translates to:
  /// **'O\'zbek'**
  String get langUzbek;

  /// No description provided for @langYoruba.
  ///
  /// In en, this message translates to:
  /// **'Yorùbá'**
  String get langYoruba;

  /// No description provided for @masjidName.
  ///
  /// In en, this message translates to:
  /// **'Masjid / Mosque Name'**
  String get masjidName;

  /// No description provided for @masjidNameArabic.
  ///
  /// In en, this message translates to:
  /// **'Arabic Mosque Name (Optional)'**
  String get masjidNameArabic;

  /// No description provided for @enableSlideshow.
  ///
  /// In en, this message translates to:
  /// **'Enable Announcement Image Slideshow'**
  String get enableSlideshow;

  /// No description provided for @tvScreenDisplayTime.
  ///
  /// In en, this message translates to:
  /// **'TV Screen Display Time'**
  String get tvScreenDisplayTime;

  /// No description provided for @slideshowRunDuration.
  ///
  /// In en, this message translates to:
  /// **'Slideshow Run Duration'**
  String get slideshowRunDuration;

  /// No description provided for @durationPerImage.
  ///
  /// In en, this message translates to:
  /// **'Duration Per Image (Seconds)'**
  String get durationPerImage;

  /// No description provided for @sectionJumuah.
  ///
  /// In en, this message translates to:
  /// **'Friday Jumu\'ah Override'**
  String get sectionJumuah;

  /// No description provided for @overrideDhuhrJumuah.
  ///
  /// In en, this message translates to:
  /// **'Override Dhuhr with Jumu\'ah on Fridays'**
  String get overrideDhuhrJumuah;

  /// No description provided for @khutbahTime.
  ///
  /// In en, this message translates to:
  /// **'Khutbah Start Time (Adhan)'**
  String get khutbahTime;

  /// No description provided for @jumuahIqamahTime.
  ///
  /// In en, this message translates to:
  /// **'Jumu\'ah Prayer / Iqamah Time'**
  String get jumuahIqamahTime;

  /// No description provided for @displayLabel.
  ///
  /// In en, this message translates to:
  /// **'Display Label'**
  String get displayLabel;

  /// No description provided for @enableTicker.
  ///
  /// In en, this message translates to:
  /// **'Enable Scrolling Ticker'**
  String get enableTicker;

  /// No description provided for @noMessagesYet.
  ///
  /// In en, this message translates to:
  /// **'No messages added yet.'**
  String get noMessagesYet;

  /// No description provided for @addMessage.
  ///
  /// In en, this message translates to:
  /// **'Add'**
  String get addMessage;

  /// No description provided for @sectionAppearance.
  ///
  /// In en, this message translates to:
  /// **'Display Appearance'**
  String get sectionAppearance;

  /// No description provided for @analogClock.
  ///
  /// In en, this message translates to:
  /// **'Analog Clock Display'**
  String get analogClock;

  /// No description provided for @use24Hour.
  ///
  /// In en, this message translates to:
  /// **'Use 24-Hour Time Format'**
  String get use24Hour;

  /// No description provided for @useArabicLabels.
  ///
  /// In en, this message translates to:
  /// **'Use Arabic Prayer Labels'**
  String get useArabicLabels;

  /// No description provided for @enableSoundAlerts.
  ///
  /// In en, this message translates to:
  /// **'Enable Adhan & Iqamah Sound Alerts'**
  String get enableSoundAlerts;

  /// No description provided for @adhanAlertMode.
  ///
  /// In en, this message translates to:
  /// **'Adhan Alert Display Mode'**
  String get adhanAlertMode;

  /// No description provided for @alertFullScreen.
  ///
  /// In en, this message translates to:
  /// **'Mode 1: Full Screen Alert (Covers entire screen)'**
  String get alertFullScreen;

  /// No description provided for @alertDismissible.
  ///
  /// In en, this message translates to:
  /// **'Mode 2: Dismissible Alert (Shows close button)'**
  String get alertDismissible;

  /// No description provided for @alertSidePanel.
  ///
  /// In en, this message translates to:
  /// **'Mode 3: Side Panel Only (No overlay)'**
  String get alertSidePanel;

  /// No description provided for @displayFont.
  ///
  /// In en, this message translates to:
  /// **'Display Font Family'**
  String get displayFont;

  /// No description provided for @displayOrientation.
  ///
  /// In en, this message translates to:
  /// **'Display Orientation'**
  String get displayOrientation;

  /// No description provided for @orientAuto.
  ///
  /// In en, this message translates to:
  /// **'Auto (Follow Device Rotation)'**
  String get orientAuto;

  /// No description provided for @orientLandscape.
  ///
  /// In en, this message translates to:
  /// **'Force Landscape (Recommended for TVs)'**
  String get orientLandscape;

  /// No description provided for @orientPortrait.
  ///
  /// In en, this message translates to:
  /// **'Force Portrait'**
  String get orientPortrait;

  /// No description provided for @requirePin.
  ///
  /// In en, this message translates to:
  /// **'Require PIN to Open Settings'**
  String get requirePin;

  /// No description provided for @newPin.
  ///
  /// In en, this message translates to:
  /// **'New PIN'**
  String get newPin;

  /// No description provided for @setPin.
  ///
  /// In en, this message translates to:
  /// **'Set PIN'**
  String get setPin;

  /// No description provided for @deleteImage.
  ///
  /// In en, this message translates to:
  /// **'Delete Image'**
  String get deleteImage;

  /// No description provided for @noImagesYet.
  ///
  /// In en, this message translates to:
  /// **'No images yet'**
  String get noImagesYet;

  /// No description provided for @importFromDevice.
  ///
  /// In en, this message translates to:
  /// **'Import from Device / USB (No internet)'**
  String get importFromDevice;

  /// No description provided for @pendingUpload.
  ///
  /// In en, this message translates to:
  /// **'Pending'**
  String get pendingUpload;

  /// No description provided for @getMyLocation.
  ///
  /// In en, this message translates to:
  /// **'Get My Location'**
  String get getMyLocation;

  /// No description provided for @calcMethod.
  ///
  /// In en, this message translates to:
  /// **'Calculation Method'**
  String get calcMethod;

  /// No description provided for @asrMethod.
  ///
  /// In en, this message translates to:
  /// **'Asr Juristic Method'**
  String get asrMethod;

  /// No description provided for @prayerCol.
  ///
  /// In en, this message translates to:
  /// **'Prayer'**
  String get prayerCol;

  /// No description provided for @adhanOffsetCol.
  ///
  /// In en, this message translates to:
  /// **'Adhan Offset (Mins)'**
  String get adhanOffsetCol;

  /// No description provided for @iqamahWaitCol.
  ///
  /// In en, this message translates to:
  /// **'Iqamah Wait (Mins)'**
  String get iqamahWaitCol;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) => <String>[
        'am',
        'ar',
        'az',
        'bn',
        'de',
        'en',
        'es',
        'fa',
        'fr',
        'gu',
        'ha',
        'hi',
        'id',
        'it',
        'kn',
        'ku',
        'ml',
        'ms',
        'nl',
        'ps',
        'pt',
        'ru',
        'si',
        'so',
        'sw',
        'ta',
        'te',
        'tl',
        'tr',
        'ur',
        'uz',
        'yo',
        'zh'
      ].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'am':
      return AppLocalizationsAm();
    case 'ar':
      return AppLocalizationsAr();
    case 'az':
      return AppLocalizationsAz();
    case 'bn':
      return AppLocalizationsBn();
    case 'de':
      return AppLocalizationsDe();
    case 'en':
      return AppLocalizationsEn();
    case 'es':
      return AppLocalizationsEs();
    case 'fa':
      return AppLocalizationsFa();
    case 'fr':
      return AppLocalizationsFr();
    case 'gu':
      return AppLocalizationsGu();
    case 'ha':
      return AppLocalizationsHa();
    case 'hi':
      return AppLocalizationsHi();
    case 'id':
      return AppLocalizationsId();
    case 'it':
      return AppLocalizationsIt();
    case 'kn':
      return AppLocalizationsKn();
    case 'ku':
      return AppLocalizationsKu();
    case 'ml':
      return AppLocalizationsMl();
    case 'ms':
      return AppLocalizationsMs();
    case 'nl':
      return AppLocalizationsNl();
    case 'ps':
      return AppLocalizationsPs();
    case 'pt':
      return AppLocalizationsPt();
    case 'ru':
      return AppLocalizationsRu();
    case 'si':
      return AppLocalizationsSi();
    case 'so':
      return AppLocalizationsSo();
    case 'sw':
      return AppLocalizationsSw();
    case 'ta':
      return AppLocalizationsTa();
    case 'te':
      return AppLocalizationsTe();
    case 'tl':
      return AppLocalizationsTl();
    case 'tr':
      return AppLocalizationsTr();
    case 'ur':
      return AppLocalizationsUr();
    case 'uz':
      return AppLocalizationsUz();
    case 'yo':
      return AppLocalizationsYo();
    case 'zh':
      return AppLocalizationsZh();
  }

  throw FlutterError(
      'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
      'an issue with the localizations generation tool. Please file an issue '
      'on GitHub with a reproducible sample app and the gen-l10n configuration '
      'that was used.');
}
