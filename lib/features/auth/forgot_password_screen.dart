import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/routes.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/validators.dart';
import '../../core/widgets/buttons.dart';
import '../../core/widgets/form_fields.dart';
import '../../data/repositories/auth_repository.dart';
import 'auth_controller.dart';
import 'widgets/auth_scaffold.dart';

/// Two steps: confirm the mobile number and receive a code, then enter the
/// code with a new password.
class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  ConsumerState<ForgotPasswordScreen> createState() =>
      _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _mobile = TextEditingController();
  final _otp = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();

  var _step = 0;
  var _loading = false;
  PasswordResetChallenge? _challenge;

  @override
  void dispose() {
    _mobile.dispose();
    _otp.dispose();
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _loading = true);
    try {
      if (_step == 0) {
        final challenge = await ref
            .read(authControllerProvider.notifier)
            .requestPasswordReset(_mobile.text.trim());
        if (!mounted) return;
        setState(() {
          _challenge = challenge;
          _step = 1;
        });
        // Without an SMS provider configured the server hands the code back
        // so the flow can still be completed; see admin/lib/sms.ts.
        if (challenge.devOtp != null) {
          _otp.text = challenge.devOtp!;
          showMessage(context, 'Development code: ${challenge.devOtp}');
        }
        return;
      }

      await ref.read(authControllerProvider.notifier).confirmPasswordReset(
            resetToken: _challenge!.resetToken,
            otp: _otp.text.trim(),
            newPassword: _password.text,
          );
      if (!mounted) return;
      showMessage(context, 'Password updated. Please log in.');
      context.go(Routes.login);
    } on AuthException catch (e) {
      if (mounted) showMessage(context, e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthScaffold(
      showBack: true,
      title: _step == 0 ? 'Forgot password' : 'Enter your code',
      subtitle: _step == 0
          ? 'Enter the mobile number linked to your account and we will text you a code.'
          : 'We sent a 6-digit code to +91 ${_mobile.text}. '
              'It expires in ${_challenge?.expiresInMinutes ?? 10} minutes.',
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_step == 0)
              MobileField(
                controller: _mobile,
                textInputAction: TextInputAction.done,
              )
            else ...[
              TextFormField(
                key: const Key('otpField'),
                controller: _otp,
                keyboardType: TextInputType.number,
                textInputAction: TextInputAction.next,
                inputFormatters: [
                  FilteringTextInputFormatter.digitsOnly,
                  LengthLimitingTextInputFormatter(6),
                ],
                decoration: const InputDecoration(
                  labelText: '6-digit code',
                  prefixIcon: Icon(Icons.sms_outlined),
                ),
                validator: (v) {
                  final value = v?.trim() ?? '';
                  if (value.isEmpty) return 'Enter the code we texted you';
                  if (value.length != 6) return 'The code is 6 digits';
                  return null;
                },
              ),
              formGap,
              PasswordField(controller: _password, label: 'New password'),
              formGap,
              PasswordField(
                controller: _confirm,
                label: 'Confirm new password',
                textInputAction: TextInputAction.done,
                validator: (v) => Validators.confirmPassword(v, _password.text),
                onSubmitted: (_) => _submit(),
              ),
            ],
            const SizedBox(height: 20),
            PrimaryButton(
              key: const Key('resetButton'),
              label: _step == 0 ? 'Send code' : 'Reset password',
              loading: _loading,
              onPressed: _submit,
            ),
            if (_step == 1)
              TextButton(
                onPressed: _loading
                    ? null
                    : () => setState(() {
                          _step = 0;
                          _otp.clear();
                          _challenge = null;
                        }),
                child: const Text('Use a different number'),
              ),
            if (_step == 0)
              const Padding(
                padding: EdgeInsets.only(top: 12),
                child: Text(
                  'For your security we never say whether a number is registered.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppColors.textMuted, fontSize: 12.5),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
