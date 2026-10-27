import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/app_bars.dart';
import '../../core/widgets/async_views.dart';
import '../../core/widgets/responsive.dart';
import '../../data/providers.dart';
import 'earnings_table.dart';

class EarningsScreen extends ConsumerWidget {
  const EarningsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final earnings = ref.watch(earningsProvider);
    final white70 = AppColors.white.withValues(alpha: 0.75);

    return Scaffold(
      appBar: const SubPageAppBar(title: 'Earnings overview'),
      body: PageListView(
        maxWidth: 760,
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        onRefresh: () => ref.refresh(earningsProvider.future),
        children: [
          AsyncValueView(
            value: earnings,
            skeletonCount: 4,
            onRetry: () => ref.invalidate(earningsProvider),
            data: (weeks) {
              final total = weeks.fold<double>(0, (sum, w) => sum + w.netEarnings);
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: AppColors.navy,
                      borderRadius: BorderRadius.circular(26),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Total net earnings', style: TextStyle(color: white70)),
                        const SizedBox(height: 6),
                        Text(
                          formatInrGrouped(total),
                          style: const TextStyle(
                            color: AppColors.white,
                            fontSize: 30,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Across the last ${weeks.length} weeks',
                          style: TextStyle(color: white70),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 18),
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: AppColors.white,
                      borderRadius: BorderRadius.circular(26),
                    ),
                    child: EarningsTable(weeks: weeks),
                  ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}
