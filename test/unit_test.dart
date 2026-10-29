import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:onexbet/core/router/app_router.dart';
import 'package:onexbet/core/utils/formatters.dart';
import 'package:onexbet/core/utils/validators.dart';
import 'package:onexbet/data/models/bank_account.dart';
import 'package:onexbet/data/models/dashboard_summary.dart';
import 'package:onexbet/data/models/messages.dart';
import 'package:onexbet/data/models/transactions.dart';
import 'package:onexbet/data/models/txn_status.dart';
import 'package:onexbet/data/models/user.dart';

void main() {
  group('formatters', () {
    test('format amounts as shown in the app', () {
      expect(formatInr(140474.93), '₹140474.93');
      expect(formatInr(0), '₹0.00');
      expect(formatInrGrouped(500000), '₹500,000');
      expect(formatUsdt(1000), '1,000.00 USDT');
      expect(formatPercent(5.5), '5.50%');
    });

    test('format dates, account numbers and names', () {
      expect(formatDateTime(DateTime(2026, 10, 14, 16, 22)), '14 Oct 2026, 16:22');
      expect(maskAccountNumber('30112233967'), '***3967');
      expect(initialsOf('sam tester'), 'S');
      expect(greetingFor(DateTime(2026, 1, 1, 14)), 'Good afternoon');
    });
  });

  group('validators', () {
    test('mobile', () {
      expect(Validators.mobile('9876543210'), isNull);
      expect(Validators.mobile(''), isNotNull);
      expect(Validators.mobile('12345'), isNotNull);
      expect(Validators.mobile('1234567890'), isNotNull);
    });

    test('password and confirmation', () {
      expect(Validators.password('secret1'), isNull);
      expect(Validators.password('abc'), isNotNull);
      expect(Validators.confirmPassword('abc', 'abc'), isNull);
      expect(Validators.confirmPassword('abc', 'abd'), isNotNull);
    });

    test('bank fields', () {
      expect(Validators.ifsc('SBIN0001234'), isNull);
      expect(Validators.ifsc('SBIN1234'), isNotNull);
      expect(Validators.upi('name@okaxis'), isNull);
      expect(Validators.upi('name'), isNotNull);
      expect(Validators.accountNumber('123456789'), isNull);
      expect(Validators.accountNumber('12345'), isNotNull);
      expect(Validators.positiveAmount('100'), isNull);
      expect(Validators.positiveAmount('-5'), isNotNull);
    });
  });

  group('authRedirect', () {
    Uri uri(String s) => Uri.parse(s);

    test('sends to splash while the session loads, keeping the target', () {
      final target = authRedirect(const AsyncLoading(), uri('/payin'));
      expect(target, '/splash?from=%2Fpayin');
    });

    test('stays on the splash until its animation has finished', () {
      const user = AsyncData<Object?>('user');
      expect(
        authRedirect(user, uri('/splash?from=%2Fpayin'), splashComplete: false),
        isNull,
      );
      expect(
        authRedirect(const AsyncData(null), uri('/splash'), splashComplete: false),
        isNull,
      );
    });

    test('logged out users go to login, auth routes stay', () {
      expect(authRedirect(const AsyncData(null), uri('/home')), '/login');
      expect(authRedirect(const AsyncData(null), uri('/login')), isNull);
      expect(
        authRedirect(const AsyncData(null), uri('/forgot-password')),
        isNull,
      );
      // There is no sign-up any more: an admin creates the account.
      expect(authRedirect(const AsyncData(null), uri('/signup')), '/login');
    });

    test('logged in users leave auth routes and splash', () {
      const user = AsyncData<Object?>('user');
      expect(authRedirect(user, uri('/login')), '/home');
      expect(authRedirect(user, uri('/splash?from=%2Fpayin')), '/payin');
      expect(authRedirect(user, uri('/splash?from=%2Flogin')), '/home');
      expect(authRedirect(user, uri('/accounts')), isNull);
    });
  });

  group('TxnStatus', () {
    test('maps the API codes onto the chip labels', () {
      expect(TxnStatus.fromCode('COMPLETED'), TxnStatus.completed);
      expect(TxnStatus.fromCode('PAYMENT_RECEIVED'), TxnStatus.paymentReceived);
      expect(TxnStatus.fromCode('PENDING'), TxnStatus.pending);
      expect(TxnStatus.fromCode('FAILED'), TxnStatus.failed);
      expect(TxnStatus.paymentReceived.label, 'Payment Received');
    });

    test('an unknown or missing status falls back to pending', () {
      expect(TxnStatus.fromCode('SOMETHING_NEW'), TxnStatus.pending);
      expect(TxnStatus.fromCode(null), TxnStatus.pending);
    });
  });

  group('parsing API responses', () {
    test('a payin keeps the figures the server calculated', () {
      final payin = PayinRecord.fromJson({
        'id': 'APE0Q8VYQV7L',
        'createdAt': '2026-10-16T08:19:00.000Z',
        'previousBalance': 135277.43,
        'amount': 5500,
        'commissionRate': 5.5,
        'commission': 302.5,
        'afterBalance': 140474.93,
        'txnRef': '628981974812',
        'status': 'COMPLETED',
      });

      expect(payin.id, 'APE0Q8VYQV7L');
      expect(payin.commission, 302.5);
      expect(payin.afterBalance, 140474.93);
      expect(payin.status, TxnStatus.completed);
      expect(payin.createdAt.isUtc, isFalse, reason: 'shown in local time');
    });

    test('a bank reads the limit key the API sends', () {
      final bank = BankAccount.fromJson({
        'id': 'b1',
        'bankName': 'State Bank of India',
        'accountHolder': 'Sam Tester',
        'accountNumber': '30112233967',
        'ifsc': 'SBIN0001234',
        'upiId': 'demo.sbi@oksbi',
        'limit': 40000,
        'dailyLimit': 40000,
        'amountLimit': 40000.0,
        'txnLimit': 40000,
        'isActive': true,
      });

      expect(bank.limit, 40000);
      expect(bank.amountLimit, 40000.0);
      expect(bank.isActive, isTrue);
      // What goes back on save.
      expect(bank.toJson()['limit'], 40000);
      expect(bank.toJson().containsKey('id'), isFalse);
    });

    test('a deposit takes its after-balance from the server', () {
      final deposit = DepositRecord.fromJson({
        'id': 'TXNUGAIDXBWU3',
        'createdAt': '2026-10-14T10:52:00.000Z',
        'previousBalance': 6115.93,
        'amount': 205600,
        'afterBalance': 211715.93,
        'status': 'PENDING',
        'utr': '428716503921',
      });

      expect(deposit.afterBalance, 211715.93);
      expect(deposit.status, TxnStatus.pending);
    });

    test('a chat message reads fromUser, or fromAgent as a fallback', () {
      final mine = ChatMessage.fromJson({
        'id': 'm1',
        'text': 'hello',
        'fromUser': true,
        'createdAt': '2026-10-16T03:30:00.000Z',
      });
      final theirs = ChatMessage.fromJson({
        'id': 'm2',
        'text': 'hi there',
        'fromAgent': false,
        'createdAt': '2026-10-16T03:31:00.000Z',
      });

      expect(mine.fromUser, isTrue);
      expect(theirs.fromUser, isFalse);
    });

    test('the dashboard summary maps every tile', () {
      final summary = DashboardSummary.fromJson({
        'totalBalance': 724452.5,
        'successRate': 100,
        'securityDepositUsdt': 1000,
        'payinCommission': 5252.5,
        'payoutCommission': 4100,
        'totalPayin': 95500,
        'totalDeposit': 605600,
        'payoutsCredited': 205000,
      });

      expect(summary.totalBalance, 724452.5);
      expect(summary.successRate, 100);
      expect(summary.payoutsCredited, 205000);
    });

    test('an earnings row keeps the masked volume the table shows', () {
      final week = EarningWeek.fromJson({
        'week': 1,
        'maskedTransactions': '98******23',
        'netEarnings': 500000,
        'transactions': 12,
      });

      expect(week.maskedTransactions, '98******23');
      expect(week.transactions, 12);
    });

    test('a user tolerates a response without a status', () {
      final user = User.fromJson({
        'id': 'agent-1',
        'name': 'Sam Tester',
        'mobile': '9876543210',
        'email': 'sam@example.com',
      });

      expect(user.firstName, 'Sam');
      expect(user.isActive, isTrue);
    });

    test('an integer-valued amount still parses as a double', () {
      final payout = PayoutPayment.fromJson({
        'id': 'LBS0JCLO28RO',
        'createdAt': '2026-10-16T05:41:00.000Z',
        'amount': 65000,
        'commission': 1300,
        'status': 'PAYMENT_RECEIVED',
      });

      expect(payout.amount, 65000.0);
      expect(payout.commission, 1300.0);
    });
  });
}
