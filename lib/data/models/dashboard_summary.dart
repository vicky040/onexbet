import 'json.dart';

class DashboardSummary {
  const DashboardSummary({
    required this.totalBalance,
    required this.successRate,
    required this.securityDepositUsdt,
    required this.payinCommission,
    required this.payoutCommission,
    required this.totalPayin,
    required this.totalDeposit,
    required this.payoutsCredited,
  });

  final double totalBalance;
  final double successRate;
  final double securityDepositUsdt;
  final double payinCommission;
  final double payoutCommission;
  final double totalPayin;
  final double totalDeposit;
  final double payoutsCredited;

  factory DashboardSummary.fromJson(Map<String, dynamic> json) =>
      DashboardSummary(
        totalBalance: asDouble(json['totalBalance']),
        successRate: asDouble(json['successRate']),
        securityDepositUsdt: asDouble(json['securityDepositUsdt']),
        payinCommission: asDouble(json['payinCommission']),
        payoutCommission: asDouble(json['payoutCommission']),
        totalPayin: asDouble(json['totalPayin']),
        totalDeposit: asDouble(json['totalDeposit']),
        payoutsCredited: asDouble(json['payoutsCredited']),
      );
}
