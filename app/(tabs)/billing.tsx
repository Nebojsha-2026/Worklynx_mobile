import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Divider } from '@/components/ui/Divider';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/lib/theme';
import { formatDate, formatCurrency } from '@/lib/format';

export default function BillingScreen() {
  const insets = useSafeAreaInsets();
  const { organization } = useAuthStore();

  const { data: subscription, isLoading: loadingSub } = useQuery({
    queryKey: ['subscription', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return null;
      const { data } = await supabase
        .from('subscriptions')
        .select('*, plans(*)')
        .eq('organization_id', organization.id)
        .maybeSingle();
      return data;
    },
    enabled: !!organization?.id,
  });

  const { data: plans = [], isLoading: loadingPlans } = useQuery({
    queryKey: ['plans'],
    queryFn: async () => {
      const { data } = await supabase.from('plans').select('*').eq('is_active', true).order('price_monthly');
      return data ?? [];
    },
  });

  const { data: memberCount = 0 } = useQuery({
    queryKey: ['member-count', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return 0;
      const { count } = await supabase
        .from('org_members')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organization.id)
        .eq('status', 'active');
      return count ?? 0;
    },
    enabled: !!organization?.id,
  });

  const isLoading = loadingSub || loadingPlans;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Billing & Subscription</Text>
      </View>

      {isLoading ? (
        <LoadingScreen message="Loading billing..." />
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Current Plan */}
          <Card style={styles.currentPlanCard}>
            <View style={styles.planHeader}>
              <View>
                <Text style={styles.planName}>{subscription?.plans?.name ?? 'Free Trial'}</Text>
                <Text style={styles.planDesc}>{subscription?.plans?.description ?? 'Explore WorkLynx for free'}</Text>
              </View>
              <Badge
                label={subscription?.status ?? 'trial'}
                status={subscription?.status === 'active' ? 'active' : subscription?.status ?? 'draft'}
              />
            </View>

            <Divider margin="sm" />

            <View style={styles.planStats}>
              <View style={styles.planStat}>
                <Text style={styles.planStatValue}>{memberCount}</Text>
                <Text style={styles.planStatLabel}>Active Staff</Text>
              </View>
              {subscription?.plans?.max_employees && (
                <View style={styles.planStat}>
                  <Text style={styles.planStatValue}>{subscription.plans.max_employees}</Text>
                  <Text style={styles.planStatLabel}>Staff Limit</Text>
                </View>
              )}
              {subscription?.current_period_end && (
                <View style={styles.planStat}>
                  <Text style={styles.planStatValue}>{formatDate(subscription.current_period_end, 'dd MMM')}</Text>
                  <Text style={styles.planStatLabel}>Renews</Text>
                </View>
              )}
            </View>

            {organization?.trial_ends_at && !subscription && (
              <View style={styles.trialBanner}>
                <Ionicons name="time-outline" size={16} color={Colors.warning} />
                <Text style={styles.trialText}>
                  Trial ends {formatDate(organization.trial_ends_at)}
                </Text>
              </View>
            )}
          </Card>

          {/* Plans */}
          <Text style={styles.sectionTitle}>Available Plans</Text>
          {plans.map((plan: any) => {
            const isCurrent = subscription?.plan_id === plan.id;
            return (
              <Card key={plan.id} style={[styles.planCard, isCurrent && styles.planCardActive]}>
                <View style={styles.planCardHeader}>
                  <Text style={styles.planCardName}>{plan.name}</Text>
                  {isCurrent && <Badge label="Current" color={Colors.primary} />}
                </View>
                {plan.description && <Text style={styles.planCardDesc}>{plan.description}</Text>}
                <View style={styles.planPrice}>
                  <Text style={styles.priceAmount}>
                    {plan.price_monthly ? formatCurrency(plan.price_monthly) : 'Free'}
                  </Text>
                  {plan.price_monthly ? <Text style={styles.pricePer}>/month</Text> : null}
                </View>
                {plan.max_employees && (
                  <Text style={styles.planLimit}>Up to {plan.max_employees} employees</Text>
                )}
                {!isCurrent && plan.price_monthly && (
                  <TouchableOpacity
                    style={styles.upgradeBtn}
                    onPress={() => Linking.openURL('https://www.worklynx.com.au/pricing')}
                  >
                    <Text style={styles.upgradeBtnText}>Upgrade to {plan.name}</Text>
                    <Ionicons name="open-outline" size={14} color={Colors.primary} />
                  </TouchableOpacity>
                )}
              </Card>
            );
          })}

          <Card style={styles.manageCard}>
            <Text style={styles.manageTitle}>Manage Subscription</Text>
            <Text style={styles.manageDesc}>Visit the WorkLynx web portal to manage payment methods, invoices, and your subscription.</Text>
            <TouchableOpacity
              style={styles.manageBtn}
              onPress={() => Linking.openURL('https://www.worklynx.com.au/app/bo/billing.html')}
            >
              <Ionicons name="open-outline" size={16} color={Colors.primary} />
              <Text style={styles.manageBtnText}>Open Web Portal</Text>
            </TouchableOpacity>
          </Card>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  header: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  scroll: { flex: 1 },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
  currentPlanCard: { gap: Spacing.sm },
  planHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  planName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  planDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  planStats: { flexDirection: 'row', justifyContent: 'space-around' },
  planStat: { alignItems: 'center' },
  planStatValue: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  planStatLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
  trialBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, backgroundColor: Colors.warningLight + '30', borderRadius: 8, padding: Spacing.sm, borderWidth: 1, borderColor: Colors.warning + '30' },
  trialText: { fontSize: FontSize.sm, color: Colors.warning, fontWeight: FontWeight.medium },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  planCard: { gap: Spacing.xs },
  planCardActive: { borderColor: Colors.primary, borderWidth: 2 },
  planCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  planCardName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  planCardDesc: { fontSize: FontSize.sm, color: Colors.textSecondary },
  planPrice: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  priceAmount: { fontSize: FontSize['2xl'], fontWeight: FontWeight.bold, color: Colors.textPrimary },
  pricePer: { fontSize: FontSize.sm, color: Colors.textMuted },
  planLimit: { fontSize: FontSize.sm, color: Colors.textMuted },
  upgradeBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: Spacing.xs },
  upgradeBtnText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.medium },
  manageCard: { gap: Spacing.sm },
  manageTitle: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  manageDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  manageBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  manageBtnText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.medium },
});
