import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_text_styles.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/app_bars.dart';
import '../../core/widgets/async_views.dart';
import '../../core/widgets/kv_row.dart';
import '../../core/widgets/responsive.dart';
import '../../core/widgets/section_card.dart';
import '../../core/widgets/stat_tile.dart';
import '../../data/models/transactions.dart';
import '../../data/providers.dart';

class PayinScreen extends ConsumerWidget {
  const PayinScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final summary = ref.watch(summaryProvider);
    final payins = ref.watch(payinsProvider);

    return Scaffold(
      appBar: const TabTopBar(title: 'Payin'),
      body: PageListView(
        onRefresh: () async {
          ref.invalidate(summaryProvider);
          ref.invalidate(payinsProvider);
          await ref.read(payinsProvider.future);
        },
        children: [
          SectionCard(
            title: 'Payin History',
            child: AsyncValueView(
              value: summary,
              skeletonCount: 1,
              onRetry: () => ref.invalidate(summaryProvider),
              data: (s) => StatsGroup(
                primary: StatData('Total Balance', formatInr(s.totalBalance)),
                secondary: [
                  StatData('Total Payin', formatInr(s.totalPayin)),
                  StatData('Commission Earned', formatInr(s.payinCommission)),
                ],
              ),
            ),
          ),
          SectionCard(
            title: 'Payin Records',
            child: InsetPanel(
              child: AsyncValueView(
                value: payins,
                onRetry: () => ref.invalidate(payinsProvider),
                data: (list) => list.isEmpty
                    ? const Padding(
                        padding: EdgeInsets.all(16),
                        child: Text('No payins yet.', style: AppTextStyles.body),
                      )
                    : ResponsiveGrid(
                        children: [for (final p in list) PayinRecordCard(record: p)],
                      ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class PayinRecordCard extends StatelessWidget {
  const PayinRecordCard({super.key, required this.record});

  final PayinRecord record;

  @override
  Widget build(BuildContext context) {
    return RecordCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(child: Text(record.id, style: AppTextStyles.recordId)),
              Text(formatDateTime(record.createdAt), style: AppTextStyles.muted),
            ],
          ),
          const SizedBox(height: 10),
          KvRow('Previous Balance', formatInr(record.previousBalance)),
          KvRow('Amount', formatInr(record.amount)),
          if (record.currency == 'USDT' && record.amountUsdt != null)
            KvRow(
              'Handed over',
              '${record.amountUsdt!.toStringAsFixed(2)} USDT',
              valueColor: AppColors.primaryBlue,
            ),
          KvRow(
            'Commission',
            '${formatInr(record.commission)} (${formatPercent(record.commissionRate)})',
            valueColor: AppColors.success,
          ),
          KvRow(
            'After Balance',
            formatInr(record.afterBalance),
            valueColor: AppColors.primaryBlue,
          ),
          const SizedBox(height: 6),
          Text('Txn: ${record.txnRef}', style: AppTextStyles.muted),
        ],
      ),
    );
  }
}
