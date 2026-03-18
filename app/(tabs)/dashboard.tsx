import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/authStore';
import { Colors, FontSize, FontWeight, Spacing } from '@/lib/theme';
import { roleLabel, roleColor } from '@/lib/theme';
import { EmployeeDashboard } from '@/components/dashboards/EmployeeDashboard';
import { ManagerDashboard } from '@/components/dashboards/ManagerDashboard';
import { BmDashboard } from '@/components/dashboards/BmDashboard';
import { BoDashboard } from '@/components/dashboards/BoDashboard';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { fullName } from '@/lib/format';

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { profile, role, organization, isPlatformAdmin } = useAuthStore();

  const displayRole = isPlatformAdmin ? 'admin' : role;
  const name = fullName(profile?.first_name, profile?.last_name);

  function renderDashboard() {
    if (isPlatformAdmin) return <ManagerDashboard />;
    switch (role) {
      case 'employee': return <EmployeeDashboard />;
      case 'manager': return <ManagerDashboard />;
      case 'business_manager': return <BmDashboard />;
      case 'business_owner': return <BoDashboard />;
      default: return <EmployeeDashboard />;
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>Good {getGreeting()}</Text>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          {organization && (
            <Text style={styles.orgName} numberOfLines={1}>{organization.name}</Text>
          )}
        </View>
        <View style={styles.headerRight}>
          <Badge label={roleLabel(displayRole)} color={roleColor(displayRole)} />
          <Avatar name={name} url={profile?.avatar_url} size={44} color={roleColor(displayRole)} />
        </View>
      </View>

      {renderDashboard()}
    </View>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  name: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginTop: 2,
  },
  orgName: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: Spacing.xs,
  },
});
