import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { StatCard } from '@/components/ui/StatCard';
import { Card } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Colors, FontSize, FontWeight, Spacing } from '@/lib/theme';
import { formatCurrency } from '@/lib/format';

export function BoDashboard() {
  const { organization } = useAuthStore();

  const { data: stats } = useQuery({
    queryKey: ['bo-stats', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return null;
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
      weekStart.setHours(0, 0, 0, 0);
      const weekStartDate = weekStart.toISOString().split('T')[0];

      const [membersRes, earningsRes, pendingRes, invitesRes] = await Promise.all([
        supabase.from('org_members').select('id', { count: 'exact', head: true })
          .eq('organization_id', organization.id)
          .eq('is_active', true),
        supabase.from('earnings').select('minutes_paid, hourly_rate')
          .eq('organization_id', organization.id)
          .gte('earned_at', weekStartDate),
        supabase.from('timesheets').select('id', { count: 'exact', head: true })
          .eq('organization_id', organization.id)
          .eq('status', 'SUBMITTED'),
        supabase.from('invites').select('id', { count: 'exact', head: true })
          .eq('organization_id', organization.id)
          .is('accepted_at', null),
      ]);

      const weeklyWages = (earningsRes.data ?? []).reduce((s, e) => {
        const hrs = (e.minutes_paid ?? 0) / 60;
        return s + hrs * (e.hourly_rate ?? 0);
      }, 0);

      return {
        members: membersRes.count ?? 0,
        weeklyWages,
        pending: pendingRes.count ?? 0,
        pendingInvites: invitesRes.count ?? 0,
      };
    },
    enabled: !!organization?.id,
  });

  const quickActions = [
    { label: 'Manage Team', icon: 'people-outline' as const, route: '/(tabs)/team', color: Colors.primary },
    { label: 'Reports', icon: 'bar-chart-outline' as const, route: '/(tabs)/reports', color: Colors.success },
    { label: 'Billing', icon: 'card-outline' as const, route: '/(tabs)/billing', color: Colors.warning },
    { label: 'Approvals', icon: 'checkmark-circle-outline' as const, route: '/(tabs)/approvals', color: Colors.info },
  ];

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.statsRow}>
        <StatCard label="Active Staff" value={stats?.members ?? 0} icon="people" color={Colors.primary} />
        <StatCard label="Weekly Wages" value={formatCurrency(stats?.weeklyWages ?? 0)} icon="cash" color={Colors.success} />
      </View>
      <View style={styles.statsRow}>
        <StatCard label="Pending Approvals" value={stats?.pending ?? 0} icon="time" color={Colors.warning} />
        <StatCard label="Pending Invites" value={stats?.pendingInvites ?? 0} icon="mail" color={Colors.info} />
      </View>

      <SectionHeader title="Quick Actions" />
      <View style={styles.quickGrid}>
        {quickActions.map((action) => (
          <TouchableOpacity
            key={action.label}
            style={[styles.quickCard, { borderColor: `${action.color}30` }]}
            onPress={() => router.push(action.route as any)}
          >
            <View style={[styles.quickIcon, { backgroundColor: `${action.color}20` }]}>
              <Ionicons name={action.icon} size={24} color={action.color} />
            </View>
            <Text style={styles.quickLabel}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Card style={styles.orgCard}>
        <View style={styles.orgRow}>
          <View style={styles.orgInfo}>
            <Text style={styles.orgName}>{organization?.name}</Text>
            {organization?.currency_code && (
              <Text style={styles.orgMeta}>Currency: {organization.currency_code}</Text>
            )}
          </View>
          <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}>
            <Ionicons name="settings-outline" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: Spacing.md, paddingBottom: Spacing.xl },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  quickCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    padding: Spacing.md,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  quickIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.textPrimary, textAlign: 'center' },
  orgCard: { gap: Spacing.xs },
  orgRow: { flexDirection: 'row', alignItems: 'flex-start' },
  orgInfo: { flex: 1 },
  orgName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  orgMeta: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
});
