import '../models/messages.dart';

/// Notifications and the support chat.
abstract interface class InboxRepository {
  Future<List<AppNotification>> notifications();

  Future<void> markRead(String id);

  Future<void> markAllRead();

  Future<List<ChatMessage>> supportMessages();

  /// Sends [text] and returns the conversation including any reply.
  Future<List<ChatMessage>> sendSupportMessage(String text);
}
