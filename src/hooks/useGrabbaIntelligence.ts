// ═══════════════════════════════════════════════════════════════════════════════
// GRABBA INTELLIGENCE HOOK
// React hook for consuming the Intelligence Core across all floors
// ═══════════════════════════════════════════════════════════════════════════════

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { GRABBA_BRAND_IDS, type GrabbaBrand } from '@/config/grabbaSkyscraper';
import {
  predictStoreRestock,
  calculatePaymentRiskScore,
  detectDeliveryBottleneck,
  forecastBrandDemand,
  generateSmartAlerts,
  generateInsight,
  getTopStoresToCheck,
  type SmartAlert,
  type BrandDemandForecast,
  type IntelligenceInsight,
  type StoreRiskProfile,
} from '@/engine/GrabbaIntelligenceCore';

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN INTELLIGENCE HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useGrabbaIntelligence() {
  return useQuery({
    queryKey: ['grabba-intelligence'],
    queryFn: async () => {
      // Fetch all required data in parallel
      const [
        storesRes,
        ordersRes,
        paymentsRes,
        driversRes,
        ambassadorsRes,
        communicationRes,
        inventoryRes,
      ] = await Promise.all([
        supabase.from('stores').select('id, name, neighborhood').limit(500),
        supabase.from('wholesale_orders').select('*').in('brand', [...GRABBA_BRAND_IDS]).order('created_at', { ascending: false }).limit(1000),
        supabase.from('store_payments').select('*').limit(500),
        supabase.from('grabba_drivers').select('*'),
        supabase.from('ambassadors').select('*, profiles(full_name)').eq('is_active', true),
        supabase.from('communication_logs').select('*').order('created_at', { ascending: false }).limit(500),
        supabase.from('store_tube_inventory').select('*').in('brand', [...GRABBA_BRAND_IDS]),
      ]);

      const stores = storesRes.data || [];
      const orders = ordersRes.data || [];
      const payments = paymentsRes.data || [];
      const drivers = driversRes.data || [];
      const ambassadors = ambassadorsRes.data || [];
      const communications = communicationRes.data || [];
      const inventory = inventoryRes.data || [];

      // ─────────────────────────────────────────────────────────────────────────
      // BRAND DEMAND FORECASTS
      // ─────────────────────────────────────────────────────────────────────────
      const brandForecasts: BrandDemandForecast[] = GRABBA_BRAND_IDS.map(brand => {
        const brandOrders = orders.filter(o => o.brand === brand);
        
        // Group by week
        const weeklyOrders: number[] = [];
        const now = new Date();
        for (let i = 3; i >= 0; i--) {
          const weekStart = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
          const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
          const weekTotal = brandOrders
            .filter(o => {
              const d = new Date(o.created_at);
              return d >= weekStart && d < weekEnd;
            })
            .reduce((sum, o) => sum + (o.boxes || 0) * 100, 0);
          weeklyOrders.push(weekTotal);
        }

        return forecastBrandDemand(weeklyOrders, brand);
      });

      // ─────────────────────────────────────────────────────────────────────────
      // STORE RISK PROFILES
      // ─────────────────────────────────────────────────────────────────────────
      const storeRisks: StoreRiskProfile[] = stores.slice(0, 50).map(store => {
        const storeOrders = orders.filter(o => o.store_id === store.id);
        const storePayments = payments.filter((p: any) => p.store_id === store.id);
        const storeComms = communications.filter((c: any) => c.store_id === store.id);
        
        const lastOrder = storeOrders[0];
        const daysSinceOrder = lastOrder 
          ? Math.floor((Date.now() - new Date(lastOrder.created_at).getTime()) / (1000 * 60 * 60 * 24))
          : 999;

        const unpaidPayments = storePayments.filter((p: any) => p.payment_status !== 'paid');
        const unpaidBalance = unpaidPayments.reduce((sum: number, p: any) => sum + ((p.owed_amount || 0) - (p.paid_amount || 0)), 0);

        const lastComm = storeComms[0];
        const communicationGap = lastComm
          ? Math.floor((Date.now() - new Date(lastComm.created_at).getTime()) / (1000 * 60 * 60 * 24))
          : 999;

        // Calculate risk
        let riskScore = 0;
        const factors: string[] = [];

        if (daysSinceOrder > 30) { riskScore += 30; factors.push('No recent orders'); }
        if (unpaidBalance > 1000) { riskScore += 25; factors.push('High unpaid balance'); }
        if (communicationGap > 21) { riskScore += 20; factors.push('Communication gap'); }

        const riskLevel = riskScore >= 60 ? 'critical' : riskScore >= 40 ? 'high' : riskScore >= 20 ? 'medium' : 'low';

        return {
          storeId: store.id,
          storeName: store.name,
          riskScore,
          riskLevel,
          factors,
          predictedDaysUntilRestock: Math.max(0, 14 - daysSinceOrder),
          unpaidBalance,
          lastOrderDays: daysSinceOrder,
          communicationGap,
        };
      });

      // ─────────────────────────────────────────────────────────────────────────
      // SMART ALERTS
      // ─────────────────────────────────────────────────────────────────────────
      const lowStockStores = inventory
        .filter((inv: any) => (inv.current_tubes_left || 0) < 50)
        .map((inv: any) => ({
          id: inv.store_id || inv.id,
          name: inv.store?.name || 'Unknown Store',
          tubesLeft: inv.current_tubes_left || 0,
          daysUntilEmpty: Math.max(1, Math.floor((inv.current_tubes_left || 0) / 10)),
        }));

      const unpaidAccounts = payments
        .filter((p: any) => p.payment_status !== 'paid' && (p.owed_amount || 0) > 500)
        .map((p: any) => {
          const daysPastDue = p.due_date 
            ? Math.max(0, Math.floor((Date.now() - new Date(p.due_date).getTime()) / (1000 * 60 * 60 * 24)))
            : 30;
          return {
            id: p.id,
            name: p.company_id || p.store_id || 'Unknown',
            amount: (p.owed_amount || 0) - (p.paid_amount || 0),
            daysPastDue,
          };
        });

      const inactiveAmbassadors = ambassadors.map((a: any) => ({
        id: a.id,
        name: a.profiles?.full_name || 'Unknown',
        daysSinceActivity: Math.floor((Date.now() - new Date(a.updated_at || a.created_at).getTime()) / (1000 * 60 * 60 * 24)),
      }));

      const alerts = generateSmartAlerts({
        lowStockStores,
        unpaidAccounts,
        inactiveAmbassadors,
        lateDeliveries: [],
        productionGaps: [],
        communicationGaps: storeRisks
          .filter(s => s.communicationGap > 21)
          .map(s => ({ id: s.storeId, name: s.storeName, daysSinceContact: s.communicationGap })),
      });

      // ─────────────────────────────────────────────────────────────────────────
      // INSIGHTS
      // ─────────────────────────────────────────────────────────────────────────
      const brandSales: Record<GrabbaBrand, { thisWeek: number; lastWeek: number }> = {} as any;
      GRABBA_BRAND_IDS.forEach(brand => {
        const forecast = brandForecasts.find(f => f.brand === brand);
        brandSales[brand] = {
          thisWeek: forecast?.currentWeekDemand || 0,
          lastWeek: forecast?.currentWeekDemand ? Math.round(forecast.currentWeekDemand / (1 + (forecast.growthRate / 100))) : 0,
        };
      });

      const insights = generateInsight({
        brandSales,
        topNeighborhoods: [],
        unpaidTotal: unpaidAccounts.reduce((sum, a) => sum + a.amount, 0),
        unpaidChange: 0,
        deliveryRate: 0.85,
        productionOutput: 0,
      });

      // ─────────────────────────────────────────────────────────────────────────
      // TOP STORES TO CHECK
      // ─────────────────────────────────────────────────────────────────────────
      const topStoresToCheck = getTopStoresToCheck(
        storeRisks.map(s => ({
          id: s.storeId,
          name: s.storeName,
          daysUntilRestock: s.predictedDaysUntilRestock,
          unpaidAmount: s.unpaidBalance,
          daysSinceContact: s.communicationGap,
        }))
      );

      // ─────────────────────────────────────────────────────────────────────────
      // DELIVERY BOTTLENECK
      // ─────────────────────────────────────────────────────────────────────────
      const activeDrivers = drivers.filter((d: any) => d.active).length;
      const bottleneck = detectDeliveryBottleneck(
        lowStockStores.length * 2, // Estimate pending deliveries
        activeDrivers,
        8, // Avg deliveries per driver
        0.85
      );

      // ─────────────────────────────────────────────────────────────────────────
      // HEALTH SCORES
      // ─────────────────────────────────────────────────────────────────────────
      const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;
      const warningAlerts = alerts.filter(a => a.severity === 'warning').length;
      
      let overallHealth = 100;
      overallHealth -= criticalAlerts * 15;
      overallHealth -= warningAlerts * 5;
      overallHealth -= lowStockStores.length * 2;
      overallHealth = Math.max(0, Math.min(100, overallHealth));

      return {
        brandForecasts,
        storeRisks,
        alerts,
        insights,
        topStoresToCheck,
        bottleneck,
        metrics: {
          overallHealth,
          criticalAlerts,
          warningAlerts,
          totalAlerts: alerts.length,
          lowStockCount: lowStockStores.length,
          unpaidTotal: unpaidAccounts.reduce((sum, a) => sum + a.amount, 0),
          activeDrivers,
          totalDrivers: drivers.length,
          totalStores: stores.length,
          totalAmbassadors: ambassadors.length,
        },
      };
    },
    refetchInterval: 60000, // Refresh every minute
    staleTime: 30000,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// FLOOR-SPECIFIC INTELLIGENCE HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

export function useCRMIntelligence() {
  const { data } = useGrabbaIntelligence();
  
  return {
    storeRisks: data?.storeRisks || [],
    topStoresToCheck: data?.topStoresToCheck || [],
    communicationGaps: data?.alerts.filter(a => a.type === 'communication') || [],
    insights: data?.insights.filter(i => i.category === 'Geographic Intelligence') || [],
  };
}

export function useInventoryIntelligence() {
  const { data } = useGrabbaIntelligence();
  
  return {
    brandForecasts: data?.brandForecasts || [],
    lowStockAlerts: data?.alerts.filter(a => a.type === 'inventory') || [],
    insights: data?.insights.filter(i => i.category === 'Operations') || [],
  };
}

export function useDeliveryIntelligence() {
  const { data } = useGrabbaIntelligence();
  
  return {
    bottleneck: data?.bottleneck,
    deliveryAlerts: data?.alerts.filter(a => a.type === 'delivery') || [],
    activeDrivers: data?.metrics?.activeDrivers || 0,
    totalDrivers: data?.metrics?.totalDrivers || 0,
  };
}

export function useFinanceIntelligence() {
  const { data } = useGrabbaIntelligence();
  
  return {
    paymentAlerts: data?.alerts.filter(a => a.type === 'payment') || [],
    unpaidTotal: data?.metrics?.unpaidTotal || 0,
    insights: data?.insights.filter(i => i.category === 'Financial Health') || [],
  };
}

export function useAmbassadorIntelligence() {
  const { data } = useGrabbaIntelligence();
  
  return {
    ambassadorAlerts: data?.alerts.filter(a => a.type === 'ambassador') || [],
    totalAmbassadors: data?.metrics?.totalAmbassadors || 0,
  };
}
