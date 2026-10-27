import 'package:flutter/material.dart';

import '../theme/app_colors.dart';

class NavDestination {
  const NavDestination(this.icon, this.activeIcon, this.label);

  final IconData icon;
  final IconData activeIcon;
  final String label;
}

/// The five main tabs, in shell branch order.
const navDestinations = [
  NavDestination(Icons.home_outlined, Icons.home_rounded, 'Home'),
  NavDestination(Icons.account_balance_outlined, Icons.account_balance, 'Accounts'),
  NavDestination(Icons.download_outlined, Icons.download_rounded, 'Payin'),
  NavDestination(Icons.bolt_outlined, Icons.bolt, 'Payout'),
  NavDestination(Icons.history_rounded, Icons.history_rounded, 'History'),
];

/// Bottom navigation with the navy pill behind the active icon.
class AppBottomNav extends StatelessWidget {
  const AppBottomNav({
    super.key,
    required this.currentIndex,
    required this.onTap,
  });

  final int currentIndex;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        color: AppColors.white,
        border: Border(top: BorderSide(color: AppColors.border)),
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 76,
          child: Row(
            children: [
              for (var i = 0; i < navDestinations.length; i++)
                Expanded(
                  child: _NavItem(
                    destination: navDestinations[i],
                    selected: i == currentIndex,
                    onTap: () => onTap(i),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.destination,
    required this.selected,
    required this.onTap,
  });

  final NavDestination destination;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      selected: selected,
      button: true,
      label: destination.label,
      excludeSemantics: true,
      child: InkResponse(
        onTap: onTap,
        radius: 40,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: 58,
              height: 36,
              decoration: BoxDecoration(
                color: selected ? AppColors.navy : Colors.transparent,
                borderRadius: BorderRadius.circular(18),
              ),
              child: Icon(
                selected ? destination.activeIcon : destination.icon,
                size: 22,
                color: selected ? AppColors.white : AppColors.textMuted,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              destination.label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                color: selected ? AppColors.navy : AppColors.textMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
