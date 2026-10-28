import 'package:flutter/material.dart';
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

class SignupScreen extends ConsumerStatefulWidget {
  const SignupScreen({super.key});

  @override
  ConsumerState<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends ConsumerState<SignupScreen> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _mobile = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  var _acceptedTerms = false;
  var _loading = false;

  @override
  void dispose() {
    for (final c in [_name, _mobile, _email, _password, _confirm]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _loading = true);
    try {
      final pendingApproval =
          await ref.read(authControllerProvider.notifier).signup(
                name: _name.text,
                mobile: _mobile.text.trim(),
                email: _email.text,
                password: _password.text,
              );
      // An account awaiting approval has no session, so the router will not
      // move: send them back to the login screen with an explanation.
      if (pendingApproval && mounted) {
        showMessage(
          context,
          'Account created. You can log in once an admin approves it.',
        );
        context.go(Routes.login);
      }
    } on AuthException catch (e) {
      if (mounted) showMessage(context, e.message);
    } catch (e) {
      // Never leave the button looking like it did nothing.
      if (mounted) showMessage(context, 'Something went wrong. Please try again.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthScaffold(
      title: 'Create account',
      subtitle: 'Sign up to start earning commission on payins and payouts.',
      footer: AuthFooterLink(
        text: 'Already have an account?',
        action: 'Login',
        onTap: () => context.go(Routes.login),
      ),
      child: AutofillGroup(
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextFormField(
                controller: _name,
                textCapitalization: TextCapitalization.words,
                textInputAction: TextInputAction.next,
                autofillHints: const [AutofillHints.name],
                decoration: const InputDecoration(
                  labelText: 'Full name',
                  prefixIcon: Icon(Icons.person_outline_rounded),
                ),
                validator: (v) => Validators.required(v, 'Full name'),
              ),
              formGap,
              MobileField(controller: _mobile),
              formGap,
              TextFormField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.next,
                autofillHints: const [AutofillHints.email],
                decoration: const InputDecoration(
                  labelText: 'Email',
                  prefixIcon: Icon(Icons.mail_outline_rounded),
                ),
                validator: Validators.email,
              ),
              formGap,
              PasswordField(controller: _password),
              formGap,
              PasswordField(
                controller: _confirm,
                label: 'Confirm password',
                textInputAction: TextInputAction.done,
                validator: (v) => Validators.confirmPassword(v, _password.text),
              ),
              const SizedBox(height: 6),
              FormField<bool>(
                initialValue: _acceptedTerms,
                validator: (_) =>
                    _acceptedTerms ? null : 'Please accept the terms to continue',
                builder: (field) => Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    CheckboxListTile(
                      value: _acceptedTerms,
                      contentPadding: EdgeInsets.zero,
                      controlAffinity: ListTileControlAffinity.leading,
                      activeColor: AppColors.navy,
                      title: const Text(
                        'I agree to the Terms & Conditions and Privacy Policy',
                        style: TextStyle(fontSize: 14),
                      ),
                      onChanged: (v) {
                        setState(() => _acceptedTerms = v ?? false);
                        field.didChange(v);
                      },
                    ),
                    if (field.hasError)
                      Text(
                        field.errorText!,
                        style: const TextStyle(
                          color: AppColors.danger,
                          fontSize: 12,
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              PrimaryButton(
                label: 'Create account',
                loading: _loading,
                onPressed: _submit,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
