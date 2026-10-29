import 'package:onexbet/data/models/app_content.dart';
import 'package:onexbet/data/models/bank_account.dart';
import 'package:onexbet/data/models/dashboard_summary.dart';
import 'package:onexbet/data/models/deposit_config.dart';
import 'package:onexbet/data/models/messages.dart';
import 'package:onexbet/data/models/transactions.dart';
import 'package:onexbet/data/models/txn_status.dart';
import 'package:onexbet/data/models/user.dart';
import 'package:onexbet/data/repositories/auth_repository.dart';
import 'package:onexbet/data/repositories/bank_repository.dart';
import 'package:onexbet/data/repositories/content_repository.dart';
import 'package:onexbet/data/repositories/inbox_repository.dart';
import 'package:onexbet/data/repositories/wallet_repository.dart';

/// In-memory repositories for the widget tests.
///
/// The app itself has no fake data — it reads everything from the API. These
/// stand in for the server so the tests stay fast and offline.

const testMobile = '9876543210';
const testPassword = 'secret1';

const testUser = User(
  id: 'agent-1',
  name: 'Sam Tester',
  mobile: testMobile,
  email: 'sam@example.com',
);

class FakeAuthRepository implements AuthRepository {
  FakeAuthRepository({User? signedInAs}) : _current = signedInAs;

  User? _current;
  PasswordResetChallenge? lastChallenge;

  @override
  Future<User?> currentUser() async => _current;

  @override
  Future<User> login({
    required String mobile,
    required String password,
  }) async {
    if (mobile != testMobile || password != testPassword) {
      throw const AuthException('Incorrect mobile number or password');
    }
    return _current = testUser;
  }

  @override
  Future<PasswordResetChallenge> requestPasswordReset({
    required String mobile,
  }) async {
    return lastChallenge = const PasswordResetChallenge(
      resetToken: 'reset-token',
      expiresInMinutes: 10,
      devOtp: '123456',
    );
  }

  @override
  Future<void> confirmPasswordReset({
    required String resetToken,
    required String otp,
    required String newPassword,
  }) async {
    if (otp != '123456') {
      throw const AuthException('Incorrect code. 4 attempt(s) left.');
    }
    _current = null;
  }

  @override
  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    if (currentPassword != testPassword) {
      throw const AuthException('Current password is incorrect');
    }
  }

  @override
  Future<void> logout() async => _current = null;
}

class FakeWalletRepository implements WalletRepository {
  FakeWalletRepository({this.openPayoutList = const [], this.balance = 140474.93});

  final List<OpenPayout> openPayoutList;

  /// Drives the welcome dialog, which only appears below the joining minimum.
  final double balance;

  /// What the last createDeposit call was told to use.
  String? lastDepositCurrency;

  @override
  Future<DashboardSummary> summary() async => DashboardSummary(
        totalBalance: balance,
        successRate: 24,
        securityDepositUsdt: 1000,
        payinCommission: 403922.93,
        payoutCommission: 60304,
        totalPayin: 7344052,
        totalDeposit: 4005100,
        payoutsCredited: 0,
      );

  @override
  Future<List<EarningWeek>> earnings() async => const [
        EarningWeek(
          week: 1,
          maskedTransactions: '98******23',
          netEarnings: 500000,
          transactions: 12,
        ),
        EarningWeek(
          week: 2,
          maskedTransactions: '87******22',
          netEarnings: 400000,
          transactions: 9,
        ),
      ];

  @override
  Future<List<PayinRecord>> payins() async => [
        PayinRecord(
          id: 'APE0Q8VYQV7L',
          createdAt: DateTime(2026, 10, 16, 13, 49),
          previousBalance: 135277.43,
          amount: 5500,
          commissionRate: 5.5,
          commission: 302.50,
          afterBalance: 140474.93,
          txnRef: '628981974812',
        ),
      ];

  @override
  Future<List<OpenPayout>> openPayouts() async => openPayoutList;

  @override
  Future<List<PayoutPayment>> payoutPayments() async => [
        PayoutPayment(
          id: 'LBS0JCLO28RO',
          createdAt: DateTime(2026, 10, 16, 11, 11),
          amount: 65000,
          commission: 1300,
          status: TxnStatus.paymentReceived,
        ),
      ];

  @override
  Future<List<DepositRecord>> deposits() async => [
        DepositRecord(
          id: 'TXNUGAIDXBWU3',
          createdAt: DateTime(2026, 10, 14, 16, 22),
          previousBalance: 6115.93,
          amount: 205600,
          afterBalance: 211715.93,
          status: TxnStatus.completed,
          utr: '428716503921',
        ),
      ];

  /// Mirrors the server: 3000 USDT, and the same worth in rupees.
  static const usdtRate = 90.0;

  /// Flipped by tests that need the rupee option back.
  bool bankTransferEnabled = false;

  /// Flipped by tests covering an agent who has not bought a plan yet.
  bool hasJoined = true;

  String? lastDepositPlan;

  @override
  Future<DepositConfig> depositConfig() async => DepositConfig(
        usdtInrRate: usdtRate,
        hasJoined: hasJoined,
        bankTransferEnabled: bankTransferEnabled,
        referralCode: hasJoined ? 'MASTER01' : null,
        plans: hasJoined
            ? const []
            : const [
                JoiningPlan(
                  code: 'AGENT',
                  label: 'Agent',
                  description: 'Start taking payins and payouts.',
                  priceUsdt: 3000,
                  priceInr: 3000 * usdtRate,
                  securityUsdt: 1000,
                ),
                JoiningPlan(
                  code: 'MASTER',
                  label: 'Master',
                  description: 'Everything an agent has, plus your own panel.',
                  priceUsdt: 5000,
                  priceInr: 5000 * usdtRate,
                  securityUsdt: 5000,
                ),
              ],
        currencies: [
          if (bankTransferEnabled)
            const DepositCurrencyOption(
              code: 'INR',
              label: 'Bank transfer',
              symbol: '₹',
              minimum: 3000 * usdtRate,
              referenceLabel: 'UTR / Reference number',
            ),
          const DepositCurrencyOption(
            code: 'USDT',
            label: 'USDT',
            symbol: 'USDT',
            minimum: 3000,
            referenceLabel: 'Transaction hash',
            address: 'TBbwzuMH3nHdYMqft3vNtnvjRtGDVb7LVE',
            network: 'TRC20 (Tron)',
          ),
        ],
      );

