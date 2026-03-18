import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Modal, ScrollView } from 'react-native';
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
import { formatDate, formatTime, formatHours } from '@/lib/format';

type Filter = 'upcoming' | 'past' | 'all';

export default function ShiftsScreen() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user, orgMember, organization, role } = useAuthStore();
  const [filter, setFilter] = useState<Filter>('upcoming');
  const [selectedShift, setSelectedShift] = useState<any>(null);

  const isManager = role === 'manager' || role === 'business_manager' || role === 'business_owner';

  const { data: shifts = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['shifts', user?.id, organization?.id, filter, role],
    queryFn: async () => {
      if (!organization?.id) return [];
      const now = new Date().toISOString();

      if (isManager) {
        let q = supabase
          .from('shifts')
          .select('*, locations(name, address), shift_assignments(id, status, user_id, clock_in_time, clock_out_time, profiles(first_name, last_name))')
          .eq('organization_id', organization.id);

        if (filter === 'upcoming') q = q.gte('start_time', now);
        else if (filter === 'past') q = q.lt('end_time', now);

        const { data } = await q.order('start_time', { ascending: filter !== 'past' }).limit(50);
        return data ?? [];
      } else {
        // Employee: only my assignments
        let q = supabase
          .from('shift_assignments')
          .select('*, shifts(*, locations(name, address))')
          .eq('user_id', user!.id)
          .eq('organization_id', organization.id);

        if (filter === 'upcoming') q = q.gte('shifts(start_time)', now);
        else if (filter === 'past') q = q.lt('shifts(end_time)', now);

        const { data } = await q.order('shifts(start_time)', { ascending: filter !== 'past' }).limit(50);
        return data ?? [];
      }
    },
    enabled: !!organization?.id,
  });

  const clockInMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase
        .from('shift_assignments')
        .update({ clock_in_time: new Date().toISOString(), status: 'confirmed' })
        .eq('id', assignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Clocked in!');
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      setSelectedShift(null);
    },
    onError: () => toast.error('Failed to clock in'),
  });

  const clockOutMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase
        .from('shift_assignments')
        .update({ clock_out_time: new Date().toISOString(), status: 'completed' })
        .eq('id', assignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Clocked out!');
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      setSelectedShift(null);
    },
    onError: () => toast.error('Failed to clock out'),
  });

  const renderItem = ({ item }: { item: any }) => {
    if (isManager) {
      const shift = item;
      return (
        <Card style={styles.card} onPress={() => setSelectedShift({ type: 'shift', data: shift })}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle} numberOfLines={1}>{shift.title}</Text>
            <Badge label={shift.status} status={shift.status} size="sm" />
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={13} color={Colors.textMuted} />
            <Text style={styles.metaText}>{formatDate(shift.start_time, 'EEE, dd MMM yyyy')}</Text>
          </View>
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
          <View style={styles.staffPill}>
            <Ionicons name="people-outline" size={13} color={Colors.primary} />
            <Text style={styles.staffText}>{shift.shift_assignments?.length ?? 0}/{shift.required_staff} assigned</Text>
          </View>
        </Card>
      );
    } else {
      const assignment = item;
      const shift = assignment.shifts;
      if (!shift) return null;
      return (
        <Card style={styles.card} onPress={() => setSelectedShift({ type: 'assignment', data: assignment })}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle} numberOfLines={1}>{shift.title}</Text>
            <Badge label={assignment.status} status={assignment.status} size="sm" />
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={13} color={Colors.textMuted} />
            <Text style={styles.metaText}>{formatDate(shift.start_time, 'EEE, dd MMM yyyy')}</Text>
          </View>
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
            <View style={styles.activeClockBanner}>
              <Ionicons name="radio-button-on" size={12} color={Colors.success} />
              <Text style={styles.activeClockText}>Clocked in at {formatTime(assignment.clock_in_time)}</Text>
            </View>
          )}
        </Card>
      );
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{isManager ? 'Shifts' : 'My Shifts'}</Text>
        {isManager && (
          <TouchableOpacity style={styles.addBtn}>
            <Ionicons name="add-circle" size={28} color={Colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Tabs */}
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

      {/* Shift Detail Modal */}
      <Modal visible={!!selectedShift} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelectedShift(null)}>
        {selectedShift && (
          <ShiftDetailModal
            shiftData={selectedShift}
            onClose={() => setSelectedShift(null)}
            onClockIn={(id) => clockInMutation.mutate(id)}
            onClockOut={(id) => clockOutMutation.mutate(id)}
            clockingIn={clockInMutation.isPending}
            clockingOut={clockOutMutation.isPending}
          />
        )}
      </Modal>
    </View>
  );
}

