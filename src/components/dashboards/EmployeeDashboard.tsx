import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Colors, FontSize, FontWeight, Spacing } from '@/lib/theme';
import { formatDate, formatTime } from '@/lib/format';

export function EmployeeDashboard() {
  const { user, organization } = useAuthStore();

  // Today's shifts
  const { data: todayShifts = [] } = useQuery({
    queryKey: ['employee-today-shifts', user?.id, organization?.id],
    queryFn: async () => {
      if (!user?.id || !organization?.id) return [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const { data } = await supabase
        .from('shift_assignments')
        .select('*, shifts(*, locations(name, address))')
        .eq('user_id', user.id)
        .eq('organization_id', organization.id)
        .gte('shifts.start_time', today.toISOString())
        .lt('shifts.start_time', tomorrow.toISOString())
        .order('shifts(start_time)', { ascending: true });
      return data ?? [];
    },
    enabled: !!user?.id && !!organization?.id,
  });

  // Upcoming shifts (next 7 days, after today)
  const { data: upcomingShifts = [] } = useQuery({
    queryKey: ['employee-upcoming-shifts', user?.id, organization?.id],
    queryFn: async () => {
      if (!user?.id || !organization?.id) return [];
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const nextWeek = new Date(tomorrow);
      nextWeek.setDate(nextWeek.getDate() + 6);
      const { data } = await supabase
        .from('shift_assignments')
        .select('*, shifts(*, locations(name, address))')
        .eq('user_id', user.id)
        .eq('organization_id', organization.id)
        .in('status', ['assigned', 'confirmed'])
        .gte('shifts.start_time', tomorrow.toISOString())
        .lte('shifts.start_time', nextWeek.toISOString())
        .order('shifts(start_time)', { ascending: true })
        .limit(5);
      return data ?? [];
    },
    enabled: !!user?.id && !!organization?.id,
  });

  // Earnings — this week (Mon to today)
  const { data: weekEarnings = 0 } = useQuery({
    queryKey: ['employee-week-earnings', user?.id, organization?.id],
    queryFn: async () => {
      if (!user?.id || !organization?.id) return 0;
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
      weekStart.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from('earnings')
        .select('amount')
        .eq('user_id', user.id)
        .eq('organization_id', organization.id)
        .gte('created_at', weekStart.toISOString());
      return (data ?? []).reduce((s: number, e: any) => s + (e.amount ?? 0), 0);
    },
    enabled: !!user?.id && !!organization?.id,
  });

  // Earnings — this month
  const { data: monthEarnings = 0 } = useQuery({
    queryKey: ['employee-month-earnings', user?.id, organization?.id],
    queryFn: async () => {
      if (!user?.id || !organization?.id) return 0;
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from('earnings')
        .select('amount')
        .eq('user_id', user.id)
        .eq('organization_id', organization.id)
        .gte('created_at', monthStart.toISOString());
      return (data ?? []).reduce((s: number, e: any) => s + (e.amount ?? 0), 0);
    },
    enabled: !!user?.id && !!organization?.id,
  });

  // Earnings — all time
  const { data: allTimeEarnings = 0 } = useQuery({
    queryKey: ['employee-alltime-earnings', user?.id, organization?.id],
    queryFn: async () => {
      if (!user?.id || !organization?.id) return 0;
      const { data } = await supabase
        .from('earnings')
        .select('amount')
        .eq('user_id', user.id)
        .eq('organization_id', organization.id);
      return (data ?? []).reduce((s: number, e: any) => s + (e.amount ?? 0), 0);
    },
    enabled: !!user?.id && !!organization?.id,
  });

  // Unread notifications
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['unread-notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('read_at', null);
      return count ?? 0;
    },
    enabled: !!user?.id,
  });

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

      {/* Earnings KPI row — matches web platform layout */}
      <View style={styles.kpiRow}>
        <EarningsKPI label="THIS WEEK" amount={weekEarnings} hint="Mon — today" />
        <EarningsKPI label="THIS MONTH" amount={monthEarnings} hint="1st — today" />
        <EarningsKPI label="ALL TIME" amount={allTimeEarnings} hint="Total earned" />
      </View>

      {/* Unread notifications banner */}
      {unreadCount > 0 && (
        <TouchableOpacity style={styles.notifBanner} onPress={() => router.push('/(tabs)/notifications')}>
          <Ionicons name="notifications" size={18} color={Colors.warning} />
          <Text style={styles.notifText}>You have {unreadCount} unread notification{unreadCount > 1 ? 's' : ''}</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
        </TouchableOpacity>
      )}

      {/* Today */}
      <SectionHeader title="Today" />
      {todayShifts.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyText}>No shifts scheduled for today.</Text>
        </Card>
      ) : (
        todayShifts.map((assignment: any) => {
          const shift = assignment.shifts;
          if (!shift) return null;
          return <ShiftCard key={assignment.id} shift={shift} assignment={assignment} />;
        })
      )}

      {/* Upcoming Shifts */}
      <SectionHeader title="Upcoming Shifts" action="View all" onAction={() => router.push('/(tabs)/shifts')} />
      {upcomingShifts.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyText}>No upcoming shifts in the next 7 days.</Text>
        </Card>
      ) : (
        upcomingShifts.map((assignment: any) => {
          const shift = assignment.shifts;
          if (!shift) return null;
          return <ShiftCard key={assignment.id} shift={shift} assignment={assignment} showDate />;
        })
      )}
    </ScrollView>
  );
}

