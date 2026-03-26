import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { Card } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/lib/theme';
import { formatDate, formatTime, formatCurrency } from '@/lib/format';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ── Payment period helpers (mirrors web platform logic) ─────────────────────

function normalizePayFreq(value: string | null | undefined): 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' {
  const raw = String(value ?? 'FORTNIGHTLY').trim().toUpperCase();
  if (raw === 'WEEKLY' || raw === 'MONTHLY') return raw;
  return 'FORTNIGHTLY';
}

function startOfWeek(d: Date): Date {
  const day = new Date(d);
  const diff = (day.getDay() + 6) % 7; // Monday=0
  day.setDate(day.getDate() - diff);
  return day;
}

function isoDate(d: Date) {
  return d.toISOString().split('T')[0];
}

function getCurrentPayPeriod(freq: string) {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const f = normalizePayFreq(freq);
  if (f === 'MONTHLY') {
    const from = new Date(d.getFullYear(), d.getMonth(), 1);
    return { from, label: 'THIS MONTH', range: `${isoDate(from)} → ${isoDate(d)}` };
  }
  if (f === 'WEEKLY') {
    const from = startOfWeek(d);
    return { from, label: 'THIS WEEK', range: `${isoDate(from)} → ${isoDate(d)}` };
  }
  // Fortnightly — same anchor as web
  const ws = startOfWeek(d);
  const anchor = new Date(2024, 0, 1);
  anchor.setHours(0, 0, 0, 0);
  const idx = Math.floor(Math.floor((ws.getTime() - anchor.getTime()) / 86400000) / 14);
  const from = new Date(anchor.getTime() + idx * 14 * 86400000);
  return { from, label: 'THIS FORTNIGHT', range: `${isoDate(from)} → ${isoDate(d)}` };
}

// ── Component ────────────────────────────────────────────────────────────────

