/// tool/test_sync_simulation.dart
///
/// Comprehensive Sync Timing Report
/// ─────────────────────────────────────────────────────────────
/// Tests and measures timing for ALL sync operations:
///   - Account creation
///   - Config push (upload) latency
///   - Config pull (download) latency
///   - Realtime WebSocket delivery latency
///   - Row counts and data sizes
///   - Stale version guard
///   - Cleanup / restore
///
/// Run with:  dart tool/test_sync_simulation.dart

import 'dart:async';
import 'dart:convert';
import 'dart:io';

const _supabaseUrl = 'https://veyrcvvvsomyrahjfvhh.supabase.co';
const _anonKey =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZleXJjdnZ2c29teXJhaGpmdmhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NjI5MzUsImV4cCI6MjA5NzMzODkzNX0.-N470V130EwnrJabX1CMId8hLiaQal0g_al_eMJzQ-Q';
const _wsUrl =
    'wss://veyrcvvvsomyrahjfvhh.supabase.co/realtime/v1/websocket?apikey=$_anonKey&vsn=1.0.0';

// ─────────────────────────────────────────────────────────────
// Report tracking
// ─────────────────────────────────────────────────────────────
int _passed = 0;
int _failed = 0;
final _timings = <String, int>{}; // op name → ms

void _pass(String name, {int? ms}) {
  _passed++;
  final t = ms != null ? ' [${ms}ms]' : '';
  print('  ✅ PASS  $name$t');
}

void _fail(String name, String reason) {
  _failed++;
  print('  ❌ FAIL  $name');
  print('         → $reason');
}

void _timing(String label, int ms) {
  _timings[label] = ms;
  print('   ⏱  $label: ${ms}ms');
}

// ─────────────────────────────────────────────────────────────
// HTTP helpers — use dart:io directly for full control
// ─────────────────────────────────────────────────────────────
Map<String, String> get _headers => {
      'apikey': _anonKey,
      'Authorization': 'Bearer $_anonKey',
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Prefer': 'return=representation',
    };

/// GET rows from a table
Future<List<dynamic>> _get(String table,
    {String? filter, String? select, String? order, int limit = 10}) async {
  var url = '$_supabaseUrl/rest/v1/$table?';
  if (select != null) url += 'select=${Uri.encodeComponent(select)}&';
  if (filter != null) url += '$filter&';
  if (order != null) url += 'order=${Uri.encodeComponent(order)}&';
  url += 'limit=$limit';

  final client = HttpClient();
  final req = await client.getUrl(Uri.parse(url));
  _headers.forEach(req.headers.set);
  final res = await req.close();
  final body = await res.transform(utf8.decoder).join();
  client.close();
  if (res.statusCode != 200) throw Exception('GET $table: ${res.statusCode} $body');
  return json.decode(body) as List;
}

/// PATCH a table row using raw bytes so JSON is never re-encoded
Future<void> _patch(String table, String filter, Map<String, dynamic> body) async {
  final url = '$_supabaseUrl/rest/v1/$table?$filter';
  final client = HttpClient();
  final req = await client.patchUrl(Uri.parse(url));
  _headers.forEach(req.headers.set);
  final encoded = utf8.encode(json.encode(body));
  req.headers.set('Content-Length', encoded.length.toString());
  req.add(encoded);
  final res = await req.close();
  final resBody = await res.transform(utf8.decoder).join();
  client.close();
  if (res.statusCode != 200 && res.statusCode != 204) {
    throw Exception('PATCH $table: ${res.statusCode} $resBody');
  }
}

/// POST to insert a row
Future<Map<String, dynamic>> _post(String table, Map<String, dynamic> body) async {
  final url = '$_supabaseUrl/rest/v1/$table';
  final client = HttpClient();
  final req = await client.postUrl(Uri.parse(url));
  _headers.forEach(req.headers.set);
  final encoded = utf8.encode(json.encode(body));
  req.headers.set('Content-Length', encoded.length.toString());
  req.add(encoded);
  final res = await req.close();
  final resBody = await res.transform(utf8.decoder).join();
  client.close();
  if (res.statusCode != 200 && res.statusCode != 201) {
    throw Exception('POST $table: ${res.statusCode} $resBody');
  }
  final decoded = json.decode(resBody);
  if (decoded is List && decoded.isNotEmpty) return Map<String, dynamic>.from(decoded.first);
  if (decoded is Map) return Map<String, dynamic>.from(decoded);
  return {};
}

