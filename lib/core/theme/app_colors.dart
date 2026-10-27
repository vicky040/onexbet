import 'package:flutter/material.dart';

/// Colour tokens sampled from the 1XBET agent app screenshots.
abstract final class AppColors {
  static const navy = Color(0xFF25255E);
  static const navySoft = Color(0xFF3A3A78);
  static const brandBlue = Color(0xFF4A7DF5);
  static const primaryBlue = Color(0xFF1E9BF0);

  /// Background of the Accounts / Payin / Payout / History tabs.
  static const scaffoldBg = Color(0xFFE4ECF5);

  /// Background of the Home tab below the navy header.
  static const homeBg = Color(0xFFF1F3F9);
  static const appBarBg = Color(0xFFD3E5F5);
  static const sectionBg = Color(0xFFE9F0F7);
  static const insetBg = Color(0xFFEEF3F9);
  static const statBg = Color(0xFFE5EDF6);
  static const pillBg = Color(0xFFF3F7FB);
  static const recordBg = Color(0xFFF8FBFE);
  static const securityTileBg = Color(0xFFE6EAF6);
  static const earningsPanelBg = Color(0xFFF2F5FA);

  static const success = Color(0xFF34D399);
  static const warning = Color(0xFFF5A524);
  static const danger = Color(0xFFE5484D);

  static const chipBg = Color(0xFFD6E8FB);
  static const chipText = Color(0xFF2F6FC6);

  static const textPrimary = Color(0xFF1E2533);
  static const textMuted = Color(0xFF7B8494);
  static const border = Color(0xFFDCE6F0);
  static const circleBorder = Color(0xFFD5D9E2);
  static const white = Colors.white;

  static const softShadow = [
    BoxShadow(color: Color(0x1A8BA3BF), blurRadius: 24, offset: Offset(0, 10)),
  ];
}