function ShiftDetailModal({ shiftData, onClose, onClockIn, onClockOut, clockingIn, clockingOut }: any) {
  const insets = useSafeAreaInsets();
  const isAssignment = shiftData.type === 'assignment';
  const shift = isAssignment ? shiftData.data.shifts : shiftData.data;
  const assignment = isAssignment ? shiftData.data : null;

  const canClockIn = isAssignment && assignment?.status === 'assigned' || assignment?.status === 'confirmed' && !assignment?.clock_in_time;
  const canClockOut = isAssignment && assignment?.clock_in_time && !assignment?.clock_out_time;

  return (
    <View style={[styles.modal, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.modalHandle} />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{shift?.title}</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {shift && (
          <View style={styles.detailList}>
            <DetailRow icon="calendar-outline" label="Date" value={formatDate(shift.start_time, 'EEEE, dd MMMM yyyy')} />
            <DetailRow icon="time-outline" label="Time" value={`${formatTime(shift.start_time)} – ${formatTime(shift.end_time)}`} />
            {shift.locations?.name && <DetailRow icon="location-outline" label="Location" value={shift.locations.name} />}
            {shift.locations?.address && <DetailRow icon="map-outline" label="Address" value={shift.locations.address} />}
            {shift.break_minutes && <DetailRow icon="cafe-outline" label="Break" value={`${shift.break_minutes} min`} />}
            {shift.notes && <DetailRow icon="document-text-outline" label="Notes" value={shift.notes} />}
          </View>
        )}

        {assignment && (
          <View style={styles.clockSection}>
            {assignment.clock_in_time && (
              <View style={styles.clockRow}>
                <Text style={styles.clockLabel}>Clocked in</Text>
                <Text style={styles.clockValue}>{formatTime(assignment.clock_in_time)}</Text>
              </View>
            )}
            {assignment.clock_out_time && (
              <View style={styles.clockRow}>
                <Text style={styles.clockLabel}>Clocked out</Text>
                <Text style={styles.clockValue}>{formatTime(assignment.clock_out_time)}</Text>
              </View>
            )}
          </View>
        )}

        {(canClockIn || canClockOut) && (
          <View style={styles.actionRow}>
            {canClockIn && (
              <Button
                title="Clock In"
                icon={<Ionicons name="log-in-outline" size={18} color="#FFF" />}
                onPress={() => onClockIn(assignment.id)}
                loading={clockingIn}
                variant="success"
                fullWidth
                size="lg"
              />
            )}
            {canClockOut && (
              <Button
                title="Clock Out"
                icon={<Ionicons name="log-out-outline" size={18} color="#FFF" />}
                onPress={() => onClockOut(assignment.id)}
                loading={clockingOut}
                variant="danger"
                fullWidth
                size="lg"
              />
            )}
          </View>
        )}
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
  addBtn: { padding: 4 },
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
  activeClockBanner: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  activeClockText: { fontSize: FontSize.xs, color: Colors.success, fontWeight: FontWeight.medium },
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
  clockSection: { backgroundColor: Colors.bgInput, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.lg, gap: Spacing.sm },
  clockRow: { flexDirection: 'row', justifyContent: 'space-between' },
  clockLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  clockValue: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.semibold },
  actionRow: { gap: Spacing.sm },
});
