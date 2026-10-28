import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/router/routes.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_text_styles.dart';
import '../../core/utils/formatters.dart';
import '../../core/utils/validators.dart';
import '../../core/widgets/app_bars.dart';
import '../../core/widgets/async_views.dart';
import '../../core/widgets/buttons.dart';
import '../../core/widgets/form_fields.dart';
import '../../core/widgets/responsive.dart';
import '../../core/widgets/section_card.dart';
import '../../data/models/deposit_config.dart';
import '../../data/providers.dart';

/// New deposit request, in rupees or USDT.
///
/// The currencies, their minimums and the USDT address all come from the
/// server, so none of it is baked into the build.
class DepositScreen extends ConsumerStatefulWidget {
  const DepositScreen({super.key});

  /// The QR for the USDT deposit address. The lower part of the image is a
  /// Binance app advert, which [_UsdtPanel] crops away.
  static const usdtQrAsset = 'assets/payment/usdt_trc20_qr.jpg';

  @override
  ConsumerState<DepositScreen> createState() => _DepositScreenState();
}

class _DepositScreenState extends ConsumerState<DepositScreen> {
  static const _inrQuickAmounts = [5000, 10000, 50000, 100000];
  static const _usdtQuickAmounts = [3000, 5000, 10000, 25000];

  final _formKey = GlobalKey<FormState>();
  final _amount = TextEditingController();
  final _reference = TextEditingController();
  String? _proofName;
  Uint8List? _proofBytes;
  var _currencyCode = 'INR';
  var _submitting = false;

  /// `AGENT` or `MASTER` while the agent is buying their joining plan.
  String? _planCode;

  @override
  void dispose() {
    _amount.dispose();
    _reference.dispose();
    super.dispose();
  }

  void _selectCurrency(String code) {
    if (code == _currencyCode) return;
    setState(() {
      _currencyCode = code;
      // The figures mean different things in each currency, so starting
      // fresh is safer than carrying a rupee amount into a USDT field.
      _amount.clear();
      _reference.clear();
      _formKey.currentState?.reset();
    });
  }

  String? _validateAmount(DepositCurrencyOption currency, String? value) {
    final error = Validators.positiveAmount(value);
    if (error != null) return error;

    if (num.parse(value!.trim()) < currency.minimum) {
      return currency.isUsdt
          ? 'Minimum deposit is ${currency.minimum.toStringAsFixed(0)} USDT'
          : 'Minimum deposit is ${formatInr(currency.minimum)}';
    }
    return null;
  }

  String? _validateReference(DepositCurrencyOption currency, String? value) {
    final v = value?.trim() ?? '';
    if (v.isEmpty) return '${currency.referenceLabel} is required';
    if (!RegExp(r'^[A-Za-z0-9]{6,80}$').hasMatch(v)) {
      return 'Enter a valid ${currency.referenceLabel.toLowerCase()}';
    }
    return null;
  }

  Future<void> _pickProof() async {
    try {
      final file = await ImagePicker().pickImage(
        source: ImageSource.gallery,
        maxWidth: 1600,
        imageQuality: 85,
      );
      if (file == null) return;
      final bytes = await file.readAsBytes();
      setState(() {
        _proofName = file.name;
        _proofBytes = bytes;
      });
    } catch (e) {
      if (mounted) showMessage(context, 'Could not open gallery: $e');
    }
  }

