import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  TouchableOpacity,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { signIn } from '@/hooks/useAuth';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/lib/theme';
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  function validate() {
    const errs: typeof errors = {};
    if (!email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Enter a valid email';
    if (!password) errs.password = 'Password is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleLogin() {
    if (!validate()) return;
    setLoading(true);
    try {
      await signIn(email.trim().toLowerCase(), password);
      // Auth listener in _layout.tsx will handle redirect
    } catch (err: any) {
      // Check for MFA required
      if (err?.message?.includes('mfa') || err?.message?.includes('factor')) {
        router.push('/(auth)/verify-mfa');
      } else {
        toast.error('Login failed', err?.message ?? 'Check your credentials and try again');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.logoWrap}>
          <View style={styles.logoMark}>
            <Text style={styles.logoLetter}>W</Text>
          </View>
          <Text style={styles.logoText}>WorkLynx</Text>
          <Text style={styles.tagline}>Timesheet & Workforce Management</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.heading}>Welcome back</Text>
          <Text style={styles.subheading}>Sign in to your account</Text>

          <Input
            label="Email address"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            leftIcon="mail-outline"
            error={errors.email}
            placeholder="you@company.com"
          />

          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            isPassword
            autoComplete="current-password"
            leftIcon="lock-closed-outline"
            error={errors.password}
            placeholder="Your password"
          />

          <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')} style={styles.forgotWrap}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          <Button
            title="Sign in"
            onPress={handleLogin}
            loading={loading}
            fullWidth
            size="lg"
            style={styles.signInBtn}
          />
        </View>

        {/* Register link */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account?</Text>
          <Link href="/(auth)/register" asChild>
            <TouchableOpacity>
              <Text style={styles.footerLink}> Create one</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: Spacing.xl + 8,
  },
  logoMark: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  logoLetter: {
    fontSize: 36,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
  },
  logoText: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  tagline: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: 4,
  },
  form: {
    gap: 0,
  },
  heading: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  subheading: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
  },
  forgotWrap: {
    alignSelf: 'flex-end',
    marginBottom: Spacing.md,
    marginTop: -Spacing.xs,
  },
  forgotText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: FontWeight.medium,
  },
  signInBtn: {
    marginTop: Spacing.xs,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.xl,
  },
  footerText: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
  },
  footerLink: {
    fontSize: FontSize.base,
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },
});
