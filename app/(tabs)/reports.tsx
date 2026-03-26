import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Avatar } from '@/components/ui/Avatar';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/lib/theme';
import { formatCurrency, formatHours } from '@/lib/format';
import { fullName } from '@/lib/format';

type Period = 'week' | 'month' | 'all';

export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const { organization } = useAuthStore();
  const [period, setPeriod] = useState<Period>('month');

  function getDateRange(p: Period): string {
    const now = new Date();
    if (p === 'week') {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      return start.toISOString();
    } else if (p === 'month') {
      return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    }
    return new Date(2020, 0, 1).toISOString();
  }

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['reports', organization?.id, period],
    queryFn: async () => {
      if (!organization?.id) return null;
      const since = getDateRange(period);

      const [timesheetsRes, earningsRes, membersRes, shiftsRes] = await Promise.all([
        supabase.from('timesheets').select('id, status').eq('organization_id', organization.id).gte('created_at', since),
        supabase.from('earnings').select('employee_user_id, minutes_worked, minutes_paid, hourly_rate').eq('organization_id', organization.id).gte('earned_at', since),
        supabase.from('org_members').select('id', { count: 'exact', head: true }).eq('organization_id', organization.id).eq('is_active', true),
        supabase.from('shifts').select('id', { count: 'exact', head: true }).eq('organization_id', organization.id).gte('shift_date', since.split('T')[0]),
      ]);

      const timesheets = timesheetsRes.data ?? [];
      const earnings = earningsRes.data ?? [];

      const approved = timesheets.filter((t) => t.status === 'APPROVED').length;
      const pending = timesheets.filter((t) => t.status === 'SUBMITTED').length;
      const totalMinutes = earnings.reduce((s, e) => s + (e.minutes_worked ?? 0), 0);
      const totalWages = earnings.reduce((s, e) => {
        const hrs = (e.minutes_paid ?? 0) / 60;
        return s + hrs * (e.hourly_rate ?? 0);
      }, 0);

      // Top earners by minutes worked
      const byEmployee: Record<string, { minutes: number; wages: number }> = {};
      for (const e of earnings) {
        const uid = e.employee_user_id;
        if (!uid) continue;
        if (!byEmployee[uid]) byEmployee[uid] = { minutes: 0, wages: 0 };
        byEmployee[uid].minutes += e.minutes_worked ?? 0;
        const hrs = (e.minutes_paid ?? 0) / 60;
        byEmployee[uid].wages += hrs * (e.hourly_rate ?? 0);
      }

      // Fetch member names using SECURITY DEFINER RPC (bypasses RLS)
      const topIds = Object.entries(byEmployee)
        .sort((a, b) => b[1].minutes - a[1].minutes)
        .slice(0, 10)
        .map(([id]) => id);

      const { data: membersData } = await supabase.rpc('list_org_members', {
        p_org_id: organization.id,
        p_roles: ['EMPLOYEE', 'MANAGER', 'BM', 'BO'],
      });
      const profileMap = Object.fromEntries(
        (membersData ?? []).map((m: any) => [m.user_id, m.full_name])
      );

      const topEarners = topIds.map((id) => ({
        id,
        name: fullName(profileMap[id]),
        minutes: byEmployee[id].minutes,
        wages: byEmployee[id].wages,
      }));

      return {
        totalTimesheets: timesheets.length,
        approved,
        pending,
        totalMinutes,
        totalWages,
        activeMembers: membersRes.count ?? 0,
        totalShifts: shiftsRes.count ?? 0,
        topEarners,
      };
    },
    enabled: !!organization?.id,
  });

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Reports</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
      >
        <View style={styles.periodRow}>
          {(['week', 'month', 'all'] as Period[]).map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.periodTab, period === p && styles.periodTabActive]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[styles.periodText, period === p && styles.periodTextActive]}>
                {p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : 'All Time'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {isLoading ? (
          <LoadingScreen message="Loading reports..." />
        ) : data ? (
          <>
            <View style={styles.statsRow}>
              <StatCard label="Total Hours" value={formatHours(data.totalMinutes)} icon="time" color={Colors.primary} />
              <StatCard label="Wages Paid" value={formatCurrency(data.totalWages)} icon="cash" color={Colors.success} />
            </View>
            <View style={styles.statsRow}>
              <StatCard label="Timesheets" value={data.totalTimesheets} icon="document-text" color={Colors.info} subtitle={`${data.approved} approved · ${data.pending} pending`} />
              <StatCard label="Shifts" value={data.totalShifts} icon="calendar" color={Colors.warning} />
            </View>

            <Card style={styles.breakdownCard}>
              <Text style={styles.breakdownTitle}>Timesheet Status</Text>
              <View style={styles.breakdownGrid}>
                <BreakdownItem label="Approved" value={data.approved} total={data.totalTimesheets} color={Colors.success} />
                <BreakdownItem label="Pending" value={data.pending} total={data.totalTimesheets} color={Colors.warning} />
                <BreakdownItem label="Other" value={data.totalTimesheets - data.approved - data.pending} total={data.totalTimesheets} color={Colors.textMuted} />
              </View>
            </Card>

            {data.topEarners.length > 0 && (
              <>
                <SectionHeader title="Hours by Staff" />
                {data.topEarners.map((emp) => (
                  <Card key={emp.id} style={styles.earnerCard}>
                    <View style={styles.earnerRow}>
                      <Avatar name={emp.name} size={36} color={Colors.primary} />
                      <View style={styles.earnerInfo}>
                        <Text style={styles.earnerName}>{emp.name}</Text>
                        <Text style={styles.earnerHours}>{formatHours(emp.minutes)}</Text>
                      </View>
                      <Text style={styles.earnerAmount}>{formatCurrency(emp.wages)}</Text>
                    </View>
                  </Card>
                ))}
              </>
            )}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function BreakdownItem({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <View style={styles.bItem}>
      <Text style={[styles.bValue, { color }]}>{value}</Text>
      <Text style={styles.bLabel}>{label}</Text>
      <Text style={styles.bPct}>{pct}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  header: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  scroll: { flex: 1 },
  content: { padding: Spacing.md, paddingBottom: Spacing.xl, gap: Spacing.sm },
  periodRow: { flexDirection: 'row', backgroundColor: Colors.bgCard, borderRadius: 10, padding: 3, gap: 2, marginBottom: Spacing.xs },
  periodTab: { flex: 1, paddingVertical: Spacing.xs, borderRadius: 8, alignItems: 'center' },
  periodTabActive: { backgroundColor: Colors.primary },
  periodText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  periodTextActive: { color: '#FFF' },
  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  breakdownCard: { gap: Spacing.md },
  breakdownTitle: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  breakdownGrid: { flexDirection: 'row', justifyContent: 'space-around' },
  bItem: { alignItems: 'center', gap: 2 },
  bValue: { fontSize: FontSize['2xl'], fontWeight: FontWeight.bold },
  bLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },
  bPct: { fontSize: FontSize.xs, color: Colors.textMuted },
  earnerCard: { marginBottom: 0 },
  earnerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  earnerInfo: { flex: 1 },
  earnerName: { fontSize: FontSize.base, fontWeight: FontWeight.medium, color: Colors.textPrimary },
  earnerHours: { fontSize: FontSize.sm, color: Colors.textSecondary },
  earnerAmount: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.success },
});
