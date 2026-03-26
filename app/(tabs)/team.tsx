import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
  Modal, ScrollView, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Divider } from '@/components/ui/Divider';
import { useToast } from '@/components/ui/Toast';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/lib/theme';
import { roleLabel, roleColor } from '@/lib/theme';
import { formatDate, fullName } from '@/lib/format';

export default function TeamScreen() {
  const insets = useSafeAreaInsets();
  const { organization, role } = useAuthStore();
  const [search, setSearch] = useState('');
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [showInvite, setShowInvite] = useState(false);

  const canManage = role === 'BO' || role === 'BM';

  // Role filter — mirrors web platform visibility rules
  function rolesForViewer(): string[] {
    if (role === 'BO') return ['EMPLOYEE', 'MANAGER', 'BM', 'BO'];
    if (role === 'BM') return ['EMPLOYEE', 'MANAGER'];
    return ['EMPLOYEE'];
  }

  // Use list_org_members RPC (SECURITY DEFINER — bypasses profiles RLS)
  const { data: members = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['team-members', organization?.id, role],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data, error } = await supabase.rpc('list_org_members', {
        p_org_id: organization.id,
        p_roles: rolesForViewer(),
      });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!organization?.id,
  });

  const filtered = members.filter((m: any) => {
    const name = fullName(m.full_name).toLowerCase();
    const email = (m.email ?? '').toLowerCase();
    const q = search.toLowerCase();
    return !q || name.includes(q) || email.includes(q);
  });

  const renderItem = ({ item }: { item: any }) => (
    <Card style={styles.card} onPress={() => setSelectedMember(item)}>
      <View style={styles.memberRow}>
        <Avatar name={fullName(item.full_name)} url={item.avatar_url} size={44} color={roleColor(item.role)} />
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>{fullName(item.full_name)}</Text>
          <Text style={styles.memberEmail} numberOfLines={1}>{item.email ?? ''}</Text>
          <View style={styles.memberMeta}>
            <Badge label={roleLabel(item.role)} color={roleColor(item.role)} size="sm" />
            {!item.is_active && <Badge label="Inactive" status="REJECTED" size="sm" />}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
      </View>
    </Card>
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Team</Text>
        {canManage && (
          <TouchableOpacity style={styles.inviteBtn} onPress={() => setShowInvite(true)}>
            <Ionicons name="person-add-outline" size={18} color={Colors.primary} />
            <Text style={styles.inviteBtnText}>Invite</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color={Colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name or email..."
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {search !== '' && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <LoadingScreen message="Loading team..." />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.user_id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <EmptyState
              icon="people-outline"
              title={search ? 'No members found' : 'No team members yet'}
              description={search ? 'Try a different search term.' : 'Invite your team to get started.'}
              actionLabel={!search && canManage ? 'Invite Member' : undefined}
              onAction={() => setShowInvite(true)}
            />
          }
        />
      )}

      <Modal
        visible={!!selectedMember}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedMember(null)}
      >
        {selectedMember && (
          <MemberDetailModal
            member={selectedMember}
            orgId={organization?.id ?? ''}
            onClose={() => setSelectedMember(null)}
            canManage={canManage}
          />
        )}
      </Modal>

      <Modal
        visible={showInvite}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowInvite(false)}
      >
        <InviteModal orgId={organization?.id ?? ''} onClose={() => setShowInvite(false)} />
      </Modal>
    </View>
  );
}

// ─── Member Detail Modal ──────────────────────────────────────────────────────

function MemberDetailModal({ member, orgId, onClose, canManage }: any) {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [deactivating, setDeactivating] = useState(false);

  // Fetch extended profile (SECURITY DEFINER RPC — returns full profile data)
  const { data: extProfile, isLoading: loadingProfile } = useQuery({
    queryKey: ['member-profile-extended', orgId, member.user_id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_employee_profile_extended', {
        p_org_id: orgId,
        p_employee_user_id: member.user_id,
      });
      if (error) throw error;
      return data?.[0] ?? null;
    },
    enabled: !!orgId && !!member.user_id,
  });

  async function handleDeactivate() {
    setDeactivating(true);
    try {
      const { error } = await supabase.rpc('deactivate_org_member', {
        p_org_id: orgId,
        p_user_id: member.user_id,
      });
      if (error) throw error;
      toast.success('Member deactivated');
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      onClose();
    } catch (err: any) {
      toast.error('Failed to deactivate', err?.message);
    } finally {
      setDeactivating(false);
    }
  }

  const name = fullName(member.full_name ?? extProfile?.full_name);
  const phone = extProfile?.phone ?? '—';
  const addressParts = [extProfile?.address_suburb, extProfile?.address_state, extProfile?.address_postcode].filter(Boolean);
  const address = addressParts.length ? addressParts.join(', ') : null;

  return (
    <View style={[styles.modal, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.modalHandle} />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Team Member</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Profile header */}
        <View style={styles.profileSection}>
          <Avatar name={name} url={member.avatar_url ?? extProfile?.avatar_url} size={72} color={roleColor(member.role)} />
          <Text style={styles.profileName}>{name}</Text>
          <View style={styles.profileBadges}>
            <Badge label={roleLabel(member.role)} color={roleColor(member.role)} />
            {!member.is_active && <Badge label="Inactive" status="REJECTED" />}
          </View>
        </View>

        <Divider margin="sm" />

        {loadingProfile ? (
          <LoadingScreen message="Loading details..." />
        ) : (
          <View style={styles.detailList}>
            {member.email && <DetailRow icon="mail-outline" label="Email" value={member.email} />}
            {phone !== '—' && <DetailRow icon="call-outline" label="Phone" value={phone} />}
            {extProfile?.dob && <DetailRow icon="gift-outline" label="Date of birth" value={formatDate(extProfile.dob)} />}
            {address && <DetailRow icon="location-outline" label="Location" value={address} />}
            {extProfile?.start_date && <DetailRow icon="calendar-outline" label="Start date" value={formatDate(extProfile.start_date)} />}
            {member.employment_type && <DetailRow icon="briefcase-outline" label="Employment" value={member.employment_type} />}
            {member.payment_frequency && <DetailRow icon="cash-outline" label="Pay frequency" value={member.payment_frequency} />}
            {extProfile?.residency_status && <DetailRow icon="id-card-outline" label="Residency" value={extProfile.residency_status} />}
            {extProfile?.emergency_contact_name && (
              <DetailRow icon="alert-circle-outline" label="Emergency contact" value={`${extProfile.emergency_contact_name} (${extProfile.emergency_contact_relationship ?? ''})`} />
            )}
          </View>
        )}

        {canManage && member.is_active && (
          <Button
            title="Deactivate Member"
            variant="danger"
            onPress={handleDeactivate}
            loading={deactivating}
            fullWidth
            style={{ marginTop: Spacing.md }}
          />
        )}
      </ScrollView>
    </View>
  );
}

