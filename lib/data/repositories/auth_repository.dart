import '../models/user.dart';

class AuthException implements Exception {
  const AuthException(this.message);

  final String message;

  @override
  String toString() => message;
}

/// A password reset in progress. The server has sent a 6-digit code to the
/// agent's mobile; [resetToken] ties the code to this attempt.
class PasswordResetChallenge {
  const PasswordResetChallenge({
    required this.resetToken,
    required this.expiresInMinutes,
    this.devOtp,
  });

  final String resetToken;
  final int expiresInMinutes;

  /// Only set outside production, where no SMS provider is configured —
  /// lets the flow be tested end to end.
  final String? devOtp;
}

abstract interface class AuthRepository {
  /// The signed-in user from the persisted session, or null.
  Future<User?> currentUser();

  Future<User> login({required String mobile, required String password});

  Future<PasswordResetChallenge> requestPasswordReset({
    required String mobile,
  });

  /// Finishes the reset. Every existing session is signed out.
  Future<void> confirmPasswordReset({
    required String resetToken,
    required String otp,
    required String newPassword,
  });

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  });

  Future<void> logout();
}
