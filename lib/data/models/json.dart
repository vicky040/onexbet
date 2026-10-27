import 'package:flutter/foundation.dart';

import '../api/api_exception.dart';

/// Readers for the API's JSON. Money arrives as a JSON number and dates as
/// ISO-8601 UTC strings; see admin/docs/API.md.

double asDouble(Object? value) {
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value) ?? 0;
  return 0;
}

int asInt(Object? value) {
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value) ?? 0;
  return 0;
}

String asString(Object? value) => value?.toString() ?? '';

bool asBool(Object? value) => value == true;

/// Parses an ISO-8601 timestamp into local time.
DateTime asDate(Object? value) {
  final parsed = DateTime.tryParse(asString(value));
  if (parsed == null) {
    throw FormatException('Expected an ISO-8601 date, got "$value"');
  }
  return parsed.toLocal();
}

DateTime? asDateOrNull(Object? value) =>
    value == null ? null : DateTime.tryParse(asString(value))?.toLocal();

/// The list-of-objects shape every list endpoint returns.
List<Map<String, dynamic>> asObjectList(Object? value) =>
    (value as List? ?? const []).whereType<Map<String, dynamic>>().toList();

Map<String, dynamic> asObject(Object? value) =>
    value is Map<String, dynamic> ? value : const {};

/// Runs [parse] over a response body, so a payload that does not look the
/// way we expect surfaces as a normal [ApiException] rather than an
/// unhandled type error deep inside a widget build.
T parseResponse<T>(T Function() parse) {
  try {
    return parse();
  } on ApiException {
    rethrow;
  } catch (error, stack) {
    debugPrint('Could not parse an API response: $error\n$stack');
    throw const ApiException(
      code: 'server_error',
      message: 'The server sent data this app could not read.',
    );
  }
}
