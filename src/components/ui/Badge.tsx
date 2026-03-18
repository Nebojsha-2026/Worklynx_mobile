import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Radius, FontSize, Spacing } from '@/lib/theme';
import { statusColor } from '@/lib/theme';

interface BadgeProps {
  label: string;
  color?: string;
  status?: string;
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

export function Badge({ label, color, status, size = 'md', style }: BadgeProps) {
  const resolvedColor = color ?? (status ? statusColor(status) : Colors.textMuted);

  return (
    <View style={[styles.badge, { backgroundColor: `${resolvedColor}20`, borderColor: `${resolvedColor}40` }, size === 'sm' ? styles.sm : styles.md, style]}>
      <View style={[styles.dot, { backgroundColor: resolvedColor }]} />
      <Text style={[styles.label, { color: resolvedColor }, size === 'sm' ? styles.labelSm : styles.labelMd]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  sm: {
    paddingHorizontal: Spacing.xs + 2,
    paddingVertical: 2,
    gap: 4,
  },
  md: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    gap: 5,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  label: {
    fontWeight: '600',
  },
  labelSm: { fontSize: FontSize.xs },
  labelMd: { fontSize: FontSize.sm },
});
