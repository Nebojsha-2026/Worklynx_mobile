import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Divider } from '@/components/ui/Divider';
import { useToast } from '@/components/ui/Toast';
import { signOut } from '@/hooks/useAuth';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/lib/theme';
import { roleLabel, roleColor } from '@/lib/theme';
import { fullName } from '@/lib/format';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user, profile, role, organization, orgMember, reset } = useAuthStore();
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(profile?.first_name ?? '');
  const [lastName, setLastName] = useState(profile?.last_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [address, setAddress] = useState(profile?.address ?? '');

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name ?? '');
      setLastName(profile.last_name ?? '');
      setPhone(profile.phone ?? '');
      setAddress(profile.address ?? '');
    }
  }, [profile]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('profiles')
        .update({ first_name: firstName.trim(), last_name: lastName.trim(), phone: phone.trim(), address: address.trim(), updated_at: new Date().toISOString() })
        .eq('id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Profile updated');
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setEditing(false);
      // Refresh auth store profile
      supabase.from('profiles').select('*').eq('id', user!.id).single().then(({ data }) => {
        if (data) useAuthStore.getState().setProfile(data);
      });
    },
    onError: (err: any) => toast.error('Failed to update', err?.message),
  });

  async function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
            reset();
          } catch (err: any) {
            toast.error('Failed to sign out', err?.message);
          }
        },
      },
    ]);
  }

  const name = fullName(profile?.first_name, profile?.last_name);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
        <TouchableOpacity onPress={() => setEditing(!editing)}>
          <Ionicons name={editing ? 'close-outline' : 'create-outline'} size={22} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]} showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <Avatar name={name} url={profile?.avatar_url} size={80} color={roleColor(role)} />
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{name}</Text>
            <Text style={styles.profileEmail}>{user?.email ?? ''}</Text>
            <View style={styles.badgeRow}>
              <Badge label={roleLabel(role)} color={roleColor(role)} />
              {organization && <Badge label={organization.name} color={Colors.textMuted} />}
            </View>
          </View>
        </View>

        {/* Edit / View */}
        {editing ? (
          <Card style={styles.editCard}>
            <Text style={styles.sectionTitle}>Edit Profile</Text>
            <View style={styles.nameRow}>
              <Input label="First name" value={firstName} onChangeText={setFirstName} autoCapitalize="words" containerStyle={styles.halfInput} />
              <Input label="Last name" value={lastName} onChangeText={setLastName} autoCapitalize="words" containerStyle={styles.halfInput} />
            </View>
            <Input label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" leftIcon="call-outline" placeholder="+61 4xx xxx xxx" />
            <Input label="Address" value={address} onChangeText={setAddress} leftIcon="location-outline" placeholder="Your address" />
            <View style={styles.editActions}>
              <Button title="Cancel" variant="secondary" onPress={() => setEditing(false)} style={{ flex: 1 }} />
              <Button title="Save Changes" onPress={() => saveMutation.mutate()} loading={saveMutation.isPending} style={{ flex: 1 }} />
            </View>
          </Card>
        ) : (
          <Card style={styles.detailsCard}>
            <Text style={styles.sectionTitle}>Personal Details</Text>
            <InfoRow icon="mail-outline" label="Email" value={user?.email ?? '—'} />
            <InfoRow icon="call-outline" label="Phone" value={profile?.phone ?? '—'} />
            <InfoRow icon="location-outline" label="Address" value={profile?.address ?? '—'} />
            {orgMember?.position && <InfoRow icon="briefcase-outline" label="Position" value={orgMember.position} />}
            {orgMember?.department && <InfoRow icon="business-outline" label="Department" value={orgMember.department} />}
            {orgMember?.start_date && <InfoRow icon="calendar-outline" label="Start date" value={orgMember.start_date} />}
          </Card>
        )}

        {/* Organisation */}
        {organization && (
          <Card style={styles.orgCard}>
            <Text style={styles.sectionTitle}>Organisation</Text>
            <InfoRow icon="business-outline" label="Name" value={organization.name} />
            {organization.abn && <InfoRow icon="document-text-outline" label="ABN" value={organization.abn} />}
            {organization.phone && <InfoRow icon="call-outline" label="Phone" value={organization.phone} />}
            {organization.address && <InfoRow icon="location-outline" label="Address" value={organization.address} />}
          </Card>
        )}

        {/* Security */}
        <Card style={styles.secCard}>
          <Text style={styles.sectionTitle}>Security</Text>
          <TouchableOpacity style={styles.secRow}>
            <Ionicons name="lock-closed-outline" size={18} color={Colors.textSecondary} />
            <Text style={styles.secLabel}>Change Password</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
          <Divider margin="sm" />
          <TouchableOpacity style={styles.secRow}>
            <Ionicons name="shield-checkmark-outline" size={18} color={Colors.textSecondary} />
            <Text style={styles.secLabel}>Two-Factor Authentication</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        </Card>

        {/* Sign Out */}
        <Button
          title="Sign Out"
          variant="danger"
          icon={<Ionicons name="log-out-outline" size={18} color="#FFF" />}
          onPress={handleSignOut}
          fullWidth
        />

        <Text style={styles.version}>WorkLynx Mobile v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={16} color={Colors.primary} style={styles.infoIcon} />
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  scroll: { flex: 1 },
  content: { padding: Spacing.md, gap: Spacing.md },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.xs },
  profileInfo: { flex: 1, gap: Spacing.xs },
  profileName: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  profileEmail: { fontSize: FontSize.sm, color: Colors.textSecondary },
  badgeRow: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap' },
  editCard: { gap: Spacing.sm },
  sectionTitle: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary, marginBottom: Spacing.xs },
  nameRow: { flexDirection: 'row', gap: Spacing.sm },
  halfInput: { flex: 1 },
  editActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  detailsCard: { gap: Spacing.md },
  orgCard: { gap: Spacing.md },
  secCard: {},
  secRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs },
  secLabel: { flex: 1, fontSize: FontSize.base, color: Colors.textPrimary },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  infoIcon: { marginTop: 3 },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 2 },
  infoValue: { fontSize: FontSize.base, color: Colors.textPrimary },
  version: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.xs },
});
