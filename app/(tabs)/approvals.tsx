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
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Divider } from '@/components/ui/Divider';
import { useToast } from '@/components/ui/Toast';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/lib/theme';
import { formatDate, formatTime, formatHours, fullName } from '@/lib/format';

type FilterType = 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'ALL';

export default function ApprovalsScreen() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user, organization } = useAuthStore();
  const [filter, setFilter] = useState<FilterType>('SUBMITTED');
  const [selected, setSelected] = useState<any>(null);

  const { data: timesheets = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['approvals', organization?.id, filter],
    queryFn: async () => {
      if (!organization?.id) return [];
      let q = supabase
        .from('timesheets')
        .select('*, shifts(title, shift_date, start_at, end_at)')
        .eq('organization_id', organization.id);
      if (filter !== 'ALL') q = q.eq('status', filter);
      const { data: tsData } = await q.order('created_at', { ascending: true }).limit(100);
      if (!tsData || tsData.length === 0) return [];

      // Fetch profiles separately (no direct FK from employee_user_id to profiles.user_id)
      const userIds = [...new Set(tsData.map((t) => t.employee_user_id).filter(Boolean))];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', userIds);
      const profileMap = Object.fromEntries((profilesData ?? []).map((p) => [p.user_id, p]));

      return tsData.map((ts) => ({
        ...ts,
        profile: profileMap[ts.employee_user_id] ?? null,
      }));
    },
    enabled: !!organization?.id,
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('timesheets')
        .update({ status: 'APPROVED', approved_by_user_id: user!.id, approved_at: new Date().toISOString() })
        .eq('id', id)
        .eq('organization_id', organization!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Timesheet approved');
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      setSelected(null);
    },
    onError: () => toast.error('Failed to approve timesheet'),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase
        .from('timesheets')
        .update({ status: 'REJECTED', rejection_reason: reason })
        .eq('id', id)
        .eq('organization_id', organization!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Timesheet rejected');
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      setSelected(null);
    },
    onError: () => toast.error('Failed to reject timesheet'),
  });

  const pendingCount = timesheets.filter((t: any) => t.status === 'SUBMITTED').length;

  const renderItem = ({ item }: { item: any }) => (
    <Card style={styles.card} onPress={() => setSelected(item)}>
      <View style={styles.cardHeader}>
        <Avatar name={fullName(item.profile?.full_name)} url={item.profile?.avatar_url} size={40} color={Colors.primary} />
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{fullName(item.profile?.full_name)}</Text>
          <Text style={styles.cardMeta}>
            {item.shifts?.title ?? 'Manual entry'}
            {item.shifts?.shift_date ? ` · ${formatDate(item.shifts.shift_date, 'dd MMM yyyy')}` : ''}
          </Text>
          {item.shifts?.start_at && (
            <Text style={styles.cardTime}>
              {formatTime(item.shifts.start_at)} – {item.shifts?.end_at ? formatTime(item.shifts.end_at) : '—'}
            </Text>
          )}
        </View>
        <Badge label={item.status} status={item.status} size="sm" />
      </View>
    </Card>
  );

  const filters: FilterType[] = ['SUBMITTED', 'APPROVED', 'REJECTED', 'ALL'];

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Approvals</Text>
        {pendingCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{pendingCount}</Text>
          </View>
        )}
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
              icon="checkmark-circle-outline"
              title={filter === 'SUBMITTED' ? 'No pending approvals' : 'No timesheets found'}
              description={filter === 'SUBMITTED' ? "You're all caught up!" : `No ${filter.toLowerCase()} timesheets.`}
            />
          }
        />
      )}

      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
        {selected && (
          <ApprovalDetailModal
            timesheet={selected}
            onClose={() => setSelected(null)}
            onApprove={() => approveMutation.mutate(selected.id)}
            onReject={(reason: string) => rejectMutation.mutate({ id: selected.id, reason })}
            approving={approveMutation.isPending}
            rejecting={rejectMutation.isPending}
          />
        )}
      </Modal>
    </View>
  );
}

