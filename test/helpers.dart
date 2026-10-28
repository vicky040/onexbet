import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/testing.dart';
import 'package:onexbet/app.dart';
import 'package:onexbet/core/widgets/app_bottom_nav.dart';
import 'package:onexbet/data/api/api_client.dart';
import 'package:onexbet/data/api/token_store.dart';
import 'package:onexbet/data/providers.dart';
import 'package:onexbet/data/repositories/auth_repository.dart';
import 'package:onexbet/data/repositories/bank_repository.dart';
import 'package:onexbet/data/repositories/content_repository.dart';
import 'package:onexbet/data/repositories/inbox_repository.dart';
import 'package:onexbet/data/repositories/wallet_repository.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'fakes.dart';

/// Taps the bottom-navigation tab labelled [label].
Future<void> tapTab(WidgetTester tester, String label) async {
  await tester.tap(
    find.descendant(of: find.byType(AppBottomNav), matching: find.text(label)),
  );
  await tester.pumpAndSettle();
}

/// Pumps the full app at phone size against the fake repositories.
///
/// The API client is replaced with one whose HTTP client fails loudly, so a
/// widget test that accidentally reaches the network cannot pass quietly.
Future<void> pumpApp(
  WidgetTester tester, {
  bool loggedIn = false,
  bool settle = true,
  AuthRepository? auth,
  WalletRepository? wallet,
  BankRepository? bank,
  InboxRepository? inbox,
  ContentRepository? content,
}) async {
  SharedPreferences.setMockInitialValues({});
  tester.view.physicalSize = const Size(1080, 2340);
  tester.view.devicePixelRatio = 2.75;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        apiClientProvider.overrideWithValue(
          ApiClient(
            baseUrl: 'http://localhost/api/v1',
            tokens: TokenStore(),
            httpClient: MockClient((request) async {
              fail('A widget test tried to call ${request.url}');
            }),
          ),
        ),
        authRepositoryProvider.overrideWithValue(
          auth ?? FakeAuthRepository(signedInAs: loggedIn ? testUser : null),
        ),
        walletRepositoryProvider
            .overrideWithValue(wallet ?? FakeWalletRepository()),
        bankRepositoryProvider.overrideWithValue(bank ?? FakeBankRepository()),
        inboxRepositoryProvider
            .overrideWithValue(inbox ?? FakeInboxRepository()),
        // Off by default: most tests are not about the startup dialog, and
        // a modal over the screen would get in their way.
        contentRepositoryProvider.overrideWithValue(
          content ?? FakeContentRepository(welcomeEnabled: false),
        ),
      ],
      child: const OnexbetApp(),
    ),
  );
  if (settle) await tester.pumpAndSettle();
}
