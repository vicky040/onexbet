@Tags(['integration'])
library;

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:onexbet/data/api/api_client.dart';
import 'package:onexbet/data/api/api_exception.dart';
import 'package:onexbet/data/api/http_auth_repository.dart';
import 'package:onexbet/data/api/http_bank_repository.dart';
import 'package:onexbet/data/api/http_inbox_repository.dart';
import 'package:onexbet/data/api/http_wallet_repository.dart';
import 'package:onexbet/data/api/token_store.dart';
import 'package:onexbet/data/models/bank_account.dart';
import 'package:onexbet/data/models/txn_status.dart';
import 'package:onexbet/data/models/user.dart';
import 'package:onexbet/data/repositories/auth_repository.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Drives the real repositories against the backend in `admin/`, so the
/// wiring is proven end to end rather than against a stub.
///
/// Start the server first, then:
///
/// ```sh
/// cd admin && npm run dev
/// flutter test test/api_integration_test.dart
/// API_BASE_URL=http://localhost:3001/api/v1 flutter test test/api_integration_test.dart
/// ```
///
/// Every test is skipped when the server is not answering, so a normal
/// `flutter test` run stays green offline.
Future<void> main() async {
  final baseUrl = Platform.environment['API_BASE_URL'] ??
      'http://localhost:3000/api/v1';

  final skip = await _unreachableReason(baseUrl);

  group('live API', () {
    late ApiClient api;
    late TokenStore tokens;
    late HttpAuthRepository auth;
    late HttpWalletRepository wallet;
    late HttpBankRepository banks;
    late HttpInboxRepository inbox;

    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      tokens = TokenStore();
      api = ApiClient(baseUrl: baseUrl, tokens: tokens);
      auth = HttpAuthRepository(api, tokens);
      wallet = HttpWalletRepository(api);
      banks = HttpBankRepository(api);
      inbox = HttpInboxRepository(api);
    });

    tearDown(() => api.close());

    Future<User> signIn() =>
        auth.login(mobile: '9876543210', password: 'secret1');

    test('no stored session means nobody is signed in', () async {
      expect(await auth.currentUser(), isNull);
    });

    test('a wrong password is reported, not swallowed', () async {
      await expectLater(
        auth.login(mobile: '9876543210', password: 'definitely-wrong'),
        throwsA(
          isA<AuthException>().having(
            (e) => e.message,
            'message',
            'Incorrect mobile number or password',
          ),
        ),
      );
      expect(await tokens.hasSession(), isFalse);
    });

    test('logging in stores a session and restores it', () async {
      final user = await signIn();

      expect(user.mobile, '9876543210');
      expect(user.name, isNotEmpty);
      expect(user.isActive, isTrue);
      expect(await tokens.accessToken(), isNotNull);
      expect(await tokens.refreshToken(), isNotNull);

      // What the app does on a cold start.
      final restored = await auth.currentUser();
      expect(restored?.mobile, '9876543210');
    });

    test('a protected call without a session is refused', () async {
      await expectLater(
        wallet.summary(),
        throwsA(isA<ApiException>().having((e) => e.isUnauthorized, '401', true)),
      );
    });

    test('the dashboard summary parses into real figures', () async {
      await signIn();
      final summary = await wallet.summary();

      expect(summary.totalBalance, greaterThan(0));
      expect(summary.securityDepositUsdt, greaterThanOrEqualTo(0));
      expect(summary.successRate, inInclusiveRange(0, 100));
      expect(summary.payinCommission, greaterThan(0));
    });

    test('payins carry the commission the ledger calculated', () async {
      await signIn();
      final payins = await wallet.payins();

      expect(payins, isNotEmpty);
      final payin = payins.first;
      expect(payin.id, startsWith('AP'));
      expect(payin.txnRef, isNotEmpty);
      expect(payin.status, TxnStatus.completed);
      // commission == amount * rate / 100, to the paisa.
      expect(
        payin.commission,
        closeTo(payin.amount * payin.commissionRate / 100, 0.01),
      );
      // The balance chain the server reports is self-consistent.
      expect(
        payin.afterBalance,
        closeTo(payin.previousBalance - payin.amount + payin.commission, 0.01),
      );
    });

    test('earnings come back newest first', () async {
      await signIn();
      final weeks = await wallet.earnings();

      expect(weeks, hasLength(8));
      expect(weeks.first.week, 1);
      expect(weeks.last.week, 8);
      expect(weeks.first.maskedTransactions, isNotEmpty);
    });

    test('payouts split into open and settled', () async {
      await signIn();

      final open = await wallet.openPayouts();
      for (final payout in open) {
        expect(payout.id, startsWith('LB'));
        expect(payout.upiId, contains('@'));
      }

      final payments = await wallet.payoutPayments();
      expect(payments, isNotEmpty);
      expect(
        payments.map((p) => p.status),
        everyElement(isNot(isNull)),
      );
    });

    test('the deposit config describes both currencies', () async {
      await signIn();
      final config = await wallet.depositConfig();

      expect(config.usdtInrRate, greaterThan(0));

      final inr = config.byCode('INR');
      final usdt = config.byCode('USDT');
      expect(inr, isNotNull);
      expect(usdt, isNotNull);

      // The two minimums are worth the same.
      expect(
        inr!.minimum,
        closeTo(usdt!.minimum * config.usdtInrRate, 0.01),
      );
      expect(usdt.address, isNotEmpty);
      expect(usdt.network, isNotEmpty);
      expect(usdt.isUsdt, isTrue);
      expect(inr.isUsdt, isFalse);
    });

    test('deposits list, and a new one comes back pending', () async {
      await signIn();

      final before = await wallet.deposits();
      expect(before, isNotEmpty);

      final config = await wallet.depositConfig();
      final amount = config.byCode('INR')!.minimum;
      final utr = 'DART${DateTime.now().millisecondsSinceEpoch}';
      final created = await wallet.createDeposit(amount: amount, utr: utr);

      expect(created.id, startsWith('TXN'));
      expect(created.amount, amount);
      expect(created.currency, 'INR');
      expect(created.status, TxnStatus.pending);
      expect(created.utr, utr);
      expect(
        created.afterBalance,
        closeTo(created.previousBalance + created.amount, 0.01),
      );

      final after = await wallet.deposits();
      expect(after.length, before.length + 1);
    });

    test('a USDT deposit is converted to rupees by the server', () async {
      await signIn();
      final config = await wallet.depositConfig();
      final usdt = config.byCode('USDT')!;

      final created = await wallet.createDeposit(
        amount: usdt.minimum,
        utr: 'DARTUSDT${DateTime.now().millisecondsSinceEpoch}',
        currency: 'USDT',
      );

      expect(created.currency, 'USDT');
      expect(created.isUsdt, isTrue);
      expect(created.amountUsdt, usdt.minimum);
      expect(created.usdtRate, config.usdtInrRate);
      // The rupee figure is the server's, not ours.
      expect(
        created.amount,
        closeTo(usdt.minimum * config.usdtInrRate, 0.01),
      );
    });

    test('a deposit under the minimum is refused with the reason', () async {
      await signIn();

      await expectLater(
        wallet.createDeposit(
          amount: 1,
          utr: 'DARTLOW${DateTime.now().millisecondsSinceEpoch}',
        ),
        throwsA(
          isA<ApiException>().having(
            (e) => e.message,
            'message',
            contains('Minimum deposit'),
          ),
        ),
      );
    });

    test('a USDT deposit under the minimum is refused in USDT', () async {
      await signIn();
      final usdt = (await wallet.depositConfig()).byCode('USDT')!;

      await expectLater(
        wallet.createDeposit(
          amount: usdt.minimum - 1,
          utr: 'DARTUSDTLOW${DateTime.now().millisecondsSinceEpoch}',
          currency: 'USDT',
        ),
        throwsA(
          isA<ApiException>().having(
            (e) => e.message,
            'message',
            contains('USDT'),
          ),
        ),
      );
    });

    test('bank accounts round-trip: create, toggle, update, delete', () async {
      await signIn();

      final before = await banks.banks();
      expect(before, isNotEmpty);
      expect(before.first.limit, greaterThan(0), reason: 'the `limit` key');

      final suffix = '${DateTime.now().millisecondsSinceEpoch % 1000000000}';
      final created = await banks.save(
        BankAccount(
          id: '',
          bankName: 'Dart Test Bank',
          accountHolder: 'Sam Tester',
          accountNumber: '9$suffix',
          ifsc: 'KKBK0000123',
          upiId: 'dart.test@okhdfcbank',
          limit: 55000,
          amountLimit: 55000,
          txnLimit: 55000,
        ),
      );

      expect(created.id, isNotEmpty);
      expect(created.limit, 55000);
      expect(created.isActive, isFalse);

      await banks.setActive(created.id, true);
      var reloaded = (await banks.banks()).firstWhere(
        (b) => b.id == created.id,
      );
      expect(reloaded.isActive, isTrue);

      await banks.save(created.copyWith(bankName: 'Dart Test Bank (edited)'));
      reloaded = (await banks.banks()).firstWhere((b) => b.id == created.id);
      expect(reloaded.bankName, 'Dart Test Bank (edited)');

      await banks.delete(created.id);
      expect(
        (await banks.banks()).where((b) => b.id == created.id),
        isEmpty,
      );
    });

    test('an invalid IFSC is rejected by the server too', () async {
      await signIn();

      await expectLater(
        banks.save(
          const BankAccount(
            id: '',
            bankName: 'Bad Bank',
            accountHolder: 'Sam Tester',
            accountNumber: '123456789012',
            ifsc: 'NOPE',
            upiId: 'bad@bank',
            limit: 1,
            amountLimit: 1,
            txnLimit: 1,
          ),
        ),
        throwsA(
          isA<ApiException>()
              .having((e) => e.code, 'code', 'validation_failed')
              .having((e) => e.details, 'details', isNotEmpty),
        ),
      );
    });

    test('notifications read and mark as read', () async {
      await signIn();

      final notifications = await inbox.notifications();
      expect(notifications, isNotEmpty);
      expect(notifications.first.title, isNotEmpty);

      await inbox.markAllRead();
      expect(
        (await inbox.notifications()).every((n) => n.read),
        isTrue,
      );
    });

    test('the support thread accepts a message and returns the whole chat',
        () async {
      await signIn();

      final before = await inbox.supportMessages();
      expect(before, isNotEmpty);
      expect(before.first.fromUser, isFalse, reason: 'opens with the welcome');

      final after = await inbox.sendSupportMessage('Sent from a Dart test');
      expect(after.length, greaterThan(before.length));
      expect(after.last.text, 'Sent from a Dart test');
      expect(after.last.fromUser, isTrue);
    });

    test('an expired access token is refreshed transparently', () async {
      await signIn();
      final refresh = await tokens.refreshToken();

      // Corrupt the access token but keep the refresh token: the client
      // should recover without the caller noticing.
      await tokens.save(accessToken: 'not-a-valid-token', refreshToken: refresh!);

      final summary = await wallet.summary();
      expect(summary.totalBalance, greaterThan(0));
      expect(await tokens.accessToken(), isNot('not-a-valid-token'));
    });

    test('a dead session signs the agent out', () async {
      await signIn();
      var expired = 0;
      api.onSessionExpired = () => expired++;

      await tokens.save(
        accessToken: 'not-a-valid-token',
        refreshToken: 'not-a-valid-refresh-token',
      );

      await expectLater(wallet.summary(), throwsA(isA<ApiException>()));
      expect(expired, 1);
      expect(await tokens.hasSession(), isFalse);
      expect(await auth.currentUser(), isNull);
    });

    test('changing the password keeps this device signed in', () async {
      await signIn();

      await auth.changePassword(
        currentPassword: 'secret1',
        newPassword: 'temporary9',
      );

      // This device keeps working on the session it was handed back. (The
      // access token itself may be byte-identical when it is re-issued in
      // the same second — the JWT `iat` claim is only second-resolution.)
      expect(await tokens.accessToken(), isNotNull);
      expect((await wallet.summary()).totalBalance, greaterThan(0));

      // The new password is live and the old one is dead.
      await expectLater(
        auth.login(mobile: '9876543210', password: 'secret1'),
        throwsA(isA<AuthException>()),
      );
      expect(
        (await auth.login(mobile: '9876543210', password: 'temporary9')).mobile,
        '9876543210',
      );

      // Reusing a password is refused…
      await expectLater(
        auth.changePassword(
          currentPassword: 'temporary9',
          newPassword: 'temporary9',
        ),
        throwsA(
          isA<AuthException>().having(
            (e) => e.message,
            'message',
            'Choose a password you have not used before',
          ),
        ),
      );

      // …and the seed password goes back, so the next run can sign in.
      await auth.changePassword(
        currentPassword: 'temporary9',
        newPassword: 'secret1',
      );
      expect((await signIn()).mobile, '9876543210');
    });

    test('a wrong current password is rejected', () async {
      await signIn();

      await expectLater(
        auth.changePassword(
          currentPassword: 'not-the-password',
          newPassword: 'whatever1',
        ),
        throwsA(
          isA<AuthException>().having(
            (e) => e.message,
            'message',
            'Current password is incorrect',
          ),
        ),
      );
    });

    test('the password reset flow issues and checks a code', () async {
      final challenge = await auth.requestPasswordReset(mobile: '9876543210');

      expect(challenge.resetToken, isNotEmpty);
      expect(challenge.expiresInMinutes, greaterThan(0));
      expect(
        challenge.devOtp,
        isNotNull,
        reason: 'the dev server hands the code back; see admin/lib/sms.ts',
      );

      await expectLater(
        auth.confirmPasswordReset(
          resetToken: challenge.resetToken,
          otp: '000000',
          newPassword: 'brandnew1',
        ),
        throwsA(isA<AuthException>()),
      );

      // The real code works, and we set the password back to what it was.
      await auth.confirmPasswordReset(
        resetToken: challenge.resetToken,
        otp: challenge.devOtp!,
        newPassword: 'secret1',
      );
      expect((await signIn()).mobile, '9876543210');
    });

    test('an unknown mobile looks exactly like a known one', () async {
      final unknown = await auth.requestPasswordReset(mobile: '9000000001');
      expect(unknown.resetToken, isNotEmpty);
      expect(unknown.devOtp, isNull, reason: 'no code is sent to nobody');
    });

    test('logging out clears the stored session', () async {
      await signIn();
      expect(await tokens.hasSession(), isTrue);

      await auth.logout();

      expect(await tokens.hasSession(), isFalse);
      expect(await auth.currentUser(), isNull);
    });
  }, skip: skip);
}

/// Returns null when the backend answers, or the reason to skip.
Future<String?> _unreachableReason(String baseUrl) async {
  try {
    final response = await http
        .get(Uri.parse('$baseUrl/health'))
        .timeout(const Duration(seconds: 3));
    if (response.statusCode == 200) return null;
    return 'The backend at $baseUrl answered ${response.statusCode}.';
  } catch (_) {
    return 'No backend at $baseUrl — start it with `cd admin && npm run dev`.';
  }
}
