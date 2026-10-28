import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/config/app_config.dart';
import '../../core/router/routes.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/formatters.dart';
import '../../core/utils/validators.dart';
import '../../core/widgets/app_bars.dart';
import '../../core/widgets/form_fields.dart';
import '../../core/widgets/kv_row.dart';
import '../../core/widgets/responsive.dart';
import '../../core/widgets/section_card.dart';
import '../../data/repositories/auth_repository.dart';
import '../auth/auth_controller.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  Future<void> _logout(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Log out?'),
        content: const Text('You will need to log in again to use the app.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            style: TextButton.styleFrom(foregroundColor: AppColors.danger),
            child: const Text('Log out'),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      await ref.read(authControllerProvider.notifier).logout();
    }
  }

  /// Opens the APK in the browser or download manager. A failure is reported
  /// rather than leaving the tap looking ignored.
  Future<void> _downloadAndroidApp(BuildContext context) async {
    final uri = Uri.parse(AppConfig.androidApkUrl);
    final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!opened && context.mounted) {
      showMessage(context, 'Could not start the download. Please try again.');
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).value;
    if (user == null) return const Scaffold();

    return Scaffold(
      appBar: const SubPageAppBar(title: 'Profile'),
      body: PageListView(
        maxWidth: 640,
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          Container(
            margin: const EdgeInsets.only(bottom: 18),
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppColors.navy,
              borderRadius: BorderRadius.circular(26),
            ),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 32,
                  backgroundColor: AppColors.white,
                  child: Text(
                    initialsOf(user.name),
                    style: const TextStyle(
                      color: AppColors.navy,
                      fontSize: 26,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        user.name,
                        style: const TextStyle(
                          color: AppColors.white,
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '+91 ${user.mobile}',
                        style: TextStyle(
                          color: AppColors.white.withValues(alpha: 0.75),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          SectionCard(
            title: 'Account',
            child: InsetPanel(
              padding: const EdgeInsets.all(14),
              child: Column(
                children: [
                  KvRow('Name', user.name),
                  KvRow('Mobile', '+91 ${user.mobile}'),
                  KvRow('Email', user.email),
                  if (user.hasJoined)
                    KvRow('Plan', user.isMaster ? 'Master' : 'Agent'),
                  // A master shares this with the agents they bring in.
                  if (user.referralCode != null)
                    KvRow('Referral code', user.referralCode!),
                ],
              ),
            ),
          ),
          SectionCard(
            title: 'Settings',
            child: InsetPanel(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Column(
                children: [
                  _SettingsTile(
                    icon: Icons.lock_reset_rounded,
                    label: 'Change password',
                    onTap: () => showDialog<void>(
                      context: context,
                      builder: (_) => const _ChangePasswordDialog(),
                    ),
                  ),
                  _SettingsTile(
                    icon: Icons.notifications_none_rounded,
                    label: 'Notifications',
                    onTap: () => context.push(Routes.notifications),
                  ),
                  _SettingsTile(
                    icon: Icons.support_agent_rounded,
                    label: 'Help & support',
                    onTap: () => context.push(Routes.support),
                  ),
                  if (AppConfig.hasAndroidDownload)
                    _SettingsTile(
                      icon: Icons.android_rounded,
                      label: 'Download Android app',
                      onTap: () => _downloadAndroidApp(context),
                    ),
                  _SettingsTile(
                    icon: Icons.logout_rounded,
                    label: 'Log out',
                    color: AppColors.danger,
                    onTap: () => _logout(context, ref),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SettingsTile extends StatelessWidget {
  const _SettingsTile({
    required this.icon,
    required this.label,
    required this.onTap,
    this.color = AppColors.textPrimary,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon, color: color),
      title: Text(
        label,
        style: TextStyle(color: color, fontWeight: FontWeight.w600),
      ),
      trailing: const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted),
      onTap: onTap,
    );
  }
}

class _ChangePasswordDialog extends ConsumerStatefulWidget {
  const _ChangePasswordDialog();

  @override
  ConsumerState<_ChangePasswordDialog> createState() =>
      _ChangePasswordDialogState();
}

class _ChangePasswordDialogState extends ConsumerState<_ChangePasswordDialog> {
  final _formKey = GlobalKey<FormState>();
  final _current = TextEditingController();
  final _new = TextEditingController();
  final _confirm = TextEditingController();
  String? _error;
  var _saving = false;

  @override
  void dispose() {
    _current.dispose();
    _new.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref
          .read(authControllerProvider.notifier)
          .changePassword(_current.text, _new.text);
      if (!mounted) return;
      Navigator.pop(context);
      showMessage(context, 'Password changed');
    } on AuthException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = 'Something went wrong. Please try again.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Change password'),
      content: SizedBox(
        width: 380,
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              PasswordField(controller: _current, label: 'Current password'),
              formGap,
              PasswordField(controller: _new, label: 'New password'),
              formGap,
              PasswordField(
                controller: _confirm,
                label: 'Confirm new password',
                textInputAction: TextInputAction.done,
                validator: (v) => Validators.confirmPassword(v, _new.text),
              ),
              if (_error != null) ...[
                const SizedBox(height: 10),
                Text(_error!, style: const TextStyle(color: AppColors.danger)),
              ],
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        TextButton(
          onPressed: _saving ? null : _save,
          child: const Text('Save'),
        ),
      ],
    );
  }
}
