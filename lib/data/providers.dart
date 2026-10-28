import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/config/app_config.dart';
import 'api/api_client.dart';
import 'api/http_auth_repository.dart';
import 'api/http_bank_repository.dart';
import 'api/http_inbox_repository.dart';
import 'api/http_wallet_repository.dart';
import 'api/token_store.dart';
import 'models/bank_account.dart';
import 'models/dashboard_summary.dart';
import 'models/deposit_config.dart';
import 'models/messages.dart';
import 'models/transactions.dart';
import 'repositories/auth_repository.dart';
import 'repositories/bank_repository.dart';
import 'repositories/inbox_repository.dart';
import 'repositories/wallet_repository.dart';

// ---------------------------------------------------------------------------
// Backend. Everything below reads live data from the API in `admin/`; set
// its address with --dart-define=API_BASE_URL=... (see AppConfig).
//
// Tests override the four repository providers with fakes.
// ---------------------------------------------------------------------------

/// The agent's access and refresh tokens, persisted across launches.
final tokenStoreProvider = Provider<TokenStore>((ref) => TokenStore());

final apiClientProvider = Provider<ApiClient>((ref) {
  final client = ApiClient(
    baseUrl: AppConfig.apiBaseUrl,
    tokens: ref.watch(tokenStoreProvider),
  );
  ref.onDispose(client.close);
  return client;
});

final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => HttpAuthRepository(
    ref.watch(apiClientProvider),
    ref.watch(tokenStoreProvider),
  ),
);

final walletRepositoryProvider = Provider<WalletRepository>(
  (ref) => HttpWalletRepository(ref.watch(apiClientProvider)),
);

final bankRepositoryProvider = Provider<BankRepository>(
  (ref) => HttpBankRepository(ref.watch(apiClientProvider)),
);

final inboxRepositoryProvider = Provider<InboxRepository>(
  (ref) => HttpInboxRepository(ref.watch(apiClientProvider)),
);

// ---------------------------------------------------------------------------
// Read-only data
// ---------------------------------------------------------------------------

final summaryProvider = FutureProvider<DashboardSummary>(
  (ref) => ref.watch(walletRepositoryProvider).summary(),
);

final earningsProvider = FutureProvider<List<EarningWeek>>(
  (ref) => ref.watch(walletRepositoryProvider).earnings(),
);

/// Currencies, minimums and the USDT address, as the server describes them.
final depositConfigProvider = FutureProvider<DepositConfig>(
  (ref) => ref.watch(walletRepositoryProvider).depositConfig(),
);

final payinsProvider = FutureProvider<List<PayinRecord>>(
  (ref) => ref.watch(walletRepositoryProvider).payins(),
);

final openPayoutsProvider = FutureProvider<List<OpenPayout>>(
  (ref) => ref.watch(walletRepositoryProvider).openPayouts(),
);

final payoutPaymentsProvider = FutureProvider<List<PayoutPayment>>(
  (ref) => ref.watch(walletRepositoryProvider).payoutPayments(),
);

// ---------------------------------------------------------------------------
// Mutable data
// ---------------------------------------------------------------------------

class BanksController extends AsyncNotifier<List<BankAccount>> {
  BankRepository get _repo => ref.read(bankRepositoryProvider);

  @override
  Future<List<BankAccount>> build() => ref.watch(bankRepositoryProvider).banks();

  Future<void> setActive(String id, bool isActive) async {
    final current = state.value ?? const [];
    state = AsyncData([
      for (final b in current) b.id == id ? b.copyWith(isActive: isActive) : b,
    ]);
    try {
      await _repo.setActive(id, isActive);
    } catch (_) {
      state = AsyncData(current);
      rethrow;
    }
  }

  Future<void> save(BankAccount bank) async {
    await _repo.save(bank);
    state = AsyncData(await _repo.banks());
  }

  Future<void> delete(String id) async {
    await _repo.delete(id);
    state = AsyncData(await _repo.banks());
  }
}

final banksProvider =
    AsyncNotifierProvider<BanksController, List<BankAccount>>(BanksController.new);

class DepositsController extends AsyncNotifier<List<DepositRecord>> {
  @override
  Future<List<DepositRecord>> build() =>
      ref.watch(walletRepositoryProvider).deposits();

  Future<DepositRecord> create({
    required double amount,
    required String utr,
    String currency = 'INR',
  }) async {
    final record = await ref
        .read(walletRepositoryProvider)
        .createDeposit(amount: amount, utr: utr, currency: currency);
    state = AsyncData([record, ...?state.value]);
    return record;
  }
}

final depositsProvider =
    AsyncNotifierProvider<DepositsController, List<DepositRecord>>(
  DepositsController.new,
);

class NotificationsController extends AsyncNotifier<List<AppNotification>> {
  InboxRepository get _repo => ref.read(inboxRepositoryProvider);

  @override
  Future<List<AppNotification>> build() =>
      ref.watch(inboxRepositoryProvider).notifications();

  Future<void> markRead(String id) async {
    await _repo.markRead(id);
    state = AsyncData([
      for (final n in state.value ?? const <AppNotification>[])
        n.id == id ? n.copyWith(read: true) : n,
    ]);
  }

  Future<void> markAllRead() async {
    await _repo.markAllRead();
    state = AsyncData([
      for (final n in state.value ?? const <AppNotification>[])
        n.copyWith(read: true),
    ]);
  }
}

final notificationsProvider =
    AsyncNotifierProvider<NotificationsController, List<AppNotification>>(
  NotificationsController.new,
);

final unreadNotificationsProvider = Provider<int>((ref) {
  final list = ref.watch(notificationsProvider).value ?? const [];
  return list.where((n) => !n.read).length;
});

class SupportChatController extends AsyncNotifier<List<ChatMessage>> {
  @override
  Future<List<ChatMessage>> build() =>
      ref.watch(inboxRepositoryProvider).supportMessages();

  /// Re-reads the conversation without flashing the loading state, so the
  /// chat can poll for support's replies while the agent is looking at it.
  /// A failure is swallowed: a dropped poll must not replace a readable
  /// conversation with an error screen.
  Future<void> refresh() async {
    try {
      state = AsyncData(
        await ref.read(inboxRepositoryProvider).supportMessages(),
      );
    } catch (_) {
      // Keep whatever is on screen.
    }
  }

  Future<void> send(String text) async {
    final pending = ChatMessage(
      id: 'pending',
      text: text,
      fromUser: true,
      createdAt: DateTime.now(),
    );
    state = AsyncData([...?state.value, pending]);
    state = AsyncData(
      await ref.read(inboxRepositoryProvider).sendSupportMessage(text),
    );
  }
}

final supportChatProvider =
    AsyncNotifierProvider<SupportChatController, List<ChatMessage>>(
  SupportChatController.new,
);

/// Whether the Home balance is visible (eye toggle).
class BalanceVisibility extends Notifier<bool> {
  @override
  bool build() => true;

  void toggle() => state = !state;
}

final balanceVisibleProvider =
    NotifierProvider<BalanceVisibility, bool>(BalanceVisibility.new);
