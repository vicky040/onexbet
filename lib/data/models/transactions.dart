import 'json.dart';
import 'txn_status.dart';

class PayinRecord {
  const PayinRecord({
    required this.id,
    required this.createdAt,
    required this.previousBalance,
    required this.amount,
    required this.commissionRate,
    required this.commission,
    required this.afterBalance,
    required this.txnRef,
    this.status = TxnStatus.completed,
  });

  /// The reference code the server assigns, e.g. `APE0Q8VYQV7L`.
  final String id;
  final DateTime createdAt;
  final double previousBalance;
  final double amount;

  /// Percentage, e.g. `5.5` for 5.50%.
  final double commissionRate;

  /// What the agent earned. The server is the authority on this — it is the
  /// figure the ledger and the admin panel agree on.
  final double commission;
  final double afterBalance;
  final String txnRef;
  final TxnStatus status;

  factory PayinRecord.fromJson(Map<String, dynamic> json) => PayinRecord(
        id: asString(json['id']),
        createdAt: asDate(json['createdAt']),
        previousBalance: asDouble(json['previousBalance']),
        amount: asDouble(json['amount']),
        commissionRate: asDouble(json['commissionRate']),
        commission: asDouble(json['commission']),
        afterBalance: asDouble(json['afterBalance']),
        txnRef: asString(json['txnRef']),
        status: TxnStatus.fromCode(json['status']),
      );
}

class PayoutPayment {
  const PayoutPayment({
    required this.id,
    required this.createdAt,
    required this.amount,
    required this.commission,
    required this.status,
    this.upiId = '',
    this.note,
  });

  final String id;
  final DateTime createdAt;
  final double amount;
  final double commission;
  final TxnStatus status;
  final String upiId;

  /// What it was for, when it was not an ordinary player payout.
  final String? note;

  factory PayoutPayment.fromJson(Map<String, dynamic> json) => PayoutPayment(
        id: asString(json['id']),
        createdAt: asDate(json['createdAt']),
        amount: asDouble(json['amount']),
        commission: asDouble(json['commission']),
        status: TxnStatus.fromCode(json['status']),
        upiId: asString(json['upiId']),
        note: json['note'] as String?,
      );
}

class OpenPayout {
  const OpenPayout({
    required this.id,
    required this.amount,
    required this.commission,
    required this.upiId,
    this.note,
  });

  final String id;
  final double amount;
  final double commission;
  final String upiId;
  final String? note;

  factory OpenPayout.fromJson(Map<String, dynamic> json) => OpenPayout(
        id: asString(json['id']),
        amount: asDouble(json['amount']),
        commission: asDouble(json['commission']),
        upiId: asString(json['upiId']),
        note: json['note'] as String?,
      );
}

class DepositRecord {
  const DepositRecord({
    required this.id,
    required this.createdAt,
    required this.previousBalance,
    required this.amount,
    required this.afterBalance,
    required this.status,
    this.utr,
    this.currency = 'INR',
    this.amountUsdt,
    this.usdtRate,
  });

  final String id;
  final DateTime createdAt;
  final double previousBalance;
  final double amount;

  /// While a deposit is pending this is what the balance *will* be; the
  /// server works it out either way.
  final double afterBalance;
  final TxnStatus status;
  final String? utr;

  /// `INR` or `USDT`. Balances are always in rupees, so [amount] is the
  /// rupee value either way; [amountUsdt] is what was actually sent.
  final String currency;
  final double? amountUsdt;
  final double? usdtRate;

  bool get isUsdt => currency == 'USDT';

  factory DepositRecord.fromJson(Map<String, dynamic> json) => DepositRecord(
        id: asString(json['id']),
        createdAt: asDate(json['createdAt']),
        previousBalance: asDouble(json['previousBalance']),
        amount: asDouble(json['amount']),
        afterBalance: asDouble(json['afterBalance']),
        status: TxnStatus.fromCode(json['status']),
        utr: json['utr'] as String?,
        currency: json['currency'] == null ? 'INR' : asString(json['currency']),
        amountUsdt:
            json['amountUsdt'] == null ? null : asDouble(json['amountUsdt']),
        usdtRate: json['usdtRate'] == null ? null : asDouble(json['usdtRate']),
      );
}

class EarningWeek {
  const EarningWeek({
    required this.week,
    required this.maskedTransactions,
    required this.netEarnings,
    this.transactions = 0,
  });

  final int week;

  /// The week's payin volume, masked the way the earnings table shows it.
  final String maskedTransactions;
  final double netEarnings;
  final int transactions;

  factory EarningWeek.fromJson(Map<String, dynamic> json) => EarningWeek(
        week: asInt(json['week']),
        maskedTransactions: asString(json['maskedTransactions']),
        netEarnings: asDouble(json['netEarnings']),
        transactions: asInt(json['transactions']),
      );
}
