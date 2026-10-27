import 'package:intl/intl.dart';

final _dateTime = DateFormat('dd MMM yyyy, HH:mm');
final _grouped = NumberFormat('#,##0.00');
final _groupedWhole = NumberFormat('#,##0');

/// `140474.93` -> `₹140474.93` (ungrouped, as shown in the app).
String formatInr(num value) => '₹${value.toStringAsFixed(2)}';

/// `500000` -> `₹500,000`.
String formatInrGrouped(num value) => '₹${_groupedWhole.format(value)}';

/// `1000` -> `1,000.00 USDT`.
String formatUsdt(num value) => '${_grouped.format(value)} USDT';

/// `14 Oct 2026, 16:22`.
String formatDateTime(DateTime value) => _dateTime.format(value);

String formatPercent(num value) => '${value.toStringAsFixed(2)}%';

/// `1234567890` -> `***7890`.
String maskAccountNumber(String number) {
  if (number.length <= 4) return number;
  return '***${number.substring(number.length - 4)}';
}

String greetingFor(DateTime now) {
  if (now.hour < 12) return 'Good morning';
  if (now.hour < 17) return 'Good afternoon';
  return 'Good evening';
}

String initialsOf(String name) {
  final trimmed = name.trim();
  return trimmed.isEmpty ? '?' : trimmed[0].toUpperCase();
}
