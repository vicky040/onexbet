import 'dart:math';

import 'package:flutter/material.dart';

abstract final class Breakpoints {
  /// From this width the shell shows a NavigationRail instead of the
  /// bottom navigation.
  static const wide = 700.0;

  /// Maximum width of page content on large screens.
  static const contentMaxWidth = 1100.0;

  static bool isWide(BuildContext context) =>
      MediaQuery.sizeOf(context).width >= wide;

  /// Horizontal padding that centres content of at most [maxWidth] within
  /// [availableWidth], never less than [minimum].
  static double sidePadding(
    double availableWidth, {
    double maxWidth = contentMaxWidth,
    double minimum = 16,
  }) =>
      max(minimum, (availableWidth - maxWidth) / 2);
}

/// Scrollable page body with pull-to-refresh, centred and width-capped on
/// large screens.
class PageListView extends StatelessWidget {
  const PageListView({
    super.key,
    required this.children,
    this.onRefresh,
    this.maxWidth = Breakpoints.contentMaxWidth,
    this.padding = const EdgeInsets.fromLTRB(16, 16, 16, 100),
  });

  final List<Widget> children;
  final Future<void> Function()? onRefresh;
  final double maxWidth;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final side = Breakpoints.sidePadding(
          constraints.maxWidth,
          maxWidth: maxWidth,
          minimum: padding.left,
        );
        final list = ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: padding.copyWith(left: side, right: side),
          children: children,
        );
        if (onRefresh == null) return list;
        return RefreshIndicator(onRefresh: onRefresh!, child: list);
      },
    );
  }
}

/// Lays [children] out in as many columns as fit [minItemWidth].
class ResponsiveGrid extends StatelessWidget {
  const ResponsiveGrid({
    super.key,
    required this.children,
    this.minItemWidth = 340,
    this.spacing = 12,
  });

  final List<Widget> children;
  final double minItemWidth;
  final double spacing;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = max(
          1,
          ((constraints.maxWidth + spacing) / (minItemWidth + spacing)).floor(),
        );
        final width = (constraints.maxWidth - spacing * (columns - 1)) / columns;
        return Wrap(
          spacing: spacing,
          runSpacing: spacing,
          children: [
            for (final child in children) SizedBox(width: width, child: child),
          ],
        );
      },
    );
  }
}
