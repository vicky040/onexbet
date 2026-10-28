import 'package:flutter/material.dart';

import '../theme/app_text_styles.dart';

/// "Amount ................ ₹65000.00"
class KvRow extends StatelessWidget {
  const KvRow(this.label, this.value, {super.key, this.valueColor});

  final String label;
  final String value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(child: Text(label, style: AppTextStyles.kvLabel)),
          const SizedBox(width: 12),
          // Flexible, so a long value — a UPI id, a chain transaction hash —
          // wraps instead of overflowing the row.
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: AppTextStyles.kvValue.copyWith(color: valueColor),
            ),
          ),
        ],
      ),
    );
  }
}
