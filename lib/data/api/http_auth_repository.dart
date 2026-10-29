import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../core/config/app_config.dart';
import '../models/json.dart';
import '../models/user.dart';
import '../repositories/auth_repository.dart';
import 'api_client.dart';
import 'api_exception.dart';
import 'token_store.dart';

/// [AuthRepository] against `/api/v1/auth/*`.
///
/// Failures are re-thrown as [AuthException] because that is what the auth
/// screens already catch; the server's message is written to be shown to the
/// user, so it is passed through untouched.
class HttpAuthRepository implements AuthRepository {
  HttpAuthRepository(this._api, this._tokens);

  final ApiClient _api;
  final TokenStore _tokens;

  Future<T> _guard<T>(Future<T> Function() call) async {
    try {
      return await call();
    } on ApiException catch (error) {
      throw AuthException(error.message);
    } on AuthException {
      rethrow;
    } catch (error) {
      // Anything unexpected still has to reach the user as a message. An
      // error that escapes here would propagate past the auth screens'
      // catch and leave a button that simply does nothing.
      debugPrint('Unexpected auth failure: $error');
      throw const AuthException('Something went wrong. Please try again.');
    }
  }

  /// Stores the tokens from a login or change-password response.
  Future<void> _saveSession(Map<String, dynamic> data) async {
    final access = data['accessToken'];
    final refresh = data['refreshToken'];
    if (access is String && refresh is String) {
      await _tokens.save(accessToken: access, refreshToken: refresh);
    }
  }

  @override
  Future<User?> currentUser() async {
    // Nothing stored means nobody is signed in — no need to ask the server.
    if (!await _tokens.hasSession()) return null;

    try {
      final data = asObject(
        // The launch screen is blocked on this call, so it gets a shorter
        // leash than an ordinary request.
        await _api
            .get('/auth/me')
            .timeout(AppConfig.sessionRestoreTimeout),
      );
      return parseResponse(() => User.fromJson(asObject(data['user'])));
    } on ApiException catch (error) {
      // An expired or revoked session is simply "logged out". A network
      // failure is reported so the app does not silently sign the agent out
      // because their train went into a tunnel.
      if (error.isUnauthorized || error.code == 'forbidden') {
        await _tokens.clear();
        return null;
      }
      throw AuthException(error.message);
    } on TimeoutException {
      throw const AuthException(
        'Could not reach the server. Please check your connection and sign in again.',
      );
    }
  }

  @override
  Future<User> login({
    required String mobile,
    required String password,
  }) =>
      _guard(() async {
        final data = asObject(
          await _api.post(
            '/auth/login',
            body: {'mobile': mobile, 'password': password},
            authenticated: false,
          ),
        );
        await _saveSession(data);
        return parseResponse(() => User.fromJson(asObject(data['user'])));
      });

  @override
  Future<PasswordResetChallenge> requestPasswordReset({
    required String mobile,
  }) =>
      _guard(() async {
        final data = asObject(
          await _api.post(
            '/auth/password-reset/request',
            body: {'mobile': mobile},
            authenticated: false,
          ),
        );
        return parseResponse(
          () => PasswordResetChallenge(
            resetToken: asString(data['resetToken']),
            expiresInMinutes: asInt(data['expiresInMinutes']),
            devOtp: data['devOtp'] as String?,
          ),
        );
      });

  @override
  Future<void> confirmPasswordReset({
    required String resetToken,
    required String otp,
    required String newPassword,
  }) =>
      _guard(() async {
        await _api.post(
          '/auth/password-reset/confirm',
          body: {
            'resetToken': resetToken,
            'otp': otp,
            'newPassword': newPassword,
          },
          authenticated: false,
        );
        // Resetting revokes every session, including this device's.
        await _tokens.clear();
      });

  @override
  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) =>
      _guard(() async {
        final data = asObject(
          await _api.post(
            '/auth/change-password',
            body: {
              'currentPassword': currentPassword,
              'newPassword': newPassword,
            },
          ),
        );
        // Other devices are signed out; this one gets a fresh session.
        await _saveSession(data);
      });

  @override
  Future<void> logout() async {
    final refreshToken = await _tokens.refreshToken();
    try {
      await _api.post(
        '/auth/logout',
        body: refreshToken == null ? null : {'refreshToken': refreshToken},
      );
    } on ApiException {
      // Being unable to tell the server must not trap the agent in the app;
      // the local tokens go either way.
    }
    await _tokens.clear();
  }
}
