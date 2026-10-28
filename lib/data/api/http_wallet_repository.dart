import '../models/dashboard_summary.dart';
import '../models/deposit_config.dart';
import '../models/json.dart';
import '../models/transactions.dart';
import '../repositories/wallet_repository.dart';
import 'api_client.dart';

/// [WalletRepository] against `/api/v1/wallet/*`, `/payins`, `/payouts/*`
/// and `/deposits`.
class HttpWalletRepository implements WalletRepository {
  HttpWalletRepository(this._api);

  final ApiClient _api;

  @override
  Future<DashboardSummary> summary() async {
    final data = await _api.get('/wallet/summary');
    return parseResponse(() => DashboardSummary.fromJson(asObject(data)));
  }

  @override
  Future<List<EarningWeek>> earnings() async {
    final data = await _api.get('/wallet/earnings');
    return parseResponse(
      () => asObjectList(data).map(EarningWeek.fromJson).toList(),
    );
  }

  @override
  Future<List<PayinRecord>> payins() async {
    final data = await _api.get('/payins');
    return parseResponse(
      () => asObjectList(data).map(PayinRecord.fromJson).toList(),
    );
  }

  @override
  Future<List<OpenPayout>> openPayouts() async {
    final data = await _api.get('/payouts/open');
    return parseResponse(
      () => asObjectList(data).map(OpenPayout.fromJson).toList(),
    );
  }

  @override
  Future<List<PayoutPayment>> payoutPayments() async {
    final data = await _api.get('/payouts/payments');
    return parseResponse(
      () => asObjectList(data).map(PayoutPayment.fromJson).toList(),
    );
  }

  @override
  Future<List<DepositRecord>> deposits() async {
    final data = await _api.get('/deposits');
    return parseResponse(
      () => asObjectList(data).map(DepositRecord.fromJson).toList(),
    );
  }

  @override
  Future<DepositConfig> depositConfig() async {
    final data = await _api.get('/deposits/config');
    return parseResponse(() => DepositConfig.fromJson(asObject(data)));
  }

  @override
  Future<DepositRecord> createDeposit({
    required double amount,
    required String utr,
    String currency = 'INR',
  }) async {
    final data = await _api.post(
      '/deposits',
      body: {'amount': amount, 'utr': utr, 'currency': currency},
    );
    return parseResponse(() => DepositRecord.fromJson(asObject(data)));
  }
}
