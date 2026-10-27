import '../models/bank_account.dart';
import '../models/json.dart';
import '../repositories/bank_repository.dart';
import 'api_client.dart';

/// [BankRepository] against `/api/v1/banks`.
class HttpBankRepository implements BankRepository {
  HttpBankRepository(this._api);

  final ApiClient _api;

  @override
  Future<List<BankAccount>> banks() async {
    final data = await _api.get('/banks');
    return parseResponse(
      () => asObjectList(data).map(BankAccount.fromJson).toList(),
    );
  }

  @override
  Future<BankAccount> save(BankAccount bank) async {
    final data = bank.id.isEmpty
        ? await _api.post('/banks', body: bank.toJson())
        : await _api.patch('/banks/${bank.id}', body: bank.toJson());
    return parseResponse(() => BankAccount.fromJson(asObject(data)));
  }

  @override
  Future<void> setActive(String id, bool isActive) async {
    await _api.patch('/banks/$id/active', body: {'isActive': isActive});
  }

  @override
  Future<void> delete(String id) async {
    await _api.delete('/banks/$id');
  }
}
