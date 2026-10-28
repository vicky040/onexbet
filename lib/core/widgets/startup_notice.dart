import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../data/models/app_content.dart';
import '../../data/providers.dart';
import '../theme/app_colors.dart';
import '../utils/formatters.dart';
import 'brand_logo.dart';

/// Shows the welcome dialog once per launch, on whichever screen mounts it.
///
/// It runs after sign-in, because what it asks for — funding the float —
/// is something only a signed-in agent can act on. It also stops appearing
/// once the balance covers the joining minimum, so a working agent is not
/// told to join every time they open the app.
///
/// The copy itself is written by an admin and can be switched off.
mixin StartupNoticeOpener<T extends ConsumerStatefulWidget>
    on ConsumerState<T> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _maybeShow());
  }

  Future<void> _maybeShow() async {
    if (!mounted || ref.read(startupNoticeSeenProvider)) return;

    final AppContent content;
    try {
      content = await ref.read(appContentProvider.future);
    } catch (_) {
      // The dialog is not worth an error message of its own; the screen
      // behind it still works.
      return;
    }

    if (!mounted || !content.welcome.enabled) return;
    if (ref.read(startupNoticeSeenProvider)) return;

    // Nothing to say to an agent who has already funded their float.
    final balance = ref.read(summaryProvider).value?.totalBalance;
    if (balance != null && balance >= content.welcome.joiningMinimumInr) {
      ref.read(startupNoticeSeenProvider.notifier).markSeen();
      return;
    }

    ref.read(startupNoticeSeenProvider.notifier).markSeen();
    await showDialog<void>(
      context: context,
      builder: (_) => WelcomeDialog(notice: content.welcome),
    );
  }
}

/// What 1XBET Agent is, and what it takes to join.
class WelcomeDialog extends StatelessWidget {
  const WelcomeDialog({super.key, required this.notice});

  final WelcomeNotice notice;

  @override
  Widget build(BuildContext context) {
    return Dialog(
      insetPadding: const EdgeInsets.all(20),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 440),
        child: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(22, 18, 22, 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const BrandLogo(size: 26),
                    const Spacer(),
                    IconButton(
                      key: const Key('closeWelcome'),
                      tooltip: 'Close',
                      icon: const Icon(Icons.close_rounded),
                      onPressed: () => Navigator.pop(context),
                    ),
                  ],
                ),
                Text(
                  notice.title,
                  style: const TextStyle(
                    fontSize: 21,
                    fontWeight: FontWeight.w800,
                    color: AppColors.navy,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  notice.body,
                  style: const TextStyle(
                    fontSize: 14.5,
                    height: 1.45,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 16),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppColors.chipBg,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        children: [
                          Icon(
                            Icons.verified_user_outlined,
                            size: 20,
                            color: AppColors.chipText,
                          ),
                          SizedBox(width: 8),
                          // Expanded, so the heading wraps on a narrow phone
                          // rather than overflowing the row.
                          Expanded(
                            child: Text(
                              'To become an agent',
                              style: TextStyle(
                                fontWeight: FontWeight.w800,
                                color: AppColors.chipText,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Adding ${notice.joiningMinimumUsdt.toStringAsFixed(0)} USDT '
                        '(about ${formatInr(notice.joiningMinimumInr)}) is mandatory '
                        'before you can start taking payins and payouts.',
                        style: const TextStyle(
                          fontSize: 14,
                          height: 1.4,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('Got it'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// The dismissible promotion.
///
/// It appears on the sign-in screen and on Home, which have opposite
/// backgrounds, so [onDark] picks the colours rather than leaving white
/// text on a white card.
class PromoBanner extends StatefulWidget {
  const PromoBanner({super.key, required this.promo, this.onDark = false});

  final PromoNotice promo;
  final bool onDark;

  @override
  State<PromoBanner> createState() => _PromoBannerState();
}

class _PromoBannerState extends State<PromoBanner> {
  var _dismissed = false;

  Future<void> _open() async {
    if (!widget.promo.hasLink) return;
    await launchUrl(
      Uri.parse(widget.promo.linkUrl),
      mode: LaunchMode.externalApplication,
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_dismissed || !widget.promo.isVisible) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(bottom: 18),
      child: Material(
        color: widget.onDark
            ? AppColors.white.withValues(alpha: 0.10)
            : AppColors.white,
        borderRadius: BorderRadius.circular(22),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: widget.promo.hasLink ? _open : null,
          child: Stack(
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (widget.promo.hasImage)
                    ClipRRect(
                      borderRadius: const BorderRadius.vertical(
                        top: Radius.circular(22),
                      ),
                      child: Image.network(
                        widget.promo.imageUrl,
                        height: 130,
                        fit: BoxFit.cover,
                        // A promotion is never worth breaking the screen it
                        // sits on.
                        errorBuilder: (_, _, _) => const SizedBox.shrink(),
                        loadingBuilder: (context, child, progress) =>
                            progress == null
                                ? child
                                : const SizedBox(
                                    height: 130,
                                    child: Center(
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        color: AppColors.primaryBlue,
                                      ),
                                    ),
                                  ),
                      ),
                    ),
                  if (widget.promo.headline.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 14, 48, 14),
                      child: Row(
                        children: [
                          Icon(
                            Icons.campaign_rounded,
                            color: widget.onDark
                                ? AppColors.brandBlue
                                : AppColors.primaryBlue,
                            size: 24,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              widget.promo.headline,
                              style: TextStyle(
                                color: widget.onDark
                                    ? AppColors.white
                                    : AppColors.navy,
                                fontSize: 14.5,
                                fontWeight: FontWeight.w700,
                                height: 1.35,
                              ),
                            ),
                          ),
                          if (widget.promo.hasLink)
                            Icon(
                              Icons.chevron_right_rounded,
                              color: widget.onDark
                                  ? AppColors.white.withValues(alpha: 0.7)
                                  : AppColors.textMuted,
                            ),
                        ],
                      ),
                    ),
                ],
              ),
              Positioned(
                top: 4,
                right: 4,
                child: IconButton(
                  key: const Key('closePromo'),
                  tooltip: 'Close',
                  iconSize: 18,
                  color: widget.onDark
                      ? AppColors.white
                      : AppColors.textMuted,
                  style: IconButton.styleFrom(
                    backgroundColor: widget.onDark
                        ? Colors.black.withValues(alpha: 0.3)
                        : AppColors.pillBg,
                    minimumSize: const Size(30, 30),
                    padding: EdgeInsets.zero,
                  ),
                  icon: const Icon(Icons.close_rounded),
                  onPressed: () => setState(() => _dismissed = true),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
