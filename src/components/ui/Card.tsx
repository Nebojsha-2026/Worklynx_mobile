import React from 'react';
import { View, StyleSheet, ViewStyle, TouchableOpacity } from 'react-native';
import { Colors, Radius, Spacing } from '@/lib/theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({ children, style, onPress, padding = 'md' }: CardProps) {
  const content = (
    <View style={[styles.card, styles[`padding_${padding}`], style]}>
      {children}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  padding_none: { padding: 0 },
  padding_sm: { padding: Spacing.sm },
  padding_md: { padding: Spacing.md },
  padding_lg: { padding: Spacing.lg },
});
