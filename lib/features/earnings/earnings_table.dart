import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/formatters.dart';
import '../../data/models/transactions.dart';

/// Week / Transactions / Net Earnings table used on Home and Earnings.
class EarningsTable extends StatelessWidget {
  const EarningsTable({super.key, required this.weeks});

  final List<EarningWeek> weeks;

  static const _header = TextStyle(
    color: AppColors.textMuted,
    fontWeight: FontWeight.w600,
    fontSize: 13.5,
  );

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: AppColors.earningsPanelBg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(10, 8, 10, 12),
            child: Row(
              children: [
                SizedBox(
                  width: 48,
                  child: Text('Week', style: _header, textAlign: TextAlign.center),
                ),
                SizedBox(width: 12),
                Expanded(child: Text('Transactions', style: _header)),
                Text('Net Earnings', style: _header),
              ],
            ),
          ),
          for (final w in weeks)
            Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
              decoration: BoxDecoration(
                color: AppColors.white,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Row(
                children: [
                  Container(
                    width: 48,
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    decoration: BoxDecoration(
                      color: AppColors.chipBg,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Text(
                      '${w.week}',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: AppColors.primaryBlue,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      w.maskedTransactions,
                      style: const TextStyle(
                        fontSize: 15.5,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ),
                  Text(
                    formatInrGrouped(w.netEarnings),
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      color: AppColors.success,
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
