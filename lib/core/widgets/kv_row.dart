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
        children: [
          Expanded(child: Text(label, style: AppTextStyles.kvLabel)),
          const SizedBox(width: 12),
          Text(
            value,
            style: AppTextStyles.kvValue.copyWith(color: valueColor),
          ),
        ],
      ),
    );
  }
}
