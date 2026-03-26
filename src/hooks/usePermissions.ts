import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PERMISSIONS_ASKED_KEY = '@worklynx_permissions_asked_v1';

/**
 * Requests all required permissions on first app open.
 * Uses AsyncStorage to ensure we only prompt once.
 */
export async function requestAllPermissions(): Promise<void> {
  try {
    const alreadyAsked = await AsyncStorage.getItem(PERMISSIONS_ASKED_KEY);
    if (alreadyAsked === 'true') return;

    // 1. Push notifications
    await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });

    // 2. Location while in use (for clock-in/out geo verification)
    await Location.requestForegroundPermissionsAsync();

    // 3. Camera (for shift photos)
    await ImagePicker.requestCameraPermissionsAsync();

    // 4. Photo library (for uploading existing photos)
    await ImagePicker.requestMediaLibraryPermissionsAsync();

    await AsyncStorage.setItem(PERMISSIONS_ASKED_KEY, 'true');
  } catch (err) {
    // Permissions are best-effort — never crash the app
    console.warn('[requestAllPermissions]', err);
  }
}

/**
 * Hook version — call once from _layout.tsx after the user is authenticated.
 */
export function usePermissions(ready: boolean) {
  useEffect(() => {
    if (ready) requestAllPermissions();
  }, [ready]);
}
