import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Colors, Radius, FontSize, FontWeight } from '@/lib/theme';

interface AvatarProps {
  name?: string | null;
  url?: string | null;
  size?: number;
  color?: string;
}

export function Avatar({ name, url, size = 40, color = Colors.primary }: AvatarProps) {
  const initials = name
    ? name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  const fontSize = size * 0.38;

  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
      />
    );
  }

  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: `${color}30`,
          borderColor: `${color}60`,
        },
      ]}
    >
      <Text style={[styles.initials, { fontSize, color }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  initials: {
    fontWeight: FontWeight.semibold,
  },
});
