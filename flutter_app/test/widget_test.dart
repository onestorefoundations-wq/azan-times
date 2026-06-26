import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_app/main.dart';
import 'package:flutter_app/core/storage_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  testWidgets('TvDisplay initializes and shows clock and empty prayer table', (WidgetTester tester) async {
    // Initialize storage mock if needed, or just let it use in-memory SharedPreferences
    SharedPreferences.setMockInitialValues({});
    await StorageService.init();

    await tester.pumpWidget(const MosqueTvApp());
    await tester.pumpAndSettle();

    // Verify Clock is there (usually indicated by a colon for time formatting like '14:30')
    expect(find.byType(Text), findsWidgets);

    // Check for prayer names
    expect(find.text('Fajr'), findsOneWidget);
    expect(find.text('Dhuhr'), findsOneWidget);
    expect(find.text('Asr'), findsOneWidget);
    expect(find.text('Maghrib'), findsOneWidget);
    expect(find.text('Isha'), findsOneWidget);

    // Capture the golden screenshot of the exact rendered UI
    await expectLater(find.byType(MosqueTvApp), matchesGoldenFile('ui_render_proof.png'));
  });
}
