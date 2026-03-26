import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useToast } from '@/components/ui/Toast';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/lib/theme';
import { formatTime } from '@/lib/format';

// ── Pay period helpers (mirrors web platform exactly) ────────────────────────

function normalizePayFreq(value: string | null | undefined): 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' {
  const raw = String(value ?? 'FORTNIGHTLY').trim().toUpperCase();
  if (raw === 'WEEKLY' || raw === 'MONTHLY') return raw;
  return 'FORTNIGHTLY';
}

function dateToDayNum(d: Date) {
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
}

function dayNumToDate(n: number) {
  const d = new Date(n * 86400000);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function mondayOf(d: Date) {
  const offset = (d.getDay() + 6) % 7;
  return dateToDayNum(d) - offset;
}

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function ddmmyyyy(d: Date) {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function formatMinutes(totalMins: number) {
  const mins = Math.max(0, Number(totalMins || 0));
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function fmtMoney(n: number) {
  return `$${Number(n || 0).toFixed(2)}`;
}

function getPeriodForDate(date: Date, freq: string) {
  const f = normalizePayFreq(freq);
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (f === 'MONTHLY') {
    const from = new Date(d.getFullYear(), d.getMonth(), 1);
    const to = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const key = `${isoDate(from)}_MONTHLY`;
    return { key, from, to, label: `Monthly period · ${ddmmyyyy(from)} → ${ddmmyyyy(to)}` };
  }
  if (f === 'WEEKLY') {
    const fromNum = mondayOf(d);
    const from = dayNumToDate(fromNum);
    const to = dayNumToDate(fromNum + 6);
    const key = `${isoDate(from)}_WEEKLY`;
    return { key, from, to, label: `Weekly period · ${ddmmyyyy(from)} → ${ddmmyyyy(to)}` };
  }
  // FORTNIGHTLY — anchor: Monday 2024-01-01
  const monNum = mondayOf(d);
  const anchorNum = dateToDayNum(new Date(2024, 0, 1));
  const idx = Math.floor((monNum - anchorNum) / 14);
  const fromNum = anchorNum + idx * 14;
  const from = dayNumToDate(fromNum);
  const to = dayNumToDate(fromNum + 13);
  const key = `${isoDate(from)}_FORTNIGHTLY`;
  return { key, from, to, label: `Fortnightly period · ${ddmmyyyy(from)} → ${ddmmyyyy(to)}` };
}

function getAllPeriods(shifts: any[], freq: string) {
  const shiftDates = shifts
    .map(s => s.shift_date ? new Date(s.shift_date + 'T00:00:00') : null)
    .filter(Boolean) as Date[];
  shiftDates.sort((a, b) => a.getTime() - b.getTime());
  if (!shiftDates.length) return [];

  const now = new Date();
  const currentPeriod = getPeriodForDate(now, freq);
  const periods: ReturnType<typeof getPeriodForDate>[] = [];
  const seen = new Set<string>();

  let checkDate = shiftDates[0];
  while (true) {
    const period = getPeriodForDate(checkDate, freq);
    if (!seen.has(period.key)) {
      seen.add(period.key);
      periods.push(period);
    }
    if (period.key === currentPeriod.key) break;
    const next = new Date(period.to);
    next.setDate(next.getDate() + 1);
    checkDate = next;
    if (next.getFullYear() > now.getFullYear() + 2) break;
  }
  if (!seen.has(currentPeriod.key)) periods.push(currentPeriod);
  return periods.reverse(); // newest first
}

function getShiftsForPeriod(period: ReturnType<typeof getPeriodForDate>, shifts: any[]) {
  const fromDay = dateToDayNum(period.from);
  const toDay = dateToDayNum(period.to);
  return shifts.filter(s => {
    if (!s.shift_date) return false;
    const d = new Date(s.shift_date + 'T00:00:00');
    const day = dateToDayNum(d);
    return day >= fromDay && day <= toDay;
  });
}

function roundForPay(mins: number) {
  if (!mins || mins <= 0) return 0;
  if (mins <= 19) return 0;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  const roundedRem = rem <= 19 ? 0 : rem <= 44 ? 30 : 60;
  return hours * 60 + roundedRem;
}

function calcScheduledMinutes(shift: any) {
  if (!shift.shift_date || !shift.start_at || !shift.end_at) return 0;
  const startMs = new Date(`${shift.shift_date}T${shift.start_at}`).getTime();
  const endDate = shift.end_date || shift.shift_date;
  const endMs = new Date(`${endDate}T${shift.end_at}`).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 0;
  const totalMins = Math.max(1, Math.round((endMs - startMs) / 60000));
  const breakMins = Math.max(0, Number(shift.break_minutes || 0));
  const paidMins = shift.break_is_paid ? totalMins : Math.max(0, totalMins - breakMins);
  return roundForPay(paidMins);
}

function calcScheduledPay(shift: any) {
  const mins = calcScheduledMinutes(shift);
  if (!mins || !shift.hourly_rate) return 0;
  return (mins / 60) * Number(shift.hourly_rate);
}

function getPeriodStatus(periodShifts: any[], timesheetMap: Map<string, any>) {
  const nonCancelled = periodShifts.filter(s => (s.status ?? '').toUpperCase() !== 'CANCELLED');
  if (!nonCancelled.length) return 'OPEN';
  const timesheets = nonCancelled.map(s => timesheetMap.get(s.id)).filter(Boolean);
  if (!timesheets.length) return 'OPEN';
  const statuses = timesheets.map(ts => (ts.status || 'OPEN').toUpperCase());
  if (statuses.every(s => s === 'APPROVED')) return 'PAID';
  if (statuses.some(s => s === 'SUBMITTED')) return 'REQUESTED';
  if (statuses.some(s => s === 'REJECTED')) return 'AMEND_REQUIRED';
  return 'OPEN';
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function TimesheetsScreen() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user, organization } = useAuthStore();
  const [expandedPeriods, setExpandedPeriods] = useState<Set<string>>(new Set());
  const [requestingPeriod, setRequestingPeriod] = useState<string | null>(null);

  // Member info for payment_frequency
  const { data: member } = useQuery({
    queryKey: ['my-member-ts', user?.id, organization?.id],
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

  const payFreq = normalizePayFreq(member?.payment_frequency);

  const { data: pageData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['timesheets-page', user?.id, organization?.id],
    queryFn: async () => {
      if (!user?.id || !organization?.id) return null;

      // 1. Load all my shift assignments
      const { data: assignments } = await supabase
        .from('shift_assignments')
        .select('shift_id')
        .eq('employee_user_id', user.id)
        .limit(1000);

      const shiftIds = (assignments ?? []).map((a: any) => a.shift_id).filter(Boolean);
      if (!shiftIds.length) return { shifts: [], timesheetMap: new Map(), allTimeTotal: 0 };

      // 2. Load full shift details
      const { data: shiftsData } = await supabase
        .from('shifts')
        .select('id, title, shift_date, end_date, start_at, end_at, location, break_minutes, break_is_paid, hourly_rate, status, track_time, locations(name)')
        .in('id', shiftIds)
        .order('shift_date', { ascending: false })
        .limit(1000);

      const shifts = shiftsData ?? [];

      // 3. Load timesheets for these shifts
      const { data: timesheetsData } = await supabase
        .from('timesheets')
        .select('id, shift_id, status, submitted_at, amend_message, amended_at, rejection_reason, time_entries(id, clock_in, clock_out, break_minutes)')
        .eq('organization_id', organization.id)
        .eq('employee_user_id', user.id)
        .in('shift_id', shiftIds)
        .limit(1000);

      const timesheetMap = new Map<string, any>();
      for (const ts of timesheetsData ?? []) timesheetMap.set(ts.shift_id, ts);

      // All time total = COMPLETED shifts
      const allTimeTotal = shifts
        .filter(s => (s.status ?? '').toUpperCase() === 'COMPLETED')
        .reduce((sum: number, s: any) => sum + calcScheduledPay(s), 0);

      return { shifts, timesheetMap, allTimeTotal };
    },
    enabled: !!user?.id && !!organization?.id,
  });

  function togglePeriod(key: string) {
    setExpandedPeriods(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  async function handleRequestPayment(period: ReturnType<typeof getPeriodForDate>, periodShifts: any[]) {
    if (!user?.id || !organization?.id || !pageData) return;

    Alert.alert(
      'Request Payment',
      'Submit all completed shifts in this period for payment approval?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          style: 'default',
          onPress: async () => {
            setRequestingPeriod(period.key);
            try {
              const { timesheetMap } = pageData;
              const completedShifts = periodShifts.filter(
                s => (s.status ?? '').toUpperCase() === 'COMPLETED'
              );
              const now = new Date().toISOString();

              // Update existing OPEN/REJECTED timesheets → SUBMITTED
              const toUpdate = completedShifts
                .map(s => timesheetMap.get(s.id))
                .filter(ts => ts && ['OPEN', 'REJECTED'].includes((ts.status ?? '').toUpperCase()))
                .map(ts => ts.id);

              if (toUpdate.length) {
                const { error } = await supabase
                  .from('timesheets')
                  .update({ status: 'SUBMITTED', submitted_at: now, amend_message: null, amended_at: null })
                  .in('id', toUpdate)
                  .eq('organization_id', organization.id)
                  .eq('employee_user_id', user.id);
                if (error) throw error;
              }

              // Insert new timesheets for completed shifts with no record
              const toInsert = completedShifts
                .filter(s => !timesheetMap.has(s.id))
                .map(s => ({
                  shift_id: s.id,
                  organization_id: organization.id,
                  employee_user_id: user.id,
                  status: 'SUBMITTED',
                  submitted_at: now,
                }));

              if (toInsert.length) {
                const { error } = await supabase.from('timesheets').insert(toInsert);
                if (error) throw error;
              }

              const total = toUpdate.length + toInsert.length;
              if (!total) {
                toast.error('No eligible shifts to submit');
                return;
              }

              toast.success('Payment requested!', `${total} shift${total > 1 ? 's' : ''} submitted`);
              queryClient.invalidateQueries({ queryKey: ['timesheets-page'] });
            } catch (err: any) {
              toast.error('Failed to submit', err?.message);
            } finally {
              setRequestingPeriod(null);
            }
          },
        },
      ]
    );
  }

  if (isLoading) return <LoadingScreen message="Loading timesheets..." />;

  const shifts = pageData?.shifts ?? [];
  const timesheetMap = pageData?.timesheetMap ?? new Map();
  const allTimeTotal = pageData?.allTimeTotal ?? 0;
  const periods = getAllPeriods(shifts, payFreq);
  const now = new Date();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.title}>Timesheets</Text>
        <View style={styles.freqBadge}>
          <Text style={styles.freqBadgeText}>Pay frequency: {payFreq}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
      >
        {/* ── All-time earnings ── */}
        <View style={styles.allTimeCard}>
          <Text style={styles.allTimeLabel}>All time</Text>
          <Text style={styles.allTimeValue}>{fmtMoney(allTimeTotal)}</Text>
        </View>

        {/* ── Period cards ── */}
        {periods.length === 0 ? (
          <EmptyState icon="time-outline" title="No timesheets" description="Your timesheets will appear here once you have completed shifts." />
        ) : (
          periods.map(period => {
            const periodShifts = getShiftsForPeriod(period, shifts);
            const nonCancelled = periodShifts.filter(s => (s.status ?? '').toUpperCase() !== 'CANCELLED');
            const completedShifts = periodShifts.filter(s => (s.status ?? '').toUpperCase() === 'COMPLETED');
            const totalPay = completedShifts.reduce((sum, s) => sum + calcScheduledPay(s), 0);
            const totalMins = nonCancelled.reduce((sum, s) => sum + calcScheduledMinutes(s), 0);
            const periodStatus = getPeriodStatus(periodShifts, timesheetMap);
            const isExpanded = expandedPeriods.has(period.key);
            const todayDay = dateToDayNum(now);
            const toDay = dateToDayNum(period.to);
            const fromDay = dateToDayNum(period.from);
            const isCurrentPeriod = todayDay >= fromDay && todayDay <= toDay;
            const isPastPeriod = todayDay > toDay;

            const submittableShifts = completedShifts.filter(s => {
              const ts = timesheetMap.get(s.id);
              const st = (ts?.status ?? 'OPEN').toUpperCase();
              return st === 'OPEN' || st === 'REJECTED';
            });
            const canRequestPayment =
              submittableShifts.length > 0 &&
              isPastPeriod &&
              periodStatus !== 'PAID' &&
              periodStatus !== 'REQUESTED';

            // Find amend message
            const amendTs = periodShifts
              .map(s => timesheetMap.get(s.id))
              .filter(ts => ts && (ts.status ?? '').toUpperCase() === 'REJECTED' && ts.amend_message);

            const isRequesting = requestingPeriod === period.key;

            return (
              <View key={period.key} style={[styles.periodCard, isCurrentPeriod && styles.periodCardCurrent]}>
                {/* Period header */}
                <View style={styles.periodHeader}>
                  <View style={styles.periodTitleRow}>
                    <Text style={styles.periodTitle} numberOfLines={2}>{period.label}</Text>
                    <View style={styles.periodBadges}>
                      {isCurrentPeriod && <View style={styles.currentBadge}><Text style={styles.currentBadgeText}>Current</Text></View>}
                      <PeriodStatusBadge status={periodStatus} />
                    </View>
                  </View>
                  <Text style={styles.periodSummary}>
                    {nonCancelled.length} shift{nonCancelled.length !== 1 ? 's' : ''} · {formatMinutes(totalMins)} scheduled · <Text style={styles.periodPay}>{fmtMoney(totalPay)}</Text> earned (completed)
                  </Text>
                </View>

                {/* Amend banner */}
                {amendTs.length > 0 && (
                  <View style={styles.amendBanner}>
                    <Ionicons name="pencil-outline" size={14} color={Colors.warning} />
                    <Text style={styles.amendText} numberOfLines={3}>
                      Amendment requested: "{amendTs[0].amend_message}"
                    </Text>
                  </View>
                )}

                {/* Actions row */}
                <View style={styles.actionsRow}>
                  {canRequestPayment && (
                    <TouchableOpacity
                      style={[styles.requestBtn, isRequesting && styles.requestBtnDisabled]}
                      onPress={() => handleRequestPayment(period, periodShifts)}
                      disabled={isRequesting}
                    >
                      {isRequesting
                        ? <ActivityIndicator size="small" color="#FFF" />
                        : <Ionicons name="card-outline" size={14} color="#FFF" />
                      }
                      <Text style={styles.requestBtnText}>Request payment</Text>
                    </TouchableOpacity>
                  )}
                  {!isPastPeriod && submittableShifts.length > 0 && (
                    <View style={styles.waitPill}>
                      <Ionicons name="time-outline" size={13} color={Colors.textMuted} />
                      <Text style={styles.waitText}>Available after {ddmmyyyy(period.to)}</Text>
                    </View>
                  )}
                  {periodShifts.length > 0 && (
                    <TouchableOpacity style={styles.toggleBtn} onPress={() => togglePeriod(period.key)}>
                      <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={14} color={Colors.textSecondary} />
                      <Text style={styles.toggleBtnText}>Shifts</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Expandable shift list */}
                {isExpanded && (
                  <View style={styles.shiftList}>
                    {periodShifts.length === 0 ? (
                      <Text style={styles.noShiftsText}>No shifts in this period.</Text>
                    ) : (
                      periodShifts.map(shift => {
                        const ts = timesheetMap.get(shift.id);
                        const status = (shift.status ?? 'ACTIVE').toUpperCase();
                        const isCancelled = status === 'CANCELLED';
                        const scheduledMins = calcScheduledMinutes(shift);
                        const scheduledPay = calcScheduledPay(shift);
                        const loc = shift.locations?.name ?? shift.location ?? null;
                        return (
                          <View key={shift.id} style={[styles.shiftRow, isCancelled && styles.shiftRowCancelled]}>
                            <View style={styles.shiftRowLeft}>
                              <Text style={styles.shiftTimeText}>
                                {formatTime(shift.start_at)} – {formatTime(shift.end_at)}
                              </Text>
                              <Text style={[styles.shiftRowDate, isCancelled && styles.textStrike]}>
                                {shift.shift_date ? formatShiftDate(shift.shift_date) : ''}
                              </Text>
                            </View>
                            <View style={styles.shiftRowBody}>
                              <Text style={[styles.shiftRowTitle, isCancelled && styles.textStrike]} numberOfLines={1}>
                                {shift.title ?? 'Untitled shift'}
                              </Text>
                              {loc && <Text style={styles.shiftRowLocation} numberOfLines={1}>📍 {loc}</Text>}
                              {ts && <TimesheetStatusPill status={ts.status} />}
                            </View>
                            <View style={styles.shiftRowRight}>
                              {!isCancelled ? (
                                <>
                                  <Text style={styles.shiftRowMins}>{formatMinutes(scheduledMins)}</Text>
                                  <Text style={styles.shiftRowPay}>{fmtMoney(scheduledPay)}</Text>
                                </>
                              ) : (
                                <Text style={styles.cancelledText}>Cancelled</Text>
                              )}
                            </View>
                          </View>
                        );
                      })
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatShiftDate(yyyyMmDd: string) {
  const [y, m, d] = yyyyMmDd.split('-');
  return `${d}/${m}/${y}`;
}

function PeriodStatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    PAID: { bg: Colors.success, text: '#FFF', label: 'Paid' },
    REQUESTED: { bg: Colors.primary, text: '#FFF', label: 'Requested' },
    AMEND_REQUIRED: { bg: Colors.danger, text: '#FFF', label: 'Amend required' },
    OPEN: { bg: Colors.border, text: Colors.textSecondary, label: 'Open' },
  };
  const s = map[status] ?? map.OPEN;
  return (
    <View style={[styles.statusPill, { backgroundColor: s.bg }]}>
      <Text style={[styles.statusPillText, { color: s.text }]}>{s.label}</Text>
    </View>
  );
}

function TimesheetStatusPill({ status }: { status: string }) {
  const map: Record<string, { color: string }> = {
    APPROVED: { color: Colors.success },
    SUBMITTED: { color: Colors.primary },
    REJECTED: { color: Colors.danger },
    OPEN: { color: Colors.textMuted },
  };
  const s = map[(status ?? '').toUpperCase()] ?? map.OPEN;
  return (
    <View style={styles.tsPill}>
      <View style={[styles.tsPillDot, { backgroundColor: s.color }]} />
      <Text style={[styles.tsPillText, { color: s.color }]}>{status}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  freqBadge: {
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
  },
  freqBadgeText: { fontSize: FontSize.xs, color: '#FFF', fontWeight: FontWeight.semibold },
  scroll: { flex: 1 },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },

  // All-time card
  allTimeCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
  },
  allTimeLabel: { fontSize: FontSize.sm, color: Colors.textMuted },
  allTimeValue: { fontSize: FontSize['3xl'], fontWeight: FontWeight.bold, color: Colors.textPrimary, marginTop: 4 },

  // Period card
  periodCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
  },
  periodCardCurrent: { borderColor: Colors.primary, borderWidth: 1.5 },
  periodHeader: { padding: Spacing.md, gap: Spacing.xs },
  periodTitleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.sm },
  periodTitle: { flex: 1, fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  periodBadges: { flexDirection: 'row', gap: 4, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' },
  periodSummary: { fontSize: FontSize.sm, color: Colors.textSecondary },
  periodPay: { fontWeight: FontWeight.semibold, color: Colors.textPrimary },

  currentBadge: { backgroundColor: Colors.primary + '30', borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: Colors.primary + '60' },
  currentBadgeText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.semibold },
  statusPill: { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  statusPillText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },

  // Amend banner
  amendBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs,
    marginHorizontal: Spacing.md, marginBottom: Spacing.sm,
    backgroundColor: Colors.warning + '15', borderRadius: Radius.md,
    padding: Spacing.sm, borderLeftWidth: 3, borderLeftColor: Colors.warning,
  },
  amendText: { flex: 1, fontSize: FontSize.sm, color: Colors.textPrimary },

  // Actions row
  actionsRow: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.xs,
    paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm,
  },
  requestBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    paddingHorizontal: Spacing.md, paddingVertical: 6,
  },
  requestBtnDisabled: { opacity: 0.6 },
  requestBtnText: { fontSize: FontSize.sm, color: '#FFF', fontWeight: FontWeight.semibold },
  waitPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.bgInput, borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 5,
  },
  waitText: { fontSize: FontSize.xs, color: Colors.textMuted },
  toggleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 5, marginLeft: 'auto',
  },
  toggleBtnText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },

  // Shift list
  shiftList: { borderTopWidth: 1, borderTopColor: Colors.border },
  noShiftsText: { padding: Spacing.md, fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },
  shiftRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border + '80',
  },
  shiftRowCancelled: { opacity: 0.5 },
  shiftRowLeft: { width: 80 },
  shiftTimeText: { fontSize: FontSize.xs, color: Colors.textMuted },
  shiftRowDate: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  shiftRowBody: { flex: 1, gap: 2 },
  shiftRowTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.textPrimary },
  shiftRowLocation: { fontSize: FontSize.xs, color: Colors.textMuted },
  textStrike: { textDecorationLine: 'line-through', color: Colors.textMuted },
  shiftRowRight: { alignItems: 'flex-end', minWidth: 60 },
  shiftRowMins: { fontSize: FontSize.xs, color: Colors.textMuted },
  shiftRowPay: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  cancelledText: { fontSize: FontSize.xs, color: Colors.danger },

  // Timesheet status pill
  tsPill: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  tsPillDot: { width: 6, height: 6, borderRadius: 3 },
  tsPillText: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
});
