import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/theme/app_colors.dart';
import '../../core/widgets/app_bars.dart';
import '../../core/widgets/async_views.dart';
import '../../core/widgets/form_fields.dart';
import '../../data/models/messages.dart';
import '../../data/providers.dart';

class SupportChatScreen extends ConsumerStatefulWidget {
  const SupportChatScreen({super.key});

  @override
  ConsumerState<SupportChatScreen> createState() => _SupportChatScreenState();
}

class _SupportChatScreenState extends ConsumerState<SupportChatScreen>
    with WidgetsBindingObserver {
  /// Support replies arrive from the admin panel, so the conversation has to
  /// be re-read while the agent is looking at it. Without this a reply only
  /// shows up after leaving the screen and coming back.
  static const _pollInterval = Duration(seconds: 5);

  final _input = TextEditingController();
  Timer? _poll;
  var _sending = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _poll = Timer.periodic(_pollInterval, (_) => _refresh());
  }

  @override
  void dispose() {
    _poll?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    _input.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Catch up immediately on coming back, rather than waiting for the tick.
    if (state == AppLifecycleState.resumed) _refresh();
  }

  void _refresh() {
    if (!mounted || _sending) return;
    ref.read(supportChatProvider.notifier).refresh();
  }

  Future<void> _send() async {
    final text = _input.text.trim();
    if (text.isEmpty || _sending) return;
    _input.clear();
    setState(() => _sending = true);
    try {
      await ref.read(supportChatProvider.notifier).send(text);
    } catch (e) {
      if (mounted) showMessage(context, 'Message not sent: $e');
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final messages = ref.watch(supportChatProvider);

    return Scaffold(
      appBar: SubPageAppBar(
        title: 'Support',
        actions: [
          IconButton(
            tooltip: 'Check for new replies',
            icon: const Icon(Icons.refresh_rounded),
            onPressed: _refresh,
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 760),
          child: Column(
            children: [
              Expanded(
                child: AsyncValueView(
                  value: messages,
                  onRetry: () => ref.invalidate(supportChatProvider),
                  data: (list) => ListView.builder(
                    reverse: true,
                    padding: const EdgeInsets.all(16),
                    itemCount: list.length,
                    itemBuilder: (_, i) =>
                        _Bubble(message: list[list.length - 1 - i]),
                  ),
                ),
              ),
              if (_sending)
                const Padding(
                  padding: EdgeInsets.only(bottom: 6),
                  child: Text(
                    // Replies now come from a person in the admin panel, so
                    // the old "Support is typing…" was simply untrue.
                    'Sending…',
                    style: TextStyle(color: AppColors.textMuted, fontSize: 13),
                  ),
                ),
              _Composer(controller: _input, onSend: _send),
            ],
          ),
        ),
      ),
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({required this.message});

  final ChatMessage message;

  @override
  Widget build(BuildContext context) {
    final mine = message.fromUser;
    final fg = mine ? AppColors.white : AppColors.textPrimary;
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxWidth: MediaQuery.sizeOf(context).width * 0.75,
        ),
        child: Container(
          margin: const EdgeInsets.symmetric(vertical: 4),
          padding: const EdgeInsets.fromLTRB(14, 10, 14, 8),
          decoration: BoxDecoration(
            color: mine ? AppColors.navy : AppColors.white,
            borderRadius: BorderRadius.only(
              topLeft: const Radius.circular(18),
              topRight: const Radius.circular(18),
              bottomLeft: Radius.circular(mine ? 18 : 4),
              bottomRight: Radius.circular(mine ? 4 : 18),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(message.text, style: TextStyle(color: fg, fontSize: 15)),
              const SizedBox(height: 4),
              Text(
                DateFormat('HH:mm').format(message.createdAt),
                style: TextStyle(color: fg.withValues(alpha: 0.6), fontSize: 11),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Composer extends StatelessWidget {
  const _Composer({required this.controller, required this.onSend});

  final TextEditingController controller;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 4, 12, 12),
        child: Row(
          children: [
            Expanded(
              child: TextField(
                controller: controller,
                textInputAction: TextInputAction.send,
                onSubmitted: (_) => onSend(),
                minLines: 1,
                maxLines: 4,
                decoration: const InputDecoration(
                  hintText: 'Type a message',
                  fillColor: AppColors.white,
                ),
              ),
            ),
            const SizedBox(width: 8),
            IconButton.filled(
              tooltip: 'Send',
              style: IconButton.styleFrom(
                backgroundColor: AppColors.navy,
                foregroundColor: AppColors.white,
                fixedSize: const Size(52, 52),
              ),
              icon: const Icon(Icons.send_rounded),
              onPressed: onSend,
            ),
          ],
        ),
      ),
    );
  }
}
