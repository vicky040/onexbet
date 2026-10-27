import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/routes.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_text_styles.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/app_bars.dart';
import '../../core/widgets/async_views.dart';
import '../../core/widgets/form_fields.dart';
import '../../core/widgets/responsive.dart';
import '../../core/widgets/section_card.dart';
import '../../data/models/bank_account.dart';
import '../../data/providers.dart';

class AccountsScreen extends ConsumerWidget {
  const AccountsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final banks = ref.watch(banksProvider);
    final list = banks.value;

    return Scaffold(
      appBar: const TabTopBar(title: 'Accounts'),
      floatingActionButton: FloatingActionButton(
        tooltip: 'Add bank account',
        onPressed: () => context.push(Routes.addBank),
        child: const Icon(Icons.add_rounded, size: 32),
      ),
      body: PageListView(
        onRefresh: () => ref.refresh(banksProvider.future),
        children: [
          SectionCard(
            title: 'Bank Accounts',
            child: InsetPanel(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Container(
                    width: 64,
                    height: 64,
                    decoration: BoxDecoration(
                      color: AppColors.chipBg,
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: const Icon(
                      Icons.account_balance,
                      color: AppColors.primaryBlue,
                      size: 30,
                    ),
                  ),
                  const SizedBox(width: 18),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Total Banks', style: AppTextStyles.kvLabel),
                      Text(
                        list == null ? '--' : '${list.length}',
                        key: const Key('totalBanks'),
                        style: const TextStyle(
                          fontSize: 30,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      Text(
                        list == null
                            ? ''
                            : '${list.where((b) => b.isActive).length} Active',
                        key: const Key('activeBanks'),
                        style: AppTextStyles.kvLabel,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          SectionCard(
            title: 'Bank List',
            child: InsetPanel(
              child: AsyncValueView(
                value: banks,
                onRetry: () => ref.invalidate(banksProvider),
                data: (banks) => banks.isEmpty
                    ? const Padding(
                        padding: EdgeInsets.all(16),
                        child: Text(
                          'No bank accounts yet. Tap + to add one.',
                          style: AppTextStyles.body,
                        ),
                      )
                    : ResponsiveGrid(
                        children: [for (final b in banks) BankCard(bank: b)],
                      ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class BankCard extends ConsumerWidget {
  const BankCard({super.key, required this.bank});

  final BankAccount bank;

  Future<void> _toggle(BuildContext context, WidgetRef ref, bool value) async {
    try {
      await ref.read(banksProvider.notifier).setActive(bank.id, value);
    } catch (e) {
      if (context.mounted) showMessage(context, 'Could not update bank: $e');
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return RecordCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      bank.bankName,
                      style: const TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      maskAccountNumber(bank.accountNumber),
                      style: const TextStyle(fontSize: 16.5),
                    ),
                    const SizedBox(height: 4),
                    Text('UPI: ${bank.upiId}', style: AppTextStyles.muted),
                    const SizedBox(height: 2),
                    Text(
                      'Limit: ${bank.limit} · ₹${bank.amountLimit.toStringAsFixed(0)}'
                      ' · ${bank.txnLimit} txns',
                      style: AppTextStyles.muted,
                    ),
                  ],
                ),
              ),
              Switch(
                key: Key('bankSwitch_${bank.id}'),
                value: bank.isActive,
                onChanged: (v) => _toggle(context, ref, v),
              ),
            ],
          ),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton.icon(
              onPressed: () => context.push(Routes.editBank(bank.id)),
              icon: const Icon(Icons.edit_rounded),
              label: const Text('Edit', style: TextStyle(fontSize: 16)),
            ),
          ),
        ],
      ),
    );
  }
}
