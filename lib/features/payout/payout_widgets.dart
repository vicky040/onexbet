import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_text_styles.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/kv_row.dart';
import '../../core/widgets/section_card.dart';
import '../../core/widgets/status_chip.dart';
import '../../data/models/transactions.dart';

class PayoutPaymentCard extends StatelessWidget {
  const PayoutPaymentCard({super.key, required this.payment});

  final PayoutPayment payment;

  @override
  Widget build(BuildContext context) {
    return RecordCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(child: Text(payment.id, style: AppTextStyles.recordId)),
              StatusChip(payment.status),
            ],
          ),
          const SizedBox(height: 4),
          Text(formatDateTime(payment.createdAt), style: AppTextStyles.muted),
          // Says what it was for when it was not an ordinary player payout,
          // such as the joining plan that opened the account.
          if (payment.note != null && payment.note!.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              payment.note!,
              style: AppTextStyles.muted.copyWith(
                color: AppColors.primaryBlue,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
          const SizedBox(height: 10),
          KvRow('Amount', formatInr(payment.amount)),
          if (payment.currency == 'USDT' && payment.amountUsdt != null)
            KvRow(
              'Collected',
              '${payment.amountUsdt!.toStringAsFixed(2)} USDT',
              valueColor: AppColors.primaryBlue,
            ),
          KvRow(
            'Commission',
            formatInr(payment.commission),
            valueColor: AppColors.success,
          ),
          // The commission is paid on top of the amount, so this is what
          // actually lands in the balance.
          KvRow(
            'You receive',
            formatInr(payment.amount + payment.commission),
            valueColor: AppColors.primaryBlue,
          ),
        ],
      ),
    );
  }
}

class OpenPayoutCard extends StatelessWidget {
  const OpenPayoutCard({super.key, required this.payout});

  final OpenPayout payout;

  @override
  Widget build(BuildContext context) {
    return RecordCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(payout.id, style: AppTextStyles.recordId),
          const SizedBox(height: 10),
          KvRow('Amount', formatInr(payout.amount)),
          KvRow(
            'Commission',
            formatInr(payout.commission),
            valueColor: AppColors.success,
          ),
          KvRow(
            'You receive',
            formatInr(payout.amount + payout.commission),
            valueColor: AppColors.primaryBlue,
          ),
          KvRow('Pay to UPI', payout.upiId),
        ],
      ),
    );
  }
}
