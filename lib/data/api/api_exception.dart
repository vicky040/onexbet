/// One invalid field, from a `validation_failed` response.
class FieldError {
  const FieldError({required this.field, required this.message});

  final String field;
  final String message;

  factory FieldError.fromJson(Map<String, dynamic> json) => FieldError(
        field: json['field'] as String? ?? '',
        message: json['message'] as String? ?? '',
      );
}

/// A failure reported by the API, or a network problem reaching it.
///
/// [message] is written by the server to be shown to the user, so screens
/// can display it as-is.
class ApiException implements Exception {
  const ApiException({
    required this.code,
    required this.message,
    this.statusCode,
    this.details = const [],
  });

  /// Stable machine code: `unauthorized`, `validation_failed`,
  /// `insufficient_balance`, `conflict`, `network`, ...
  final String code;
  final String message;
  final int? statusCode;
  final List<FieldError> details;

  bool get isUnauthorized => code == 'unauthorized';
  bool get isNetwork => code == 'network';

  /// Could not reach the server at all.
  factory ApiException.network([String? detail]) => ApiException(
        code: 'network',
        message: detail ??
            'Could not reach the server. Check your connection and try again.',
      );

  @override
  String toString() => message;
}
