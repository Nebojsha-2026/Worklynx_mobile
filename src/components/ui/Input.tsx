import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, FontSize, Spacing } from '@/lib/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  containerStyle?: ViewStyle;
  isPassword?: boolean;
}

export function Input({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  onRightIconPress,
  containerStyle,
  isPassword = false,
  style,
  ...props
}: InputProps) {
  const [showPassword, setShowPassword] = useState(false);

  const passwordIcon = showPassword ? 'eye-off-outline' : 'eye-outline';

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputWrapper, error ? styles.inputError : undefined]}>
        {leftIcon && (
          <Ionicons
            name={leftIcon}
            size={18}
            color={Colors.textSecondary}
            style={styles.leftIcon}
          />
        )}
        <TextInput
          style={[styles.input, leftIcon ? styles.inputWithLeft : undefined, (rightIcon || isPassword) ? styles.inputWithRight : undefined, style]}
          placeholderTextColor={Colors.textMuted}
          secureTextEntry={isPassword && !showPassword}
          autoCapitalize={isPassword ? 'none' : props.autoCapitalize}
          {...props}
        />
        {isPassword && (
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.rightIcon}
          >
            <Ionicons name={passwordIcon} size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
        {rightIcon && !isPassword && (
          <TouchableOpacity onPress={onRightIconPress} style={styles.rightIcon}>
            <Ionicons name={rightIcon} size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
      {hint && !error && <Text style={styles.hintText}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    fontWeight: '500',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgInput,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  inputError: {
    borderColor: Colors.danger,
  },
  input: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  inputWithLeft: {
    paddingLeft: 4,
  },
  inputWithRight: {
    paddingRight: 4,
  },
  leftIcon: {
    marginLeft: Spacing.sm + 2,
  },
  rightIcon: {
    padding: Spacing.sm + 2,
  },
  errorText: {
    fontSize: FontSize.xs,
    color: Colors.danger,
    marginTop: 4,
  },
  hintText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 4,
  },
});
