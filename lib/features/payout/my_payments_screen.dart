import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/router/routes.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/app_bars.dart';
import '../../core/widgets/async_views.dart';
import '../../core/widgets/responsive.dart';
import '../../data/models/txn_status.dart';
import '../../data/providers.dart';
import 'payout_widgets.dart';

class MyPaymentsScreen extends ConsumerStatefulWidget {
  const MyPaymentsScreen({super.key});

  @override
  ConsumerState<MyPaymentsScreen> createState() => _MyPaymentsScreenState();
}

class _MyPaymentsScreenState extends ConsumerState<MyPaymentsScreen> {
  static const _filters = <TxnStatus?>[
    null,
    TxnStatus.paymentReceived,
    TxnStatus.pending,
    TxnStatus.failed,
  ];

  TxnStatus? _filter;

  @override
  Widget build(BuildContext context) {
    final payments = ref.watch(payoutPaymentsProvider);

    return Scaffold(
      appBar: const SubPageAppBar(title: 'My Payments', fallback: Routes.payout),
      body: PageListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        onRefresh: () => ref.refresh(payoutPaymentsProvider.future),
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final f in _filters)
                ChoiceChip(
                  label: Text(f?.label ?? 'All'),
                  selected: _filter == f,
                  showCheckmark: false,
                  labelStyle: TextStyle(
                    color: _filter == f ? AppColors.white : AppColors.textPrimary,
                    fontWeight: FontWeight.w600,
                  ),
                  onSelected: (_) => setState(() => _filter = f),
                ),
            ],
          ),
          const SizedBox(height: 16),
          AsyncValueView(
            value: payments,
            skeletonCount: 4,
            onRetry: () => ref.invalidate(payoutPaymentsProvider),
            data: (list) {
              final filtered = _filter == null
                  ? list
                  : list.where((p) => p.status == _filter).toList();
              if (filtered.isEmpty) {
                return const EmptyState('No payments match this filter.');
              }
              return ResponsiveGrid(
                children: [
                  for (final p in filtered) PayoutPaymentCard(payment: p),
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}