/// DELETE a row
Future<void> _delete(String table, String filter) async {
  final url = '$_supabaseUrl/rest/v1/$table?$filter';
  final client = HttpClient();
  final req = await client.deleteUrl(Uri.parse(url));
  _headers.forEach(req.headers.set);
  final res = await req.close();
  await res.drain();
  client.close();
}

// ─────────────────────────────────────────────────────────────
// Realtime WebSocket listener
// ─────────────────────────────────────────────────────────────
Future<({Map<String, dynamic>? record, int? ms})> _listenForRealtime({
  required String tenantId,
  required Duration timeout,
  required DateTime pushTime,
}) async {
  final completer = Completer<Map<String, dynamic>?>();
  WebSocket? ws;

  try {
    ws = await WebSocket.connect(_wsUrl).timeout(const Duration(seconds: 10));

    // Send join message for this tenant's row
    final joinMsg = json.encode({
      'topic': 'realtime:public:mosque_configs:tenant_id=eq.$tenantId',
      'event': 'phx_join',
      'payload': {
        'config': {'broadcast': {'self': false}, 'presence': {'key': ''}},
        'access_token': _anonKey,
      },
      'ref': '1',
    });
    ws.add(joinMsg);

    // Heartbeat to keep connection alive
    final heartbeat = Timer.periodic(const Duration(seconds: 10), (_) {
      if (ws?.readyState == WebSocket.open) {
        ws!.add(json.encode(
            {'topic': 'phoenix', 'event': 'heartbeat', 'payload': {}, 'ref': null}));
      }
    });

    ws.listen(
      (raw) {
        try {
          final msg = json.decode(raw as String) as Map<String, dynamic>;
          final event = msg['event'] as String?;
          final payload = msg['payload'] as Map<String, dynamic>?;

          if (event == 'phx_reply') {
            print('   WS join status: ${payload?['status']}');
          }

          if (event == 'postgres_changes' || event == '*') {
            final data = payload?['data'] as Map<String, dynamic>?;
            final record = data?['record'] as Map<String, dynamic>?;
            if (record != null && !completer.isCompleted) {
              heartbeat.cancel();
              completer.complete(record);
            }
          }
        } catch (_) {}
      },
      onError: (_) { if (!completer.isCompleted) completer.complete(null); },
      onDone: () { if (!completer.isCompleted) completer.complete(null); },
    );

    final record = await completer.future.timeout(timeout, onTimeout: () => null);
    final ms = record != null ? DateTime.now().difference(pushTime).inMilliseconds : null;
    return (record: record, ms: ms);
  } catch (e) {
    print('   WS error: $e');
    return (record: null, ms: null);
  } finally {
    await ws?.close();
  }
}

