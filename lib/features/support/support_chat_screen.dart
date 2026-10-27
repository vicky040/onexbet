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

class _SupportChatScreenState extends ConsumerState<SupportChatScreen> {
  final _input = TextEditingController();
  var _sending = false;

  @override
  void dispose() {
    _input.dispose();
    super.dispose();
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
      appBar: const SubPageAppBar(title: 'Support'),
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
                    'Support is typing…',
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
