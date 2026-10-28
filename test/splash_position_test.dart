import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:onexbet/features/auth/splash_screen.dart';

void main() {
  testWidgets('the splash logo sits in the middle of the screen', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      const ProviderScope(child: MaterialApp(home: SplashScreen())),
    );
    await tester.pump(const Duration(milliseconds: 600));

    final screen = tester.getSize(find.byType(SplashScreen));
    final logo = tester.getCenter(find.byType(Image));

    expect(
      logo.dy,
      closeTo(screen.height / 2, 8),
      reason: 'the logo should be vertically centred, not sitting high',
    );
    expect(logo.dx, closeTo(screen.width / 2, 2));
  });
}
