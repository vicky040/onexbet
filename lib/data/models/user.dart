import 'json.dart';

class User {
  const User({
    required this.name,
    required this.mobile,
    required this.email,
    this.id = '',
    this.status = 'ACTIVE',
    this.plan = 'NONE',
    this.referralCode,
  });

  final String name;
  final String mobile;
  final String email;
  final String id;

  /// `ACTIVE`, `PENDING` or `BLOCKED`.
  final String status;

  /// `NONE` until the joining deposit is approved, then `AGENT` or `MASTER`.
  final String plan;

  /// A master's referral code.
  final String? referralCode;

  bool get isActive => status == 'ACTIVE';
  bool get hasJoined => plan != 'NONE';
  bool get isMaster => plan == 'MASTER';

  String get firstName => name.trim().split(RegExp(r'\s+')).first;

  factory User.fromJson(Map<String, dynamic> json) => User(
        id: asString(json['id']),
        name: asString(json['name']),
        mobile: asString(json['mobile']),
        email: asString(json['email']),
        status: json['status'] == null ? 'ACTIVE' : asString(json['status']),
        plan: json['plan'] == null ? 'NONE' : asString(json['plan']),
        referralCode: json['referralCode'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'mobile': mobile,
        'email': email,
        'status': status,
        'plan': plan,
      };
}
