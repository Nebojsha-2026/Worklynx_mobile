import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
  Modal, ScrollView, TextInput, Alert, Platform, Image, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
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

// ── Haversine distance in metres ─────────────────────────────────────────────
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const STORAGE_BUCKET = 'shift-photos';
const GEO_POLL_MS   = 60_000;  // check location every 60 s while clocked in
const GEO_GRACE_MS  = 10 * 60_000; // 10-minute grace before auto clock-out

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
  const hasGeo = !!(shift?.geo_lat && shift?.geo_lng);
  const geoRadius = shift?.geofence_radius ?? 200;

  const [clockLoading, setClockLoading] = useState(false);
  const [geoWarning, setGeoWarning] = useState<string | null>(null); // shown while outside radius
  const [photoUploading, setPhotoUploading] = useState<'BEFORE' | 'AFTER' | null>(null);
  const geoOutSince = useRef<number | null>(null);
  const autoClockOutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geoInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Current timesheet + open time entry
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

  // Shift photos
  const { data: photos = [], refetch: refetchPhotos } = useQuery({
    queryKey: ['shift-photos', shift?.id, userId],
    queryFn: async () => {
      if (!shift?.id || !orgId) return [];
      const { data } = await supabase
        .from('shift_photos')
        .select('id, photo_type, storage_url, employee_user_id')
        .eq('shift_id', shift.id)
        .eq('organization_id', orgId)
        .eq('employee_user_id', userId)
        .order('created_at', { ascending: true });
      return data ?? [];
    },
    enabled: isAssignment && !!shift?.requires_photos && !!shift?.id,
  });

  const isClockedIn = !!clockState?.openEntry;
  const hasTimesheet = !!clockState?.timesheet;
  const hasBefore = photos.some((p: any) => p.photo_type === 'BEFORE');
  const hasAfter  = photos.some((p: any) => p.photo_type === 'AFTER');

  // ── GPS geofence monitor while clocked in ──────────────────────────────────
  useEffect(() => {
    if (!isClockedIn || !hasGeo) return;

    async function checkPosition() {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const dist = haversineDistance(pos.coords.latitude, pos.coords.longitude, shift.geo_lat, shift.geo_lng);

        if (dist <= geoRadius) {
          // Back inside — cancel any pending auto clock-out
          geoOutSince.current = null;
          if (autoClockOutTimer.current) { clearTimeout(autoClockOutTimer.current); autoClockOutTimer.current = null; }
          setGeoWarning(null);
        } else {
          const graceMinutes = Math.round(GEO_GRACE_MS / 60000);
          if (!geoOutSince.current) {
            geoOutSince.current = Date.now();
            // Schedule auto clock-out after grace period
            autoClockOutTimer.current = setTimeout(() => {
              performClockOut('auto');
            }, GEO_GRACE_MS);
          }
          const minutesLeft = Math.max(0, Math.round((GEO_GRACE_MS - (Date.now() - geoOutSince.current)) / 60000));
          setGeoWarning(`You are ${Math.round(dist)}m from the shift location (max ${geoRadius}m). Auto clock-out in ${minutesLeft} min.`);
        }
      } catch { /* ignore location errors */ }
    }

    checkPosition();
    geoInterval.current = setInterval(checkPosition, GEO_POLL_MS);
    return () => {
      if (geoInterval.current) clearInterval(geoInterval.current);
      if (autoClockOutTimer.current) clearTimeout(autoClockOutTimer.current);
    };
  }, [isClockedIn, hasGeo]);

  // ── Clock in with geo check ────────────────────────────────────────────────
  async function handleClockIn() {
    if (!shift?.id || !userId || !orgId) return;

    // Geofence check before allowing clock-in
    if (hasGeo) {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        toast.error('Location required', 'Enable location access to clock in to this shift.');
        return;
      }
      try {
        setClockLoading(true);
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const dist = haversineDistance(pos.coords.latitude, pos.coords.longitude, shift.geo_lat, shift.geo_lng);
        if (dist > geoRadius) {
          toast.error('Outside shift location', `You are ${Math.round(dist)}m away. Must be within ${geoRadius}m to clock in.`);
          setClockLoading(false);
          return;
        }
      } catch {
        toast.error('Location error', 'Could not get your location. Please try again.');
        setClockLoading(false);
        return;
      }
    } else {
      setClockLoading(true);
    }

    try {
      let timesheetId = clockState?.timesheet?.id;
      if (!timesheetId) {
        const { data: newTs, error: tsErr } = await supabase
          .from('timesheets')
          .insert({ organization_id: orgId, shift_id: shift.id, employee_user_id: userId, status: 'OPEN' })
          .select('id').single();
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

  // ── Clock out ──────────────────────────────────────────────────────────────
  async function performClockOut(reason: 'manual' | 'auto' = 'manual') {
    if (!clockState?.openEntry?.id) return;
    try {
      const { error } = await supabase
        .from('time_entries')
        .update({ clock_out: new Date().toISOString() })
        .eq('id', clockState.openEntry.id);
      if (error) throw error;
      if (reason === 'auto') {
        toast.error('Auto clocked out', 'You left the shift location for too long.');
      } else {
        toast.success('Clocked out!', formatTime(new Date()));
      }
      geoOutSince.current = null;
      setGeoWarning(null);
      refetchClock();
    } catch (err: any) {
      toast.error('Clock-out failed', err?.message);
    }
  }

  async function handleClockOut() {
    setClockLoading(true);
    await performClockOut('manual');
    setClockLoading(false);
  }

  // ── Photo upload ───────────────────────────────────────────────────────────
  async function handleUploadPhoto(photoType: 'BEFORE' | 'AFTER') {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setPhotoUploading(photoType);
    try {
      const ext = (asset.uri.split('.').pop() ?? 'jpg').toLowerCase();
      const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
      const filePath = `${orgId}/${shift.id}/${userId}/${photoType}-${Date.now()}.${safeExt}`;

      // Read file as ArrayBuffer via fetch
      const response = await fetch(asset.uri);
      const blob = await response.blob();

      const { error: uploadErr } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, blob, { contentType: `image/${safeExt}`, upsert: false });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);

      const { error: dbErr } = await supabase.from('shift_photos').insert({
        organization_id: orgId,
        shift_id: shift.id,
        assignment_id: assignmentId,
        employee_user_id: userId,
        photo_type: photoType,
        storage_path: filePath,
        storage_url: urlData.publicUrl,
      });
      if (dbErr) throw dbErr;

      toast.success(`${photoType === 'BEFORE' ? 'Before' : 'After'} photo uploaded!`);
      refetchPhotos();
    } catch (err: any) {
      toast.error('Upload failed', err?.message);
    } finally {
      setPhotoUploading(null);
    }
  }

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
            {hasGeo && <DetailRow icon="radio-button-on-outline" label="Geofence" value={`${geoRadius}m radius`} />}
            {(shift.break_minutes ?? 0) > 0 && <DetailRow icon="cafe-outline" label="Break" value={`${shift.break_minutes} min`} />}
            {shift.description && <DetailRow icon="document-text-outline" label="Notes" value={shift.description} />}
          </View>
        )}

        {/* Employee: clock in/out + geo warning + photos */}
        {isAssignment && !isManager && (
          <>
            {/* Geo warning banner */}
            {geoWarning && (
              <View style={styles.geoWarningBanner}>
                <Ionicons name="warning-outline" size={16} color={Colors.danger} />
                <Text style={styles.geoWarningText}>{geoWarning}</Text>
              </View>
            )}

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
            </View>

            {/* Before / after photos */}
            {shift?.requires_photos && (
              <View style={styles.photoSection}>
                <Text style={styles.photoSectionTitle}>
                  <Ionicons name="camera-outline" size={15} color={Colors.textSecondary} /> Shift Photos Required
                </Text>
                <View style={styles.photoRow}>
                  {/* BEFORE */}
                  <View style={styles.photoSlot}>
                    <Text style={styles.photoSlotLabel}>BEFORE</Text>
                    {hasBefore ? (
                      <Image
                        source={{ uri: photos.find((p: any) => p.photo_type === 'BEFORE')?.storage_url }}
                        style={styles.photoThumb}
                      />
                    ) : (
                      <TouchableOpacity
                        style={styles.photoUploadBtn}
                        onPress={() => handleUploadPhoto('BEFORE')}
                        disabled={!!photoUploading}
                      >
                        {photoUploading === 'BEFORE'
                          ? <ActivityIndicator size="small" color={Colors.primary} />
                          : <><Ionicons name="cloud-upload-outline" size={22} color={Colors.primary} /><Text style={styles.photoUploadText}>Upload</Text></>
                        }
                      </TouchableOpacity>
                    )}
                  </View>
                  {/* AFTER */}
                  <View style={styles.photoSlot}>
                    <Text style={styles.photoSlotLabel}>AFTER</Text>
                    {hasAfter ? (
                      <Image
                        source={{ uri: photos.find((p: any) => p.photo_type === 'AFTER')?.storage_url }}
                        style={styles.photoThumb}
                      />
                    ) : (
                      <TouchableOpacity
                        style={styles.photoUploadBtn}
                        onPress={() => handleUploadPhoto('AFTER')}
                        disabled={!!photoUploading}
                      >
                        {photoUploading === 'AFTER'
                          ? <ActivityIndicator size="small" color={Colors.primary} />
                          : <><Ionicons name="cloud-upload-outline" size={22} color={Colors.primary} /><Text style={styles.photoUploadText}>Upload</Text></>
                        }
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            )}
          </>
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
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [showEmployeePicker, setShowEmployeePicker] = useState(false);

  // Load employees for assignment picker
  const { data: employees = [] } = useQuery({
    queryKey: ['employees-for-picker', orgId],
    queryFn: async () => {
      const { data } = await supabase.rpc('list_org_members', {
        p_org_id: orgId,
        p_roles: ['EMPLOYEE'],
      });
      return data ?? [];
    },
    enabled: !!orgId,
  });

  async function handleCreate() {
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (!shiftDate || !startAt || !endAt) {
      toast.error('Date and times are required');
      return;
    }
    setLoading(true);
    try {
      const { data: shift, error } = await supabase.from('shifts').insert({
        organization_id: orgId,
        created_by_user_id: userId,
        title: title.trim(),
        shift_date: shiftDate,
        end_date: shiftDate,
        start_at: startAt + ':00',
        end_at: endAt + ':00',
        break_minutes: parseInt(breakMins) || 0,
        location: location.trim() || null,
        description: notes.trim() || null,
        status: 'ACTIVE',
      }).select('id').single();
      if (error) throw error;

      // Assign to employee if one was selected
      if (selectedEmployee && shift?.id) {
        const { error: assignErr } = await supabase.rpc('assign_shift_to_employee', {
          p_shift_id: shift.id,
          p_employee_user_id: selectedEmployee.user_id,
        });
        if (assignErr) console.warn('Assign error:', assignErr.message);
      }

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

        <FieldLabel>Title *</FieldLabel>
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

        <FieldLabel>Assign Employee (optional)</FieldLabel>
        <TouchableOpacity
          style={styles.employeePickerBtn}
          onPress={() => setShowEmployeePicker(true)}
        >
          <Ionicons name="person-outline" size={16} color={Colors.textMuted} style={styles.inputIcon} />
          <Text style={[styles.employeePickerText, !selectedEmployee && { color: Colors.textMuted }]}>
            {selectedEmployee ? selectedEmployee.full_name : 'Select employee...'}
          </Text>
          <Ionicons name="chevron-down-outline" size={16} color={Colors.textMuted} />
        </TouchableOpacity>

        {showEmployeePicker && (
          <View style={styles.employeeList}>
            <TouchableOpacity
              style={styles.employeeOption}
              onPress={() => { setSelectedEmployee(null); setShowEmployeePicker(false); }}
            >
              <Text style={styles.employeeOptionText}>— None —</Text>
            </TouchableOpacity>
            {employees.map((emp: any) => (
              <TouchableOpacity
                key={emp.user_id}
                style={[styles.employeeOption, selectedEmployee?.user_id === emp.user_id && styles.employeeOptionActive]}
                onPress={() => { setSelectedEmployee(emp); setShowEmployeePicker(false); }}
              >
                <Text style={[styles.employeeOptionText, selectedEmployee?.user_id === emp.user_id && { color: Colors.primary, fontWeight: '600' }]}>
                  {emp.full_name}
                </Text>
                {emp.email ? <Text style={styles.employeeOptionEmail}>{emp.email}</Text> : null}
              </TouchableOpacity>
            ))}
          </View>
        )}

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
  // Employee picker
  employeePickerBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bgInput, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm + 2, marginBottom: 2 },
  employeePickerText: { flex: 1, fontSize: FontSize.base, color: Colors.textPrimary },
  employeeList: { backgroundColor: Colors.bgCard, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.sm, overflow: 'hidden' },
  employeeOption: { padding: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  employeeOptionActive: { backgroundColor: Colors.primary + '15' },
  employeeOptionText: { fontSize: FontSize.base, color: Colors.textPrimary },
  employeeOptionEmail: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  // Geo warning
  geoWarningBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.warning + '20', borderRadius: Radius.md, padding: Spacing.sm + 2, borderWidth: 1, borderColor: Colors.warning + '60', marginBottom: Spacing.sm },
  geoWarningText: { flex: 1, fontSize: FontSize.sm, color: Colors.warning, fontWeight: FontWeight.medium },
  // Photo upload
  photoSection: { marginBottom: Spacing.lg },
  photoSectionTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textSecondary, marginBottom: Spacing.sm },
  photoRow: { flexDirection: 'row', gap: Spacing.md },
  photoSlot: { flex: 1, alignItems: 'center', gap: Spacing.xs },
  photoSlotLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.textMuted, letterSpacing: 0.5 },
  photoThumb: { width: '100%', aspectRatio: 1, borderRadius: Radius.md, backgroundColor: Colors.bgInput },
  photoUploadBtn: { width: '100%', aspectRatio: 1, borderRadius: Radius.md, borderWidth: 2, borderColor: Colors.primary + '60', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primaryLight + '10', gap: 4 },
  photoUploadText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.medium },
});
