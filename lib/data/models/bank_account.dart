import 'json.dart';

class BankAccount {
  const BankAccount({
    required this.id,
    required this.bankName,
    required this.accountHolder,
    required this.accountNumber,
    required this.ifsc,
    required this.upiId,
    required this.limit,
    required this.amountLimit,
    required this.txnLimit,
    this.isActive = false,
  });

  final String id;
  final String bankName;
  final String accountHolder;
  final String accountNumber;
  final String ifsc;
  final String upiId;

  /// Daily limit. The API sends it as both `limit` and `dailyLimit`.
  final int limit;
  final double amountLimit;
  final int txnLimit;
  final bool isActive;

  factory BankAccount.fromJson(Map<String, dynamic> json) => BankAccount(
        id: asString(json['id']),
        bankName: asString(json['bankName']),
        accountHolder: asString(json['accountHolder']),
        accountNumber: asString(json['accountNumber']),
        ifsc: asString(json['ifsc']),
        upiId: asString(json['upiId']),
        limit: asInt(json['limit'] ?? json['dailyLimit']),
        amountLimit: asDouble(json['amountLimit']),
        txnLimit: asInt(json['txnLimit']),
        isActive: asBool(json['isActive']),
      );

  /// The body the API accepts on create and update. `id` is in the path, not
  /// the body.
  Map<String, dynamic> toJson() => {
        'bankName': bankName,
        'accountHolder': accountHolder,
        'accountNumber': accountNumber,
        'ifsc': ifsc,
        'upiId': upiId,
        'limit': limit,
        'amountLimit': amountLimit,
        'txnLimit': txnLimit,
        'isActive': isActive,
      };

  BankAccount copyWith({
    String? id,
    String? bankName,
    String? accountHolder,
    String? accountNumber,
    String? ifsc,
    String? upiId,
    int? limit,
    double? amountLimit,
    int? txnLimit,
    bool? isActive,
  }) {
    return BankAccount(
      id: id ?? this.id,
      bankName: bankName ?? this.bankName,
      accountHolder: accountHolder ?? this.accountHolder,
      accountNumber: accountNumber ?? this.accountNumber,
      ifsc: ifsc ?? this.ifsc,
      upiId: upiId ?? this.upiId,
      limit: limit ?? this.limit,
      amountLimit: amountLimit ?? this.amountLimit,
      txnLimit: txnLimit ?? this.txnLimit,
      isActive: isActive ?? this.isActive,
    );
  }
}