function ApprovalDetailModal({ timesheet, onClose, onApprove, onReject, approving, rejecting }: any) {
  const insets = useSafeAreaInsets();
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const isPending = timesheet.status === 'SUBMITTED';

  return (
    <View style={[styles.modal, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.modalHandle} />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Timesheet Review</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.employeeRow}>
          <Avatar name={fullName(timesheet.profile?.full_name)} url={timesheet.profile?.avatar_url} size={48} color={Colors.primary} />
          <View style={styles.employeeInfo}>
            <Text style={styles.employeeName}>{fullName(timesheet.profile?.full_name)}</Text>
            <Badge label={timesheet.status} status={timesheet.status} size="sm" />
          </View>
        </View>

        <Divider margin="sm" />

        <View style={styles.detailGrid}>
          {timesheet.shifts?.title && <DetailItem label="Shift" value={timesheet.shifts.title} />}
          {timesheet.shifts?.shift_date && <DetailItem label="Date" value={formatDate(timesheet.shifts.shift_date, 'EEEE, dd MMMM yyyy')} />}
          {timesheet.shifts?.start_at && <DetailItem label="Start time" value={formatTime(timesheet.shifts.start_at)} />}
          {timesheet.shifts?.end_at && <DetailItem label="End time" value={formatTime(timesheet.shifts.end_at)} />}
          {timesheet.rejection_reason && <DetailItem label="Rejection reason" value={timesheet.rejection_reason} danger />}
        </View>

        {isPending && !showReject && (
          <View style={styles.actions}>
            <Button title="Approve" variant="success" icon={<Ionicons name="checkmark" size={18} color="#FFF" />} onPress={onApprove} loading={approving} fullWidth size="lg" />
            <Button title="Reject" variant="danger" icon={<Ionicons name="close" size={18} color="#FFF" />} onPress={() => setShowReject(true)} fullWidth size="lg" />
          </View>
        )}

        {isPending && showReject && (
          <View style={styles.rejectBox}>
            <Text style={styles.rejectLabel}>Reason for rejection</Text>
            <TextInput
              style={styles.rejectInput}
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="Explain why this timesheet is being rejected..."
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <View style={styles.rejectActions}>
              <Button title="Cancel" variant="secondary" onPress={() => setShowReject(false)} style={{ flex: 1 }} />
              <Button
                title="Confirm Reject"
                variant="danger"
                onPress={() => onReject(rejectReason)}
                loading={rejecting}
                disabled={!rejectReason.trim()}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function DetailItem({ label, value, highlight, danger }: { label: string; value: string; highlight?: boolean; danger?: boolean }) {
  return (
    <View style={styles.detailItem}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, highlight && styles.detailHighlight, danger && styles.detailDanger]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  badge: { backgroundColor: Colors.danger, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText: { fontSize: 11, fontWeight: FontWeight.bold, color: '#FFF' },
  filterScroll: { maxHeight: 48 },
  filterRow: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.xs },
  filterTab: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.full, backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border },
  filterTabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  filterTextActive: { color: '#FFF' },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing.xl },
  card: { gap: Spacing.xs },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  cardInfo: { flex: 1 },
  cardName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  cardMeta: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  cardTime: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 1 },
  modal: { flex: 1, backgroundColor: Colors.bgCard, paddingHorizontal: Spacing.md },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.md },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  employeeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.sm },
  employeeInfo: { gap: Spacing.xs },
  employeeName: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  detailGrid: { gap: Spacing.md, marginBottom: Spacing.lg },
  detailItem: {},
  detailLabel: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 2 },
  detailValue: { fontSize: FontSize.base, color: Colors.textPrimary },
  detailHighlight: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.primary },
  detailDanger: { color: Colors.danger },
  actions: { gap: Spacing.sm },
  rejectBox: { gap: Spacing.sm },
  rejectLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.textSecondary },
  rejectInput: { backgroundColor: Colors.bgInput, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, color: Colors.textPrimary, fontSize: FontSize.base, padding: Spacing.md, minHeight: 80 },
  rejectActions: { flexDirection: 'row', gap: Spacing.sm },
});
