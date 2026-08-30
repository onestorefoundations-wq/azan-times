/// auth_session.dart
/// Holds the tenant-scoped JWT minted by the `auth` Edge Function and drives
/// the login / register / refresh calls.
///
/// This replaces the old scheme where the client queried admin_users directly
/// and compared the typed password to password_hash — which required the anon
/// key baked into the app to have read access to the credential table. Nothing
/// here ever sees a stored password, and every Supabase request now travels as
/// an `authenticated` role carrying a tenant_id claim, which is what the RLS
/// policies in supabase/02_security_hardening.sql filter on.
library;

import 'dart:convert';
import 'dart:developer' as dev;
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class AuthSessionData {
  final String token;
  final String refreshToken;
  final int expiresAt; // epoch ms
  final String userId;
  final String tenantId;
  final String username;
  final String mobile;
  final String email;
  final String mosqueName;

  const AuthSessionData({
    required this.token,
    required this.refreshToken,
    required this.expiresAt,
    required this.userId,
    required this.tenantId,
    required this.username,
    required this.mobile,
    required this.email,
    required this.mosqueName,
  });

  factory AuthSessionData.fromJson(Map<String, dynamic> j) => AuthSessionData(
        token: j['token'] as String,
        refreshToken: j['refreshToken'] as String? ?? '',
        expiresAt: (j['expiresAt'] as num?)?.toInt() ?? 0,
        userId: j['userId'] as String? ?? '',
        tenantId: j['tenantId'] as String,
        username: j['username'] as String? ?? '',
        mobile: j['mobile'] as String? ?? '',
        email: j['email'] as String? ?? '',
        mosqueName: j['mosqueName'] as String? ?? 'Linked Mosque',
      );
}

class AuthSession {
  static const _kToken = 'auth_token';
  static const _kRefreshToken = 'auth_refresh_token';
  static const _kExpiresAt = 'auth_token_expires_at';
  static const _kUserId = 'auth_user_id';

  /// Supabase access tokens last about an hour, so this is a margin before
  /// expiry rather than a renewal interval. The refresh token is what keeps a
  /// display signed in across months of uptime.
  static const _refreshWindow = Duration(minutes: 5);

  static late SharedPreferences _prefs;
  static late String _functionsUrl;
  static late String _anonKey;
  static String? _cachedToken;

  static Future<void> init({
    required String supabaseUrl,
    required String anonKey,
  }) async {
    _prefs = await SharedPreferences.getInstance();
    _functionsUrl = '$supabaseUrl/functions/v1';
    _anonKey = anonKey;
    _cachedToken = _prefs.getString(_kToken);
  }

  /// Synchronous so it can back the client's accessToken callback cheaply.
  static String? get token => _cachedToken;

  static int get expiresAt => _prefs.getInt(_kExpiresAt) ?? 0;

  static bool get isExpired {
    final exp = expiresAt;
    return exp > 0 && DateTime.now().millisecondsSinceEpoch >= exp;
  }

  static String? get refreshToken => _prefs.getString(_kRefreshToken);

  static Future<void> _save(AuthSessionData s) async {
    _cachedToken = s.token;
    await _prefs.setString(_kToken, s.token);
    if (s.refreshToken.isNotEmpty) {
      await _prefs.setString(_kRefreshToken, s.refreshToken);
    }
    await _prefs.setInt(_kExpiresAt, s.expiresAt);
    await _prefs.setString(_kUserId, s.userId);
  }

  static Future<void> clear() async {
    _cachedToken = null;
    await _prefs.remove(_kToken);
    await _prefs.remove(_kRefreshToken);
    await _prefs.remove(_kExpiresAt);
    await _prefs.remove(_kUserId);
  }

  static Future<AuthSessionData> login(String identifier, String password) async {
    final s = await _call({
      'action': 'login',
      'identifier': identifier,
      'password': password,
    });
    await _save(s);
    return s;
  }

  static Future<AuthSessionData> register({
    required String mosqueName,
    required String username,
    required String password,
    String? mobile,
    String? email,
  }) async {
    final s = await _call({
      'action': 'register',
      'mosqueName': mosqueName,
      'username': username,
      'password': password,
      'mobile': mobile,
      'email': email,
    });
    await _save(s);
    return s;
  }

  /// Renews the access token when it is close to expiring. Returns false only
  /// when the session is genuinely gone and the user has to link again; a
  /// network failure leaves the existing token in place so a display that is
  /// merely offline does not sign itself out.
  static Future<bool> refreshIfNeeded() async {
    final current = _cachedToken;
    final refresh = refreshToken;
    if (current == null && refresh == null) return false;

    final exp = expiresAt;
    if (current != null &&
        exp > 0 &&
        exp - DateTime.now().millisecondsSinceEpoch > _refreshWindow.inMilliseconds) {
      return true;
    }

    if (refresh == null) return false;

    try {
      await _save(await _call({'action': 'refresh', 'refreshToken': refresh}));
      return true;
    } catch (e) {
      dev.log('[Auth] refresh failed: $e');
      return !isExpired;
    }
  }

  static Future<AuthSessionData> _call(Map<String, dynamic> body) async {
    final res = await http.post(
      Uri.parse('$_functionsUrl/auth'),
      headers: {
        'Content-Type': 'application/json',
        'apikey': _anonKey,
        'Authorization': 'Bearer $_anonKey',
      },
      body: jsonEncode(body),
    );

    Map<String, dynamic> data;
    try {
      data = jsonDecode(res.body) as Map<String, dynamic>;
    } catch (_) {
      data = {};
    }

    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw Exception(data['error'] as String? ?? 'Auth failed (${res.statusCode})');
    }
    return AuthSessionData.fromJson(data);
  }
}
