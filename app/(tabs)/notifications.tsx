import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Colors, FontSize, FontWeight, Spacing } from '@/lib/theme';
import { formatRelative } from '@/lib/format';

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const { data: notifications = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      return data ?? [];
    },
    enabled: !!user?.id,
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .is('read_at', null);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const unreadCount = notifications.filter((n: any) => !n.read_at).length;

  const iconForType = (type: string): keyof typeof Ionicons.glyphMap => {
    if (type.includes('shift')) return 'calendar';
    if (type.includes('timesheet') || type.includes('approval')) return 'checkmark-circle';
    if (type.includes('invite')) return 'person-add';
    if (type.includes('message') || type.includes('comm')) return 'chatbubble';
    return 'notifications';
  };

  const colorForType = (type: string): string => {
    if (type.includes('approved')) return Colors.success;
    if (type.includes('rejected')) return Colors.danger;
    if (type.includes('invite')) return Colors.info;
    return Colors.primary;
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity onPress={() => !item.read_at && markReadMutation.mutate(item.id)} activeOpacity={0.8}>
      <Card style={[styles.card, !item.read_at && styles.cardUnread]}>
        <View style={styles.row}>
          <View style={[styles.iconWrap, { backgroundColor: `${colorForType(item.type)}20` }]}>
            <Ionicons name={iconForType(item.type)} size={20} color={colorForType(item.type)} />
          </View>
          <View style={styles.content}>
            <View style={styles.titleRow}>
              <Text style={[styles.notifTitle, !item.read_at && styles.notifTitleUnread]}>{item.title}</Text>
              {!item.read_at && <View style={styles.unreadDot} />}
            </View>
            <Text style={styles.notifBody} numberOfLines={2}>{item.body}</Text>
            <Text style={styles.time}>{formatRelative(item.created_at)}</Text>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
        {unreadCount > 0 && (
          <Button title="Mark all read" variant="ghost" size="sm" onPress={() => markAllReadMutation.mutate()} />
        )}
      </View>

      {isLoading ? (
        <LoadingScreen message="Loading notifications..." />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <EmptyState
              icon="notifications-outline"
              title="No notifications"
              description="You're all caught up! Notifications about shifts, timesheets, and more will appear here."
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing.xl },
  card: {},
  cardUnread: { borderColor: Colors.primary + '40', backgroundColor: Colors.bgCard },
  row: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  content: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, justifyContent: 'space-between' },
  notifTitle: { flex: 1, fontSize: FontSize.base, color: Colors.textSecondary },
  notifTitleUnread: { color: Colors.textPrimary, fontWeight: FontWeight.semibold },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  notifBody: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2, lineHeight: 18 },
  time: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 4 },
});
