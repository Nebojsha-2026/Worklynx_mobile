// ─── Color Palettes ──────────────────────────────────────────────────────────

const darkPalette = {
  primary: '#6D28D9',
  primaryDark: '#5B21B6',
  primaryLight: '#EDE9FE',
  success: '#10B981',
  successLight: '#D1FAE5',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  danger: '#EF4444',
  dangerLight: '#FEE2E2',
  info: '#6366F1',
  infoLight: '#E0E7FF',
  bg: '#0F172A',
  bgCard: '#1E293B',
  bgInput: '#334155',
  border: '#334155',
  borderLight: '#475569',
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  textInverse: '#0F172A',
  roleEmployee: '#10B981',
  roleManager: '#6D28D9',
  roleBM: '#8B5CF6',
  roleBO: '#F59E0B',
  roleAdmin: '#EF4444',
  statusDraft: '#64748B',
  statusPublished: '#6D28D9',
  statusCompleted: '#10B981',
  statusCancelled: '#EF4444',
};

const lightPalette = {
  primary: '#6D28D9',
  primaryDark: '#5B21B6',
  primaryLight: '#EDE9FE',
  success: '#059669',
  successLight: '#D1FAE5',
  warning: '#D97706',
  warningLight: '#FEF3C7',
  danger: '#DC2626',
  dangerLight: '#FEE2E2',
  info: '#4F46E5',
  infoLight: '#E0E7FF',
  bg: '#F8FAFC',
  bgCard: '#FFFFFF',
  bgInput: '#F1F5F9',
  border: '#E2E8F0',
  borderLight: '#CBD5E1',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  textInverse: '#F1F5F9',
  roleEmployee: '#059669',
  roleManager: '#6D28D9',
  roleBM: '#7C3AED',
  roleBO: '#D97706',
  roleAdmin: '#DC2626',
  statusDraft: '#94A3B8',
  statusPublished: '#6D28D9',
  statusCompleted: '#059669',
  statusCancelled: '#DC2626',
};

// Mutable Colors object – mutate via applyColorTheme() to switch themes.
// All existing imports of `Colors` will reflect the update on next render.
export const Colors: typeof darkPalette = { ...darkPalette };

export function applyColorTheme(isDark: boolean) {
  const src = isDark ? darkPalette : lightPalette;
  (Object.keys(src) as (keyof typeof darkPalette)[]).forEach((k) => {
    (Colors as any)[k] = src[k];
  });
}

// ─── Spacing / Radius / Typography ───────────────────────────────────────────

export const Spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };
export const Radius = { sm: 6, md: 10, lg: 16, xl: 24, full: 9999 };
export const FontSize = {
  xs: 11, sm: 13, base: 15, md: 16, lg: 18, xl: 20, '2xl': 24, '3xl': 30, '4xl': 36,
};
export const FontWeight = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};

// ─── Role helpers ─────────────────────────────────────────────────────────────

export function roleColor(role: string | null): string {
  switch (role) {
    case 'EMPLOYEE': return Colors.roleEmployee;
    case 'MANAGER': return Colors.roleManager;
    case 'BM': return Colors.roleBM;
    case 'BO': return Colors.roleBO;
    default: return Colors.roleAdmin;
  }
}

export function roleLabel(role: string | null): string {
  switch (role) {
    case 'EMPLOYEE': return 'Employee';
    case 'MANAGER': return 'Manager';
    case 'BM': return 'Business Manager';
    case 'BO': return 'Business Owner';
    case 'admin': return 'Admin';
    default: return 'Admin';
  }
}

// ─── Status helpers ───────────────────────────────────────────────────────────

export function statusColor(status: string): string {
  switch ((status ?? '').toUpperCase()) {
    case 'DRAFT':      return Colors.statusDraft;
    case 'PUBLISHED':  return Colors.primary;
    case 'ACTIVE':     return Colors.success;
    case 'COMPLETED':  return Colors.success;
    case 'CANCELLED':  return Colors.danger;
    case 'OFFERED':    return Colors.info;
    case 'OPEN':       return Colors.textMuted;
    case 'SUBMITTED':  return Colors.warning;
    case 'APPROVED':   return Colors.success;
    case 'REJECTED':   return Colors.danger;
    case 'LOCKED':     return Colors.info;
    default:           return Colors.textMuted;
  }
}
