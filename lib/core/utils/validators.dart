/// Form validators. Each returns an error message, or null when valid.
abstract final class Validators {
  static final _mobile = RegExp(r'^[6-9]\d{9}$');
  static final _email = RegExp(r'^[\w.+-]+@[\w-]+(\.[\w-]+)+$');
  static final _ifsc = RegExp(r'^[A-Z]{4}0[A-Z0-9]{6}$');
  static final _upi = RegExp(r'^[\w.-]{2,}@[a-zA-Z]{2,}$');
  static final _digits = RegExp(r'^\d+$');

  static String? required(String? value, [String field = 'This field']) {
    if (value == null || value.trim().isEmpty) return '$field is required';
    return null;
  }

  static String? mobile(String? value) {
    final v = value?.trim() ?? '';
    if (v.isEmpty) return 'Mobile number is required';
    if (!_mobile.hasMatch(v)) return 'Enter a valid 10-digit mobile number';
    return null;
  }

  static String? email(String? value) {
    final v = value?.trim() ?? '';
    if (v.isEmpty) return 'Email is required';
    if (!_email.hasMatch(v)) return 'Enter a valid email address';
    return null;
  }

  static String? password(String? value) {
    final v = value ?? '';
    if (v.isEmpty) return 'Password is required';
    if (v.length < 6) return 'Password must be at least 6 characters';
    return null;
  }

  static String? confirmPassword(String? value, String password) {
    if (value == null || value.isEmpty) return 'Please confirm your password';
    if (value != password) return 'Passwords do not match';
    return null;
  }

  static String? ifsc(String? value) {
    final v = value?.trim().toUpperCase() ?? '';
    if (v.isEmpty) return 'IFSC is required';
    if (!_ifsc.hasMatch(v)) return 'Enter a valid IFSC (e.g. SBIN0001234)';
    return null;
  }

  static String? upi(String? value) {
    final v = value?.trim() ?? '';
    if (v.isEmpty) return 'UPI ID is required';
    if (!_upi.hasMatch(v)) return 'Enter a valid UPI ID (e.g. name@bank)';
    return null;
  }

  static String? accountNumber(String? value) {
    final v = value?.trim() ?? '';
    if (v.isEmpty) return 'Account number is required';
    if (!_digits.hasMatch(v) || v.length < 9 || v.length > 18) {
      return 'Account number must be 9-18 digits';
    }
    return null;
  }

  static String? positiveAmount(String? value, [String field = 'Amount']) {
    final v = value?.trim() ?? '';
    if (v.isEmpty) return '$field is required';
    final n = num.tryParse(v);
    if (n == null || n <= 0) return 'Enter a valid ${field.toLowerCase()}';
    return null;
  }
}
