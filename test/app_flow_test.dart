import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:onexbet/features/auth/splash_screen.dart';

import 'fakes.dart';
import 'helpers.dart';

void main() {
  testWidgets('animated splash plays before leaving for login', (tester) async {
    await pumpApp(tester, settle: false);
    await tester.pump(const Duration(milliseconds: 600));

    expect(find.byType(SplashScreen), findsOneWidget);
    expect(find.text('AGENT PANEL'), findsOneWidget);
    expect(find.text('Welcome back'), findsNothing);

    await tester.pumpAndSettle();
    expect(find.byType(SplashScreen), findsNothing);
    expect(find.text('Welcome back'), findsOneWidget);
  });

  testWidgets('logged-out users land on login and see validation errors',
      (tester) async {
    await pumpApp(tester);

    expect(find.text('Welcome back'), findsOneWidget);

    await tester.tap(find.byKey(const Key('loginButton')));
    await tester.pumpAndSettle();

    expect(find.text('Mobile number is required'), findsOneWidget);
    expect(find.text('Password is required'), findsOneWidget);
  });

  testWidgets('a rejected login shows the server message', (tester) async {
    await pumpApp(tester);

    await tester.enterText(find.byKey(const Key('mobileField')), testMobile);
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Password'),
      'wrongpassword',
    );
    await tester.tap(find.byKey(const Key('loginButton')));
    await tester.pumpAndSettle();

    expect(find.text('Incorrect mobile number or password'), findsOneWidget);
    expect(find.text('Welcome back'), findsOneWidget);
  });

  testWidgets('logging in opens Home with the balance', (tester) async {
    await pumpApp(tester);

    await tester.enterText(find.byKey(const Key('mobileField')), testMobile);
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Password'),
      testPassword,
    );
    await tester.tap(find.byKey(const Key('loginButton')));
    await tester.pumpAndSettle();

    expect(find.text('Total balance'), findsOneWidget);
    expect(find.text('₹140474.93'), findsOneWidget);
    expect(find.text('Add deposit'), findsOneWidget);
  });

  testWidgets('bottom navigation switches tabs', (tester) async {
    await pumpApp(tester, loggedIn: true);
    expect(find.text('Total balance'), findsOneWidget);

    await tapTab(tester, 'Payin');
    expect(find.text('Payin History'), findsOneWidget);
    expect(find.text('APE0Q8VYQV7L'), findsOneWidget);

    await tapTab(tester, 'Payout');
    expect(find.text('Recent Payments'), findsOneWidget);
    expect(
      find.text('No open payouts right now. Please check again later.'),
      findsOneWidget,
    );

    await tapTab(tester, 'History');
    expect(find.text('Deposit Records'), findsOneWidget);
    expect(find.text('TXNUGAIDXBWU3'), findsOneWidget);
  });

  testWidgets('payin records show the commission the server sent',
      (tester) async {
    await pumpApp(tester, loggedIn: true);
    await tapTab(tester, 'Payin');

    // 5.5% of ₹5500, as calculated by the backend ledger.
    expect(find.text('₹302.50 (5.50%)'), findsOneWidget);
  });

  testWidgets('toggling a bank updates the active count', (tester) async {
    await pumpApp(tester, loggedIn: true);

    await tapTab(tester, 'Accounts');

    expect(find.byKey(const Key('totalBanks')), findsOneWidget);
    expect(find.text('0 Active'), findsOneWidget);

    await tester.tap(find.byKey(const Key('bankSwitch_b1')));
    await tester.pumpAndSettle();

    expect(find.text('1 Active'), findsOneWidget);
  });

  testWidgets('forgot password asks for the code it texted', (tester) async {
    final auth = FakeAuthRepository();
    await pumpApp(tester, auth: auth);

    await tester.tap(find.text('Forgot password?'));
    await tester.pumpAndSettle();

    expect(find.text('Forgot password'), findsOneWidget);

    await tester.enterText(find.byKey(const Key('mobileField')), testMobile);
    await tester.tap(find.byKey(const Key('resetButton')));
    await tester.pumpAndSettle();

    // Step two: the code field appears and the request was made.
    expect(auth.lastChallenge, isNotNull);
    expect(find.byKey(const Key('otpField')), findsOneWidget);
    expect(find.text('Enter your code'), findsOneWidget);

    await tester.enterText(
      find.widgetWithText(TextFormField, 'New password'),
      'brandnew1',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Confirm new password'),
      'brandnew1',
    );
    await tester.tap(find.byKey(const Key('resetButton')));
    await tester.pumpAndSettle();

    expect(find.text('Password updated. Please log in.'), findsOneWidget);
    expect(find.text('Welcome back'), findsOneWidget);
  });

  testWidgets('support chat shows an admin reply without leaving the screen',
      (tester) async {
    final inbox = FakeInboxRepository();
    await pumpApp(tester, loggedIn: true, inbox: inbox);

    // The help card sits below the fold on a phone.
    final helpCard = find.text('Need help? Chat with our support team');
    await tester.scrollUntilVisible(helpCard, 200);
    await tester.pumpAndSettle();
    await tester.tap(helpCard);
    await tester.pumpAndSettle();

    expect(
      find.text('Hi! Welcome to 1XBET agent support. How can we help you today?'),
      findsOneWidget,
    );
    expect(find.text('Reply sent from the admin panel'), findsNothing);

    // The admin answers. The agent is still sitting on the screen, which is
    // exactly the case that used to show nothing until you navigated away.
    inbox.addSupportReply('Reply sent from the admin panel');

    await tester.pump(const Duration(seconds: 6));
    await tester.pump();

    expect(find.text('Reply sent from the admin panel'), findsOneWidget);
  });

  group('deposit', () {
    /// The USDT panel is tall enough to push the button off-screen.
    Future<void> submitDeposit(WidgetTester tester) async {
      final button = find.text('Submit deposit');
      // scrollUntilVisible cannot be used here: the screen has more than one
      // Scrollable and it refuses to guess.
      await tester.ensureVisible(button);
      await tester.pumpAndSettle();
      await tester.tap(button);
      await tester.pumpAndSettle();
    }

    Future<void> openDeposit(WidgetTester tester) async {
      final addDeposit = find.text('Add deposit');
      await tester.scrollUntilVisible(addDeposit, 200);
      await tester.pumpAndSettle();
      await tester.tap(addDeposit);
      await tester.pumpAndSettle();
    }

    testWidgets('offers both currencies, with INR selected', (tester) async {
      await pumpApp(tester, loggedIn: true);
      await openDeposit(tester);

      expect(find.byKey(const Key('currency_INR')), findsOneWidget);
      expect(find.byKey(const Key('currency_USDT')), findsOneWidget);
      // The rupee minimum is the USDT minimum at the day's rate.
      expect(find.textContaining('Minimum ₹270000.00'), findsOneWidget);
      // No wallet details until USDT is chosen.
      expect(find.textContaining('TBbwzuMH3nHdY'), findsNothing);
    });

    testWidgets('USDT shows the address, network and QR', (tester) async {
      await pumpApp(tester, loggedIn: true);
      await openDeposit(tester);

      await tester.tap(find.byKey(const Key('currency_USDT')));
      await tester.pumpAndSettle();

      expect(find.text('TBbwzuMH3nHdYMqft3vNtnvjRtGDVb7LVE'), findsOneWidget);
      expect(find.text('Network: TRC20 (Tron)'), findsOneWidget);
      expect(find.byType(Image), findsWidgets);
      expect(find.textContaining('Minimum 3000 USDT'), findsOneWidget);
    });

    testWidgets('a USDT amount below the minimum is refused', (tester) async {
      await pumpApp(tester, loggedIn: true);
      await openDeposit(tester);

      await tester.tap(find.byKey(const Key('currency_USDT')));
      await tester.pumpAndSettle();

      await tester.enterText(find.byKey(const Key('depositAmount')), '2999');
      await tester.enterText(
        find.byKey(const Key('depositUtr')),
        'abc123def456',
      );
      await submitDeposit(tester);

      expect(find.text('Minimum deposit is 3000 USDT'), findsOneWidget);
    });

    testWidgets('a USDT deposit is submitted in USDT', (tester) async {
      final wallet = FakeWalletRepository();
      await pumpApp(tester, loggedIn: true, wallet: wallet);
      await openDeposit(tester);

      await tester.tap(find.byKey(const Key('currency_USDT')));
      await tester.pumpAndSettle();

      await tester.enterText(find.byKey(const Key('depositAmount')), '3000');
      await tester.pumpAndSettle();
      // The agent is told what it is worth before submitting.
      expect(find.textContaining('Credits about ₹270000.00'), findsOneWidget);

      await tester.enterText(
        find.byKey(const Key('depositUtr')),
        'abc123def456',
      );
      await submitDeposit(tester);

      expect(wallet.lastDepositCurrency, 'USDT');
    });

    testWidgets('an INR amount below the minimum is refused', (tester) async {
      await pumpApp(tester, loggedIn: true);
      await openDeposit(tester);

      await tester.enterText(find.byKey(const Key('depositAmount')), '5000');
      await tester.enterText(
        find.byKey(const Key('depositUtr')),
        '428716503921',
      );
      await submitDeposit(tester);

      expect(find.textContaining('Minimum deposit is ₹270000.00'), findsOneWidget);
    });
  });

  group('startup notices', () {
    testWidgets('the welcome dialog explains the joining requirement',
        (tester) async {
      await pumpApp(
        tester,
        content: FakeContentRepository(welcomeEnabled: true),
      );

      expect(find.text('Welcome to 1XBET Agent'), findsOneWidget);
      expect(find.text('To become an agent'), findsOneWidget);
      // 3000 USDT at the fake rate of 90.
      expect(
        find.textContaining('3000 USDT (about ₹270000.00) is mandatory'),
        findsOneWidget,
      );
    });

    testWidgets('it closes and stays closed', (tester) async {
      await pumpApp(
        tester,
        content: FakeContentRepository(welcomeEnabled: true),
      );
      expect(find.text('Welcome to 1XBET Agent'), findsOneWidget);

      await tester.tap(find.byKey(const Key('closeWelcome')));
      await tester.pumpAndSettle();
      expect(find.text('Welcome to 1XBET Agent'), findsNothing);

      // Still signed out on the login screen, and it does not come back.
      expect(find.text('Welcome back'), findsOneWidget);
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('Welcome to 1XBET Agent'), findsNothing);
    });

    testWidgets('an admin can switch the dialog off', (tester) async {
      await pumpApp(
        tester,
        content: FakeContentRepository(welcomeEnabled: false),
      );

      expect(find.text('Welcome to 1XBET Agent'), findsNothing);
      expect(find.text('Welcome back'), findsOneWidget);
    });

    testWidgets('the promotion shows on sign-in and can be dismissed',
        (tester) async {
      await pumpApp(
        tester,
        content: FakeContentRepository(
          welcomeEnabled: false,
          promoEnabled: true,
        ),
      );

      expect(
        find.text('Bet on every match, live on 1XBET'),
        findsOneWidget,
      );

      await tester.tap(find.byKey(const Key('closePromo')));
      await tester.pumpAndSettle();

      expect(find.text('Bet on every match, live on 1XBET'), findsNothing);
      expect(find.text('Welcome back'), findsOneWidget);
    });

    testWidgets('no promotion is shown when it is off', (tester) async {
      await pumpApp(tester);
      expect(find.byKey(const Key('closePromo')), findsNothing);
    });
  });
}
