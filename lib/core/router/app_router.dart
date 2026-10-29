import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/accounts/accounts_screen.dart';
import '../../features/accounts/bank_form_screen.dart';
import '../../features/auth/auth_controller.dart';
import '../../features/auth/forgot_password_screen.dart';
import '../../features/auth/login_screen.dart';
import '../../features/auth/splash_screen.dart';
import '../../features/deposit/deposit_screen.dart';
import '../../features/earnings/earnings_screen.dart';
import '../../features/history/history_screen.dart';
import '../../features/home/home_screen.dart';
import '../../features/notifications/notifications_screen.dart';
import '../../features/payin/payin_screen.dart';
import '../../features/payout/my_payments_screen.dart';
import '../../features/payout/payout_screen.dart';
import '../../features/profile/profile_screen.dart';
import '../../features/shell/main_shell.dart';
import '../../features/support/support_chat_screen.dart';
import 'routes.dart';

final rootNavigatorKey = GlobalKey<NavigatorState>(debugLabel: 'root');

/// Decides where to send the user based on the auth state. The splash stays
/// up until its animation has finished ([splashComplete]).
String? authRedirect(
  AsyncValue<Object?> auth,
  Uri uri, {
  bool splashComplete = true,
}) {
  final location = uri.path;
  final isAuthRoute = Routes.authRoutes.contains(location);

  if (location == Routes.splash && !splashComplete) return null;

  if (auth.isLoading && !auth.hasValue) {
    if (location == Routes.splash) return null;
    return Uri(path: Routes.splash, queryParameters: {'from': uri.toString()})
        .toString();
  }

  final loggedIn = auth.value != null;
  if (!loggedIn) return isAuthRoute ? null : Routes.login;

  if (isAuthRoute) return Routes.home;
  if (location == Routes.splash) {
    final from = uri.queryParameters['from'];
    final valid = from != null &&
        from.startsWith('/') &&
        !from.startsWith(Routes.splash) &&
        !Routes.authRoutes.contains(Uri.parse(from).path);
    return valid ? from : Routes.home;
  }
  return null;
}

final routerProvider = Provider<GoRouter>((ref) {
  final authChanges = ValueNotifier<int>(0);
  ref.listen(authControllerProvider, (_, _) => authChanges.value++);
  ref.listen(splashCompleteProvider, (_, _) => authChanges.value++);
  ref.onDispose(authChanges.dispose);

  return GoRouter(
    navigatorKey: rootNavigatorKey,
    initialLocation: Routes.home,
    refreshListenable: authChanges,
    redirect: (context, state) => authRedirect(
      ref.read(authControllerProvider),
      state.uri,
      splashComplete: ref.read(splashCompleteProvider),
    ),
    routes: [
      GoRoute(path: Routes.splash, builder: (_, _) => const SplashScreen()),
      GoRoute(path: Routes.login, builder: (_, _) => const LoginScreen()),
      GoRoute(
        path: Routes.forgotPassword,
        builder: (_, _) => const ForgotPasswordScreen(),
      ),
      StatefulShellRoute.indexedStack(
        builder: (_, _, shell) => MainShell(shell: shell),
        branches: [
          StatefulShellBranch(routes: [
            GoRoute(path: Routes.home, builder: (_, _) => const HomeScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: Routes.accounts,
              builder: (_, _) => const AccountsScreen(),
              routes: [
                GoRoute(
                  path: 'add',
                  parentNavigatorKey: rootNavigatorKey,
                  builder: (_, _) => const BankFormScreen(),
                ),
                GoRoute(
                  path: ':id/edit',
                  parentNavigatorKey: rootNavigatorKey,
                  builder: (_, state) =>
                      BankFormScreen(bankId: state.pathParameters['id']),
                ),
              ],
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: Routes.payin, builder: (_, _) => const PayinScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: Routes.payout,
              builder: (_, _) => const PayoutScreen(),
              routes: [
                GoRoute(
                  path: 'my-payments',
                  parentNavigatorKey: rootNavigatorKey,
                  builder: (_, _) => const MyPaymentsScreen(),
                ),
              ],
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: Routes.history,
              builder: (_, _) => const HistoryScreen(),
            ),
          ]),
        ],
      ),
      GoRoute(path: Routes.deposit, builder: (_, _) => const DepositScreen()),
      GoRoute(
        path: Routes.notifications,
        builder: (_, _) => const NotificationsScreen(),
      ),
      GoRoute(path: Routes.profile, builder: (_, _) => const ProfileScreen()),
      GoRoute(
        path: Routes.support,
        builder: (_, _) => const SupportChatScreen(),
      ),
      GoRoute(path: Routes.earnings, builder: (_, _) => const EarningsScreen()),
    ],
  );
});
