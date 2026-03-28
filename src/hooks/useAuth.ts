import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';

export function useAuthListener() {
  const { setSession, setProfile, setOrgContext, setIsPlatformAdmin, setIsLoading, reset } = useAuthStore();

  useEffect(() => {
    setIsLoading(true);

    // Safety net: never stay stuck on loading screen (e.g. no/slow network)
    const safetyTimer = setTimeout(() => setIsLoading(false), 10_000);

    // Use onAuthStateChange only (not getSession) — it fires INITIAL_SESSION
    // on mount which avoids calling loadUserData twice simultaneously
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);

      if (session) {
        // Authenticate the Realtime client so RLS-filtered subscriptions work
        supabase.realtime.setAuth(session.access_token);
        clearTimeout(safetyTimer);
        await loadUserData(session.user.id);
      } else {
        reset();
      }
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(safetyTimer);
    };
  }, []);

  async function loadUserData(userId: string) {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      setProfile(profile);

      const { data: adminData } = await supabase
        .from('platform_admins')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle();

      setIsPlatformAdmin(!!adminData);

      const { data: member } = await supabase
        .from('org_members')
        .select('*, organizations(*)')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (member) {
        const org = (member as any).organizations;
        setOrgContext(member, org);
      } else {
        setOrgContext(null, null);
      }
    } catch (err) {
      console.warn('loadUserData error:', err);
    } finally {
      setIsLoading(false);
    }
  }
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUp(email: string, password: string, fullName: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: 'worklynx://reset-password',
  });
  if (error) throw error;
}

export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function verifyMfaTotp(code: string, factorId: string) {
  const { data: challenge } = await supabase.auth.mfa.challenge({ factorId });
  if (!challenge) throw new Error('Could not create MFA challenge');
  const { data, error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code,
  });
  if (error) throw error;
  return data;
}
