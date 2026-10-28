import '../models/app_content.dart';

/// Copy the app shows before anyone has signed in.
abstract interface class ContentRepository {
  Future<AppContent> appContent();
}
