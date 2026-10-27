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
import '../../core/widgets/buttons.dart';
import '../../core/widgets/form_fields.dart';
import '../../core/widgets/responsive.dart';
import '../../core/widgets/section_card.dart';
import '../../data/providers.dart';

/// New deposit request: amount, UTR / reference and optional proof image.
class DepositScreen extends ConsumerStatefulWidget {
  const DepositScreen({super.key});

  @override
  ConsumerState<DepositScreen> createState() => _DepositScreenState();
}

class _DepositScreenState extends ConsumerState<DepositScreen> {
  static const _minAmount = 100;
  static const _quickAmounts = [5000, 10000, 50000, 100000];

  final _formKey = GlobalKey<FormState>();
  final _amount = TextEditingController();
  final _utr = TextEditingController();
  String? _proofName;
  Uint8List? _proofBytes;
  var _submitting = false;

  @override
  void dispose() {
    _amount.dispose();
    _utr.dispose();
    super.dispose();
  }

  String? _validateAmount(String? value) {
    final error = Validators.positiveAmount(value);
    if (error != null) return error;
    if (num.parse(value!.trim()) < _minAmount) {
      return 'Minimum deposit is ${formatInr(_minAmount)}';
    }
    return null;
  }

  String? _validateUtr(String? value) {
    final v = value?.trim() ?? '';
    if (v.isEmpty) return 'UTR / reference number is required';
    if (!RegExp(r'^[A-Za-z0-9]{6,22}$').hasMatch(v)) {
      return 'Enter a valid UTR / reference number';
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

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _submitting = true);
    try {
      await ref.read(depositsProvider.notifier).create(
            amount: double.parse(_amount.text.trim()),
            utr: _utr.text.trim(),
          );
      if (!mounted) return;
      showMessage(context, 'Deposit request submitted for verification');
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

    return Scaffold(
      appBar: const SubPageAppBar(title: 'Deposit'),
      body: Form(
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
                          child: Text('Current balance', style: AppTextStyles.kvLabel),
                        ),
                        Text(
                          balance == null ? '--' : formatInr(balance),
                          style: AppTextStyles.statValue.copyWith(fontSize: 18),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 18),
                  TextFormField(
                    key: const Key('depositAmount'),
                    controller: _amount,
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                    inputFormatters: [
                      FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}')),
                    ],
                    decoration: const InputDecoration(
                      labelText: 'Amount',
                      prefixText: '₹ ',
                    ),
                    validator: _validateAmount,
                  ),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (final a in _quickAmounts)
                        ActionChip(
                          label: Text(formatInrGrouped(a)),
                          onPressed: () => _amount.text = '$a',
                        ),
                    ],
                  ),
                  formGap,
                  TextFormField(
                    key: const Key('depositUtr'),
                    controller: _utr,
                    textCapitalization: TextCapitalization.characters,
                    decoration: const InputDecoration(
                      labelText: 'UTR / Reference number',
                      prefixIcon: Icon(Icons.tag_rounded),
                    ),
                    validator: _validateUtr,
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
                    label: 'Submit deposit',
                    loading: _submitting,
                    onPressed: _submit,
                  ),
                ],
              ),
            ),
            const Text(
              'Deposits are credited to your balance after the payment is verified. '
              'Make sure the UTR matches your bank transfer.',
              style: AppTextStyles.muted,
            ),
          ],
        ),
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