  @override
  Future<DepositRecord> createDeposit({
    required double amount,
    required String utr,
    String currency = 'INR',
    String? plan,
  }) async {
    lastDepositCurrency = currency;
    lastDepositPlan = plan;
    final inr = currency == 'USDT' ? amount * usdtRate : amount;
    return DepositRecord(
      id: 'TXNNEW000001',
      createdAt: DateTime.now(),
      previousBalance: 140474.93,
      amount: inr,
      afterBalance: 140474.93 + inr,
      status: TxnStatus.pending,
      utr: utr,
      currency: currency,
      amountUsdt: currency == 'USDT' ? amount : null,
      usdtRate: currency == 'USDT' ? usdtRate : null,
    );
  }
}

class FakeBankRepository implements BankRepository {
  FakeBankRepository() {
    _banks = [
      const BankAccount(
        id: 'b1',
        bankName: 'State Bank of India',
        accountHolder: 'Sam Tester',
        accountNumber: '30112233967',
        ifsc: 'SBIN0001234',
        upiId: 'demo.sbi@oksbi',
        limit: 40000,
        amountLimit: 40000,
        txnLimit: 40000,
      ),
      const BankAccount(
        id: 'b2',
        bankName: 'Union Bank',
        accountHolder: 'Sam Tester',
        accountNumber: '520101000857',
        ifsc: 'UBIN0530101',
        upiId: 'demo.union@ybl',
        limit: 500000,
        amountLimit: 100000,
        txnLimit: 500000,
      ),
    ];
  }

  late List<BankAccount> _banks;

  @override
  Future<List<BankAccount>> banks() async => List.unmodifiable(_banks);

  @override
  Future<BankAccount> save(BankAccount bank) async {
    if (bank.id.isEmpty) {
      final created = bank.copyWith(id: 'b${_banks.length + 1}');
      _banks = [..._banks, created];
      return created;
    }
    _banks = [
      for (final b in _banks) b.id == bank.id ? bank : b,
    ];
    return bank;
  }

  @override
  Future<void> setActive(String id, bool isActive) async {
    _banks = [
      for (final b in _banks)
        b.id == id ? b.copyWith(isActive: isActive) : b,
    ];
  }

  @override
  Future<void> delete(String id) async {
    _banks = _banks.where((b) => b.id != id).toList();
  }
}

class FakeInboxRepository implements InboxRepository {
  List<AppNotification> _notifications = [
    AppNotification(
      id: 'n1',
      title: 'Payin received',
      body: '₹5500.00 credited to your wallet.',
      createdAt: DateTime(2026, 10, 16, 13, 49),
    ),
  ];

  List<ChatMessage> _messages = [
    ChatMessage(
      id: 'm1',
      text: 'Hi! Welcome to 1XBET agent support. How can we help you today?',
      fromUser: false,
      createdAt: DateTime(2026, 10, 16, 9, 0),
    ),
  ];

  @override
  Future<List<AppNotification>> notifications() async =>
      List.unmodifiable(_notifications);

  @override
  Future<void> markRead(String id) async {
    _notifications = [
      for (final n in _notifications)
        n.id == id ? n.copyWith(read: true) : n,
    ];
  }

  @override
  Future<void> markAllRead() async {
    _notifications = [
      for (final n in _notifications) n.copyWith(read: true),
    ];
  }

  /// Stands in for an admin replying from the panel while the agent has the
  /// chat open.
  void addSupportReply(String text) {
    _messages = [
      ..._messages,
      ChatMessage(
        id: 'reply${_messages.length + 1}',
        text: text,
        fromUser: false,
        createdAt: DateTime.now(),
      ),
    ];
  }

  @override
  Future<List<ChatMessage>> supportMessages() async =>
      List.unmodifiable(_messages);

  @override
  Future<List<ChatMessage>> sendSupportMessage(String text) async {
    _messages = [
      ..._messages,
      ChatMessage(
        id: 'm${_messages.length + 1}',
        text: text,
        fromUser: true,
        createdAt: DateTime.now(),
      ),
      ChatMessage(
        id: 'm${_messages.length + 2}',
        text: 'Thanks for reaching out! A support agent will reply shortly.',
        fromUser: false,
        createdAt: DateTime.now(),
      ),
    ];
    return List.unmodifiable(_messages);
  }
}

class FakeContentRepository implements ContentRepository {
  FakeContentRepository({
    this.welcomeEnabled = true,
    this.promoEnabled = false,
  });

  final bool welcomeEnabled;
  final bool promoEnabled;

  @override
  Future<AppContent> appContent() async => AppContent(
        welcome: WelcomeNotice(
          enabled: welcomeEnabled,
          title: 'Welcome to 1XBET Agent',
          body: 'Agents collect player deposits and pay out withdrawals.',
          joiningMinimumUsdt: 3000,
          joiningMinimumInr: 3000 * FakeWalletRepository.usdtRate,
        ),
        promo: PromoNotice(
          enabled: promoEnabled,
          headline: 'Bet on every match, live on 1XBET',
          imageUrl: '',
          linkUrl: 'https://example.com/promo',
        ),
      );
}