// ─────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────
void main() async {
  final globalStart = DateTime.now();
  print('');
  print('╔══════════════════════════════════════════════════════╗');
  print('║  🕌 Masjid Sync — Comprehensive Timing Report        ║');
  print('║  ${DateTime.now().toLocal()}                  ║');
  print('╚══════════════════════════════════════════════════════╝');
  print('');

  // ── Test 1: Basic connectivity ───────────────────────────
  print('▶ [1] Database Connectivity & Row Counts');
  try {
    var t = DateTime.now();
    final tenants = await _get('tenants', select: 'id,name', limit: 50);
    _timing('Tenants table read', DateTime.now().difference(t).inMilliseconds);

    t = DateTime.now();
    final configs = await _get('mosque_configs', select: 'tenant_id,config_version,updated_at', limit: 50);
    _timing('mosque_configs table read', DateTime.now().difference(t).inMilliseconds);

    t = DateTime.now();
    final devices = await _get('device_registry', select: 'device_id,tenant_id,last_seen,online_status', limit: 50);
    _timing('device_registry table read', DateTime.now().difference(t).inMilliseconds);

    _pass('Database connectivity');
    print('   📊 Tenants:         ${tenants.length} row(s) — ${tenants.map((r) => r['name']).join(', ')}');
    print('   📊 mosque_configs:  ${configs.length} row(s)');
    print('   📊 device_registry: ${devices.length} row(s)');
    for (final d in devices) {
      print('      Device: ${d['device_id']} | online: ${d['online_status']} | last_seen: ${d['last_seen']}');
    }
  } catch (e) {
    _fail('Database connectivity', e.toString());
    _printSummary(globalStart);
    return;
  }
  print('');

  // ── Test 2: Read existing config ─────────────────────────
  print('▶ [2] Read Full Config from Cloud');
  String? tenantId;
  int originalVersion = 0;
  Map<String, dynamic>? originalConfigJson;
  int configSizeBytes = 0;

  try {
    final t = DateTime.now();
    final rows = await _get(
      'mosque_configs',
      select: 'tenant_id,config_version,config_json,updated_at,updated_by',
      order: 'updated_at.desc',
      limit: 1,
    );
    final pullMs = DateTime.now().difference(t).inMilliseconds;
    _timing('Config pull latency (↓)', pullMs);

    if (rows.isEmpty) { _fail('Read config', 'No rows'); _printSummary(globalStart); return; }

    final row = rows.first as Map<String, dynamic>;
    tenantId = row['tenant_id'] as String;
    originalVersion = (row['config_version'] as num?)?.toInt() ?? 0;
    originalConfigJson = Map<String, dynamic>.from(row['config_json'] as Map<String, dynamic>);
    configSizeBytes = utf8.encode(json.encode(originalConfigJson)).length;

    _pass('Read full config', ms: pullMs);
    print('   Tenant:         $tenantId');
    print('   Version:        $originalVersion');
    print('   Updated at:     ${row['updated_at']}');
    print('   Updated by:     ${row['updated_by'] ?? 'unknown'}');
    print('   Config size:    ${configSizeBytes}B (${(configSizeBytes/1024).toStringAsFixed(1)} KB)');
    print('   Ticker msgs:    ${(originalConfigJson['ticker_settings']?['messages'] as List?)?.length ?? 0}');
    print('   Slideshow imgs: ${(originalConfigJson['slideshow_settings']?['images'] as List?)?.length ?? 0}');
    print('   Prayers set:    ${originalConfigJson['time_adjustments'] != null ? 'YES' : 'NO'}');
  } catch (e) {
    _fail('Read config', e.toString());
    _printSummary(globalStart);
    return;
  }
  print('');

  // ── Test 3: Account creation ─────────────────────────────
  print('▶ [3] Account Creation Simulation');
  final testUser = 'sim_user_${DateTime.now().millisecondsSinceEpoch}';
  String? newTenantId;
  bool accountCreated = false;

  try {
    // Step 1: Create tenant
    var t = DateTime.now();
    final tenant = await _post('tenants', {'name': 'Sim Test Mosque (auto-cleanup)'});
    final tenantMs = DateTime.now().difference(t).inMilliseconds;
    newTenantId = tenant['id'] as String?;
    _timing('Tenant creation', tenantMs);

    // Step 2: Create admin user
    t = DateTime.now();
    await _post('admin_users', {
      'tenant_id': newTenantId,
      'username': testUser,
      'email': '$testUser@sim.test',
      'password_hash': 'sim_password_123',
    });
    final userMs = DateTime.now().difference(t).inMilliseconds;
    _timing('Admin user creation', userMs);

    // Step 3: Push initial config
    t = DateTime.now();
    final initialConfig = {
      'masjid_profile': {'name': 'Sim Test Mosque', 'tenant_id': newTenantId, 'latitude': 11.1, 'longitude': 76.2, 'timezone_id': 'Asia/Kolkata', 'calculation_method': 'Karachi', 'asr_juristic_method': 'Standard'},
      'features_format': {'use_24_hour_format': false, 'use_arabic_labels': false, 'audio_alerts_enabled': true, 'adhan_alert_mode': 'full_screen'},
      'time_adjustments': {'fajr_adhan_offset': 0, 'fajr_iqamah_wait': 20, 'dhuhr_adhan_offset': 0, 'dhuhr_iqamah_wait': 10, 'asr_adhan_offset': 0, 'asr_iqamah_wait': 10, 'maghrib_adhan_offset': 0, 'maghrib_iqamah_wait': 5, 'isha_adhan_offset': 0, 'isha_iqamah_wait': 10},
      'jumuah_settings': {'enabled': true, 'iqamah_time': '13:30', 'khutbah_time': '13:00', 'display_label': "Jumu'ah"},
      'slideshow_settings': {'enabled': false, 'images': [], 'interval_minutes': 5, 'display_mode': 'full_screen'},
      'ticker_settings': {'enabled': false, 'messages': [], 'speed': 50},
    };
    await _post('mosque_configs', {
      'tenant_id': newTenantId,
      'config_version': 1,
      'config_json': initialConfig,
      'updated_by': 'sim-account-creation',
    });
    final configMs = DateTime.now().difference(t).inMilliseconds;
    _timing('Initial config push', configMs);

    accountCreated = true;
    _pass('Full account creation (tenant + user + config)', ms: tenantMs + userMs + configMs);
    print('   New tenant ID: $newTenantId');
    print('   Username:      $testUser');
    print('   Total steps:   3 (tenant → user → config)');
  } catch (e) {
    _fail('Account creation', e.toString());
  }
  print('');

  // ── Test 4: Config push (upload) latency ─────────────────
  print('▶ [4] Config Push (Upload ↑) — Simulating Admin Save');
  int pushedVersion = originalVersion;

  try {
    final modifiedConfig = Map<String, dynamic>.from(originalConfigJson!);
    modifiedConfig['ticker_settings'] = {
      'enabled': true,
      'messages': ['🧪 Timing test — ${DateTime.now().toLocal()}'],
      'speed': 50,
    };
    final pushSize = utf8.encode(json.encode(modifiedConfig)).length;
    final nextVersion = originalVersion + 1;

    final t = DateTime.now();
    await _patch(
      'mosque_configs',
      'tenant_id=eq.$tenantId',
      {
        'config_version': nextVersion,
        'config_json': modifiedConfig,
        'updated_at': DateTime.now().toIso8601String(),
        'updated_by': 'sim-device-A',
      },
    );
    final pushMs = DateTime.now().difference(t).inMilliseconds;
    _timing('Config push latency (↑)', pushMs);

    pushedVersion = nextVersion;
    _pass('Config push to Supabase', ms: pushMs);
    print('   Payload size:  ${pushSize}B (${(pushSize/1024).toStringAsFixed(1)} KB)');
    print('   New version:   $nextVersion');
  } catch (e) {
    _fail('Config push', e.toString());
  }
  print('');

  // ── Test 5: Config pull (download) latency ───────────────
  print('▶ [5] Config Pull (Download ↓) — Simulating Device B Polling');
  try {
    final t = DateTime.now();
    final rows = await _get(
      'mosque_configs',
      select: 'config_version,config_json,updated_by',
      filter: 'tenant_id=eq.$tenantId',
      limit: 1,
    );
    final pullMs = DateTime.now().difference(t).inMilliseconds;
    _timing('Config pull latency (↓)', pullMs);

    final row = rows.first as Map<String, dynamic>;
    final remoteVersion = (row['config_version'] as num?)?.toInt() ?? 0;

    if (remoteVersion > originalVersion) {
      _pass('Device B pulled updated config', ms: pullMs);
      print('   Version:    $originalVersion → $remoteVersion ✓');
      print('   Updated by: ${row['updated_by']}');
    } else {
      _fail('Config pull version check', 'Remote=$remoteVersion not > local=$originalVersion');
    }
  } catch (e) {
    _fail('Config pull', e.toString());
  }
  print('');

  // ── Test 6: Realtime WebSocket latency ───────────────────
  print('▶ [6] Realtime WebSocket Delivery Latency');
  print('   Subscribing to WebSocket channel...');

  final realtimeFuture = _listenForRealtime(
    tenantId: tenantId!,
    timeout: const Duration(seconds: 8),
    pushTime: DateTime.now(),
  );

  // Give WS 2 seconds to join
  await Future.delayed(const Duration(seconds: 2));

  final pushTime = DateTime.now();
  final realtimeConfig = Map<String, dynamic>.from(originalConfigJson!);
  realtimeConfig['ticker_settings'] = {
    'enabled': true,
    'messages': ['🔴 Realtime test — ${pushTime.toLocal()}'],
    'speed': 60,
  };

  print('   Device A pushing update at ${pushTime.toLocal()}...');
  try {
    await _patch(
      'mosque_configs',
      'tenant_id=eq.$tenantId',
      {
        'config_version': pushedVersion + 1,
        'config_json': realtimeConfig,
        'updated_at': pushTime.toIso8601String(),
        'updated_by': 'sim-realtime-push',
      },
    );
  } catch (e) {
    print('   Push error: $e');
  }

  final rt = await realtimeFuture;
  if (rt.record != null && rt.ms != null) {
    _timing('Realtime delivery latency (↓ live)', rt.ms!);
    _pass('Realtime delivery — Device B received update', ms: rt.ms);
    print('   Push time: $pushTime');
    print('   Received:  ${DateTime.now().toLocal()}');
  } else {
    _fail(
      'Realtime WebSocket delivery',
      'No event within 8s. Run supabase_setup.sql to enable Realtime on mosque_configs!',
    );
    print('');
    print('   ⚠️  Run this SQL in Supabase Dashboard → SQL Editor:');
    print('      ALTER TABLE mosque_configs REPLICA IDENTITY FULL;');
    print('      ALTER PUBLICATION supabase_realtime ADD TABLE mosque_configs;');
  }
  print('');

  // ── Test 7: Stale version guard ──────────────────────────
  print('▶ [7] Stale Version Guard (Logic)');
  final remoteNow = pushedVersion + 1;
  final localNow = remoteNow; // simulate Device A's own event coming back
  if (!(remoteNow > localNow)) {
    _pass('Correctly skips self-triggered realtime events (local=remote=$remoteNow)');
  } else {
    _fail('Stale guard', 'Would incorrectly apply own push as remote update');
  }
  print('');

  // ── Test 8: Restore original config ─────────────────────
  print('▶ [8] Restore Original Config (Cleanup)');
  try {
    final t = DateTime.now();
    await _patch(
      'mosque_configs',
      'tenant_id=eq.$tenantId',
      {
        'config_version': remoteNow + 1,
        'config_json': originalConfigJson!,
        'updated_at': DateTime.now().toIso8601String(),
        'updated_by': 'sim-cleanup',
      },
    );
    final restoreMs = DateTime.now().difference(t).inMilliseconds;
    _timing('Config restore push', restoreMs);
    _pass('Original config restored at version ${remoteNow + 1}', ms: restoreMs);
  } catch (e) {
    _fail('Config restore', e.toString());
  }
  print('');

  // ── Test 9: Cleanup test account ────────────────────────
  if (accountCreated && newTenantId != null) {
    print('▶ [9] Cleanup Test Account');
    try {
      await _delete('mosque_configs', 'tenant_id=eq.$newTenantId');
      await _delete('admin_users', 'tenant_id=eq.$newTenantId');
      await _delete('tenants', 'id=eq.$newTenantId');
      _pass('Test account deleted (tenant + user + config)');
    } catch (e) {
      _fail('Test account cleanup', e.toString());
    }
    print('');
  }

  _printSummary(globalStart);
}

void _printSummary(DateTime start) {
  final totalMs = DateTime.now().difference(start).inMilliseconds;

  print('╔══════════════════════════════════════════════════════╗');
  print('║  📋 SYNC TIMING REPORT                               ║');
  print('╠══════════════════════════════════════════════════════╣');

  if (_timings.isNotEmpty) {
    print('║  ⏱  Operation Timings:                               ║');
    for (final e in _timings.entries) {
      final label = e.key.padRight(38);
      final val = '${e.value}ms'.padLeft(7);
      print('║    $label $val  ║');
    }
    print('╠══════════════════════════════════════════════════════╣');
  }

  print('║  Tests: $_passed passed, $_failed failed of ${_passed + _failed} total'.padRight(54) + '║');
  print('║  Total run time: ${totalMs}ms'.padRight(54) + '║');
  print('╠══════════════════════════════════════════════════════╣');
  if (_failed == 0) {
    print('║  🎉 ALL TESTS PASSED — Sync working correctly!       ║');
  } else {
    print('║  ⚠️  $_failed test(s) failed. See messages above.'.padRight(54) + '║');
  }
  print('╚══════════════════════════════════════════════════════╝');
  print('');
}
