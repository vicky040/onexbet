import '../models/dashboard_summary.dart';
import '../models/transactions.dart';

/// Balances, payins, payouts, deposits and earnings.
abstract interface class WalletRepository {
  Future<DashboardSummary> summary();

  Future<List<EarningWeek>> earnings();

  Future<List<PayinRecord>> payins();

  Future<List<OpenPayout>> openPayouts();

  Future<List<PayoutPayment>> payoutPayments();

  Future<List<DepositRecord>> deposits();

  Future<DepositRecord> createDeposit({
    required double amount,
    required String utr,
  });
}
