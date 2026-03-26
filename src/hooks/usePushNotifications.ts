import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';

// Configure how notifications appear when the app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Registers the device Expo push token with Supabase so the server-side
 * send-push-notification edge function can deliver notifications to this device.
 */
async function registerPushToken(userId: string): Promise<void> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    // Android requires a notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'WorkLynx',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#3B82F6',
        sound: 'default',
      });
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.warn('[PushNotifications] No EAS projectId found in app config');
      return;
    }

    const { data: tokenData } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!tokenData) return;

    // Upsert the token into Supabase — idempotent
    const { error } = await supabase
      .from('expo_push_tokens')
      .upsert({ user_id: userId, token: tokenData }, { onConflict: 'user_id,token' });

    if (error) console.warn('[PushNotifications] Failed to save token:', error.message);
  } catch (err) {
    console.warn('[PushNotifications] registerPushToken error:', err);
  }
}

/**
 * Maps notification type/link to the appropriate tab route.
 */
function resolveRoute(data: Record<string, any>): string | null {
  const type = String(data?.type ?? '').toUpperCase();
  const link = String(data?.link ?? '');

  if (link.includes('shift')) return '/(tabs)/shifts';
  if (link.includes('timesheet')) return '/(tabs)/timesheets';
  if (link.includes('approval')) return '/(tabs)/approvals';

  if (type.startsWith('SHIFT_')) return '/(tabs)/shifts';
  if (type.startsWith('TIMESHEET_') || type === 'PAYMENT_REQUESTED') return '/(tabs)/timesheets';
  if (type === 'TIMESHEET_SUBMITTED') return '/(tabs)/approvals';

  return '/(tabs)/notifications';
}

/**
 * Hook — call once from the authenticated root layout.
 * Registers the push token and sets up notification listeners.
 */
export function usePushNotifications(userId: string | undefined) {
  const notifListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    if (!userId) return;

    // Register token with backend
    registerPushToken(userId);

    // Foreground notification received
    notifListener.current = Notifications.addNotificationReceivedListener(notification => {
      // The notification bell/badge in the app will refresh via React Query
      // No extra action needed — the notification is shown as an alert by the handler above
    });

    // User tapped a notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as Record<string, any>;
      const route = resolveRoute(data);
      if (route) {
        // Small delay to ensure the app is fully mounted
        setTimeout(() => router.push(route as any), 300);
      }
    });

    return () => {
      notifListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [userId]);
}

/**
 * Call when the user signs out to remove their push token from this device.
 */
export async function unregisterPushToken(userId: string): Promise<void> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) return;

    const { data: tokenData } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!tokenData) return;

    await supabase
      .from('expo_push_tokens')
      .delete()
      .eq('user_id', userId)
      .eq('token', tokenData);
  } catch (err) {
    console.warn('[PushNotifications] unregisterPushToken error:', err);
  }
}
