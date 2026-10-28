import 'json.dart';

/// One way to fund the wallet, as described by the server.
///
/// The minimums and the USDT address come from the backend rather than being
/// built into the app, so they can be changed without shipping a release —
/// and so the rupee minimum always matches the rate the server will use.
class DepositCurrencyOption {
  const DepositCurrencyOption({
    required this.code,
    required this.label,
    required this.symbol,
    required this.minimum,
    required this.referenceLabel,
    this.address,
    this.network,
  });

  /// `INR` or `USDT`.
  final String code;
  final String label;
  final String symbol;

  /// Smallest accepted deposit, in this currency.
  final double minimum;

  /// What to call the field that identifies the payment.
  final String referenceLabel;

  /// Only for USDT: where to send it, and on which chain.
  final String? address;
  final String? network;

  bool get isUsdt => code == 'USDT';

  factory DepositCurrencyOption.fromJson(Map<String, dynamic> json) =>
      DepositCurrencyOption(
        code: asString(json['code']),
        label: asString(json['label']),
        symbol: asString(json['symbol']),
        minimum: asDouble(json['minimum']),
        referenceLabel: asString(json['referenceLabel']),
        address: json['address'] as String?,
        network: json['network'] as String?,
      );
}

/// One of the plans a new agent can buy to join.
class JoiningPlan {
  const JoiningPlan({
    required this.code,
    required this.label,
    required this.description,
    required this.priceUsdt,
    required this.priceInr,
  });

  /// `AGENT` or `MASTER`.
  final String code;
  final String label;
  final String description;
  final double priceUsdt;
  final double priceInr;

  bool get isMaster => code == 'MASTER';

  factory JoiningPlan.fromJson(Map<String, dynamic> json) => JoiningPlan(
        code: asString(json['code']),
        label: asString(json['label']),
        description: asString(json['description']),
        priceUsdt: asDouble(json['priceUsdt']),
        priceInr: asDouble(json['priceInr']),
      );
}

class DepositConfig {
  const DepositConfig({
    required this.usdtInrRate,
    required this.currencies,
    this.plans = const [],
    this.hasJoined = true,
    this.bankTransferEnabled = false,
    this.referralCode,
  });

  /// What one USDT is worth in rupees today.
  final double usdtInrRate;
  final List<DepositCurrencyOption> currencies;

  /// The plans on offer to someone who has not joined yet.
  final List<JoiningPlan> plans;

  /// False while the agent still has to buy a plan.
  final bool hasJoined;
  final bool bankTransferEnabled;

  /// A master's own code, to share with the agents they bring in.
  final String? referralCode;

  DepositCurrencyOption? byCode(String code) {
    for (final currency in currencies) {
      if (currency.code == code) return currency;
    }
    return null;
  }

  factory DepositConfig.fromJson(Map<String, dynamic> json) => DepositConfig(
        usdtInrRate: asDouble(json['usdtInrRate']),
        currencies: asObjectList(json['currencies'])
            .map(DepositCurrencyOption.fromJson)
            .toList(),
        plans: asObjectList(json['plans']).map(JoiningPlan.fromJson).toList(),
        // Default to "joined" so an older server, which says nothing about
        // plans, keeps working as a plain top-up screen.
        hasJoined: json['hasJoined'] == null ? true : asBool(json['hasJoined']),
        bankTransferEnabled: asBool(json['bankTransferEnabled']),
        referralCode: json['referralCode'] as String?,
      );
}
