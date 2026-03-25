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
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { signUp } from '@/hooks/useAuth';
import { Colors, FontSize, FontWeight, Spacing } from '@/lib/theme';

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const errs: Record<string, string> = {};
    if (!firstName.trim()) errs.firstName = 'First name is required';
    if (!lastName.trim()) errs.lastName = 'Last name is required';
    if (!email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Enter a valid email';
    if (!password) errs.password = 'Password is required';
    else if (password.length < 8) errs.password = 'Password must be at least 8 characters';
    if (password !== confirmPassword) errs.confirmPassword = 'Passwords do not match';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleRegister() {
    if (!validate()) return;
    setLoading(true);
    try {
      const { user } = await signUp(email.trim().toLowerCase(), password, firstName.trim(), lastName.trim());
      if (user) {
        toast.success('Account created!', 'Please check your email to verify your account.');
        router.replace('/(auth)/login');
      }
    } catch (err: any) {
      toast.error('Registration failed', err?.message ?? 'Please try again');
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
        contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing.xl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.logoWrap}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.logoText}>WorkLynx</Text>
        </View>

        <Text style={styles.heading}>Create account</Text>
        <Text style={styles.subheading}>Join your team on WorkLynx</Text>

        <View style={styles.row}>
          <Input
            label="First name"
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
            leftIcon="person-outline"
            error={errors.firstName}
            placeholder="John"
            containerStyle={styles.halfInput}
          />
          <Input
            label="Last name"
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
            leftIcon="person-outline"
            error={errors.lastName}
            placeholder="Smith"
            containerStyle={styles.halfInput}
          />
        </View>

        <Input
          label="Email address"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
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
          leftIcon="lock-closed-outline"
          error={errors.password}
          placeholder="At least 8 characters"
          hint="Minimum 8 characters"
        />

        <Input
          label="Confirm password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          isPassword
          leftIcon="lock-closed-outline"
          error={errors.confirmPassword}
          placeholder="Repeat your password"
        />

        <Button
          title="Create account"
          onPress={handleRegister}
          loading={loading}
          fullWidth
          size="lg"
          style={styles.registerBtn}
        />

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
            <Text style={styles.footerLink}> Sign in</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingHorizontal: Spacing.lg },
  backBtn: { marginBottom: Spacing.lg },
  backText: { color: Colors.primary, fontSize: FontSize.base, fontWeight: FontWeight.medium },
  logoWrap: { alignItems: 'center', marginBottom: Spacing.lg },
  logoImage: {
    width: 64,
    height: 64,
    borderRadius: 16,
    marginBottom: Spacing.xs,
  },
  logoText: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  heading: { fontSize: FontSize['2xl'], fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: 4 },
  subheading: { fontSize: FontSize.base, color: Colors.textSecondary, marginBottom: Spacing.lg },
  row: { flexDirection: 'row', gap: Spacing.sm },
  halfInput: { flex: 1 },
  registerBtn: { marginTop: Spacing.xs },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.xl },
  footerText: { fontSize: FontSize.base, color: Colors.textSecondary },
  footerLink: { fontSize: FontSize.base, color: Colors.primary, fontWeight: FontWeight.semibold },
});
