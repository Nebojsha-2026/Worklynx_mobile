import React, { useEffect, useState } from 'react';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/ui/Toast';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useAuthListener } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { Colors } from '@/lib/theme';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: 1,
    },
  },
});

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, isLoading } = useAuthStore();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)/dashboard');
    }
  }, [session, isLoading, segments]);

  if (isLoading) return <LoadingScreen message="Loading WorkLynx..." />;

  return <>{children}</>;
}

function RootLayoutInner({ themeKey }: { themeKey: number }) {
  const { isLoading } = useAuthStore();
  const { isDark } = useThemeStore();

  useAuthListener();

  useEffect(() => {
    if (!isLoading) SplashScreen.hideAsync();
  }, [isLoading]);

  return (
    <AuthGuard>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.bg } }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="index" options={{ headerShown: false }} />
      </Stack>
    </AuthGuard>
  );
}

export default function RootLayout() {
  const [themeKey, setThemeKey] = useState(0);
  const { loadTheme, isDark } = useThemeStore();

  // Load saved theme preference on app start
  useEffect(() => {
    loadTheme().then(() => setThemeKey((k) => k + 1));
  }, []);

  // Re-render entire tree when theme changes (so Colors object takes effect)
  const { toggleTheme: _toggle } = useThemeStore();
  useEffect(() => {
    // Subscribe to theme changes via zustand
    const unsub = useThemeStore.subscribe(() => setThemeKey((k) => k + 1));
    return unsub;
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={Colors.bg} />
            <RootLayoutInner key={themeKey} themeKey={themeKey} />
          </ToastProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