function EarningsKPI({ label, amount, hint }: { label: string; amount: number; hint: string }) {
  return (
    <Card style={styles.kpiCard}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>${(amount ?? 0).toFixed(2)}</Text>
      <Text style={styles.kpiHint}>{hint}</Text>
    </Card>
  );
}

function ShiftCard({ shift, assignment, showDate }: { shift: any; assignment: any; showDate?: boolean }) {
  return (
    <Card style={styles.shiftCard} onPress={() => router.push('/(tabs)/shifts')}>
      <View style={styles.shiftHeader}>
        <Text style={styles.shiftTitle} numberOfLines={1}>{shift.title}</Text>
        <Badge label={assignment.status} status={assignment.status} size="sm" />
      </View>
      {showDate && (
        <View style={styles.metaRow}>
          <Ionicons name="calendar-outline" size={13} color={Colors.textMuted} />
          <Text style={styles.metaText}>{formatDate(shift.start_time, 'EEE, dd MMM')}</Text>
        </View>
      )}
      <View style={styles.metaRow}>
        <Ionicons name="time-outline" size={13} color={Colors.textMuted} />
        <Text style={styles.metaText}>{formatTime(shift.start_time)} – {formatTime(shift.end_time)}</Text>
      </View>
      {shift.locations?.name && (
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={13} color={Colors.textMuted} />
          <Text style={styles.metaText} numberOfLines={1}>{shift.locations.name}</Text>
        </View>
      )}
      {assignment.clock_in_time && !assignment.clock_out_time && (
        <View style={styles.clockBanner}>
          <Ionicons name="radio-button-on" size={11} color={Colors.success} />
          <Text style={styles.clockText}>Clocked in at {formatTime(assignment.clock_in_time)}</Text>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: Spacing.md, gap: Spacing.xs, paddingBottom: Spacing.xl },

  // Earnings KPI
  kpiRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  kpiCard: { flex: 1, gap: 4 },
  kpiLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  kpiValue: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.extrabold,
    color: Colors.textPrimary,
    lineHeight: 30,
  },
  kpiHint: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },

  // Notifications banner
  notifBanner: {
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
  notifText: { flex: 1, fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.medium },

  // Shift cards
  emptyCard: { marginBottom: Spacing.sm },
  emptyText: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', paddingVertical: Spacing.sm },
  shiftCard: { marginBottom: Spacing.sm, gap: 5 },
  shiftHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  shiftTitle: { flex: 1, fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary, marginRight: Spacing.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  clockBanner: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  clockText: { fontSize: FontSize.xs, color: Colors.success, fontWeight: FontWeight.medium },
});
