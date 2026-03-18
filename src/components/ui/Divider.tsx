import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors, Spacing } from '@/lib/theme';

export function Divider({ margin = 'md' }: { margin?: 'sm' | 'md' | 'lg' | 'none' }) {
  return <View style={[styles.divider, margin !== 'none' && styles[`margin_${margin}`]]} />;
}

const styles = StyleSheet.create({
  divider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  margin_sm: { marginVertical: Spacing.sm },
  margin_md: { marginVertical: Spacing.md },
  margin_lg: { marginVertical: Spacing.lg },
});
