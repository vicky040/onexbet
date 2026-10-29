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

    testWidgets('only USDT is offered while bank transfer is off',
        (tester) async {
      await pumpApp(tester, loggedIn: true);
      await openDeposit(tester);

      // One currency means no picker to get wrong: the wallet is shown
      // straight away.
      expect(find.byKey(const Key('currency_INR')), findsNothing);
      expect(find.text('TBbwzuMH3nHdYMqft3vNtnvjRtGDVb7LVE'), findsOneWidget);
      expect(find.textContaining('Minimum 3000 USDT'), findsOneWidget);
    });

    testWidgets('bank transfer comes back when the server enables it',
        (tester) async {
      await pumpApp(
        tester,
        loggedIn: true,
        wallet: FakeWalletRepository()..bankTransferEnabled = true,
      );
      await openDeposit(tester);

      expect(find.byKey(const Key('currency_INR')), findsOneWidget);
      expect(find.byKey(const Key('currency_USDT')), findsOneWidget);
    });

    testWidgets('USDT shows the address, network and QR', (tester) async {
      await pumpApp(tester, loggedIn: true);
      await openDeposit(tester);

      expect(find.text('TBbwzuMH3nHdYMqft3vNtnvjRtGDVb7LVE'), findsOneWidget);
      expect(find.text('Network: TRC20 (Tron)'), findsOneWidget);
      expect(find.byType(Image), findsWidgets);
    });

    testWidgets('a USDT amount below the minimum is refused', (tester) async {
      await pumpApp(tester, loggedIn: true);
      await openDeposit(tester);

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

      await tester.enterText(find.byKey(const Key('depositAmount')), '3000');
      await tester.pumpAndSettle();
      expect(find.textContaining('Credits about ₹270000.00'), findsOneWidget);

      await tester.enterText(
        find.byKey(const Key('depositUtr')),
        'abc123def456',
      );
      await submitDeposit(tester);

      expect(wallet.lastDepositCurrency, 'USDT');
      // A top-up, not a plan purchase.
      expect(wallet.lastDepositPlan, isNull);
    });
  });

  group('joining plans', () {
    Future<void> openDeposit(WidgetTester tester) async {
      final addDeposit = find.text('Add deposit');
      await tester.scrollUntilVisible(addDeposit, 200);
      await tester.pumpAndSettle();
      await tester.tap(addDeposit);
      await tester.pumpAndSettle();
    }

    FakeWalletRepository joining() => FakeWalletRepository()..hasJoined = false;

    testWidgets('both plans are offered, with nothing else until one is picked',
        (tester) async {
      await pumpApp(tester, loggedIn: true, wallet: joining());
      await openDeposit(tester);

      expect(find.text('Agent'), findsOneWidget);
      expect(find.text('Master'), findsOneWidget);
      expect(find.text('3000 USDT'), findsOneWidget);
      expect(find.text('5000 USDT'), findsOneWidget);
      expect(find.text('PANEL ACCESS'), findsOneWidget);

      // The agent is told what is held back before they pay anything.
      expect(
        find.textContaining('1000 USDT held as security'),
        findsOneWidget,
      );
      // The master plan keeps the lot, so it must not read "0 to your
      // balance" as though something had gone wrong.
      expect(
        find.textContaining('All 5000 USDT is held as security'),
        findsOneWidget,
      );

      // The QR only makes sense once an amount is settled.
      expect(find.text('Choose a plan to see the payment details.'),
          findsOneWidget);
      expect(find.text('TBbwzuMH3nHdYMqft3vNtnvjRtGDVb7LVE'), findsNothing);
    });

    testWidgets('picking the master plan fills in its price and shows the QR',
        (tester) async {
      await pumpApp(tester, loggedIn: true, wallet: joining());
      await openDeposit(tester);

      await tester.tap(find.text('Master'));
      await tester.pumpAndSettle();

      expect(find.text('TBbwzuMH3nHdYMqft3vNtnvjRtGDVb7LVE'), findsOneWidget);
      final amount = tester.widget<TextField>(
        find.descendant(
          of: find.byKey(const Key('depositAmount')),
          matching: find.byType(TextField),
        ),
      );
      expect(amount.controller?.text, '5000');
      // The price is the server's to decide, not the agent's to edit.
      expect(amount.readOnly, isTrue);
    });

    testWidgets('the chosen plan is sent with the payment', (tester) async {
      final wallet = joining();
      await pumpApp(tester, loggedIn: true, wallet: wallet);
      await openDeposit(tester);

      await tester.tap(find.text('Master'));
      await tester.pumpAndSettle();
      await tester.enterText(
        find.byKey(const Key('depositUtr')),
        'abc123def456',
      );

      final button = find.text('I have paid');
      await tester.ensureVisible(button);
      await tester.pumpAndSettle();
      await tester.tap(button);
      await tester.pumpAndSettle();

      expect(wallet.lastDepositPlan, 'MASTER');
      expect(wallet.lastDepositCurrency, 'USDT');
    });
  });

  group('startup notices', () {
    testWidgets('the welcome dialog does not appear before signing in',
        (tester) async {
      await pumpApp(
        tester,
        content: FakeContentRepository(welcomeEnabled: true),
      );

      // Signed out: nothing to act on, so nothing is asked of them.
      expect(find.text('Welcome back'), findsOneWidget);
      expect(find.text('Welcome to 1XBET Agent'), findsNothing);
    });

    testWidgets('it appears after signing in, with the joining requirement',
        (tester) async {
      await pumpApp(
        tester,
        loggedIn: true,
        content: FakeContentRepository(welcomeEnabled: true),
        wallet: FakeWalletRepository(balance: 0),
      );

      expect(find.text('Welcome to 1XBET Agent'), findsOneWidget);
      expect(find.text('To become an agent'), findsOneWidget);
      expect(
        find.textContaining('3000 USDT (about ₹270000.00) is mandatory'),
        findsOneWidget,
      );
    });

    testWidgets('it closes and stays closed', (tester) async {
      await pumpApp(
        tester,
        loggedIn: true,
        content: FakeContentRepository(welcomeEnabled: true),
        wallet: FakeWalletRepository(balance: 0),
      );
      expect(find.text('Welcome to 1XBET Agent'), findsOneWidget);

      await tester.tap(find.byKey(const Key('closeWelcome')));
      await tester.pumpAndSettle();

      expect(find.text('Welcome to 1XBET Agent'), findsNothing);
      expect(find.text('Total balance'), findsOneWidget);

      await tester.pump(const Duration(seconds: 1));
      expect(find.text('Welcome to 1XBET Agent'), findsNothing);
    });

    testWidgets('a funded agent is not asked to join again', (tester) async {
      await pumpApp(
        tester,
        loggedIn: true,
        content: FakeContentRepository(welcomeEnabled: true),
        // Above the joining minimum of 3000 USDT at 90 = ₹270,000.
        wallet: FakeWalletRepository(balance: 300000),
      );

      expect(find.text('Total balance'), findsOneWidget);
      expect(find.text('Welcome to 1XBET Agent'), findsNothing);
    });

    testWidgets('an admin can switch the dialog off', (tester) async {
      await pumpApp(
        tester,
        loggedIn: true,
        content: FakeContentRepository(welcomeEnabled: false),
        wallet: FakeWalletRepository(balance: 0),
      );

      expect(find.text('Welcome to 1XBET Agent'), findsNothing);
      expect(find.text('Total balance'), findsOneWidget);
    });

    testWidgets('the promotion shows on the sign-in screen too',
        (tester) async {
      await pumpApp(
        tester,
        content: FakeContentRepository(
          welcomeEnabled: true,
          promoEnabled: true,
        ),
      );

      // Signed out: the ad runs, the dialog does not.
      expect(find.text('Welcome back'), findsOneWidget);
      expect(find.text('Bet on every match, live on 1XBET'), findsOneWidget);
      expect(find.text('Welcome to 1XBET Agent'), findsNothing);

      await tester.tap(find.byKey(const Key('closePromo')));
      await tester.pumpAndSettle();
      expect(find.text('Bet on every match, live on 1XBET'), findsNothing);
    });

    testWidgets('the promotion shows on Home and can be dismissed',
        (tester) async {
      await pumpApp(
        tester,
        loggedIn: true,
        content: FakeContentRepository(
          welcomeEnabled: false,
          promoEnabled: true,
        ),
      );

      final headline = find.text('Bet on every match, live on 1XBET');
      expect(headline, findsOneWidget);

      await tester.tap(find.byKey(const Key('closePromo')));
      await tester.pumpAndSettle();

      expect(headline, findsNothing);
      expect(find.text('Total balance'), findsOneWidget);
    });

    testWidgets('no promotion is shown when it is off', (tester) async {
      await pumpApp(tester, loggedIn: true);
      expect(find.byKey(const Key('closePromo')), findsNothing);
    });
  });
}
