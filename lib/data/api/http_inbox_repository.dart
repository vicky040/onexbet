import '../models/json.dart';
import '../models/messages.dart';
import '../repositories/inbox_repository.dart';
import 'api_client.dart';

/// [InboxRepository] against `/api/v1/notifications` and
/// `/api/v1/support/messages`.
class HttpInboxRepository implements InboxRepository {
  HttpInboxRepository(this._api);

  final ApiClient _api;

  @override
  Future<List<AppNotification>> notifications() async {
    final data = await _api.get('/notifications');
    return parseResponse(
      () => asObjectList(data).map(AppNotification.fromJson).toList(),
    );
  }

  @override
  Future<void> markRead(String id) async {
    await _api.post('/notifications/$id/read');
  }

  @override
  Future<void> markAllRead() async {
    await _api.post('/notifications/read-all');
  }

  @override
  Future<List<ChatMessage>> supportMessages() async {
    final data = await _api.get('/support/messages');
    return parseResponse(
      () => asObjectList(data).map(ChatMessage.fromJson).toList(),
    );
  }

  @override
  Future<List<ChatMessage>> sendSupportMessage(String text) async {
    // The endpoint answers with the whole conversation, which is what this
    // method's contract promises.
    final data = await _api.post('/support/messages', body: {'text': text});
    return parseResponse(
      () => asObjectList(data).map(ChatMessage.fromJson).toList(),
    );
  }
}
