import '../models/bank_account.dart';

abstract interface class BankRepository {
  Future<List<BankAccount>> banks();

  /// Creates the bank when [BankAccount.id] is empty, otherwise updates it.
  Future<BankAccount> save(BankAccount bank);

  Future<void> setActive(String id, bool isActive);

  Future<void> delete(String id);
}
