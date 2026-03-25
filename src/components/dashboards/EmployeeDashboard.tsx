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
import { EmptyState } from '@/components/ui/EmptyState';
import { Colors, FontSize, FontWeight, Spacing } from '@/lib/theme';
import { formatDate, formatTime, formatCurrency, formatHours } from '@/lib/format';

export function EmployeeDashboard() {
  const { user, organization } = useAuthStore();

  // Upcoming shifts via shift_assignments
  const { data: upcomingShifts = [] } = useQuery({
    queryKey: ['employee-upcoming-shifts', user?.id, organization?.id],
    queryFn: async () => {
      if (!user?.id || !organization?.id) return [];
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('shift_assignments')
        .select('*, shifts(id, title, shift_date, start_at, end_at, location, locations(name))')
        .eq('employee_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (!data) return [];
      return data
        .filter((a: any) => a.shifts?.shift_date >= today)
        .sort((a: any, b: any) => (a.shifts?.shift_date ?? '').localeCompare(b.shifts?.shift_date ?? ''))
        .slice(0, 5);
    },
    enabled: !!user?.id && !!organization?.id,
  });

  // Open timesheets (need to submit)
  const { data: openTimesheets = [] } = useQuery({
    queryKey: ['employee-open-timesheets', user?.id, organization?.id],
    queryFn: async () => {
      if (!user?.id || !organization?.id) return [];
      const { data } = await supabase
        .from('timesheets')
        .select('*, shifts(title, shift_date, start_at, end_at)')
        .eq('employee_user_id', user.id)
        .eq('organization_id', organization.id)
        .eq('status', 'OPEN')
        .order('created_at', { ascending: false })
        .limit(5);
      return data ?? [];
    },
    enabled: !!user?.id && !!organization?.id,
  });

  // This week earnings
  const { data: weekEarnings } = useQuery({
    queryKey: ['employee-week-earnings', user?.id, organization?.id],
    queryFn: async () => {
      if (!user?.id || !organization?.id) return null;
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
      weekStart.setHours(0, 0, 0, 0);

      const { data } = await supabase
        .from('earnings')
        .select('minutes_worked, minutes_paid, hourly_rate')
        .eq('employee_user_id', user.id)
        .eq('organization_id', organization.id)
        .gte('earned_at', weekStart.toISOString().split('T')[0]);

      if (!data) return null;
      const totalMinutes = data.reduce((s, e) => s + (e.minutes_worked ?? 0), 0);
      const totalWages = data.reduce((s, e) => {
        const hrs = (e.minutes_paid ?? 0) / 60;
        return s + hrs * (e.hourly_rate ?? 0);
      }, 0);
      return { wages: totalWages, minutes: totalMinutes };
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
        .eq('is_read', false);
      return count ?? 0;
    },
    enabled: !!user?.id,
  });

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.statsRow}>
        <StatCard label="Upcoming Shifts" value={upcomingShifts.length} icon="calendar" color={Colors.primary} />
        <StatCard label="Open" value={openTimesheets.length} icon="time" color={Colors.warning} />
        <StatCard
          label="This Week"
          value={weekEarnings ? formatCurrency(weekEarnings.wages) : '$0.00'}
          icon="cash"
          color={Colors.success}
          subtitle={weekEarnings ? formatHours(weekEarnings.minutes) : ''}
        />
      </View>

      {unreadCount > 0 && (
        <TouchableOpacity style={styles.notifBanner} onPress={() => router.push('/(tabs)/notifications')}>
          <Ionicons name="notifications" size={18} color={Colors.warning} />
          <Text style={styles.notifText}>You have {unreadCount} unread notification{unreadCount > 1 ? 's' : ''}</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
        </TouchableOpacity>
      )}

      <SectionHeader title="Upcoming Shifts" action="View all" onAction={() => router.push('/(tabs)/shifts')} />
      {upcomingShifts.length === 0 ? (
        <Card>
          <EmptyState icon="calendar-outline" title="No upcoming shifts" description="You have no shifts scheduled." />
        </Card>
      ) : (
        upcomingShifts.map((assignment: any) => {
          const shift = assignment.shifts;
          if (!shift) return null;
          return (
            <Card key={assignment.id} style={styles.shiftCard} onPress={() => router.push('/(tabs)/shifts')}>
              <View style={styles.shiftHeader}>
                <Text style={styles.shiftTitle} numberOfLines={1}>{shift.title}</Text>
              </View>
              <View style={styles.shiftMeta}>
                <View style={styles.metaItem}>
                  <Ionicons name="calendar-outline" size={14} color={Colors.textMuted} />
                  <Text style={styles.metaText}>{formatDate(shift.shift_date, 'EEE, dd MMM')}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="time-outline" size={14} color={Colors.textMuted} />
                  <Text style={styles.metaText}>{formatTime(shift.start_at)} – {formatTime(shift.end_at)}</Text>
                </View>
                {(shift.locations?.name || shift.location) && (
                  <View style={styles.metaItem}>
                    <Ionicons name="location-outline" size={14} color={Colors.textMuted} />
                    <Text style={styles.metaText} numberOfLines={1}>{shift.locations?.name ?? shift.location}</Text>
                  </View>
                )}
              </View>
            </Card>
          );
        })
      )}

      {openTimesheets.length > 0 && (
        <>
          <SectionHeader title="Timesheets to Submit" action="View all" onAction={() => router.push('/(tabs)/timesheets')} />
          {openTimesheets.map((ts: any) => (
            <Card key={ts.id} style={styles.shiftCard} onPress={() => router.push('/(tabs)/timesheets')}>
              <View style={styles.shiftHeader}>
                <Text style={styles.shiftTitle}>
                  {ts.shifts?.title ?? (ts.shifts?.shift_date ? formatDate(ts.shifts.shift_date, 'EEE, dd MMM') : 'Timesheet')}
                </Text>
                <Badge label={ts.status} status={ts.status} size="sm" />
              </View>
              {ts.shifts?.shift_date && (
                <Text style={styles.metaText}>{formatDate(ts.shifts.shift_date, 'dd MMM yyyy')}</Text>
              )}
            </Card>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: Spacing.md, gap: Spacing.xs, paddingBottom: Spacing.xl },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xs },
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
  shiftCard: { marginBottom: Spacing.sm, gap: Spacing.sm },
  shiftHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  shiftTitle: { flex: 1, fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary, marginRight: Spacing.sm },
  shiftMeta: { gap: 4 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: FontSize.sm, color: Colors.textSecondary },
});
