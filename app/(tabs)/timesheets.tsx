import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Modal, ScrollView, TextInput } from 'react-native';
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

export default function TimesheetsScreen() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user, organization } = useAuthStore();
  const [filter, setFilter] = useState<'draft' | 'submitted' | 'approved' | 'all'>('all');
  const [selected, setSelected] = useState<any>(null);

  const { data: timesheets = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['my-timesheets', user?.id, organization?.id, filter],
    queryFn: async () => {
      if (!user?.id || !organization?.id) return [];
      let q = supabase
        .from('timesheets')
        .select('*, shifts(title)')
        .eq('user_id', user.id)
        .eq('organization_id', organization.id);
      if (filter !== 'all') q = q.eq('status', filter);
      const { data } = await q.order('start_time', { ascending: false }).limit(50);
      return data ?? [];
    },
    enabled: !!user?.id && !!organization?.id,
  });

  const submitMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('timesheets')
        .update({ status: 'submitted' })
        .eq('id', id)
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Timesheet submitted!');
      queryClient.invalidateQueries({ queryKey: ['my-timesheets'] });
      setSelected(null);
    },
    onError: () => toast.error('Failed to submit timesheet'),
  });

  const renderItem = ({ item }: { item: any }) => (
    <Card style={styles.card} onPress={() => setSelected(item)}>
      <View style={styles.cardHeader}>
        <View style={styles.cardLeft}>
          <Text style={styles.cardTitle}>
            {item.shifts?.title ?? formatDate(item.start_time, 'EEE, dd MMM')}
          </Text>
          <Text style={styles.cardDate}>{formatDate(item.start_time, 'dd MMM yyyy')}</Text>
        </View>
        <View style={styles.cardRight}>
          <Badge label={item.status} status={item.status} size="sm" />
          {item.total_hours && (
            <Text style={styles.hours}>{formatHours(item.total_hours)}</Text>
          )}
        </View>
      </View>
      <View style={styles.timeRow}>
        <Ionicons name="time-outline" size={13} color={Colors.textMuted} />
        <Text style={styles.timeText}>{formatTime(item.start_time)} – {formatTime(item.end_time)}</Text>
        {item.break_minutes && (
          <Text style={styles.breakText}>· {item.break_minutes}min break</Text>
        )}
      </View>
      {item.notes && (
        <Text style={styles.notes} numberOfLines={1}>{item.notes}</Text>
      )}
    </Card>
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Timesheets</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
        {(['all', 'draft', 'submitted', 'approved'] as const).map((f) => (
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
              description={filter === 'all' ? "Your timesheets will appear here." : `No ${filter} timesheets.`}
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
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Date</Text>
            <Text style={styles.detailValue}>{formatDate(timesheet.start_time, 'EEEE, dd MMMM yyyy')}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Start time</Text>
            <Text style={styles.detailValue}>{formatTime(timesheet.start_time)}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>End time</Text>
            <Text style={styles.detailValue}>{formatTime(timesheet.end_time)}</Text>
          </View>
          {timesheet.break_minutes != null && (
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Break</Text>
              <Text style={styles.detailValue}>{timesheet.break_minutes} minutes</Text>
            </View>
          )}
          {timesheet.total_hours != null && (
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Total hours</Text>
              <Text style={[styles.detailValue, styles.totalHours]}>{formatHours(timesheet.total_hours)}</Text>
            </View>
          )}
          {timesheet.shifts?.title && (
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Shift</Text>
              <Text style={styles.detailValue}>{timesheet.shifts.title}</Text>
            </View>
          )}
          {timesheet.notes && (
            <View style={[styles.detailItem, styles.fullWidth]}>
              <Text style={styles.detailLabel}>Notes</Text>
              <Text style={styles.detailValue}>{timesheet.notes}</Text>
            </View>
          )}
          {timesheet.rejected_reason && (
            <View style={[styles.detailItem, styles.fullWidth, styles.rejectedBox]}>
              <Text style={styles.rejectedLabel}>Rejection reason</Text>
              <Text style={styles.rejectedValue}>{timesheet.rejected_reason}</Text>
            </View>
          )}
        </View>

        {timesheet.status === 'draft' && (
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
  cardRight: { alignItems: 'flex-end', gap: 4 },
  cardTitle: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  cardDate: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  hours: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.primary },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  timeText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  breakText: { fontSize: FontSize.sm, color: Colors.textMuted },
  notes: { fontSize: FontSize.xs, color: Colors.textMuted, fontStyle: 'italic' },
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
  fullWidth: { width: '100%' },
  rejectedBox: { backgroundColor: Colors.dangerLight + '20', borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.danger + '30' },
  rejectedLabel: { fontSize: FontSize.xs, color: Colors.danger, marginBottom: 4 },
  rejectedValue: { fontSize: FontSize.sm, color: Colors.textPrimary },
  actionBtn: { marginTop: Spacing.sm },
});
