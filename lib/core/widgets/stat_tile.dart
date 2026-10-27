import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../theme/app_text_styles.dart';
import 'section_card.dart';

class StatData {
  const StatData(this.label, this.value);

  final String label;
  final String value;
}

/// Label above an inset value pill ("Total Balance  ₹140474.93").
class StatTile extends StatelessWidget {
  const StatTile({super.key, required this.data});

  final StatData data;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.statBg,
        borderRadius: BorderRadius.circular(22),
        boxShadow: AppColors.softShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(data.label, style: AppTextStyles.statLabel),
          const SizedBox(height: 10),
          const Spacer(),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            decoration: BoxDecoration(
              color: AppColors.pillBg,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Text(data.value, style: AppTextStyles.statValue),
          ),
        ],
      ),
    );
  }
}

/// One wide stat on top and two side by side below it; a single row of
/// three when there is enough width.
class StatsGroup extends StatelessWidget {
  const StatsGroup({
    super.key,
    required this.primary,
    required this.secondary,
  }) : assert(secondary.length == 2);

  final StatData primary;
  final List<StatData> secondary;

  @override
  Widget build(BuildContext context) {
    const gap = SizedBox(width: 12, height: 12);
    return InsetPanel(
      child: LayoutBuilder(
        builder: (context, constraints) {
          if (constraints.maxWidth >= 640) {
            return IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Expanded(child: StatTile(data: primary)),
                  gap,
                  Expanded(child: StatTile(data: secondary[0])),
                  gap,
                  Expanded(child: StatTile(data: secondary[1])),
                ],
              ),
            );
          }
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              IntrinsicHeight(child: StatTile(data: primary)),
              gap,
              IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Expanded(child: StatTile(data: secondary[0])),
                    gap,
                    Expanded(child: StatTile(data: secondary[1])),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
