import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/routes.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/validators.dart';
import '../../core/widgets/app_bars.dart';
import '../../core/widgets/async_views.dart';
import '../../core/widgets/buttons.dart';
import '../../core/widgets/form_fields.dart';
import '../../core/widgets/responsive.dart';
import '../../core/widgets/section_card.dart';
import '../../data/models/bank_account.dart';
import '../../data/providers.dart';

/// Adds a bank account, or edits the one with [bankId].
class BankFormScreen extends ConsumerStatefulWidget {
  const BankFormScreen({super.key, this.bankId});

  final String? bankId;

  @override
  ConsumerState<BankFormScreen> createState() => _BankFormScreenState();
}

class _BankFormScreenState extends ConsumerState<BankFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _bankName = TextEditingController();
  final _holder = TextEditingController();
  final _accountNumber = TextEditingController();
  final _ifsc = TextEditingController();
  final _upi = TextEditingController();
  final _limit = TextEditingController();
  final _amountLimit = TextEditingController();
  final _txnLimit = TextEditingController();
  var _isActive = false;
  var _prefilled = false;
  var _saving = false;

  bool get _isEdit => widget.bankId != null;

  @override
  void dispose() {
    for (final c in [
      _bankName,
      _holder,
      _accountNumber,
      _ifsc,
      _upi,
      _limit,
      _amountLimit,
      _txnLimit,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  void _prefill(BankAccount bank) {
    _bankName.text = bank.bankName;
    _holder.text = bank.accountHolder;
    _accountNumber.text = bank.accountNumber;
    _ifsc.text = bank.ifsc;
    _upi.text = bank.upiId;
    _limit.text = '${bank.limit}';
    _amountLimit.text = bank.amountLimit.toStringAsFixed(0);
    _txnLimit.text = '${bank.txnLimit}';
    _isActive = bank.isActive;
    _prefilled = true;
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    final bank = BankAccount(
      id: widget.bankId ?? '',
      bankName: _bankName.text.trim(),
      accountHolder: _holder.text.trim(),
      accountNumber: _accountNumber.text.trim(),
      ifsc: _ifsc.text.trim().toUpperCase(),
      upiId: _upi.text.trim(),
      limit: int.parse(_limit.text),
      amountLimit: double.parse(_amountLimit.text),
      txnLimit: int.parse(_txnLimit.text),
      isActive: _isActive,
    );
    try {
      await ref.read(banksProvider.notifier).save(bank);
      if (!mounted) return;
      showMessage(context, _isEdit ? 'Bank account updated' : 'Bank account added');
      _close();
    } catch (e) {
      if (mounted) showMessage(context, 'Could not save bank: $e');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _delete() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete bank account?'),
        content: const Text('This bank account will be removed from your list.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            style: TextButton.styleFrom(foregroundColor: AppColors.danger),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    await ref.read(banksProvider.notifier).delete(widget.bankId!);
    if (!mounted) return;
    showMessage(context, 'Bank account deleted');
    _close();
  }

  void _close() => context.canPop() ? context.pop() : context.go(Routes.accounts);

  String? _wholeNumber(String? v, String field) {
    final error = Validators.positiveAmount(v, field);
    if (error != null) return error;
    return int.tryParse(v!.trim()) == null ? 'Enter a whole number' : null;
  }

  @override
  Widget build(BuildContext context) {
    final banks = ref.watch(banksProvider);

    return Scaffold(
      appBar: SubPageAppBar(
        title: _isEdit ? 'Edit Bank' : 'Add Bank',
        fallback: Routes.accounts,
        actions: [
          if (_isEdit)
            IconButton(
              tooltip: 'Delete',
              icon: const Icon(Icons.delete_outline_rounded),
              onPressed: _delete,
            ),
        ],
      ),
      body: AsyncValueView(
        value: banks,
        data: (list) {
          if (_isEdit && !_prefilled) {
            final bank = list.where((b) => b.id == widget.bankId).firstOrNull;
            if (bank == null) {
              return const Padding(
                padding: EdgeInsets.all(16),
                child: EmptyState('Bank account not found.'),
              );
            }
            _prefill(bank);
          }
          return _buildForm();
        },
      ),
    );
  }

  Widget _buildForm() {
    final digits = [FilteringTextInputFormatter.digitsOnly];
    return Form(
      key: _formKey,
      child: PageListView(
        maxWidth: 640,
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          SectionCard(
            title: 'Bank details',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextFormField(
                  controller: _bankName,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(
                    labelText: 'Bank name',
                    prefixIcon: Icon(Icons.account_balance_outlined),
                  ),
                  validator: (v) => Validators.required(v, 'Bank name'),
                ),
                formGap,
                TextFormField(
                  controller: _holder,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(
                    labelText: 'Account holder name',
                    prefixIcon: Icon(Icons.person_outline_rounded),
                  ),
                  validator: (v) => Validators.required(v, 'Account holder name'),
                ),
                formGap,
                TextFormField(
                  controller: _accountNumber,
                  keyboardType: TextInputType.number,
                  inputFormatters: [
                    ...digits,
                    LengthLimitingTextInputFormatter(18),
                  ],
                  decoration: const InputDecoration(
                    labelText: 'Account number',
                    prefixIcon: Icon(Icons.numbers_rounded),
                  ),
                  validator: Validators.accountNumber,
                ),
                formGap,
                TextFormField(
                  controller: _ifsc,
                  textCapitalization: TextCapitalization.characters,
                  inputFormatters: [
                    LengthLimitingTextInputFormatter(11),
                    TextInputFormatter.withFunction(
                      (_, value) => value.copyWith(text: value.text.toUpperCase()),
                    ),
                  ],
                  decoration: const InputDecoration(
                    labelText: 'IFSC',
                    prefixIcon: Icon(Icons.qr_code_rounded),
                  ),
                  validator: Validators.ifsc,
                ),
                formGap,
                TextFormField(
                  controller: _upi,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(
                    labelText: 'UPI ID',
                    prefixIcon: Icon(Icons.alternate_email_rounded),
                  ),
                  validator: Validators.upi,
                ),
              ],
            ),
          ),
          SectionCard(
            title: 'Limits',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextFormField(
                  controller: _limit,
                  keyboardType: TextInputType.number,
                  inputFormatters: digits,
                  decoration: const InputDecoration(labelText: 'Daily limit'),
                  validator: (v) => _wholeNumber(v, 'Daily limit'),
                ),
                formGap,
                TextFormField(
                  controller: _amountLimit,
                  keyboardType: TextInputType.number,
                  inputFormatters: digits,
                  decoration: const InputDecoration(
                    labelText: 'Amount limit',
                    prefixText: '₹ ',
                  ),
                  validator: (v) => _wholeNumber(v, 'Amount limit'),
                ),
                formGap,
                TextFormField(
                  controller: _txnLimit,
                  keyboardType: TextInputType.number,
                  inputFormatters: digits,
                  decoration: const InputDecoration(labelText: 'Transaction limit'),
                  validator: (v) => _wholeNumber(v, 'Transaction limit'),
                ),
                const SizedBox(height: 6),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text(
                    'Active',
                    style: TextStyle(fontWeight: FontWeight.w600),
                  ),
                  subtitle: const Text('Receive payins on this account'),
                  value: _isActive,
                  onChanged: (v) => setState(() => _isActive = v),
                ),
              ],
            ),
          ),
          PrimaryButton(
            label: _isEdit ? 'Save changes' : 'Add bank account',
            loading: _saving,
            onPressed: _save,
          ),
        ],
      ),
    );
  }
}
