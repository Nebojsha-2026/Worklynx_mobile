import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { Colors, FontSize } from '@/lib/theme';

type TabConfig = {
  name: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconFocused: keyof typeof Ionicons.glyphMap;
};

const employeeTabs: TabConfig[] = [
  { name: 'dashboard', title: 'Dashboard', icon: 'grid-outline', iconFocused: 'grid' },
  { name: 'shifts', title: 'My Shifts', icon: 'calendar-outline', iconFocused: 'calendar' },
  { name: 'timesheets', title: 'Timesheets', icon: 'time-outline', iconFocused: 'time' },
  { name: 'notifications', title: 'Alerts', icon: 'notifications-outline', iconFocused: 'notifications' },
  { name: 'profile', title: 'Profile', icon: 'person-outline', iconFocused: 'person' },
];

const managerTabs: TabConfig[] = [
  { name: 'dashboard', title: 'Dashboard', icon: 'grid-outline', iconFocused: 'grid' },
  { name: 'shifts', title: 'Shifts', icon: 'calendar-outline', iconFocused: 'calendar' },
  { name: 'team', title: 'Team', icon: 'people-outline', iconFocused: 'people' },
  { name: 'approvals', title: 'Approvals', icon: 'checkmark-circle-outline', iconFocused: 'checkmark-circle' },
  { name: 'profile', title: 'Profile', icon: 'person-outline', iconFocused: 'person' },
];

const bmTabs: TabConfig[] = [
  { name: 'dashboard', title: 'Dashboard', icon: 'grid-outline', iconFocused: 'grid' },
  { name: 'team', title: 'Team', icon: 'people-outline', iconFocused: 'people' },
  { name: 'approvals', title: 'Approvals', icon: 'checkmark-circle-outline', iconFocused: 'checkmark-circle' },
  { name: 'reports', title: 'Reports', icon: 'bar-chart-outline', iconFocused: 'bar-chart' },
  { name: 'profile', title: 'Profile', icon: 'person-outline', iconFocused: 'person' },
];

const boTabs: TabConfig[] = [
  { name: 'dashboard', title: 'Dashboard', icon: 'grid-outline', iconFocused: 'grid' },
  { name: 'team', title: 'Team', icon: 'people-outline', iconFocused: 'people' },
  { name: 'reports', title: 'Reports', icon: 'bar-chart-outline', iconFocused: 'bar-chart' },
  { name: 'billing', title: 'Billing', icon: 'card-outline', iconFocused: 'card' },
  { name: 'profile', title: 'Profile', icon: 'person-outline', iconFocused: 'person' },
];

const adminTabs: TabConfig[] = [
  { name: 'dashboard', title: 'Dashboard', icon: 'grid-outline', iconFocused: 'grid' },
  { name: 'team', title: 'Orgs', icon: 'business-outline', iconFocused: 'business' },
  { name: 'reports', title: 'Reports', icon: 'bar-chart-outline', iconFocused: 'bar-chart' },
  { name: 'profile', title: 'Profile', icon: 'person-outline', iconFocused: 'person' },
];

export default function TabsLayout() {
  const { role, isPlatformAdmin } = useAuthStore();

  // FIX: DB roles are uppercase BO/BM/MANAGER/EMPLOYEE
  const tabs = isPlatformAdmin
    ? adminTabs
    : role === 'EMPLOYEE'
    ? employeeTabs
    : role === 'MANAGER'
    ? managerTabs
    : role === 'BM'
    ? bmTabs
    : role === 'BO'
    ? boTabs
    : employeeTabs;

  const allScreens = ['dashboard', 'shifts', 'timesheets', 'team', 'approvals', 'reports', 'billing', 'notifications', 'profile'];
  const activeNames = tabs.map((t) => t.name);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.bgCard,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: { fontSize: FontSize.xs, fontWeight: '500' },
      }}
    >
      {allScreens.map((screenName) => {
        const tab = tabs.find((t) => t.name === screenName);
        const isHidden = !activeNames.includes(screenName);
        return (
          <Tabs.Screen
            key={screenName}
            name={screenName}
            options={{
              title: tab?.title ?? screenName,
              href: isHidden ? null : undefined,
              tabBarIcon: ({ focused, color }) =>
                tab ? <Ionicons name={focused ? tab.iconFocused : tab.icon} size={22} color={color} /> : null,
            }}
          />
        );
      })}
    </Tabs>
  );
}
