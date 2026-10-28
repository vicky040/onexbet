import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../core/widgets/responsive.dart';
import '../../core/widgets/startup_notice.dart';
import '../../data/providers.dart';
import 'home_widgets.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

/// [StartupNoticeOpener] shows the welcome dialog here rather than on the
/// sign-in screen: funding the float is something only a signed-in agent
/// can act on.
class _HomeScreenState extends ConsumerState<HomeScreen>
    with StartupNoticeOpener {
  static const _maxWidth = 760.0;

  @override
  Widget build(BuildContext context) {
    Future<void> refresh() async {
      ref.invalidate(summaryProvider);
      ref.invalidate(earningsProvider);
      await ref.read(summaryProvider.future);
    }

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: AppColors.homeBg,
        body: LayoutBuilder(
          builder: (context, constraints) {
            final side = Breakpoints.sidePadding(
              constraints.maxWidth,
              maxWidth: _maxWidth,
            );
            return RefreshIndicator(
              onRefresh: refresh,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.only(bottom: 32),
                children: [
                  HomeHeader(sidePadding: side),
                  Padding(
                    padding: EdgeInsets.symmetric(horizontal: side),
                    child: const Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        SizedBox(height: 18),
                        _Promo(),
                        AddDepositButton(),
                        SizedBox(height: 18),
                        CommissionTiles(),
                        SizedBox(height: 18),
                        EarningsOverviewCard(),
                        SizedBox(height: 18),
                        HelpCard(),
                      ],
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}


/// The promotion, when an admin has one switched on.
class _Promo extends ConsumerWidget {
  const _Promo();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final content = ref.watch(appContentProvider).value;
    if (content == null || !content.promo.isVisible) {
      return const SizedBox.shrink();
    }
    return PromoBanner(promo: content.promo);
  }
}
