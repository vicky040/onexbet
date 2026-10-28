import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';

/// Becomes true once the splash animation has played; the router keeps the
/// user on the splash until then.
class SplashComplete extends Notifier<bool> {
  @override
  bool build() => false;

  void complete() => state = true;
}

final splashCompleteProvider = NotifierProvider<SplashComplete, bool>(
  SplashComplete.new,
);

/// Animated launch screen. The logo starts exactly where the native splash
/// draws it (centred, 170dp wide) so the hand-off is seamless.
class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  /// Same file as the native splash image (720px at 4x = 180dp).
  static const logoAsset = 'assets/branding/splash_logo.png';
  static const logoWidth = 180.0;

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen>
    with TickerProviderStateMixin {
  late final _intro = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1900),
  );
  late final _rings = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1600),
  );

  late final _scale = TweenSequence<double>([
    TweenSequenceItem(
      tween: Tween(
        begin: 1.0,
        end: 1.12,
      ).chain(CurveTween(curve: Curves.easeOut)),
      weight: 25,
    ),
    TweenSequenceItem(
      tween: Tween(
        begin: 1.12,
        end: 1.0,
      ).chain(CurveTween(curve: Curves.easeInOut)),
      weight: 20,
    ),
    TweenSequenceItem(tween: ConstantTween(1.0), weight: 55),
  ]).animate(_intro);

  late final _shimmer = CurvedAnimation(
    parent: _intro,
    curve: const Interval(0.3, 0.75, curve: Curves.easeInOut),
  );

  late final _tagline = CurvedAnimation(
    parent: _intro,
    curve: const Interval(0.45, 0.75, curve: Curves.easeOut),
  );

  late final _progress = CurvedAnimation(
    parent: _intro,
    curve: const Interval(0.4, 1.0, curve: Curves.easeInOut),
  );

  @override
  void initState() {
    super.initState();
    _rings.repeat();
    _intro
      ..addStatusListener((status) {
        if (status == AnimationStatus.completed) {
          ref.read(splashCompleteProvider.notifier).complete();
        }
      })
      ..forward();
  }

  @override
  void dispose() {
    _intro.dispose();
    _rings.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: AppColors.navy,
        // The Stack sizes itself to the ring painter (320x320) rather than
        // the window, so without this it sits in the top-left corner on any
        // screen bigger than that — obvious in a browser.
        body: Center(
          child: Stack(
            alignment: Alignment.center,
            children: [
              AnimatedBuilder(
                animation: _rings,
                builder: (_, _) => CustomPaint(
                  size: const Size.square(320),
                  painter: _RingsPainter(_rings.value),
                ),
              ),
              ScaleTransition(
                scale: _scale,
                child: AnimatedBuilder(
                  animation: _shimmer,
                  builder: (_, child) => ShaderMask(
                    blendMode: BlendMode.srcATop,
                    shaderCallback: (rect) =>
                        _shimmerGradient(_shimmer.value).createShader(rect),
                    child: child,
                  ),
                  child: Image.asset(
                    SplashScreen.logoAsset,
                    width: SplashScreen.logoWidth,
                    semanticLabel: '1XBET',
                  ),
                ),
              ),
              Transform.translate(
                offset: const Offset(0, 62),
                child: FadeTransition(
                  opacity: _tagline,
                  child: SlideTransition(
                    position: Tween(
                      begin: const Offset(0, 0.6),
                      end: Offset.zero,
                    ).animate(_tagline),
                    child: Text(
                      'AGENT PANEL',
                      style: TextStyle(
                        color: AppColors.white.withValues(alpha: 0.75),
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 4,
                      ),
                    ),
                  ),
                ),
              ),
              Transform.translate(
                offset: const Offset(0, 104),
                child: SizedBox(
                  width: 120,
                  height: 3,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(2),
                    child: AnimatedBuilder(
                      animation: _progress,
                      builder: (_, _) => LinearProgressIndicator(
                        value: _progress.value,
                        backgroundColor: AppColors.white.withValues(
                          alpha: 0.12,
                        ),
                        color: AppColors.brandBlue,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// A soft white band that sweeps left to right across the logo.
  LinearGradient _shimmerGradient(double t) {
    final center = -0.3 + 1.6 * t;
    double clamp(double v) => v.clamp(0.0, 1.0);
    return LinearGradient(
      begin: Alignment.centerLeft,
      end: Alignment.centerRight,
      colors: [
        Colors.transparent,
        AppColors.white.withValues(alpha: t == 0 || t == 1 ? 0 : 0.7),
        Colors.transparent,
      ],
      stops: [clamp(center - 0.15), clamp(center), clamp(center + 0.15)],
    );
  }
}

/// Two glow rings that expand outward from the logo and fade.
class _RingsPainter extends CustomPainter {
  _RingsPainter(this.t);

  final double t;

  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    final maxRadius = size.shortestSide / 2;
    for (final offset in const [0.0, 0.5]) {
      final p = (t + offset) % 1.0;
      final radius = maxRadius * (0.35 + 0.65 * p);
      final opacity = 0.28 * math.pow(1 - p, 2);
      canvas.drawCircle(
        center,
        radius,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2
          ..color = AppColors.brandBlue.withValues(alpha: opacity.toDouble()),
      );
    }
  }

  @override
  bool shouldRepaint(_RingsPainter old) => old.t != t;
}
