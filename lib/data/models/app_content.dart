import 'json.dart';

/// The explanatory dialog shown when the app opens.
class WelcomeNotice {
  const WelcomeNotice({
    required this.enabled,
    required this.title,
    required this.body,
    required this.joiningMinimumUsdt,
    required this.joiningMinimumInr,
  });

  final bool enabled;
  final String title;
  final String body;

  /// What someone must add to become an agent. Same figure as the deposit
  /// minimum, so the two can never disagree.
  final double joiningMinimumUsdt;
  final double joiningMinimumInr;

  factory WelcomeNotice.fromJson(Map<String, dynamic> json) => WelcomeNotice(
        enabled: asBool(json['enabled']),
        title: asString(json['title']),
        body: asString(json['body']),
        joiningMinimumUsdt: asDouble(json['joiningMinimumUsdt']),
        joiningMinimumInr: asDouble(json['joiningMinimumInr']),
      );
}

/// A dismissible promotion on the sign-in screen.
class PromoNotice {
  const PromoNotice({
    required this.enabled,
    required this.headline,
    required this.imageUrl,
    required this.linkUrl,
  });

  final bool enabled;
  final String headline;
  final String imageUrl;
  final String linkUrl;

  bool get hasImage => imageUrl.isNotEmpty;
  bool get hasLink => linkUrl.isNotEmpty;

  /// Nothing to show if it is off, or switched on with nothing in it.
  bool get isVisible => enabled && (headline.isNotEmpty || hasImage);

  factory PromoNotice.fromJson(Map<String, dynamic> json) => PromoNotice(
        enabled: asBool(json['enabled']),
        headline: asString(json['headline']),
        imageUrl: asString(json['imageUrl']),
        linkUrl: asString(json['linkUrl']),
      );
}

/// Everything the app shows before anyone signs in.
class AppContent {
  const AppContent({required this.welcome, required this.promo});

  final WelcomeNotice welcome;
  final PromoNotice promo;

  factory AppContent.fromJson(Map<String, dynamic> json) => AppContent(
        welcome: WelcomeNotice.fromJson(asObject(json['welcome'])),
        promo: PromoNotice.fromJson(asObject(json['promo'])),
      );
}
