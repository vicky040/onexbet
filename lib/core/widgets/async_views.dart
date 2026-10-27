import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../theme/app_colors.dart';
import '../theme/app_text_styles.dart';
import 'section_card.dart';

/// Renders [value] with a skeleton while loading and a retry on error.
class AsyncValueView<T> extends StatelessWidget {
  const AsyncValueView({
    super.key,
    required this.value,
    required this.data,
    this.onRetry,
    this.skeletonCount = 2,
  });

  final AsyncValue<T> value;
  final Widget Function(T data) data;
  final VoidCallback? onRetry;
  final int skeletonCount;

  @override
  Widget build(BuildContext context) {
    return value.when(
      data: data,
      loading: () => LoadingSkeleton(count: skeletonCount),
      error: (error, _) => ErrorView(message: '$error', onRetry: onRetry),
    );
  }
}

class LoadingSkeleton extends StatelessWidget {
  const LoadingSkeleton({super.key, this.count = 2, this.height = 84});

  final int count;
  final double height;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        for (var i = 0; i < count; i++)
          Container(
            height: height,
            margin: EdgeInsets.only(bottom: i == count - 1 ? 0 : 12),
            decoration: BoxDecoration(
              color: AppColors.border.withValues(alpha: 0.6),
              borderRadius: BorderRadius.circular(16),
            ),
          ),
      ],
    );
  }
}

class ErrorView extends StatelessWidget {
  const ErrorView({super.key, required this.message, this.onRetry});

  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return InsetPanel(
      padding: const EdgeInsets.all(18),
      child: Column(
        children: [
          const Icon(Icons.error_outline_rounded, color: AppColors.danger, size: 32),
          const SizedBox(height: 8),
          Text(
            'Something went wrong',
            style: AppTextStyles.body.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 4),
          Text(message, style: AppTextStyles.muted, textAlign: TextAlign.center),
          if (onRetry != null) ...[
            const SizedBox(height: 8),
            TextButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ],
      ),
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState(this.message, {super.key});

  final String message;

  @override
  Widget build(BuildContext context) {
    return InsetPanel(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 32),
      child: Text(message, style: AppTextStyles.body.copyWith(fontSize: 16)),
    );
  }
}
