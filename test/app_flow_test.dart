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
}
