import 'package:flutter/material.dart';

import 'app_colors.dart';

abstract final class AppTextStyles {
  static const appBarTitle = TextStyle(
    fontSize: 21,
    fontWeight: FontWeight.w700,
    color: AppColors.textPrimary,
  );

  static const sectionTitle = TextStyle(
    fontSize: 19,
    fontWeight: FontWeight.w700,
    color: AppColors.textPrimary,
  );

  static const statLabel = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w500,
    color: AppColors.textMuted,
  );

  static const statValue = TextStyle(
    fontSize: 21,
    fontWeight: FontWeight.w700,
    color: AppColors.primaryBlue,
  );

  static const recordId = TextStyle(
    fontSize: 16,
    fontWeight: FontWeight.w700,
    color: AppColors.textPrimary,
    letterSpacing: 0.2,
  );

  static const muted = TextStyle(
    fontSize: 13.5,
    fontWeight: FontWeight.w400,
    color: AppColors.textMuted,
  );

  static const kvLabel = TextStyle(
    fontSize: 14.5,
    fontWeight: FontWeight.w500,
    color: AppColors.textMuted,
  );

  static const kvValue = TextStyle(
    fontSize: 15,
    fontWeight: FontWeight.w700,
    color: AppColors.textPrimary,
  );

  static const body = TextStyle(
    fontSize: 15,
    height: 1.4,
    color: AppColors.textPrimary,
  );
}
