import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_colors.dart';
import '../../core/widgets/app_bottom_nav.dart';
import '../../core/widgets/brand_logo.dart';
import '../../core/widgets/responsive.dart';

/// Hosts the five tabs: bottom navigation on phones, a rail on wide screens.
class MainShell extends StatelessWidget {
  const MainShell({super.key, required this.shell});

  final StatefulNavigationShell shell;

  void _select(int index) =>
      shell.goBranch(index, initialLocation: index == shell.currentIndex);

  @override
  Widget build(BuildContext context) {
    if (!Breakpoints.isWide(context)) {
      return Scaffold(
        body: shell,
        bottomNavigationBar: AppBottomNav(
          currentIndex: shell.currentIndex,
          onTap: _select,
        ),
      );
    }

    return Scaffold(
      body: Row(
        children: [
          NavigationRail(
            backgroundColor: AppColors.white,
            selectedIndex: shell.currentIndex,
            onDestinationSelected: _select,
            labelType: NavigationRailLabelType.all,
            minWidth: 92,
            indicatorColor: AppColors.navy,
            selectedIconTheme: const IconThemeData(color: AppColors.white),
            unselectedIconTheme: const IconThemeData(color: AppColors.textMuted),
            selectedLabelTextStyle: const TextStyle(
              color: AppColors.navy,
              fontWeight: FontWeight.w700,
            ),
            unselectedLabelTextStyle: const TextStyle(
              color: AppColors.textMuted,
              fontWeight: FontWeight.w500,
            ),
            leading: const Padding(
              padding: EdgeInsets.symmetric(vertical: 20),
              child: BrandLogo(size: 22),
            ),
            destinations: [
              for (final d in navDestinations)
                NavigationRailDestination(
                  icon: Icon(d.icon),
                  selectedIcon: Icon(d.activeIcon),
                  label: Text(d.label),
                ),
            ],
          ),
          const VerticalDivider(width: 1, thickness: 1, color: AppColors.border),
          Expanded(child: shell),
        ],
      ),
    );
  }
}
