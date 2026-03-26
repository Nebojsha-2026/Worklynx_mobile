import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { StatCard } from '@/components/ui/StatCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Colors, FontSize, FontWeight, Spacing } from '@/lib/theme';
import { formatDate, formatTime, fullName } from '@/lib/format';

export function ManagerDashboard() {
  const { organization } = useAuthStore();

  const { data: stats } = useQuery({
    queryKey: ['manager-stats', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return null;
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

      const [shiftsRes, membersRes, timesheetsRes] = await Promise.all([
        supabase.from('shifts').select('id', { count: 'exact', head: true })
          .eq('organization_id', organization.id)
          .gte('shift_date', today)
          .lt('shift_date', tomorrow)
          .eq('status', 'ACTIVE'),
        supabase.from('org_members').select('id', { count: 'exact', head: true })
          .eq('organization_id', organization.id)
          .eq('is_active', true),
        supabase.from('timesheets').select('id', { count: 'exact', head: true })
          .eq('organization_id', organization.id)
          .eq('status', 'SUBMITTED'),
      ]);

      return {
        todayShifts: shiftsRes.count ?? 0,
        activeMembers: membersRes.count ?? 0,
        pendingApprovals: timesheetsRes.count ?? 0,
      };
    },
    enabled: !!organization?.id,
  });

  const { data: pendingTimesheets = [] } = useQuery({
    queryKey: ['manager-pending-timesheets', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data } = await supabase
        .from('timesheets')
        .select('*, shifts(title, shift_date)')
        .eq('organization_id', organization.id)
        .eq('status', 'SUBMITTED')
        .order('created_at', { ascending: true })
        .limit(5);
      if (!data || data.length === 0) return [];

      const { data: membersData } = await supabase.rpc('list_org_members', {
        p_org_id: organization.id,
        p_roles: ['EMPLOYEE', 'MANAGER', 'BM', 'BO'],
      });
      const profileMap = Object.fromEntries(
        (membersData ?? []).map((m: any) => [m.user_id, { user_id: m.user_id, full_name: m.full_name, avatar_url: m.avatar_url }])
      );

      return data.map((ts) => ({ ...ts, profile: profileMap[ts.employee_user_id] ?? null }));
    },
    enabled: !!organization?.id,
  });

  const { data: todayShifts = [] } = useQuery({
    queryKey: ['manager-today-shifts', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      const { data } = await supabase
        .from('shifts')
        .select('*, locations(name), shift_assignments(id)')
        .eq('organization_id', organization.id)
        .in('status', ['ACTIVE', 'OFFERED'])
        .gte('shift_date', today)
        .lt('shift_date', tomorrow)
        .order('start_at')
        .limit(5);
      return data ?? [];
    },
    enabled: !!organization?.id,
  });

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.statsRow}>
        <StatCard label="Today's Shifts" value={stats?.todayShifts ?? 0} icon="calendar" color={Colors.primary} />
        <StatCard label="Active Staff" value={stats?.activeMembers ?? 0} icon="people" color={Colors.success} />
        <StatCard label="Need Approval" value={stats?.pendingApprovals ?? 0} icon="time" color={Colors.warning} />
      </View>

      {(stats?.pendingApprovals ?? 0) > 0 && (
        <TouchableOpacity style={styles.alertBanner} onPress={() => router.push('/(tabs)/approvals')}>
          <Ionicons name="alert-circle" size={18} color={Colors.warning} />
          <Text style={styles.alertText}>{stats?.pendingApprovals} timesheet{(stats?.pendingApprovals ?? 0) > 1 ? 's' : ''} awaiting approval</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
        </TouchableOpacity>
      )}

      <SectionHeader title="Today's Shifts" action="View all" onAction={() => router.push('/(tabs)/shifts')} />
      {todayShifts.length === 0 ? (
        <Card padding="md">
          <Text style={styles.emptyText}>No shifts scheduled today</Text>
        </Card>
      ) : (
        todayShifts.map((shift: any) => (
          <Card key={shift.id} style={styles.card} onPress={() => router.push('/(tabs)/shifts')}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle} numberOfLines={1}>{shift.title}</Text>
              <Badge label={shift.status} status={shift.status} size="sm" />
            </View>
            <View style={styles.metaRow}>
              <Ionicons name="time-outline" size={13} color={Colors.textMuted} />
              <Text style={styles.metaText}>{formatTime(shift.start_at)} – {formatTime(shift.end_at)}</Text>
              {shift.locations?.name && (
                <>
                  <Text style={styles.metaDot}>·</Text>
                  <Ionicons name="location-outline" size={13} color={Colors.textMuted} />
                  <Text style={styles.metaText} numberOfLines={1}>{shift.locations.name}</Text>
                </>
              )}
            </View>
            <View style={styles.staffRow}>
              <Text style={styles.staffCount}>{shift.shift_assignments?.length ?? 0} staff assigned</Text>
            </View>
          </Card>
        ))
      )}

      <SectionHeader title="Pending Approvals" action="View all" onAction={() => router.push('/(tabs)/approvals')} />
      {pendingTimesheets.length === 0 ? (
        <Card padding="md">
          <Text style={styles.emptyText}>No timesheets awaiting approval</Text>
        </Card>
      ) : (
        pendingTimesheets.map((ts: any) => (
          <Card key={ts.id} style={styles.card} onPress={() => router.push('/(tabs)/approvals')}>
            <View style={styles.cardHeader}>
              <Avatar name={fullName(ts.profile?.full_name)} url={ts.profile?.avatar_url} size={32} color={Colors.primary} />
              <View style={styles.cardInfo}>
                <Text style={styles.cardTitle}>{fullName(ts.profile?.full_name)}</Text>
                <Text style={styles.metaText}>
                  {ts.shifts?.title ?? 'Manual entry'}
                  {ts.shifts?.shift_date ? ` · ${formatDate(ts.shifts.shift_date, 'dd MMM')}` : ''}
                </Text>
              </View>
              <Badge label="Pending" status="SUBMITTED" size="sm" />
            </View>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: Spacing.md, paddingBottom: Spacing.xl },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xs },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: `${Colors.warning}15`,
    borderRadius: 10,
    padding: Spacing.sm + 2,
    borderWidth: 1,
    borderColor: `${Colors.warning}30`,
    marginBottom: Spacing.xs,
  },
  alertText: { flex: 1, fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.medium },
  card: { marginBottom: Spacing.sm, gap: Spacing.xs },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  cardInfo: { flex: 1 },
  cardTitle: { flex: 1, fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  metaDot: { color: Colors.textMuted, marginHorizontal: 2 },
  staffCount: { fontSize: FontSize.sm, color: Colors.textMuted },
  staffRow: { marginTop: 2 },
  emptyText: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', paddingVertical: Spacing.sm },
});
