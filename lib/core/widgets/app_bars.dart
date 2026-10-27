import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/providers.dart';
import '../router/routes.dart';
import '../theme/app_colors.dart';
import 'buttons.dart';

/// Bell icon with an unread badge; opens Notifications.
class NotificationBell extends ConsumerWidget {
  const NotificationBell({super.key, this.color = AppColors.textPrimary});

  final Color color;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final unread = ref.watch(unreadNotificationsProvider);
    return IconButton(
      tooltip: 'Notifications',
      onPressed: () => context.push(Routes.notifications),
      icon: Badge(
        isLabelVisible: unread > 0,
        label: Text('$unread'),
        backgroundColor: AppColors.danger,
        child: Icon(Icons.notifications_none_rounded, size: 28, color: color),
      ),
    );
  }
}

/// Top bar of the Accounts / Payin / Payout / History tabs.
class TabTopBar extends StatelessWidget implements PreferredSizeWidget {
  const TabTopBar({super.key, required this.title});

  final String title;

  @override
  Size get preferredSize => const Size.fromHeight(68);

  @override
  Widget build(BuildContext context) {
    return AppBar(
      toolbarHeight: 68,
      automaticallyImplyLeading: false,
      titleSpacing: 18,
      title: Text(title),
      actions: [
        DepositPill(onTap: () => context.push(Routes.deposit)),
        const SizedBox(width: 6),
        const NotificationBell(),
        const SizedBox(width: 8),
      ],
    );
  }
}

/// App bar for pushed screens. Falls back to [fallback] when there is
/// nothing to pop (e.g. a deep link opened directly on the web).
class SubPageAppBar extends StatelessWidget implements PreferredSizeWidget {
  const SubPageAppBar({
    super.key,
    required this.title,
    this.fallback = Routes.home,
    this.actions,
  });

  final String title;
  final String fallback;
  final List<Widget>? actions;

  @override
  Size get preferredSize => const Size.fromHeight(64);

  @override
  Widget build(BuildContext context) {
    return AppBar(
      toolbarHeight: 64,
      leading: IconButton(
        tooltip: 'Back',
        icon: const Icon(Icons.arrow_back_rounded),
        onPressed: () =>
            context.canPop() ? context.pop() : context.go(fallback),
      ),
      title: Text(title),
      actions: actions,
    );
  }
}
