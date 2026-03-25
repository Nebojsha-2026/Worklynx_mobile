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

type FilterType = 'ALL' | 'OPEN' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

export default function TimesheetsScreen() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user, organization } = useAuthStore();
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [selected, setSelected] = useState<any>(null);

  const { data: timesheets = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['my-timesheets', user?.id, organization?.id, filter],
    queryFn: async () => {
      if (!user?.id || !organization?.id) return [];
      let q = supabase
        .from('timesheets')
        .select('*, shifts(title, shift_date, start_at, end_at), time_entries(clock_in, clock_out, break_minutes)')
        .eq('employee_user_id', user.id)
        .eq('organization_id', organization.id);
      if (filter !== 'ALL') q = q.eq('status', filter);
      const { data } = await q.order('created_at', { ascending: false }).limit(50);
      return data ?? [];
    },
    enabled: !!user?.id && !!organization?.id,
  });

  const submitMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('timesheets')
        .update({ status: 'SUBMITTED' })
        .eq('id', id)
        .eq('employee_user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Timesheet submitted!');
      queryClient.invalidateQueries({ queryKey: ['my-timesheets'] });
      setSelected(null);
    },
    onError: () => toast.error('Failed to submit timesheet'),
  });

  const renderItem = ({ item }: { item: any }) => {
    const shiftDate = item.shifts?.shift_date;
    const startAt = item.shifts?.start_at;
    const endAt = item.shifts?.end_at;
    return (
      <Card style={styles.card} onPress={() => setSelected(item)}>
        <View style={styles.cardHeader}>
          <View style={styles.cardLeft}>
            <Text style={styles.cardTitle}>
              {item.shifts?.title ?? (shiftDate ? formatDate(shiftDate) : 'Manual entry')}
            </Text>
            <Text style={styles.cardDate}>
              {shiftDate ? formatDate(shiftDate, 'dd MMM yyyy') : formatDate(item.created_at, 'dd MMM yyyy')}
            </Text>
          </View>
          <Badge label={item.status} status={item.status} size="sm" />
        </View>
        {(startAt || endAt) && (
          <View style={styles.timeRow}>
            <Ionicons name="time-outline" size={13} color={Colors.textMuted} />
            <Text style={styles.timeText}>
              {startAt ? formatTime(startAt) : '—'} – {endAt ? formatTime(endAt) : '—'}
            </Text>
          </View>
        )}
      </Card>
    );
  };

  const filters: FilterType[] = ['ALL', 'OPEN', 'SUBMITTED', 'APPROVED', 'REJECTED'];

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Timesheets</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {isLoading ? (
        <LoadingScreen message="Loading timesheets..." />
      ) : (
        <FlatList
          data={timesheets}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <EmptyState
              icon="time-outline"
              title="No timesheets"
              description={filter === 'ALL' ? "Your timesheets will appear here." : `No ${filter.toLowerCase()} timesheets.`}
            />
          }
        />
      )}

      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
        {selected && (
          <TimesheetDetailModal
            timesheet={selected}
            onClose={() => setSelected(null)}
            onSubmit={() => submitMutation.mutate(selected.id)}
            submitting={submitMutation.isPending}
          />
        )}
      </Modal>
    </View>
  );
}

function TimesheetDetailModal({ timesheet, onClose, onSubmit, submitting }: any) {
  const insets = useSafeAreaInsets();
  const shiftDate = timesheet.shifts?.shift_date;
  const startAt = timesheet.shifts?.start_at;
  const endAt = timesheet.shifts?.end_at;
  const timeEntries: any[] = timesheet.time_entries ?? [];

  const totalMinutes = timeEntries.reduce((sum: number, te: any) => {
    if (te.clock_in && te.clock_out) {
      const mins = (new Date(te.clock_out).getTime() - new Date(te.clock_in).getTime()) / 60000;
      const breakMins = te.break_minutes ?? 0;
      return sum + Math.max(0, mins - breakMins);
    }
    return sum;
  }, 0);

  return (
    <View style={[styles.modal, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.modalHandle} />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Timesheet Details</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <Badge label={timesheet.status} status={timesheet.status} style={styles.statusBadge} />

        <View style={styles.detailGrid}>
          {timesheet.shifts?.title && (
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Shift</Text>
              <Text style={styles.detailValue}>{timesheet.shifts.title}</Text>
            </View>
          )}
          {shiftDate && (
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Date</Text>
              <Text style={styles.detailValue}>{formatDate(shiftDate, 'EEEE, dd MMMM yyyy')}</Text>
            </View>
          )}
          {startAt && (
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Shift start</Text>
              <Text style={styles.detailValue}>{formatTime(startAt)}</Text>
            </View>
          )}
          {endAt && (
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Shift end</Text>
              <Text style={styles.detailValue}>{formatTime(endAt)}</Text>
            </View>
          )}
          {totalMinutes > 0 && (
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Total hours worked</Text>
              <Text style={[styles.detailValue, styles.totalHours]}>{formatHours(totalMinutes)}</Text>
            </View>
          )}
          {timesheet.rejection_reason && (
            <View style={[styles.detailItem, styles.rejectedBox]}>
              <Text style={styles.rejectedLabel}>Rejection reason</Text>
              <Text style={styles.rejectedValue}>{timesheet.rejection_reason}</Text>
            </View>
          )}
        </View>

        {timeEntries.length > 0 && (
          <>
            <Text style={styles.entriesTitle}>Time Entries</Text>
            {timeEntries.map((te: any, idx: number) => (
              <View key={idx} style={styles.entryRow}>
                <Ionicons name="time-outline" size={14} color={Colors.textMuted} />
                <Text style={styles.entryText}>
                  {te.clock_in ? formatTime(te.clock_in) : '—'} – {te.clock_out ? formatTime(te.clock_out) : 'Active'}
                  {te.break_minutes ? `  ·  ${te.break_minutes}min break` : ''}
                </Text>
              </View>
            ))}
          </>
        )}

        {timesheet.status === 'OPEN' && (
          <Button
            title="Submit for Approval"
            onPress={onSubmit}
            loading={submitting}
            fullWidth
            size="lg"
            style={styles.actionBtn}
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  filterScroll: { maxHeight: 48 },
  filterRow: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.xs },
  filterTab: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.full, backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border },
  filterTabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  filterTextActive: { color: '#FFF' },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing.xl },
  card: { gap: Spacing.xs },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  cardLeft: { flex: 1, marginRight: Spacing.sm },
  cardTitle: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  cardDate: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  timeText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  modal: { flex: 1, backgroundColor: Colors.bgCard, paddingHorizontal: Spacing.md },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.md },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  statusBadge: { marginBottom: Spacing.lg },
  detailGrid: { gap: Spacing.md, marginBottom: Spacing.lg },
  detailItem: {},
  detailLabel: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 2 },
  detailValue: { fontSize: FontSize.base, color: Colors.textPrimary },
  totalHours: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.primary },
  rejectedBox: { backgroundColor: Colors.dangerLight + '20', borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.danger + '30' },
  rejectedLabel: { fontSize: FontSize.xs, color: Colors.danger, marginBottom: 4 },
  rejectedValue: { fontSize: FontSize.sm, color: Colors.textPrimary },
  entriesTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textSecondary, marginBottom: Spacing.xs },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  entryText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  actionBtn: { marginTop: Spacing.sm },
});