  Future<void> _submit(DepositCurrencyOption currency) async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _submitting = true);
    try {
      await ref.read(depositsProvider.notifier).create(
            amount: double.parse(_amount.text.trim()),
            utr: _reference.text.trim(),
            currency: currency.code,
            plan: _planCode,
          );
      if (!mounted) return;
      showMessage(
        context,
        _planCode == null
            ? 'Deposit request submitted for verification'
            : 'Payment submitted. Your plan starts once it is approved.',
      );
      context.go(Routes.history);
    } catch (e) {
      if (mounted) showMessage(context, 'Could not submit deposit: $e');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final balance = ref.watch(summaryProvider).value?.totalBalance;
    final config = ref.watch(depositConfigProvider);

    return Scaffold(
      appBar: const SubPageAppBar(title: 'Deposit'),
      body: AsyncValueView(
        value: config,
        skeletonCount: 3,
        onRetry: () => ref.invalidate(depositConfigProvider),
        data: (config) {
          final currency =
              config.byCode(_currencyCode) ?? config.currencies.first;
          // Buying the first plan, rather than topping up an existing one.
          final joining = !config.hasJoined && config.plans.isNotEmpty;

          return Form(
            key: _formKey,
            child: PageListView(
              maxWidth: 640,
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
              children: [
                SectionCard(
                  title: 'New Deposit',
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      InsetPanel(
                        padding: const EdgeInsets.all(16),
                        child: Row(
                          children: [
                            const Icon(
                              Icons.account_balance_wallet_outlined,
                              color: AppColors.primaryBlue,
                            ),
                            const SizedBox(width: 12),
                            const Expanded(
                              child: Text(
                                'Current balance',
                                style: AppTextStyles.kvLabel,
                              ),
                            ),
                            Text(
                              balance == null ? '--' : formatInr(balance),
                              style: AppTextStyles.statValue
                                  .copyWith(fontSize: 18),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 18),

                      if (joining) ...[
                        _PlanPicker(
                          plans: config.plans,
                          selected: _planCode,
                          onChanged: (plan) => setState(() {
                            _planCode = plan.code;
                            // The server checks the price exactly, so the
                            // amount is the plan's, not the agent's to type.
                            _amount.text = plan.priceUsdt.toStringAsFixed(0);
                          }),
                        ),
                        const SizedBox(height: 18),
                      ] else if (config.currencies.length > 1) ...[
                        _CurrencyPicker(
                          currencies: config.currencies,
                          selected: currency.code,
                          onChanged: _selectCurrency,
                        ),
                        const SizedBox(height: 18),
                      ],

                      if (joining && _planCode == null)
                        const Text(
                          'Choose a plan to see the payment details.',
                          style: AppTextStyles.muted,
                        ),

                      if (!joining || _planCode != null) ...[
                      if (currency.isUsdt) ...[
                        _UsdtPanel(currency: currency),
                        const SizedBox(height: 18),
                      ],

                      TextFormField(
                        key: const Key('depositAmount'),
                        controller: _amount,
                        keyboardType: const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                        inputFormatters: [
                          FilteringTextInputFormatter.allow(
                            RegExp(r'^\d*\.?\d{0,2}'),
                          ),
                        ],
                        decoration: InputDecoration(
                          labelText: 'Amount',
                          prefixText: currency.isUsdt ? null : '₹ ',
                          suffixText: currency.isUsdt ? 'USDT' : null,
                          helperText: currency.isUsdt
                              ? 'Minimum ${currency.minimum.toStringAsFixed(0)} USDT'
                              : 'Minimum ${formatInr(currency.minimum)} '
                                  '(${(currency.minimum / config.usdtInrRate).toStringAsFixed(0)}'
                                  ' USDT at ${formatInr(config.usdtInrRate)})',
                          helperMaxLines: 2,
                        ),
                        readOnly: joining,
                        validator: (v) => _validateAmount(currency, v),
                        onChanged: (_) => setState(() {}),
                      ),

                      if (currency.isUsdt) _UsdtValueHint(
                        amount: _amount.text,
                        rate: config.usdtInrRate,
                      ),

                      const SizedBox(height: 10),
                      if (!joining) Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          for (final a in currency.isUsdt
                              ? _usdtQuickAmounts
                              : _inrQuickAmounts)
                            ActionChip(
                              label: Text(
                                currency.isUsdt
                                    ? '$a USDT'
                                    : formatInrGrouped(a),
                              ),
                              onPressed: () {
                                _amount.text = '$a';
                                setState(() {});
                              },
                            ),
                        ],
                      ),
                      formGap,

                      TextFormField(
                        key: const Key('depositUtr'),
                        controller: _reference,
                        textCapitalization: TextCapitalization.characters,
                        decoration: InputDecoration(
                          labelText: currency.referenceLabel,
                          prefixIcon: Icon(
                            currency.isUsdt
                                ? Icons.link_rounded
                                : Icons.tag_rounded,
                          ),
                        ),
                        validator: (v) => _validateReference(currency, v),
                      ),
                      formGap,

                      _ProofPicker(
                        name: _proofName,
                        bytes: _proofBytes,
                        onPick: _pickProof,
                        onRemove: () => setState(() {
                          _proofName = null;
                          _proofBytes = null;
                        }),
                      ),
                      const SizedBox(height: 20),
                      PrimaryButton(
                        label: joining ? 'I have paid' : 'Submit deposit',
                        loading: _submitting,
                        onPressed: () => _submit(currency),
                      ),
                      ],
                    ],
                  ),
                ),
                Text(
                  currency.isUsdt
                      ? 'Send only USDT on ${currency.network} to the address above. '
                          'Anything else is lost. Your balance is credited in rupees '
                          'at ${formatInr(config.usdtInrRate)} per USDT once the '
                          'transfer is confirmed.'
                      : 'Deposits are credited to your balance after the payment is '
                          'verified. Make sure the UTR matches your bank transfer.',
                  style: AppTextStyles.muted,
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

/// The two joining plans. An agent buys exactly one, once.
class _PlanPicker extends StatelessWidget {
  const _PlanPicker({
    required this.plans,
    required this.selected,
    required this.onChanged,
  });

  final List<JoiningPlan> plans;
  final String? selected;
  final ValueChanged<JoiningPlan> onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text('Choose your plan', style: AppTextStyles.kvLabel),
        const SizedBox(height: 10),
        for (final plan in plans) ...[
          _PlanCard(
            plan: plan,
            selected: plan.code == selected,
            onTap: () => onChanged(plan),
          ),
          const SizedBox(height: 10),
        ],
      ],
    );
  }
}

class _PlanCard extends StatelessWidget {
  const _PlanCard({
    required this.plan,
    required this.selected,
    required this.onTap,
  });

  final JoiningPlan plan;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: selected ? AppColors.primaryBlue : AppColors.border,
            width: selected ? 2 : 1,
          ),
          color: selected
              ? AppColors.primaryBlue.withValues(alpha: 0.06)
              : null,
        ),
        child: Row(
          children: [
            Icon(
              selected
                  ? Icons.radio_button_checked
                  : Icons.radio_button_unchecked,
              color: selected ? AppColors.primaryBlue : AppColors.textMuted,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // A Wrap, not a Row: on a narrow phone the badge drops
                  // under the name instead of overflowing.
                  Wrap(
                    spacing: 8,
                    runSpacing: 4,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Text(
                        plan.label,
                        style: AppTextStyles.kvLabel.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      if (plan.isMaster)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.primaryBlue,
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: const Text(
                            'PANEL ACCESS',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 9,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(plan.description, style: AppTextStyles.muted),
                  if (plan.securityUsdt > 0) ...[
                    const SizedBox(height: 6),
                    Text(
                      '${plan.securityUsdt.toStringAsFixed(0)} USDT held as '
                      'security, ${plan.floatUsdt.toStringAsFixed(0)} USDT to '
                      'your balance, plus your payout commission.',
                      style: AppTextStyles.muted.copyWith(
                        color: AppColors.primaryBlue,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: 12),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  '${plan.priceUsdt.toStringAsFixed(0)} USDT',
                  style: AppTextStyles.statValue.copyWith(fontSize: 16),
                ),
                Text(formatInr(plan.priceInr), style: AppTextStyles.muted),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// INR or USDT.
class _CurrencyPicker extends StatelessWidget {
  const _CurrencyPicker({
    required this.currencies,
    required this.selected,
    required this.onChanged,
  });

  final List<DepositCurrencyOption> currencies;
  final String selected;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        for (final currency in currencies) ...[
          Expanded(
            child: _CurrencyTab(
              key: Key('currency_${currency.code}'),
              label: currency.label,
              code: currency.code,
              selected: currency.code == selected,
              onTap: () => onChanged(currency.code),
            ),
          ),
          if (currency != currencies.last) const SizedBox(width: 10),
        ],
      ],
    );
  }
}

class _CurrencyTab extends StatelessWidget {
  const _CurrencyTab({
    super.key,
    required this.label,
    required this.code,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final String code;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      selected: selected,
      button: true,
      child: Material(
        color: selected ? AppColors.navy : AppColors.pillBg,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 12),
            child: Column(
              children: [
                Icon(
                  code == 'USDT'
                      ? Icons.currency_bitcoin_rounded
                      : Icons.account_balance_rounded,
                  size: 22,
                  color: selected ? AppColors.white : AppColors.navy,
                ),
                const SizedBox(height: 6),
                Text(
                  label,
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                    color: selected ? AppColors.white : AppColors.textPrimary,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// The QR code, network and address for a USDT transfer.
class _UsdtPanel extends StatelessWidget {
  const _UsdtPanel({required this.currency});

  final DepositCurrencyOption currency;

  /// The source image carries a Binance app advert below the address; only
  /// the top of it is worth showing.
  static const _usefulHeightFraction = 0.68;

  @override
  Widget build(BuildContext context) {
    final address = currency.address ?? '';

    return InsetPanel(
      padding: const EdgeInsets.all(14),
      child: Column(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(14),
            child: Align(
              alignment: Alignment.topCenter,
              heightFactor: _usefulHeightFraction,
              child: Image.asset(
                DepositScreen.usdtQrAsset,
                width: 280,
                fit: BoxFit.fitWidth,
                semanticLabel: 'USDT deposit QR code',
              ),
            ),
          ),
          const SizedBox(height: 12),
          if (currency.network != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: AppColors.chipBg,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                'Network: ${currency.network}',
                style: const TextStyle(
                  color: AppColors.chipText,
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                ),
              ),
            ),
          const SizedBox(height: 12),
          SelectableText(
            address,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 13.5,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.2,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 8),
          OutlinedPillButton(
            label: 'Copy address',
            onPressed: () async {
              await Clipboard.setData(ClipboardData(text: address));
              if (context.mounted) showMessage(context, 'Address copied');
            },
          ),
        ],
      ),
    );
  }
}

/// Shows what the typed USDT amount is worth, so there is no surprise when
/// the rupee balance moves.
class _UsdtValueHint extends StatelessWidget {
  const _UsdtValueHint({required this.amount, required this.rate});

  final String amount;
  final double rate;

  @override
  Widget build(BuildContext context) {
    final parsed = double.tryParse(amount.trim());
    if (parsed == null || parsed <= 0) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Text(
        'Credits about ${formatInr(parsed * rate)} at ${formatInr(rate)} per USDT',
        style: AppTextStyles.muted.copyWith(color: AppColors.primaryBlue),
      ),
    );
  }
}

class _ProofPicker extends StatelessWidget {
  const _ProofPicker({
    required this.name,
    required this.bytes,
    required this.onPick,
    required this.onRemove,
  });

  final String? name;
  final Uint8List? bytes;
  final VoidCallback onPick;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    if (bytes == null) {
      return OutlinedButton.icon(
        onPressed: onPick,
        icon: const Icon(Icons.upload_file_rounded),
        label: const Text('Upload payment screenshot (optional)'),
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.primaryBlue,
          minimumSize: const Size.fromHeight(52),
          side: const BorderSide(color: AppColors.border, width: 1.5),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
      );
    }
    return RecordCard(
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: Image.memory(bytes!, width: 56, height: 56, fit: BoxFit.cover),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              name ?? 'Screenshot',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
          IconButton(
            tooltip: 'Remove',
            icon: const Icon(Icons.close_rounded),
            onPressed: onRemove,
          ),
        ],
      ),
    );
  }
}
