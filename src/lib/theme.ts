export const Colors = {
  // Brand
  primary: '#3B82F6',       // blue-500
  primaryDark: '#1D4ED8',   // blue-700
  primaryLight: '#DBEAFE',  // blue-100

  // Status
  success: '#10B981',       // emerald-500
  successLight: '#D1FAE5',
  warning: '#F59E0B',       // amber-500
  warningLight: '#FEF3C7',
  danger: '#EF4444',        // red-500
  dangerLight: '#FEE2E2',
  info: '#6366F1',          // indigo-500
  infoLight: '#E0E7FF',

  // Neutrals (dark theme primary)
  bg: '#0F172A',            // slate-900
  bgCard: '#1E293B',        // slate-800
  bgInput: '#334155',       // slate-700
  border: '#334155',        // slate-700
  borderLight: '#475569',   // slate-600

  // Text
  textPrimary: '#F1F5F9',   // slate-100
  textSecondary: '#94A3B8', // slate-400
  textMuted: '#64748B',     // slate-500
  textInverse: '#0F172A',

  // Role colours
  roleEmployee: '#10B981',
  roleManager: '#3B82F6',
  roleBM: '#8B5CF6',
  roleBO: '#F59E0B',
  roleAdmin: '#EF4444',

  // Shift status
  statusDraft: '#64748B',
  statusPublished: '#3B82F6',
  statusCompleted: '#10B981',
  statusCancelled: '#EF4444',

  // Timesheet status
  timesheetDraft: '#64748B',
  timesheetSubmitted: '#F59E0B',
  timesheetApproved: '#10B981',
  timesheetRejected: '#EF4444',
  timesheetPaid: '#6366F1',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const FontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
};

export const FontWeight = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};

export function roleColor(role: string | null): string {
  switch (role) {
    case 'employee': return Colors.roleEmployee;
    case 'manager': return Colors.roleManager;
    case 'business_manager': return Colors.roleBM;
    case 'business_owner': return Colors.roleBO;
    default: return Colors.roleAdmin;
  }
}

export function roleLabel(role: string | null): string {
  switch (role) {
    case 'employee': return 'Employee';
    case 'manager': return 'Manager';
    case 'business_manager': return 'Business Manager';
    case 'business_owner': return 'Business Owner';
    default: return 'Admin';
  }
}

export function statusColor(status: string): string {
  switch (status) {
    case 'draft': return Colors.statusDraft;
    case 'published': return Colors.primary;
    case 'completed': return Colors.success;
    case 'cancelled': return Colors.danger;
    case 'submitted': return Colors.warning;
    case 'approved': return Colors.success;
    case 'rejected': return Colors.danger;
    case 'paid': return Colors.info;
    case 'active': return Colors.success;
    case 'assigned': return Colors.primary;
    case 'confirmed': return Colors.success;
    default: return Colors.textMuted;
  }
}
