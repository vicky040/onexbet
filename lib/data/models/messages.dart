import 'json.dart';

class AppNotification {
  const AppNotification({
    required this.id,
    required this.title,
    required this.body,
    required this.createdAt,
    this.read = false,
  });

  final String id;
  final String title;
  final String body;
  final DateTime createdAt;
  final bool read;

  factory AppNotification.fromJson(Map<String, dynamic> json) =>
      AppNotification(
        id: asString(json['id']),
        title: asString(json['title']),
        body: asString(json['body']),
        createdAt: asDate(json['createdAt']),
        read: asBool(json['read']),
      );

  AppNotification copyWith({bool? read}) => AppNotification(
        id: id,
        title: title,
        body: body,
        createdAt: createdAt,
        read: read ?? this.read,
      );
}

class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.text,
    required this.fromUser,
    required this.createdAt,
  });

  final String id;
  final String text;

  /// True when the agent wrote it; the API calls this `fromUser`.
  final bool fromUser;
  final DateTime createdAt;

  factory ChatMessage.fromJson(Map<String, dynamic> json) => ChatMessage(
        id: asString(json['id']),
        text: asString(json['text']),
        fromUser: asBool(json['fromUser'] ?? json['fromAgent']),
        createdAt: asDate(json['createdAt']),
      );
}
