import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../core/config/app_config.dart';
import 'api_exception.dart';
import 'token_store.dart';

/// Talks to the backend in `admin/`.
///
/// Responsibilities kept in one place: the base URL, the bearer header,
/// unwrapping the `{ ok, data }` envelope, turning `{ ok: false, error }`
/// into an [ApiException], and refreshing an expired access token once
/// before giving up.
class ApiClient {
  ApiClient({
    required this.baseUrl,
    required this.tokens,
    http.Client? httpClient,
  }) : _http = httpClient ?? http.Client();

  final String baseUrl;
  final TokenStore tokens;
  final http.Client _http;

  /// Called when the session is gone for good — a refresh failed, or there
  /// was nothing to refresh with. Wired to the auth controller so the app
  /// returns to the login screen.
  void Function()? onSessionExpired;

  /// Guards against a burst of 401s all refreshing at once.
  Future<bool>? _refreshing;

  Future<dynamic> get(
    String path, {
    Map<String, String>? query,
    bool authenticated = true,
  }) =>
      _request('GET', path, query: query, authenticated: authenticated);

  Future<dynamic> post(
    String path, {
    Object? body,
    bool authenticated = true,
  }) =>
      _request('POST', path, body: body, authenticated: authenticated);

  Future<dynamic> patch(String path, {Object? body}) =>
      _request('PATCH', path, body: body);

  Future<dynamic> delete(String path) => _request('DELETE', path);

  void close() => _http.close();

  // -------------------------------------------------------------------------

  Uri _uri(String path, Map<String, String>? query) {
    final uri = Uri.parse('$baseUrl$path');
    if (query == null || query.isEmpty) return uri;
    return uri.replace(queryParameters: {...uri.queryParameters, ...query});
  }

  Future<dynamic> _request(
    String method,
    String path, {
    Object? body,
    Map<String, String>? query,
    bool authenticated = true,
  }) async {
    var response = await _send(
      method,
      path,
      body: body,
      query: query,
      authenticated: authenticated,
    );

    // One retry, after refreshing the access token.
    if (response.statusCode == 401 && authenticated) {
      if (await _refreshSession()) {
        response = await _send(
          method,
          path,
          body: body,
          query: query,
          authenticated: authenticated,
        );
      }
    }

    return _decode(response);
  }

  Future<http.Response> _send(
    String method,
    String path, {
    Object? body,
    Map<String, String>? query,
    required bool authenticated,
  }) async {
    final request = http.Request(method, _uri(path, query))
      ..headers['accept'] = 'application/json';

    if (body != null) {
      request.headers['content-type'] = 'application/json';
      request.body = jsonEncode(body);
    }

    if (authenticated) {
      final token = await tokens.accessToken();
      if (token != null) request.headers['authorization'] = 'Bearer $token';
    }

    try {
      final streamed =
          await _http.send(request).timeout(AppConfig.requestTimeout);
      return http.Response.fromStream(streamed);
    } on TimeoutException {
      throw ApiException.network(
        'The server took too long to respond. Please try again.',
      );
    } on http.ClientException catch (e) {
      throw ApiException.network(_networkMessage(e.message));
    } catch (e) {
      // SocketException and friends, without importing dart:io (which the
      // web build cannot use).
      throw ApiException.network(_networkMessage('$e'));
    }
  }

  String _networkMessage(String detail) =>
      'Could not reach the server at $baseUrl. Make sure it is running.'
      '\n($detail)';

  dynamic _decode(http.Response response) {
    Map<String, dynamic>? envelope;
    if (response.body.isNotEmpty) {
      try {
        final decoded = jsonDecode(response.body);
        if (decoded is Map<String, dynamic>) envelope = decoded;
      } on FormatException {
        // Not JSON — most likely an HTML error page from a proxy.
      }
    }

    if (envelope == null) {
      throw ApiException(
        code: 'server_error',
        statusCode: response.statusCode,
        message: response.statusCode >= 500
            ? 'The server had a problem. Please try again shortly.'
            : 'Unexpected response from the server (${response.statusCode}).',
      );
    }

    if (envelope['ok'] == true) return envelope['data'];

    final error = envelope['error'];
    if (error is! Map<String, dynamic>) {
      throw ApiException(
        code: 'server_error',
        statusCode: response.statusCode,
        message: 'Unexpected response from the server.',
      );
    }

    final rawDetails = error['details'];
    throw ApiException(
      code: error['code'] as String? ?? 'server_error',
      message: error['message'] as String? ?? 'Something went wrong.',
      statusCode: response.statusCode,
      details: rawDetails is List
          ? rawDetails
              .whereType<Map<String, dynamic>>()
              .map(FieldError.fromJson)
              .toList()
          : const [],
    );
  }

  /// Exchanges the refresh token for a new pair. Returns false when there is
  /// nothing to refresh with, or the server refused — in which case the
  /// stored tokens are cleared and [onSessionExpired] fires.
  Future<bool> _refreshSession() {
    return _refreshing ??= _performRefresh().whenComplete(() {
      _refreshing = null;
    });
  }

  Future<bool> _performRefresh() async {
    final refreshToken = await tokens.refreshToken();
    if (refreshToken == null) {
      await _endSession();
      return false;
    }

    final http.Response response;
    try {
      response = await _send(
        'POST',
        '/auth/refresh',
        body: {'refreshToken': refreshToken},
        authenticated: false,
      );
    } on ApiException {
      // The server is unreachable: keep the tokens so the session survives
      // a flaky connection, and let the original call report the failure.
      return false;
    }

    try {
      final data = _decode(response);
      if (data is Map<String, dynamic>) {
        final access = data['accessToken'];
        final refresh = data['refreshToken'];
        if (access is String && refresh is String) {
          await tokens.save(accessToken: access, refreshToken: refresh);
          return true;
        }
      }
    } on ApiException {
      // Fall through: the refresh token is spent or revoked.
    }

    await _endSession();
    return false;
  }

  Future<void> _endSession() async {
    await tokens.clear();
    onSessionExpired?.call();
  }
}
