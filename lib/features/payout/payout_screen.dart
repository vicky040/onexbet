import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/routes.dart';
import '../../core/theme/app_text_styles.dart';
import '../../core/widgets/app_bars.dart';
import '../../core/widgets/async_views.dart';
import '../../core/widgets/buttons.dart';
import '../../core/widgets/responsive.dart';
import '../../core/widgets/section_card.dart';
import '../../data/providers.dart';
import 'payout_widgets.dart';

class PayoutScreen extends ConsumerWidget {
  const PayoutScreen({super.key});

  static const _recentCount = 5;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final open = ref.watch(openPayoutsProvider);
    final payments = ref.watch(payoutPaymentsProvider);

    return Scaffold(
      appBar: const TabTopBar(title: 'Payout'),
      body: PageListView(
        onRefresh: () async {
          ref.invalidate(openPayoutsProvider);
          ref.invalidate(payoutPaymentsProvider);
          await ref.read(payoutPaymentsProvider.future);
        },
        children: [
          SectionCard(
            title: 'Payouts',
            action: OutlinedPillButton(
              label: 'My Payments',
              onPressed: () => context.push(Routes.myPayments),
            ),
            child: AsyncValueView(
              value: open,
              skeletonCount: 1,
              onRetry: () => ref.invalidate(openPayoutsProvider),
              data: (list) => list.isEmpty
                  ? const EmptyState(
                      'No open payouts right now. Please check again later.',
                    )
                  : ResponsiveGrid(
                      children: [for (final p in list) OpenPayoutCard(payout: p)],
                    ),
            ),
          ),
          SectionCard(
            title: 'Recent Payments',
            child: InsetPanel(
              child: AsyncValueView(
                value: payments,
                onRetry: () => ref.invalidate(payoutPaymentsProvider),
                data: (list) => list.isEmpty
                    ? const Padding(
                        padding: EdgeInsets.all(16),
                        child: Text('No payments yet.', style: AppTextStyles.body),
                      )
                    : ResponsiveGrid(
                        children: [
                          for (final p in list.take(_recentCount))
                            PayoutPaymentCard(payment: p),
                        ],
                      ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
