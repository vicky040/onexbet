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

  /// How long the launch screen may wait for "am I still signed in?".
  ///
  /// Shorter than [requestTimeout]: the router holds the user on the splash
  /// until this resolves, so a slow network must drop them at the login
  /// screen rather than leave them watching the logo.
  static const sessionRestoreTimeout = Duration(seconds: 8);

  /// Where the Android build can be downloaded from.
  ///
  /// ```sh
  /// flutter build web --dart-define=ANDROID_APK_URL=/downloads/app-release.apk
  /// ```
  ///
  /// Left empty the Profile screen simply does not offer the download, rather
  /// than showing a link that goes nowhere.
  static const androidApkUrl = String.fromEnvironment("ANDROID_APK_URL");

  static bool get hasAndroidDownload => androidApkUrl.isNotEmpty;
}
