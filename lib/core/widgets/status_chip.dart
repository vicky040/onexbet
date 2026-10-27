import 'package:flutter/material.dart';

import '../../data/models/txn_status.dart';
import '../theme/app_colors.dart';

class StatusChip extends StatelessWidget {
  const StatusChip(this.status, {super.key});

  final TxnStatus status;

  (Color, Color) get _colors => switch (status) {
        TxnStatus.completed ||
        TxnStatus.paymentReceived =>
          (AppColors.chipBg, AppColors.chipText),
        TxnStatus.pending => (const Color(0xFFFFF1D6), const Color(0xFFB7791F)),
        TxnStatus.failed => (const Color(0xFFFDE2E2), const Color(0xFFC53030)),
      };

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = _colors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        status.label,
        style: TextStyle(color: fg, fontWeight: FontWeight.w600, fontSize: 13.5),
      ),
    );
  }
}
