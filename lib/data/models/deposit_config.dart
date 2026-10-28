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

class DepositConfig {
  const DepositConfig({required this.usdtInrRate, required this.currencies});

  /// What one USDT is worth in rupees today.
  final double usdtInrRate;
  final List<DepositCurrencyOption> currencies;

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
      );
}
