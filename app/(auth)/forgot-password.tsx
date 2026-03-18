import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { resetPassword } from '@/hooks/useAuth';
import { Colors, FontSize, FontWeight, Spacing } from '@/lib/theme';

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleReset() {
    if (!email.trim()) { setError('Email is required'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Enter a valid email'); return; }
    setError('');
    setLoading(true);
    try {
      await resetPassword(email.trim().toLowerCase());
      setSent(true);
    } catch (err: any) {
      toast.error('Failed to send reset email', err?.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.screen, { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing.lg }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={Colors.primary} />
          <Text style={styles.backText}>Back to sign in</Text>
        </TouchableOpacity>

        {sent ? (
          <View style={styles.successWrap}>
            <View style={styles.successIcon}>
              <Ionicons name="mail-open-outline" size={48} color={Colors.success} />
            </View>
            <Text style={styles.heading}>Check your email</Text>
            <Text style={styles.description}>
              We've sent a password reset link to{'\n'}
              <Text style={styles.emailText}>{email}</Text>
            </Text>
            <Button title="Back to sign in" onPress={() => router.replace('/(auth)/login')} fullWidth style={styles.btn} />
          </View>
        ) : (
          <View style={styles.formWrap}>
            <View style={styles.iconWrap}>
              <Ionicons name="lock-open-outline" size={40} color={Colors.primary} />
            </View>
            <Text style={styles.heading}>Forgot password?</Text>
            <Text style={styles.description}>
              Enter your email address and we'll send you a link to reset your password.
            </Text>
            <Input
              label="Email address"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              leftIcon="mail-outline"
              error={error}
              placeholder="you@company.com"
            />
            <Button title="Send reset link" onPress={handleReset} loading={loading} fullWidth size="lg" />
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: Colors.bg, paddingHorizontal: Spacing.lg },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.xl },
  backText: { fontSize: FontSize.base, color: Colors.primary, fontWeight: FontWeight.medium },
  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  successIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  formWrap: { gap: Spacing.sm },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  heading: { fontSize: FontSize['2xl'], fontWeight: FontWeight.bold, color: Colors.textPrimary },
  description: { fontSize: FontSize.base, color: Colors.textSecondary, lineHeight: 22, marginBottom: Spacing.md },
  emailText: { color: Colors.textPrimary, fontWeight: FontWeight.semibold },
  btn: { marginTop: Spacing.md },
});
