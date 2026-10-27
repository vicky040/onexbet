import 'package:flutter/material.dart';

import '../theme/app_colors.dart';

/// The italic "1XBET" wordmark.
class BrandLogo extends StatelessWidget {
  const BrandLogo({super.key, this.size = 30, this.color = AppColors.brandBlue});

  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Text(
      '1XBET',
      style: TextStyle(
        fontSize: size,
        fontWeight: FontWeight.w900,
        fontStyle: FontStyle.italic,
        letterSpacing: -0.5,
        color: color,
        height: 1,
      ),
    );
  }
}
