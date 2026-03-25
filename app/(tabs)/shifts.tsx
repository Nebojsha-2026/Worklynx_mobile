import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Modal, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/lib/theme';
import { formatDate, formatTime } from '@/lib/format';

type Filter = 'upcoming' | 'past' | 'all';

function todayStr() {
  return new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"
}

export default function ShiftsScreen() {
  const insets = useSafeAreaInsets();
  const { user, organization, role } = useAuthStore();
  const [filter, setFilter] = useState<Filter>('upcoming');
  const [selectedShift, setSelectedShift] = useState<any>(null);

  // FIX: roles are uppercase
  const isManager = role === 'MANAGER' || role === 'BM' || role === 'BO';

  const { data: shifts = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['shifts', user?.id, organization?.id, filter, role],
    queryFn: async () => {
      if (!organization?.id) return [];
      const today = todayStr();

      if (isManager) {
        // Manager: query shifts directly, filter by shift_date
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
        // Employee: query shift_assignments with employee_user_id (not user_id)
        const { data } = await supabase
          .from('shift_assignments')
          .select('*, shifts(id, title, shift_date, start_at, end_at, break_minutes, description, status, organization_id, location, location_id, locations(name, address))')
          .eq('employee_user_id', user!.id)
          .limit(200);

        const all = data ?? [];
        // Filter client-side by org and date
        const orgFiltered = all.filter((a: any) => a.shifts?.organization_id === organization.id);
        const dateFiltered = orgFiltered.filter((a: any) => {
          const sd = a.shifts?.shift_date;
          if (!sd) return true;
          if (filter === 'upcoming') return sd >= today;
          if (filter === 'past') return sd < today;
          return true;
        });
        // Sort by shift_date + start_at
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
            />
          }
        />
      )}

      <Modal visible={!!selectedShift} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelectedShift(null)}>
        {selectedShift && (
          <ShiftDetailModal shiftData={selectedShift} onClose={() => setSelectedShift(null)} />
        )}
      </Modal>
    </View>
  );
}

function ShiftDetailModal({ shiftData, onClose }: any) {
  const insets = useSafeAreaInsets();
  const isAssignment = shiftData.type === 'assignment';
  const shift = isAssignment ? shiftData.data.shifts : shiftData.data;
  const locationName = shift?.locations?.name ?? shift?.location ?? null;

  return (
    <View style={[styles.modal, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.modalHandle} />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{shift?.title ?? 'Shift Details'}</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {shift && (
          <View style={styles.detailList}>
            <DetailRow icon="calendar-outline" label="Date" value={formatDate(shift.shift_date, 'EEEE, dd MMMM yyyy')} />
            <DetailRow icon="time-outline" label="Time" value={`${formatTime(shift.start_at)} – ${formatTime(shift.end_at)}`} />
            {locationName && <DetailRow icon="location-outline" label="Location" value={locationName} />}
            {shift.break_minutes > 0 && <DetailRow icon="cafe-outline" label="Break" value={`${shift.break_minutes} min`} />}
            {shift.description && <DetailRow icon="document-text-outline" label="Notes" value={shift.description} />}
          </View>
        )}

        <View style={styles.timesheetNote}>
          <Ionicons name="information-circle-outline" size={16} color={Colors.textMuted} />
          <Text style={styles.timesheetNoteText}>Clock in/out is done via the Timesheets tab</Text>
        </View>
      </ScrollView>
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
  modal: { flex: 1, backgroundColor: Colors.bgCard, paddingHorizontal: Spacing.md },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.md },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.lg },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, flex: 1 },
  detailList: { gap: Spacing.md, marginBottom: Spacing.lg },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  detailIcon: { marginTop: 2 },
  detailContent: { flex: 1 },
  detailLabel: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 2 },
  detailValue: { fontSize: FontSize.base, color: Colors.textPrimary },
  timesheetNote: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, padding: Spacing.sm, backgroundColor: Colors.bgInput, borderRadius: Radius.md },
  timesheetNoteText: { fontSize: FontSize.sm, color: Colors.textMuted },
});
