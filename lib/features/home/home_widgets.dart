import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/routes.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/app_bars.dart';
import '../../core/widgets/async_views.dart';
import '../../core/widgets/brand_logo.dart';
import '../../data/models/dashboard_summary.dart';
import '../../data/providers.dart';
import '../auth/auth_controller.dart';
import '../earnings/earnings_table.dart';

/// Navy header with balance, overlapped by the quick actions card.
class HomeHeader extends StatelessWidget {
  const HomeHeader({super.key, required this.sidePadding});

  final double sidePadding;

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        const Positioned(
          top: 0,
          left: 0,
          right: 0,
          bottom: 64,
          child: ColoredBox(color: AppColors.navy),
        ),
        Padding(
          padding: EdgeInsets.symmetric(horizontal: sidePadding),
          child: const Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SafeArea(bottom: false, child: _BalanceSection()),
              SizedBox(height: 22),
              _QuickActionsCard(),
            ],
          ),
        ),
      ],
    );
  }
}

class _BalanceSection extends ConsumerWidget {
  const _BalanceSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).value;
    final summary = ref.watch(summaryProvider).value;
    final visible = ref.watch(balanceVisibleProvider);
    final white70 = AppColors.white.withValues(alpha: 0.75);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 10),
        Row(
          children: [
            const BrandLogo(size: 30),
            const Spacer(),
            const NotificationBell(color: AppColors.white),
            const SizedBox(width: 6),
            Semantics(
              button: true,
              label: 'Profile',
              child: GestureDetector(
                onTap: () => context.push(Routes.profile),
                child: CircleAvatar(
                  radius: 22,
                  backgroundColor: AppColors.white,
                  child: Text(
                    initialsOf(user?.name ?? ''),
                    style: const TextStyle(
                      color: AppColors.navy,
                      fontWeight: FontWeight.w800,
                      fontSize: 18,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 26),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: AppColors.white.withValues(alpha: 0.12),
            border: Border.all(color: AppColors.white.withValues(alpha: 0.25)),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.trending_up_rounded, color: AppColors.white, size: 20),
              const SizedBox(width: 10),
              Flexible(
                child: Text(
                  'Success rate  ${summary == null ? '--' : formatPercent(summary.successRate)}',
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AppColors.white,
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 26),
        Text(
          '${greetingFor(DateTime.now())}, ${user?.firstName ?? ''}',
          style: const TextStyle(
            color: AppColors.white,
            fontSize: 18,
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(height: 14),
        Text('Total balance', style: TextStyle(color: white70, fontSize: 15)),
        const SizedBox(height: 4),
        Row(
          children: [
            Expanded(
              child: FittedBox(
                fit: BoxFit.scaleDown,
                alignment: Alignment.centerLeft,
                child: Text(
                  summary == null
                      ? '₹ --'
                      : visible
                          ? formatInr(summary.totalBalance)
                          : '₹ ••••••',
                  style: const TextStyle(
                    color: AppColors.white,
                    fontSize: 40,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
            IconButton(
              tooltip: visible ? 'Hide balance' : 'Show balance',
              color: AppColors.white,
              iconSize: 28,
              icon: Icon(
                visible ? Icons.visibility_outlined : Icons.visibility_off_outlined,
              ),
              onPressed: () =>
                  ref.read(balanceVisibleProvider.notifier).toggle(),
            ),
          ],
        ),
      ],
    );
  }
}

class _QuickActionsCard extends StatelessWidget {
  const _QuickActionsCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 6),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(26),
        boxShadow: AppColors.softShadow,
      ),
      child: Row(
        children: [
          Expanded(
            child: _QuickAction(
              icon: Icons.file_download_outlined,
              label: 'Deposit',
              onTap: () => context.push(Routes.deposit),
            ),
          ),
          Expanded(
            child: _QuickAction(
              icon: Icons.credit_card_outlined,
              label: 'Payin',
              onTap: () => context.go(Routes.payin),
            ),
          ),
          Expanded(
            child: _QuickAction(
              icon: Icons.file_upload_outlined,
              label: 'Payout',
              onTap: () => context.go(Routes.payout),
            ),
          ),
          Expanded(
            child: _QuickAction(
              icon: Icons.receipt_long_outlined,
              label: 'History',
              onTap: () => context.go(Routes.history),
            ),
          ),
        ],
      ),
    );
  }
}

class _QuickAction extends StatelessWidget {
  const _QuickAction({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.all(4),
        child: Column(
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.circleBorder, width: 1.5),
              ),
              child: Icon(icon, color: AppColors.navy, size: 24),
            ),
            const SizedBox(height: 10),
            FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(
                label,
                maxLines: 1,
                style: const TextStyle(
                  color: AppColors.navy,
                  fontWeight: FontWeight.w700,
                  fontSize: 14.5,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class AddDepositButton extends StatelessWidget {
  const AddDepositButton({super.key});

  @override
  Widget build(BuildContext context) {
    return ElevatedButton.icon(
      onPressed: () => context.push(Routes.deposit),
      icon: const Icon(Icons.add_rounded, size: 26),
      label: const Text('Add deposit'),
    );
  }
}

/// Security deposit tile beside the payin / payout commission tiles.
class CommissionTiles extends ConsumerWidget {
  const CommissionTiles({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final summary = ref.watch(summaryProvider).value;
    String inr(double Function(DashboardSummary s) pick) =>
        summary == null ? '--' : formatInr(pick(summary));

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            child: Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: AppColors.securityTileBg,
                borderRadius: BorderRadius.circular(24),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.verified_user_outlined, color: AppColors.navy, size: 30),
                  const SizedBox(height: 24),
                  const Spacer(),
                  const Text(
                    'Security deposit',
                    style: TextStyle(color: AppColors.textMuted, fontSize: 14.5),
                  ),
                  const SizedBox(height: 6),
                  FittedBox(
                    fit: BoxFit.scaleDown,
                    child: Text(
                      summary == null ? '--' : formatUsdt(summary.securityDepositUsdt),
                      style: const TextStyle(
                        color: AppColors.navy,
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Your security deposit keeps your account safe.',
                    style: TextStyle(color: AppColors.textMuted, fontSize: 13),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              children: [
                Expanded(
                  child: _CommissionTile(
                    icon: Icons.credit_card_outlined,
                    label: 'Payin commission',
                    value: inr((s) => s.payinCommission),
                    onTap: () => context.go(Routes.payin),
                  ),
                ),
                const SizedBox(height: 12),
                Expanded(
                  child: _CommissionTile(
                    icon: Icons.north_east_rounded,
                    label: 'Payout commission',
                    value: inr((s) => s.payoutCommission),
                    onTap: () => context.go(Routes.payout),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _CommissionTile extends StatelessWidget {
  const _CommissionTile({
    required this.icon,
    required this.label,
    required this.value,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final String value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.white,
      borderRadius: BorderRadius.circular(22),
      child: InkWell(
        borderRadius: BorderRadius.circular(22),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
          child: Row(
            children: [
              Icon(icon, color: AppColors.navy, size: 22),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: AppColors.textMuted,
                        fontSize: 13.5,
                      ),
                    ),
                    const SizedBox(height: 4),
                    FittedBox(
                      fit: BoxFit.scaleDown,
                      child: Text(
                        value,
                        style: const TextStyle(
                          color: AppColors.navy,
                          fontSize: 17,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted),
            ],
          ),
        ),
      ),
    );
  }
}

class EarningsOverviewCard extends ConsumerWidget {
  const EarningsOverviewCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final earnings = ref.watch(earningsProvider);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(26),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const Icon(Icons.bar_chart_rounded, color: AppColors.navy, size: 26),
              const SizedBox(width: 8),
              const Expanded(
                child: Text(
                  'Earnings overview',
                  style: TextStyle(
                    color: AppColors.navy,
                    fontSize: 19,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              TextButton(
                onPressed: () => context.push(Routes.earnings),
                style: TextButton.styleFrom(foregroundColor: AppColors.textMuted),
                child: const Text('View all >'),
              ),
            ],
          ),
          const SizedBox(height: 12),
          AsyncValueView(
            value: earnings,
            onRetry: () => ref.invalidate(earningsProvider),
            data: (weeks) => EarningsTable(weeks: weeks.take(3).toList()),
          ),
        ],
      ),
    );
  }
}

class HelpCard extends StatelessWidget {
  const HelpCard({super.key});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.white,
      borderRadius: BorderRadius.circular(22),
      child: InkWell(
        borderRadius: BorderRadius.circular(22),
        onTap: () => context.push(Routes.support),
        child: const Padding(
          padding: EdgeInsets.all(18),
          child: Row(
            children: [
              Icon(Icons.chat_bubble_outline_rounded, color: AppColors.navy, size: 28),
              SizedBox(width: 14),
              Expanded(
                child: Text(
                  'Need help? Chat with our support team',
                  style: TextStyle(
                    color: AppColors.navy,
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              Icon(Icons.chevron_right_rounded, color: AppColors.textMuted),
            ],
          ),
        ),
      ),
    );
  }
}
