import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/routes.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_text_styles.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/app_bars.dart';
import '../../core/widgets/async_views.dart';
import '../../core/widgets/buttons.dart';
import '../../core/widgets/kv_row.dart';
import '../../core/widgets/responsive.dart';
import '../../core/widgets/section_card.dart';
import '../../core/widgets/stat_tile.dart';
import '../../core/widgets/status_chip.dart';
import '../../data/models/transactions.dart';
import '../../data/providers.dart';

class HistoryScreen extends ConsumerWidget {
  const HistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final summary = ref.watch(summaryProvider);
    final deposits = ref.watch(depositsProvider);

    return Scaffold(
      appBar: const TabTopBar(title: 'History'),
      body: PageListView(
        onRefresh: () async {
          ref.invalidate(summaryProvider);
          ref.invalidate(depositsProvider);
          await ref.read(depositsProvider.future);
        },
        children: [
          SectionCard(
            title: 'History',
            action: OutlinedPillButton(
              label: 'New Deposit',
              onPressed: () => context.push(Routes.deposit),
            ),
            child: AsyncValueView(
              value: summary,
              skeletonCount: 1,
              onRetry: () => ref.invalidate(summaryProvider),
              data: (s) => StatsGroup(
                primary: StatData('Total Balance', formatInr(s.totalBalance)),
                secondary: [
                  StatData('Total Deposit', formatInr(s.totalDeposit)),
                  StatData('Payouts Credited', formatInr(s.payoutsCredited)),
                ],
              ),
            ),
          ),
          SectionCard(
            title: 'Deposit Records',
            child: InsetPanel(
              child: AsyncValueView(
                value: deposits,
                onRetry: () => ref.invalidate(depositsProvider),
                data: (list) => list.isEmpty
                    ? const Padding(
                        padding: EdgeInsets.all(16),
                        child: Text('No deposits yet.', style: AppTextStyles.body),
                      )
                    : ResponsiveGrid(
                        children: [
                          for (final d in list) DepositRecordCard(record: d),
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

class DepositRecordCard extends StatelessWidget {
  const DepositRecordCard({super.key, required this.record});

  final DepositRecord record;

  @override
  Widget build(BuildContext context) {
    return RecordCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(child: Text(record.id, style: AppTextStyles.recordId)),
              StatusChip(record.status),
            ],
          ),
          const SizedBox(height: 4),
          Text(formatDateTime(record.createdAt), style: AppTextStyles.muted),
          const SizedBox(height: 10),
          KvRow('Previous Balance', formatInr(record.previousBalance)),
          KvRow('Amount', formatInr(record.amount)),
          KvRow(
            'After Balance',
            formatInr(record.afterBalance),
            valueColor: AppColors.primaryBlue,
          ),
          if (record.utr != null) ...[
            const SizedBox(height: 6),
            Text('UTR: ${record.utr}', style: AppTextStyles.muted),
          ],
        ],
      ),
    );
  }
}
