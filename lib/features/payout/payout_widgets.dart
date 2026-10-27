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
          const SizedBox(height: 10),
          KvRow('Amount', formatInr(payment.amount)),
          KvRow(
            'Commission',
            formatInr(payment.commission),
            valueColor: AppColors.success,
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
          KvRow('Pay to UPI', payout.upiId),
        ],
      ),
    );
  }
}
