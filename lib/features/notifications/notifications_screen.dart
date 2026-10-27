import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_text_styles.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/app_bars.dart';
import '../../core/widgets/async_views.dart';
import '../../core/widgets/responsive.dart';
import '../../core/widgets/section_card.dart';
import '../../data/models/messages.dart';
import '../../data/providers.dart';

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifications = ref.watch(notificationsProvider);
    final unread = ref.watch(unreadNotificationsProvider);

    return Scaffold(
      appBar: SubPageAppBar(
        title: 'Notifications',
        actions: [
          if (unread > 0)
            TextButton(
              onPressed: () =>
                  ref.read(notificationsProvider.notifier).markAllRead(),
              child: const Text('Mark all read'),
            ),
          const SizedBox(width: 8),
        ],
      ),
      body: PageListView(
        maxWidth: 760,
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        onRefresh: () => ref.refresh(notificationsProvider.future),
        children: [
          AsyncValueView(
            value: notifications,
            skeletonCount: 4,
            onRetry: () => ref.invalidate(notificationsProvider),
            data: (list) => list.isEmpty
                ? const EmptyState('You have no notifications.')
                : Column(
                    children: [
                      for (final n in list)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: _NotificationTile(
                            notification: n,
                            onTap: () => ref
                                .read(notificationsProvider.notifier)
                                .markRead(n.id),
                          ),
                        ),
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}

class _NotificationTile extends StatelessWidget {
  const _NotificationTile({required this.notification, required this.onTap});

  final AppNotification notification;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final n = notification;
    return RecordCard(
      onTap: onTap,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: const BoxDecoration(
              color: AppColors.chipBg,
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.notifications_none_rounded,
              color: AppColors.primaryBlue,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        n.title,
                        style: TextStyle(
                          fontSize: 15.5,
                          fontWeight: n.read ? FontWeight.w600 : FontWeight.w800,
                        ),
                      ),
                    ),
                    if (!n.read)
                      Container(
                        width: 9,
                        height: 9,
                        decoration: const BoxDecoration(
                          color: AppColors.primaryBlue,
                          shape: BoxShape.circle,
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(n.body, style: AppTextStyles.muted.copyWith(fontSize: 14)),
                const SizedBox(height: 6),
                Text(
                  formatDateTime(n.createdAt),
                  style: AppTextStyles.muted.copyWith(fontSize: 12),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
