import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
  Modal, ScrollView, TextInput, Alert, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useToast } from '@/components/ui/Toast';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/lib/theme';
import { formatDate, formatTime } from '@/lib/format';

type Filter = 'upcoming' | 'past' | 'all';

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

export default function ShiftsScreen() {
  const insets = useSafeAreaInsets();
  const { user, organization, role } = useAuthStore();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('upcoming');
  const [selectedShift, setSelectedShift] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);

  const isManager = role === 'MANAGER' || role === 'BM' || role === 'BO';

  const { data: shifts = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['shifts', user?.id, organization?.id, filter, role],
    queryFn: async () => {
      if (!organization?.id) return [];
      const today = todayStr();

      if (isManager) {
        let q = supabase
          .from('shifts')
          .select('*, locations(name, address), shift_assignments(id, employee_user_id)')
          .eq('organization_id', organization.id);
        if (filter === 'upcoming') q = q.gte('shift_date', today);
        else if (filter === 'past') q = q.lt('shift_date', today);
        const { data } = await q
          .order('shift_date', { ascending: filter !== 'past' })
          .order('start_at', { ascending: true })
          .limit(50);
        return data ?? [];
      } else {
        const { data } = await supabase
          .from('shift_assignments')
          .select('*, shifts(id, title, shift_date, start_at, end_at, break_minutes, description, status, organization_id, location, location_id, requires_photos, locations(name, address))')
          .eq('employee_user_id', user!.id)
          .limit(200);
        const all = data ?? [];
        const orgFiltered = all.filter((a: any) => a.shifts?.organization_id === organization.id);
        const dateFiltered = orgFiltered.filter((a: any) => {
          const sd = a.shifts?.shift_date;
          if (!sd) return true;
          if (filter === 'upcoming') return sd >= today;
          if (filter === 'past') return sd < today;
          return true;
        });
        dateFiltered.sort((a: any, b: any) => {
          const da = `${a.shifts?.shift_date}T${a.shifts?.start_at}`;
          const db = `${b.shifts?.shift_date}T${b.shifts?.start_at}`;
          return filter === 'past' ? db.localeCompare(da) : da.localeCompare(db);
        });
        return dateFiltered.slice(0, 50);
      }
    },
    enabled: !!organization?.id && !!user?.id,
  });

  const renderItem = ({ item }: { item: any }) => {
    if (isManager) {
      const shift = item;
      const locationName = shift.locations?.name ?? shift.location ?? null;
      return (
        <Card style={styles.card} onPress={() => setSelectedShift({ type: 'shift', data: shift })}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle} numberOfLines={1}>{shift.title ?? 'Shift'}</Text>
            <Badge label={shift.status} status={shift.status?.toLowerCase()} size="sm" />
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={13} color={Colors.textMuted} />
            <Text style={styles.metaText}>{formatDate(shift.shift_date, 'EEE, dd MMM yyyy')}</Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={13} color={Colors.textMuted} />
            <Text style={styles.metaText}>{formatTime(shift.start_at)} – {formatTime(shift.end_at)}</Text>
          </View>
          {locationName && (
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={13} color={Colors.textMuted} />
              <Text style={styles.metaText} numberOfLines={1}>{locationName}</Text>
            </View>
          )}
          <View style={styles.staffPill}>
            <Ionicons name="people-outline" size={13} color={Colors.primary} />
            <Text style={styles.staffText}>{shift.shift_assignments?.length ?? 0} assigned</Text>
          </View>
        </Card>
      );
    } else {
      const assignment = item;
      const shift = assignment.shifts;
      if (!shift) return null;
      const locationName = shift.locations?.name ?? shift.location ?? null;
      return (
        <Card style={styles.card} onPress={() => setSelectedShift({ type: 'assignment', data: assignment })}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle} numberOfLines={1}>{shift.title ?? 'Shift'}</Text>
            <Badge label={shift.status} status={shift.status?.toLowerCase()} size="sm" />
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={13} color={Colors.textMuted} />
            <Text style={styles.metaText}>{formatDate(shift.shift_date, 'EEE, dd MMM yyyy')}</Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={13} color={Colors.textMuted} />
            <Text style={styles.metaText}>{formatTime(shift.start_at)} – {formatTime(shift.end_at)}</Text>
          </View>
          {locationName && (
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={13} color={Colors.textMuted} />
              <Text style={styles.metaText} numberOfLines={1}>{locationName}</Text>
            </View>
          )}
        </Card>
      );
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{isManager ? 'Shifts' : 'My Shifts'}</Text>
        {isManager && (
          <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreate(true)}>
            <Ionicons name="add" size={20} color={Colors.primary} />
            <Text style={styles.createBtnText}>New Shift</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.filterRow}>
        {(['upcoming', 'past', 'all'] as Filter[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <LoadingScreen message="Loading shifts..." />
      ) : (
        <FlatList
          data={shifts}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <EmptyState
              icon="calendar-outline"
              title={filter === 'upcoming' ? 'No upcoming shifts' : 'No shifts found'}
              description={filter === 'upcoming' ? "You're all caught up!" : 'Try a different filter.'}
              actionLabel={isManager && filter !== 'past' ? 'Create Shift' : undefined}
              onAction={() => setShowCreate(true)}
            />
          }
        />
      )}

      <Modal visible={!!selectedShift} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelectedShift(null)}>
        {selectedShift && (
          <ShiftDetailModal
            shiftData={selectedShift}
            userId={user?.id ?? ''}
            orgId={organization?.id ?? ''}
            isManager={isManager}
            onClose={() => setSelectedShift(null)}
            onRefresh={() => {
              setSelectedShift(null);
              queryClient.invalidateQueries({ queryKey: ['shifts'] });
            }}
          />
        )}
      </Modal>

      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCreate(false)}>
        <CreateShiftModal
          orgId={organization?.id ?? ''}
          userId={user?.id ?? ''}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            queryClient.invalidateQueries({ queryKey: ['shifts'] });
          }}
        />
      </Modal>
    </View>
  );
}

