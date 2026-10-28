import '../models/dashboard_summary.dart';
import '../models/deposit_config.dart';
import '../models/transactions.dart';

/// Balances, payins, payouts, deposits and earnings.
abstract interface class WalletRepository {
  Future<DashboardSummary> summary();

  Future<List<EarningWeek>> earnings();

  Future<List<PayinRecord>> payins();

  Future<List<OpenPayout>> openPayouts();

  Future<List<PayoutPayment>> payoutPayments();

  Future<List<DepositRecord>> deposits();

  /// The currencies the platform accepts, their minimums, and where to send
  /// USDT. Read from the server so none of it is baked into the app.
  Future<DepositConfig> depositConfig();

  /// [amount] is in [currency]; the server converts USDT to rupees at its
  /// own rate, so the app never decides what a deposit is worth.
  Future<DepositRecord> createDeposit({
    required double amount,
    required String utr,
    String currency = 'INR',
    /// `AGENT` or `MASTER` when this deposit is buying a joining plan.
    String? plan,
  });
}
