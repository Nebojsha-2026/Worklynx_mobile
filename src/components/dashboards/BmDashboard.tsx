import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { StatCard } from '@/components/ui/StatCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Colors, FontSize, FontWeight, Spacing } from '@/lib/theme';
import { formatDate, fullName } from '@/lib/format';

export function BmDashboard() {
  const { organization } = useAuthStore();

  const { data: stats } = useQuery({
    queryKey: ['bm-stats', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return null;
      const today = new Date().toISOString().split('T')[0];
      const [membersRes, pendingRes, shiftsRes] = await Promise.all([
        supabase.from('org_members').select('id', { count: 'exact', head: true })
          .eq('organization_id', organization.id)
          .eq('is_active', true),
        supabase.from('timesheets').select('id', { count: 'exact', head: true })
          .eq('organization_id', organization.id)
          .eq('status', 'SUBMITTED'),
        supabase.from('shifts').select('id', { count: 'exact', head: true })
          .eq('organization_id', organization.id)
          .eq('status', 'ACTIVE')
          .gte('shift_date', today),
      ]);
      return { members: membersRes.count ?? 0, pending: pendingRes.count ?? 0, shifts: shiftsRes.count ?? 0 };
    },
    enabled: !!organization?.id,
  });

  const { data: recentTimesheets = [] } = useQuery({
    queryKey: ['bm-recent-timesheets', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data } = await supabase
        .from('timesheets')
        .select('*, shifts(title, shift_date)')
        .eq('organization_id', organization.id)
        .in('status', ['SUBMITTED', 'APPROVED', 'REJECTED'])
        .order('updated_at', { ascending: false })
        .limit(8);
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

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.statsRow}>
        <StatCard label="Active Staff" value={stats?.members ?? 0} icon="people" color={Colors.primary} />
        <StatCard label="Pending" value={stats?.pending ?? 0} icon="time" color={Colors.warning} />
        <StatCard label="Upcoming Shifts" value={stats?.shifts ?? 0} icon="calendar" color={Colors.success} />
      </View>

      <SectionHeader title="Recent Timesheets" action="View all" onAction={() => router.push('/(tabs)/approvals')} />
      {recentTimesheets.map((ts: any) => (
        <Card key={ts.id} style={styles.card} onPress={() => router.push('/(tabs)/approvals')}>
          <View style={styles.row}>
            <Avatar name={fullName(ts.profile?.full_name)} url={ts.profile?.avatar_url} size={36} color={Colors.roleBM} />
            <View style={styles.info}>
              <Text style={styles.name}>{fullName(ts.profile?.full_name)}</Text>
              <Text style={styles.date}>
                {ts.shifts?.title ?? 'Manual entry'}
                {ts.shifts?.shift_date ? ` · ${formatDate(ts.shifts.shift_date, 'EEE dd MMM')}` : ''}
              </Text>
            </View>
            <Badge label={ts.status} status={ts.status} size="sm" />
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: Spacing.md, paddingBottom: Spacing.xl },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  card: { marginBottom: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  info: { flex: 1 },
  name: { fontSize: FontSize.base, fontWeight: FontWeight.medium, color: Colors.textPrimary },
  date: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
});
