import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { LoadingScreen } from '@/components/ui/LoadingScreen';

export default function Index() {
  const { session, isLoading } = useAuthStore();

  if (isLoading) return <LoadingScreen />;
  if (session) return <Redirect href="/(tabs)/dashboard" />;
  return <Redirect href="/(auth)/login" />;
}
