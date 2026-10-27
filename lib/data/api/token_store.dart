import 'package:shared_preferences/shared_preferences.dart';

/// Holds the agent's access and refresh tokens between launches.
///
/// Values are cached in memory after the first read so the API client does
/// not touch storage on every request.
class TokenStore {
  TokenStore();

  static const _accessKey = 'auth_access_token';
  static const _refreshKey = 'auth_refresh_token';

  String? _accessToken;
  String? _refreshToken;
  bool _loaded = false;

  Future<void> _load() async {
    if (_loaded) return;
    final prefs = await SharedPreferences.getInstance();
    _accessToken = prefs.getString(_accessKey);
    _refreshToken = prefs.getString(_refreshKey);
    _loaded = true;
  }

  Future<String?> accessToken() async {
    await _load();
    return _accessToken;
  }

  Future<String?> refreshToken() async {
    await _load();
    return _refreshToken;
  }

  /// True when there is anything worth trying against the server.
  Future<bool> hasSession() async {
    await _load();
    return _accessToken != null || _refreshToken != null;
  }

  Future<void> save({
    required String accessToken,
    required String refreshToken,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_accessKey, accessToken);
    await prefs.setString(_refreshKey, refreshToken);
    _accessToken = accessToken;
    _refreshToken = refreshToken;
    _loaded = true;
  }

  Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_accessKey);
    await prefs.remove(_refreshKey);
    _accessToken = null;
    _refreshToken = null;
    _loaded = true;
  }
}
