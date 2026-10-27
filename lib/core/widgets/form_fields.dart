import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../utils/validators.dart';

/// 10-digit Indian mobile number field.
class MobileField extends StatelessWidget {
  const MobileField({super.key, required this.controller, this.textInputAction});

  final TextEditingController controller;
  final TextInputAction? textInputAction;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      key: const Key('mobileField'),
      controller: controller,
      keyboardType: TextInputType.phone,
      textInputAction: textInputAction ?? TextInputAction.next,
      autofillHints: const [AutofillHints.telephoneNumberNational],
      inputFormatters: [
        FilteringTextInputFormatter.digitsOnly,
        LengthLimitingTextInputFormatter(10),
      ],
      decoration: const InputDecoration(
        labelText: 'Mobile number',
        prefixIcon: Icon(Icons.phone_iphone_rounded),
        prefixText: '+91 ',
      ),
      validator: Validators.mobile,
    );
  }
}

/// Password field with a show/hide toggle.
class PasswordField extends StatefulWidget {
  const PasswordField({
    super.key,
    required this.controller,
    this.label = 'Password',
    this.validator = Validators.password,
    this.textInputAction,
    this.onSubmitted,
  });

  final TextEditingController controller;
  final String label;
  final FormFieldValidator<String> validator;
  final TextInputAction? textInputAction;
  final ValueChanged<String>? onSubmitted;

  @override
  State<PasswordField> createState() => _PasswordFieldState();
}

class _PasswordFieldState extends State<PasswordField> {
  var _obscure = true;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: widget.controller,
      obscureText: _obscure,
      textInputAction: widget.textInputAction ?? TextInputAction.next,
      onFieldSubmitted: widget.onSubmitted,
      autofillHints: const [AutofillHints.password],
      decoration: InputDecoration(
        labelText: widget.label,
        prefixIcon: const Icon(Icons.lock_outline_rounded),
        suffixIcon: IconButton(
          tooltip: _obscure ? 'Show password' : 'Hide password',
          icon: Icon(
            _obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined,
          ),
          onPressed: () => setState(() => _obscure = !_obscure),
        ),
      ),
      validator: widget.validator,
    );
  }
}

const formGap = SizedBox(height: 14);

void showMessage(BuildContext context, String message) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(message)));
}
