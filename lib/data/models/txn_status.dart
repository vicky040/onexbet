enum TxnStatus {
  completed('Completed', 'COMPLETED'),
  paymentReceived('Payment Received', 'PAYMENT_RECEIVED'),
  pending('Pending', 'PENDING'),
  failed('Failed', 'FAILED');

  const TxnStatus(this.label, this.code);

  /// Shown on the status chip.
  final String label;

  /// What the API sends and accepts; see admin/docs/API.md.
  final String code;

  /// Falls back to [pending] for a status this build does not know yet,
  /// so a newer server cannot crash an older app.
  static TxnStatus fromCode(Object? code) {
    final value = code?.toString();
    return values.firstWhere(
      (status) => status.code == value,
      orElse: () => TxnStatus.pending,
    );
  }
}
