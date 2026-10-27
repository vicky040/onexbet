import 'json.dart';

class User {
  const User({
    required this.name,
    required this.mobile,
    required this.email,
    this.id = '',
    this.status = 'ACTIVE',
  });

  final String name;
  final String mobile;
  final String email;
  final String id;

  /// `ACTIVE`, `PENDING` or `BLOCKED`.
  final String status;

  bool get isActive => status == 'ACTIVE';

  String get firstName => name.trim().split(RegExp(r'\s+')).first;

  factory User.fromJson(Map<String, dynamic> json) => User(
        id: asString(json['id']),
        name: asString(json['name']),
        mobile: asString(json['mobile']),
        email: asString(json['email']),
        status: json['status'] == null ? 'ACTIVE' : asString(json['status']),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'mobile': mobile,
        'email': email,
        'status': status,
      };
}
