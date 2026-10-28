import '../models/app_content.dart';
import '../models/json.dart';
import '../repositories/content_repository.dart';
import 'api_client.dart';

/// [ContentRepository] against `/api/v1/app-content`.
///
/// Called without a token: the welcome dialog and the promotion appear on
/// the sign-in screen, where there is nobody signed in yet.
class HttpContentRepository implements ContentRepository {
  HttpContentRepository(this._api);

  final ApiClient _api;

  @override
  Future<AppContent> appContent() async {
    final data = await _api.get('/app-content', authenticated: false);
    return parseResponse(() => AppContent.fromJson(asObject(data)));
  }
}
