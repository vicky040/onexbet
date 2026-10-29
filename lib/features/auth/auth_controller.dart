import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/models/user.dart';
import '../../data/providers.dart';
import '../../data/repositories/auth_repository.dart';

/// Holds the signed-in user (null when logged out). The router listens to
/// this to redirect between the auth screens and the app.
class AuthController extends AsyncNotifier<User?> {
  AuthRepository get _repo => ref.read(authRepositoryProvider);

  @override
  Future<User?> build() {
    // A refresh token that the server has rejected cannot be recovered from,
    // so drop straight back to the login screen.
    ref.watch(apiClientProvider).onSessionExpired = () {
      if (state.hasValue && state.value != null) {
        state = const AsyncData(null);
      }
    };

    return ref.watch(authRepositoryProvider).currentUser();
  }

  Future<void> login(String mobile, String password) async {
    final user = await _repo.login(mobile: mobile, password: password);
    state = AsyncData(user);
  }

  Future<PasswordResetChallenge> requestPasswordReset(String mobile) =>
      _repo.requestPasswordReset(mobile: mobile);

  Future<void> confirmPasswordReset({
    required String resetToken,
    required String otp,
    required String newPassword,
  }) =>
      _repo.confirmPasswordReset(
        resetToken: resetToken,
        otp: otp,
        newPassword: newPassword,
      );

  Future<void> changePassword(String currentPassword, String newPassword) =>
      _repo.changePassword(
        currentPassword: currentPassword,
        newPassword: newPassword,
      );

  Future<void> logout() async {
    await _repo.logout();
    state = const AsyncData(null);
    // Drop everything that was loaded for the agent who just left.
    ref.invalidate(summaryProvider);
    ref.invalidate(earningsProvider);
    ref.invalidate(payinsProvider);
    ref.invalidate(openPayoutsProvider);
    ref.invalidate(payoutPaymentsProvider);
    ref.invalidate(banksProvider);
    ref.invalidate(depositsProvider);
    ref.invalidate(notificationsProvider);
    ref.invalidate(supportChatProvider);
  }
}

final authControllerProvider =
    AsyncNotifierProvider<AuthController, User?>(AuthController.new);
