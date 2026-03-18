import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { Profile, OrgMember, Organization, UserRole } from '@/types/database';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  orgMember: OrgMember | null;
  organization: Organization | null;
  role: UserRole | null;
  isPlatformAdmin: boolean;
  isLoading: boolean;

  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setOrgContext: (member: OrgMember | null, org: Organization | null) => void;
  setIsPlatformAdmin: (isAdmin: boolean) => void;
  setIsLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  profile: null,
  orgMember: null,
  organization: null,
  role: null,
  isPlatformAdmin: false,
  isLoading: true,

  setSession: (session) =>
    set({ session, user: session?.user ?? null }),

  setProfile: (profile) =>
    set({ profile }),

  setOrgContext: (member, org) =>
    set({
      orgMember: member,
      organization: org,
      role: member?.role as UserRole ?? null,
    }),

  setIsPlatformAdmin: (isAdmin) =>
    set({ isPlatformAdmin: isAdmin }),

  setIsLoading: (loading) =>
    set({ isLoading: loading }),

  reset: () =>
    set({
      session: null,
      user: null,
      profile: null,
      orgMember: null,
      organization: null,
      role: null,
      isPlatformAdmin: false,
      isLoading: false,
    }),
}));
