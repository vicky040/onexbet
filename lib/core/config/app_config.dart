import 'package:flutter/foundation.dart';

abstract final class AppConfig {
  /// Where the backend in `admin/` is listening.
  ///
  /// Override it at build time:
  ///
  /// ```sh
  /// flutter run --dart-define=API_BASE_URL=http://192.168.1.20:3000/api/v1
  /// ```
  static const _override = String.fromEnvironment('API_BASE_URL');

  static String get apiBaseUrl {
    if (_override.isNotEmpty) return _override;
    // The Android emulator reaches the host machine on 10.0.2.2; everywhere
    // else localhost is the host.
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
      return 'http://10.0.2.2:3000/api/v1';
    }
    return 'http://localhost:3000/api/v1';
  }

  /// How long to wait for a single request before giving up.
  static const requestTimeout = Duration(seconds: 20);
}
