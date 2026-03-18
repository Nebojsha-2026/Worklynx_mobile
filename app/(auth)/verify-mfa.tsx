import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/lib/theme';

export default function VerifyMfaScreen() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);

  useEffect(() => {
    loadFactors();
  }, []);

  async function loadFactors() {
    const { data } = await supabase.auth.mfa.listFactors();
    const totpFactor = data?.totp?.[0];
    if (totpFactor) setFactorId(totpFactor.id);
  }

  async function handleVerify() {
    if (!factorId || code.length !== 6) return;
    setLoading(true);
    try {
      const { data: challenge } = await supabase.auth.mfa.challenge({ factorId });
      if (!challenge) throw new Error('Could not create challenge');
      const { error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
      });
      if (error) throw error;
      router.replace('/(tabs)/dashboard');
    } catch (err: any) {
      toast.error('Verification failed', 'Invalid or expired code. Please try again.');
      setCode('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing.lg }]}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Ionicons name="arrow-back" size={20} color={Colors.primary} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="shield-checkmark-outline" size={44} color={Colors.primary} />
        </View>
        <Text style={styles.heading}>Two-factor authentication</Text>
        <Text style={styles.description}>
          Enter the 6-digit code from your authenticator app to continue.
        </Text>

        <TextInput
          style={styles.codeInput}
          value={code}
          onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          maxLength={6}
          placeholder="000000"
          placeholderTextColor={Colors.textMuted}
          textAlign="center"
          autoFocus
        />

        <Button
          title="Verify"
          onPress={handleVerify}
          loading={loading}
          disabled={code.length !== 6}
          fullWidth
          size="lg"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg, paddingHorizontal: Spacing.lg },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.xl },
  backText: { fontSize: FontSize.base, color: Colors.primary, fontWeight: FontWeight.medium },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  heading: { fontSize: FontSize['2xl'], fontWeight: FontWeight.bold, color: Colors.textPrimary, textAlign: 'center' },
  description: { fontSize: FontSize.base, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  codeInput: {
    width: '100%',
    height: 64,
    backgroundColor: Colors.bgInput,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    fontSize: 32,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    letterSpacing: 12,
    marginVertical: Spacing.md,
  },
});