export function EmployeeDashboard() {
  const { user, organization } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
  const [clockLoading, setClockLoading] = useState(false);

  // Member info (for payment_frequency)
  const { data: member } = useQuery({
    queryKey: ['my-member', user?.id, organization?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('org_members')
        .select('payment_frequency')
        .eq('user_id', user!.id)
        .eq('organization_id', organization!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id && !!organization?.id,
  });

  const payFreq = member?.payment_frequency ?? 'FORTNIGHTLY';
  const period = getCurrentPayPeriod(payFreq);

  // Upcoming shifts
  const { data: upcomingShifts = [] } = useQuery({
    queryKey: ['employee-upcoming-shifts', user?.id, organization?.id],
    queryFn: async () => {
      if (!user?.id || !organization?.id) return [];
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('shift_assignments')
        .select('*, shifts(id, title, shift_date, start_at, end_at, location, description, break_minutes, requires_photos, locations(name, address))')
        .eq('employee_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (!data) return [];
      return data
        .filter((a: any) => a.shifts?.organization_id === undefined
          ? true
          : a.shifts?.shift_date >= today)
        .filter((a: any) => a.shifts?.shift_date >= today)
        .sort((a: any, b: any) => {
          const da = `${a.shifts?.shift_date}T${a.shifts?.start_at}`;
          const db = `${b.shifts?.shift_date}T${b.shifts?.start_at}`;
          return da.localeCompare(db);
        })
        .slice(0, 10);
    },
    enabled: !!user?.id && !!organization?.id,
  });

  // Open timesheets count
  const { data: openCount = 0 } = useQuery({
    queryKey: ['employee-open-ts-count', user?.id, organization?.id],
    queryFn: async () => {
      if (!user?.id || !organization?.id) return 0;
      const { count } = await supabase
        .from('timesheets')
        .select('id', { count: 'exact', head: true })
        .eq('employee_user_id', user.id)
        .eq('organization_id', organization.id)
        .eq('status', 'OPEN');
      return count ?? 0;
    },
    enabled: !!user?.id && !!organization?.id,
  });

  // Period earnings
  const { data: earnings } = useQuery({
    queryKey: ['employee-earnings', user?.id, organization?.id, isoDate(period.from)],
    queryFn: async () => {
      if (!user?.id || !organization?.id) return { period: 0, allTime: 0 };
      const [periodRes, allTimeRes] = await Promise.all([
        supabase.from('earnings')
          .select('minutes_paid, hourly_rate')
          .eq('employee_user_id', user.id)
          .eq('organization_id', organization.id)
          .gte('earned_at', isoDate(period.from)),
        supabase.from('earnings')
          .select('minutes_paid, hourly_rate')
          .eq('employee_user_id', user.id)
          .eq('organization_id', organization.id),
      ]);
      const sum = (rows: any[]) =>
        (rows ?? []).reduce((s, e) => s + ((e.minutes_paid ?? 0) / 60) * (e.hourly_rate ?? 0), 0);
      return { period: sum(periodRes.data ?? []), allTime: sum(allTimeRes.data ?? []) };
    },
    enabled: !!user?.id && !!organization?.id,
  });

  // Clock state for the selected shift
  const { data: clockState, refetch: refetchClock } = useQuery({
    queryKey: ['clock-state-dash', selectedAssignment?.shifts?.id, user?.id],
    queryFn: async () => {
      const shiftId = selectedAssignment?.shifts?.id;
      if (!shiftId || !user?.id) return null;
      const { data: ts } = await supabase
        .from('timesheets')
        .select('id, status, time_entries(id, clock_in, clock_out)')
        .eq('shift_id', shiftId)
        .eq('employee_user_id', user.id)
        .maybeSingle();
      if (!ts) return { timesheet: null, openEntry: null };
      const openEntry = (ts.time_entries as any[])?.find(te => te.clock_in && !te.clock_out) ?? null;
      return { timesheet: ts, openEntry };
    },
    enabled: !!selectedAssignment && !!user?.id,
  });

  async function handleClockIn() {
    const shift = selectedAssignment?.shifts;
    if (!shift || !user?.id || !organization?.id) return;
    setClockLoading(true);
    try {
      let timesheetId = clockState?.timesheet?.id;
      if (!timesheetId) {
        const { data: newTs, error: tsErr } = await supabase
          .from('timesheets')
          .insert({ organization_id: organization.id, shift_id: shift.id, employee_user_id: user.id, status: 'OPEN' })
          .select('id').single();
        if (tsErr) throw tsErr;
        timesheetId = newTs.id;
      }
      const { error } = await supabase.from('time_entries')
        .insert({ timesheet_id: timesheetId, clock_in: new Date().toISOString(), break_minutes: 0 });
      if (error) throw error;
      refetchClock();
    } catch (err: any) {
      console.error(err);
    } finally {
      setClockLoading(false);
    }
  }

  async function handleClockOut() {
    if (!clockState?.openEntry?.id) return;
    setClockLoading(true);
    try {
      const { error } = await supabase.from('time_entries')
        .update({ clock_out: new Date().toISOString() })
        .eq('id', clockState.openEntry.id);
      if (error) throw error;
      refetchClock();
    } catch (err: any) {
      console.error(err);
    } finally {
      setClockLoading(false);
    }
  }

  const isClockedIn = !!clockState?.openEntry;
  const hasTimesheet = !!clockState?.timesheet;
  const selectedShift = selectedAssignment?.shifts;

  return (
    <>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Earnings cards ── */}
        <View style={styles.earningsRow}>
          <View style={styles.earningsCard}>
            <Text style={styles.earningsLabel}>{period.label}</Text>
            <Text style={styles.earningsAmount}>{formatCurrency(earnings?.period ?? 0)}</Text>
            <Text style={styles.earningsRange}>{period.range}</Text>
          </View>
          <View style={styles.earningsCard}>
            <Text style={styles.earningsLabel}>ALL TIME</Text>
            <Text style={styles.earningsAmount}>{formatCurrency(earnings?.allTime ?? 0)}</Text>
            <Text style={styles.earningsRange}>Total earned</Text>
          </View>
        </View>

        {/* ── Mini stat row ── */}
        <View style={styles.miniRow}>
          <TouchableOpacity style={styles.miniCard} onPress={() => router.push('/(tabs)/shifts')}>
            <Ionicons name="calendar-outline" size={18} color={Colors.primary} />
            <Text style={styles.miniValue}>{upcomingShifts.length}</Text>
            <Text style={styles.miniLabel}>Upcoming{'\n'}Shifts</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.miniCard} onPress={() => router.push('/(tabs)/timesheets')}>
            <Ionicons name="time-outline" size={18} color={Colors.warning} />
            <Text style={styles.miniValue}>{openCount}</Text>
            <Text style={styles.miniLabel}>Open{'\n'}Timesheets</Text>
          </TouchableOpacity>
        </View>

        {/* ── Upcoming Shifts list ── */}
        <SectionHeader title="Upcoming Shifts" action="View all" onAction={() => router.push('/(tabs)/shifts')} />
        {upcomingShifts.length === 0 ? (
          <Card>
            <EmptyState icon="calendar-outline" title="No upcoming shifts" description="You have no shifts scheduled." />
          </Card>
        ) : (
          upcomingShifts.map((assignment: any) => {
            const shift = assignment.shifts;
            if (!shift) return null;
            const loc = shift.locations?.name ?? shift.location ?? null;
            return (
              <Card
                key={assignment.id}
                style={styles.shiftCard}
                onPress={() => setSelectedAssignment(assignment)}
              >
                <Text style={styles.shiftTitle} numberOfLines={1}>{shift.title ?? 'Shift'}</Text>
                <View style={styles.metaItem}>
                  <Ionicons name="calendar-outline" size={13} color={Colors.textMuted} />
                  <Text style={styles.metaText}>{formatDate(shift.shift_date, 'EEE, dd MMM')}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="time-outline" size={13} color={Colors.textMuted} />
                  <Text style={styles.metaText}>{formatTime(shift.start_at)} – {formatTime(shift.end_at)}</Text>
                </View>
                {loc && (
                  <View style={styles.metaItem}>
                    <Ionicons name="location-outline" size={13} color={Colors.textMuted} />
                    <Text style={styles.metaText} numberOfLines={1}>{loc}</Text>
                  </View>
                )}
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* ── Shift Detail Modal ── */}
      <Modal
        visible={!!selectedAssignment}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedAssignment(null)}
      >
        {selectedShift && (
          <View style={[styles.modal, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHandle} />
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle} numberOfLines={2}>{selectedShift.title ?? 'Shift Details'}</Text>
                <TouchableOpacity onPress={() => setSelectedAssignment(null)}>
                  <Ionicons name="close" size={24} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.detailList}>
                <DetailRow icon="calendar-outline" label="Date" value={formatDate(selectedShift.shift_date, 'EEEE, dd MMMM yyyy')} />
                <DetailRow icon="time-outline" label="Time" value={`${formatTime(selectedShift.start_at)} – ${formatTime(selectedShift.end_at)}`} />
                {(selectedShift.locations?.name ?? selectedShift.location) && (
                  <DetailRow icon="location-outline" label="Location" value={selectedShift.locations?.name ?? selectedShift.location} />
                )}
                {(selectedShift.break_minutes ?? 0) > 0 && (
                  <DetailRow icon="cafe-outline" label="Break" value={`${selectedShift.break_minutes} min`} />
                )}
                {selectedShift.description && (
                  <DetailRow icon="document-text-outline" label="Notes" value={selectedShift.description} />
                )}
              </View>

              {/* Clock in / out */}
              <View style={styles.clockSection}>
                {isClockedIn ? (
                  <>
                    <View style={styles.clockedInBanner}>
                      <View style={styles.clockDot} />
                      <Text style={styles.clockedInText}>
                        Clocked in at {formatTime(clockState!.openEntry!.clock_in)}
                      </Text>
                    </View>
                    <Button
                      title="Clock Out"
                      variant="danger"
                      icon={<Ionicons name="stop-circle-outline" size={18} color="#FFF" />}
                      onPress={handleClockOut}
                      loading={clockLoading}
                      fullWidth
                      size="lg"
                    />
                  </>
                ) : (
                  <Button
                    title={hasTimesheet ? 'Clock In Again' : 'Clock In'}
                    icon={<Ionicons name="play-circle-outline" size={18} color="#FFF" />}
                    onPress={handleClockIn}
                    loading={clockLoading}
                    fullWidth
                    size="lg"
                  />
                )}
                {selectedShift.requires_photos && (
                  <View style={styles.photoNote}>
                    <Ionicons name="camera-outline" size={16} color={Colors.warning} />
                    <Text style={styles.photoNoteText}>This shift requires photo verification</Text>
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>
    </>
  );
}

function DetailRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={16} color={Colors.primary} style={styles.detailIcon} />
      <View style={styles.detailContent}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing.xl },

  // Earnings cards
  earningsRow: { flexDirection: 'row', gap: Spacing.sm },
  earningsCard: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  earningsLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.textMuted, letterSpacing: 0.5 },
  earningsAmount: { fontSize: FontSize['2xl'], fontWeight: FontWeight.bold, color: Colors.textPrimary },
  earningsRange: { fontSize: FontSize.xs, color: Colors.textMuted },

  // Mini stat row
  miniRow: { flexDirection: 'row', gap: Spacing.sm },
  miniCard: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'flex-start',
    gap: 4,
  },
  miniValue: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginTop: 2 },
  miniLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 16 },

  // Shift cards
  shiftCard: { gap: 4 },
  shiftTitle: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary, marginBottom: 2 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: FontSize.sm, color: Colors.textSecondary },

  // Modal
  modal: { flex: 1, backgroundColor: Colors.bgCard, paddingHorizontal: Spacing.md },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.md },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: Spacing.lg, gap: Spacing.sm },
  modalTitle: { flex: 1, fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  detailList: { gap: Spacing.md, marginBottom: Spacing.lg },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  detailIcon: { marginTop: 2 },
  detailContent: { flex: 1 },
  detailLabel: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 2 },
  detailValue: { fontSize: FontSize.base, color: Colors.textPrimary },
  // Clock
  clockSection: { gap: Spacing.sm, marginBottom: Spacing.lg },
  clockedInBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.success + '20', borderRadius: Radius.md,
    padding: Spacing.sm + 2, borderWidth: 1, borderColor: Colors.success + '40',
  },
  clockDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.success },
  clockedInText: { fontSize: FontSize.sm, color: Colors.success, fontWeight: FontWeight.medium },
  photoNote: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    padding: Spacing.sm, backgroundColor: Colors.warning + '20', borderRadius: Radius.md,
  },
  photoNoteText: { fontSize: FontSize.sm, color: Colors.warning },
});
