import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Colors, FontSize, FontWeight, Spacing } from '@/lib/theme';
import { formatCurrency, formatHours, formatDate, fullName } from '@/lib/format';

type Period = 'week' | 'month' | 'all';

export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const { organization } = useAuthStore();
  const [period, setPeriod] = useState<Period>('month');

  function getDateRange(p: Period) {
    const now = new Date();
    if (p === 'week') {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      return start.toISOString();
    } else if (p === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return start.toISOString();
    }
    return new Date(2020, 0, 1).toISOString();
  }

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['reports', organization?.id, period],
    queryFn: async () => {
      if (!organization?.id) return null;
      const since = getDateRange(period);

      const [timesheetsRes, earningsRes, membersRes, shiftsRes] = await Promise.all([
        supabase.from('timesheets').select('*').eq('organization_id', organization.id).gte('created_at', since),
        supabase.from('earnings').select('*, profiles(first_name, last_name)').eq('organization_id', organization.id).gte('created_at', since),
        supabase.from('org_members').select('id', { count: 'exact', head: true }).eq('organization_id', organization.id).eq('status', 'active'),
        supabase.from('shifts').select('id', { count: 'exact', head: true }).eq('organization_id', organization.id).gte('start_time', since),
      ]);

      const timesheets = timesheetsRes.data ?? [];
      const earnings = earningsRes.data ?? [];

      const approved = timesheets.filter((t) => t.status === 'approved').length;
      const pending = timesheets.filter((t) => t.status === 'submitted').length;
      const totalHours = timesheets.reduce((s, t) => s + (t.total_hours ?? 0), 0);
      const totalWages = earnings.reduce((s, e) => s + (e.amount ?? 0), 0);

      // Top earners
      const byEmployee: Record<string, { name: string; amount: number; hours: number }> = {};
      for (const e of earnings) {
        const userId = (e as any).user_id;
        const name = fullName((e as any).profiles?.first_name, (e as any).profiles?.last_name);
        if (!byEmployee[userId]) byEmployee[userId] = { name, amount: 0, hours: 0 };
        byEmployee[userId].amount += e.amount ?? 0;
        byEmployee[userId].hours += e.hours ?? 0;
      }
      const topEarners = Object.entries(byEmployee)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => b.hours - a.hours)
        .slice(0, 10);

      return {
        totalTimesheets: timesheets.length,
        approved,
        pending,
        totalHours,
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
        {/* Period selector */}
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
              <StatCard label="Total Hours" value={formatHours(data.totalHours)} icon="time" color={Colors.primary} />
              <StatCard label="Wages Paid" value={formatCurrency(data.totalWages)} icon="cash" color={Colors.success} />
            </View>
            <View style={styles.statsRow}>
              <StatCard label="Timesheets" value={data.totalTimesheets} icon="document-text" color={Colors.info} subtitle={`${data.approved} approved · ${data.pending} pending`} />
              <StatCard label="Shifts" value={data.totalShifts} icon="calendar" color={Colors.warning} />
            </View>

            {/* Timesheet breakdown */}
            <Card style={styles.breakdownCard}>
              <Text style={styles.breakdownTitle}>Timesheet Status</Text>
              <View style={styles.breakdownGrid}>
                <BreakdownItem label="Approved" value={data.approved} total={data.totalTimesheets} color={Colors.success} />
                <BreakdownItem label="Pending" value={data.pending} total={data.totalTimesheets} color={Colors.warning} />
                <BreakdownItem label="Other" value={data.totalTimesheets - data.approved - data.pending} total={data.totalTimesheets} color={Colors.textMuted} />
              </View>
            </Card>

            {/* Top earners */}
            {data.topEarners.length > 0 && (
              <>
                <SectionHeader title="Hours by Staff" />
                {data.topEarners.map((emp) => (
                  <Card key={emp.id} style={styles.earnerCard}>
                    <View style={styles.earnerRow}>
                      <Avatar name={emp.name} size={36} color={Colors.primary} />
                      <View style={styles.earnerInfo}>
                        <Text style={styles.earnerName}>{emp.name}</Text>
                        <Text style={styles.earnerHours}>{formatHours(emp.hours)}</Text>
                      </View>
                      <Text style={styles.earnerAmount}>{formatCurrency(emp.amount)}</Text>
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
