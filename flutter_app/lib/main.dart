/// main.dart
/// App entry point — initializes all services and wraps app in MultiProvider.

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:provider/provider.dart';
import 'core/storage_service.dart';
import 'core/supabase_sync_service.dart';
import 'core/device_service.dart';
import 'core/prayer_engine.dart';
import 'providers/app_provider.dart';
import 'pages/tv_display.dart';
import 'l10n/app_localizations.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize timezone data
  PrayerEngine.initTimezone();

  // Initialize local storage
  await StorageService.init();

  // Generate/persist device ID
  await DeviceService.getOrCreateDeviceId();

  // Initialize Supabase client
  await SupabaseSyncService.init();

  runApp(
    ChangeNotifierProvider(
      create: (_) => AppProvider()..init(),
      child: const MosqueTvApp(),
    ),
  );
}

class MosqueTvApp extends StatelessWidget {
  const MosqueTvApp({super.key});

  @override
  Widget build(BuildContext context) {
    final langCode = context.select<AppProvider, String>(
      (p) => p.config?.features.displayLanguage ?? 'en',
    );
    final locale = Locale(langCode);
    final isRtl = langCode == 'ar' || langCode == 'ur' || langCode == 'fa' || langCode == 'ps';

    return MaterialApp(
      title: 'Islamic Digital Signage',
      debugShowCheckedModeBanner: false,
      locale: locale,
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      builder: (context, child) {
        // Force RTL for Arabic and Urdu
        return Directionality(
          textDirection: isRtl ? TextDirection.rtl : TextDirection.ltr,
          child: child!,
        );
      },
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF0F172A),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF14B8A6),
          secondary: Color(0xFF3B82F6),
          surface: Color(0xFF1E293B),
        ),
        fontFamily: 'Roboto',
        switchTheme: SwitchThemeData(
          thumbColor: MaterialStateProperty.resolveWith((states) {
            return states.contains(MaterialState.selected)
                ? const Color(0xFF14B8A6)
                : const Color(0xFF64748B);
          }),
          trackColor: MaterialStateProperty.resolveWith((states) {
            return states.contains(MaterialState.selected)
                ? const Color(0xFF14B8A6).withOpacity(0.4)
                : const Color(0xFF334155);
          }),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: const Color(0xFF263549),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: Color(0xFF334155)),
          ),
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF14B8A6),
            foregroundColor: const Color(0xFF0F172A),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          ),
        ),
        dropdownMenuTheme: const DropdownMenuThemeData(
          textStyle: TextStyle(color: Color(0xFFE2E8F0)),
        ),
      ),
      home: const TvDisplay(),
    );
  }
}