// ─── Invite Modal ─────────────────────────────────────────────────────────────

function InviteModal({ orgId, onClose }: { orgId: string; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'EMPLOYEE' | 'MANAGER' | 'BM'>('EMPLOYEE');
  const [loading, setLoading] = useState(false);

  const roles = [
    { value: 'EMPLOYEE' as const, label: 'Employee' },
    { value: 'MANAGER' as const, label: 'Manager' },
    { value: 'BM' as const, label: 'Business Manager' },
  ];

  async function handleInvite() {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Please enter a valid email address');
      return;
    }
    setLoading(true);
    try {
      const expires = new Date();
      expires.setDate(expires.getDate() + 7);
      const token = Math.random().toString(36).substring(2) + Date.now().toString(36);

      // Use the SECURITY DEFINER RPC which handles permissions correctly
      const { error } = await supabase.rpc('create_invite_secure', {
        p_org_id: orgId,
        p_email: email.trim().toLowerCase(),
        p_role: inviteRole,
        p_token: token,
        p_expires_at: expires.toISOString(),
      });
      if (error) throw error;
      toast.success('Invite sent!', `An invitation has been sent to ${email}`);
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      onClose();
    } catch (err: any) {
      toast.error('Failed to send invite', err?.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.modal, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.modalHandle} />
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Invite Team Member</Text>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={24} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <Text style={styles.fieldLabel}>Email address</Text>
      <View style={styles.inputWrap}>
        <Ionicons name="mail-outline" size={16} color={Colors.textMuted} style={styles.inputIcon} />
        <TextInput
          style={styles.textInput}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="member@company.com"
          placeholderTextColor={Colors.textMuted}
        />
      </View>

      <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>Role</Text>
      <View style={styles.roleList}>
        {roles.map((r) => (
          <TouchableOpacity
            key={r.value}
            style={[styles.roleOption, inviteRole === r.value && styles.roleOptionActive]}
            onPress={() => setInviteRole(r.value)}
          >
            <View style={[styles.radioCircle, inviteRole === r.value && styles.radioActive]}>
              {inviteRole === r.value && <View style={styles.radioInner} />}
            </View>
            <Text style={[styles.roleLabelText, inviteRole === r.value && styles.roleLabelActive]}>{r.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Button
        title="Send Invitation"
        onPress={handleInvite}
        loading={loading}
        fullWidth
        size="lg"
        style={{ marginTop: Spacing.xl }}
      />
    </View>
  );
}

function DetailRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={16} color={Colors.primary} />
      <View style={styles.detailContent}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  inviteBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.primaryLight + '30', borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderWidth: 1, borderColor: Colors.primary + '40' },
  inviteBtnText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.medium },
  searchWrap: { flexDirection: 'row', alignItems: 'center', margin: Spacing.md, backgroundColor: Colors.bgInput, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.sm },
  searchIcon: { marginRight: 6 },
  searchInput: { flex: 1, paddingVertical: Spacing.sm, fontSize: FontSize.base, color: Colors.textPrimary },
  list: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xl, gap: Spacing.sm },
  card: {},
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  memberInfo: { flex: 1 },
  memberName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  memberEmail: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 1 },
  memberMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.xs, flexWrap: 'wrap' },
  modal: { flex: 1, backgroundColor: Colors.bgCard, paddingHorizontal: Spacing.md },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.md },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.lg },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  profileSection: { alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  profileName: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  profileBadges: { flexDirection: 'row', gap: Spacing.xs },
  detailList: { gap: Spacing.md, marginBottom: Spacing.lg },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  detailContent: { flex: 1 },
  detailLabel: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 2 },
  detailValue: { fontSize: FontSize.base, color: Colors.textPrimary },
  fieldLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.textSecondary, marginBottom: Spacing.xs },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bgInput, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: Spacing.sm },
  inputIcon: { marginRight: 6 },
  textInput: { flex: 1, paddingVertical: Spacing.sm + 2, fontSize: FontSize.base, color: Colors.textPrimary },
  roleList: { gap: Spacing.sm },
  roleOption: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, backgroundColor: Colors.bgInput, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border },
  roleOptionActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight + '20' },
  radioCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: Colors.primary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
  roleLabelText: { fontSize: FontSize.base, color: Colors.textSecondary },
  roleLabelActive: { color: Colors.textPrimary, fontWeight: FontWeight.medium },
});