// ─── Shift Detail Modal ───────────────────────────────────────────────────────

function ShiftDetailModal({ shiftData, userId, orgId, isManager, onClose, onRefresh }: any) {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const isAssignment = shiftData.type === 'assignment';
  const shift = isAssignment ? shiftData.data.shifts : shiftData.data;
  const assignmentId = isAssignment ? shiftData.data.id : null;
  const locationName = shift?.locations?.name ?? shift?.location ?? null;
  const [clockLoading, setClockLoading] = useState(false);

  // Current timesheet + open time entry for this assignment
  const { data: clockState, refetch: refetchClock } = useQuery({
    queryKey: ['clock-state', shift?.id, userId],
    queryFn: async () => {
      if (!shift?.id || !userId || !orgId) return null;
      const { data: ts } = await supabase
        .from('timesheets')
        .select('id, status, time_entries(id, clock_in, clock_out)')
        .eq('shift_id', shift.id)
        .eq('employee_user_id', userId)
        .maybeSingle();
      if (!ts) return { timesheet: null, openEntry: null };
      const openEntry = (ts.time_entries as any[])?.find((te) => te.clock_in && !te.clock_out) ?? null;
      return { timesheet: ts, openEntry };
    },
    enabled: isAssignment && !!shift?.id && !!userId,
  });

  async function handleClockIn() {
    if (!shift?.id || !userId || !orgId) return;
    setClockLoading(true);
    try {
      let timesheetId = clockState?.timesheet?.id;
      if (!timesheetId) {
        const { data: newTs, error: tsErr } = await supabase
          .from('timesheets')
          .insert({ organization_id: orgId, shift_id: shift.id, employee_user_id: userId, status: 'OPEN' })
          .select('id')
          .single();
        if (tsErr) throw tsErr;
        timesheetId = newTs.id;
      }
      const { error: teErr } = await supabase
        .from('time_entries')
        .insert({ timesheet_id: timesheetId, clock_in: new Date().toISOString(), break_minutes: 0 });
      if (teErr) throw teErr;
      toast.success('Clocked in!', formatTime(new Date()));
      refetchClock();
    } catch (err: any) {
      toast.error('Clock-in failed', err?.message);
    } finally {
      setClockLoading(false);
    }
  }

  async function handleClockOut() {
    if (!clockState?.openEntry?.id) return;
    setClockLoading(true);
    try {
      const { error } = await supabase
        .from('time_entries')
        .update({ clock_out: new Date().toISOString() })
        .eq('id', clockState.openEntry.id);
      if (error) throw error;
      toast.success('Clocked out!', formatTime(new Date()));
      refetchClock();
    } catch (err: any) {
      toast.error('Clock-out failed', err?.message);
    } finally {
      setClockLoading(false);
    }
  }

  const isClockedIn = !!clockState?.openEntry;
  const hasTimesheet = !!clockState?.timesheet;

  return (
    <View style={[styles.modal, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.modalHandle} />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle} numberOfLines={2}>{shift?.title ?? 'Shift Details'}</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {shift && (
          <View style={styles.detailList}>
            <DetailRow icon="calendar-outline" label="Date" value={formatDate(shift.shift_date, 'EEEE, dd MMMM yyyy')} />
            <DetailRow icon="time-outline" label="Time" value={`${formatTime(shift.start_at)} – ${formatTime(shift.end_at)}`} />
            {locationName && <DetailRow icon="location-outline" label="Location" value={locationName} />}
            {(shift.break_minutes ?? 0) > 0 && <DetailRow icon="cafe-outline" label="Break" value={`${shift.break_minutes} min`} />}
            {shift.description && <DetailRow icon="document-text-outline" label="Notes" value={shift.description} />}
          </View>
        )}

        {/* Clock in / out — employee only */}
        {isAssignment && !isManager && (
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

            {shift?.requires_photos && (
              <View style={styles.photoNote}>
                <Ionicons name="camera-outline" size={16} color={Colors.warning} />
                <Text style={styles.photoNoteText}>This shift requires photo verification</Text>
              </View>
            )}
          </View>
        )}

        {/* Manager: show assigned staff count */}
        {isManager && shiftData.data?.shift_assignments && (
          <View style={styles.staffSection}>
            <Text style={styles.staffSectionTitle}>
              {shiftData.data.shift_assignments.length} staff assigned
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Create Shift Modal (managers) ───────────────────────────────────────────

function CreateShiftModal({ orgId, userId, onClose, onCreated }: any) {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [shiftDate, setShiftDate] = useState(todayStr());
  const [startAt, setStartAt] = useState('09:00');
  const [endAt, setEndAt] = useState('17:00');
  const [breakMins, setBreakMins] = useState('30');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!shiftDate || !startAt || !endAt) {
      toast.error('Date and times are required');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from('shifts').insert({
        organization_id: orgId,
        created_by_user_id: userId,
        title: title.trim() || null,
        shift_date: shiftDate,
        end_date: shiftDate,
        start_at: startAt + ':00',
        end_at: endAt + ':00',
        break_minutes: parseInt(breakMins) || 0,
        location: location.trim() || null,
        description: notes.trim() || null,
        status: 'PUBLISHED',
      });
      if (error) throw error;
      toast.success('Shift created!');
      onCreated();
    } catch (err: any) {
      toast.error('Failed to create shift', err?.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.modal, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.modalHandle} />
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Create Shift</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <FieldLabel>Title (optional)</FieldLabel>
        <FieldInput value={title} onChangeText={setTitle} placeholder="e.g. Morning Shift" icon="text-outline" />

        <FieldLabel>Date *</FieldLabel>
        <FieldInput value={shiftDate} onChangeText={setShiftDate} placeholder="YYYY-MM-DD" icon="calendar-outline" keyboardType="numbers-and-punctuation" />

        <View style={styles.timeRow}>
          <View style={{ flex: 1 }}>
            <FieldLabel>Start time *</FieldLabel>
            <FieldInput value={startAt} onChangeText={setStartAt} placeholder="09:00" icon="time-outline" keyboardType="numbers-and-punctuation" />
          </View>
          <View style={{ flex: 1 }}>
            <FieldLabel>End time *</FieldLabel>
            <FieldInput value={endAt} onChangeText={setEndAt} placeholder="17:00" icon="time-outline" keyboardType="numbers-and-punctuation" />
          </View>
        </View>

        <FieldLabel>Break (minutes)</FieldLabel>
        <FieldInput value={breakMins} onChangeText={setBreakMins} placeholder="30" icon="cafe-outline" keyboardType="number-pad" />

        <FieldLabel>Location</FieldLabel>
        <FieldInput value={location} onChangeText={setLocation} placeholder="Address or place name" icon="location-outline" />

        <FieldLabel>Notes</FieldLabel>
        <FieldInput value={notes} onChangeText={setNotes} placeholder="Optional notes..." icon="document-text-outline" multiline />

        <View style={styles.createActions}>
          <Button title="Cancel" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
          <Button title="Create Shift" onPress={handleCreate} loading={loading} style={{ flex: 1 }} />
        </View>
      </ScrollView>
    </View>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.fieldLabel}>{children}</Text>;
}

function FieldInput({ value, onChangeText, placeholder, icon, keyboardType, multiline }: any) {
  return (
    <View style={[styles.inputWrap, multiline && styles.inputMulti]}>
      <Ionicons name={icon} size={16} color={Colors.textMuted} style={styles.inputIcon} />
      <TextInput
        style={[styles.textInput, multiline && { minHeight: 72, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        keyboardType={keyboardType ?? 'default'}
        multiline={multiline}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
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
  screen: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  createBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primaryLight + '30', borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderWidth: 1, borderColor: Colors.primary + '40' },
  createBtnText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.medium },
  filterRow: { flexDirection: 'row', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.xs },
  filterTab: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.full, backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border },
  filterTabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  filterTextActive: { color: '#FFF' },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing.xl },
  card: { gap: Spacing.xs },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  cardTitle: { flex: 1, fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  staffPill: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: Spacing.xs, backgroundColor: Colors.primaryLight + '20', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  staffText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.medium },
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
  clockedInBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.success + '20', borderRadius: Radius.md, padding: Spacing.sm + 2, borderWidth: 1, borderColor: Colors.success + '40' },
  clockDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.success },
  clockedInText: { fontSize: FontSize.sm, color: Colors.success, fontWeight: FontWeight.medium },
  photoNote: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, padding: Spacing.sm, backgroundColor: Colors.warningLight + '30', borderRadius: Radius.md },
  photoNoteText: { fontSize: FontSize.sm, color: Colors.warning },
  staffSection: { padding: Spacing.sm, backgroundColor: Colors.bgInput, borderRadius: Radius.md, marginBottom: Spacing.md },
  staffSectionTitle: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  // Create shift form
  timeRow: { flexDirection: 'row', gap: Spacing.sm },
  fieldLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.textSecondary, marginBottom: Spacing.xs, marginTop: Spacing.sm },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bgInput, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: Spacing.sm, marginBottom: 2 },
  inputMulti: { alignItems: 'flex-start', paddingVertical: Spacing.xs },
  inputIcon: { marginRight: 6 },
  textInput: { flex: 1, paddingVertical: Spacing.sm + 2, fontSize: FontSize.base, color: Colors.textPrimary },
  createActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
});
