import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { GRABBA_BRANDS, GrabbaBrand } from '@/config/grabbaBrands';

// ═══════════════════════════════════════════════════════════════════════════════
// GRABBA DATA HOOKS
// Centralized data fetching for all Grabba floors
// ═══════════════════════════════════════════════════════════════════════════════

// Fetch companies with brand activity
export function useGrabbaCompanies(brandFilter: GrabbaBrand[] = [...GRABBA_BRANDS]) {
  return useQuery({
    queryKey: ['grabba-companies', brandFilter],
    queryFn: async () => {
      // Get companies that have orders with selected Grabba brands
      const { data: ordersWithCompanies } = await supabase
        .from('wholesale_orders')
        .select('company_id, brand')
        .in('brand', brandFilter);

      const companyIds = [...new Set(ordersWithCompanies?.map(o => o.company_id).filter(Boolean))];
      
      if (companyIds.length === 0) {
        // Fallback: get all companies
        const { data } = await supabase.from('companies').select('*').limit(100);
        return data || [];
      }

      const { data } = await supabase
        .from('companies')
        .select('*')
        .in('id', companyIds);

      return data || [];
    },
  });
}

// Fetch brand activity per company
export function useGrabbaBrandActivity() {
  return useQuery({
    queryKey: ['grabba-brand-activity'],
    queryFn: async () => {
      const { data } = await supabase
        .from('wholesale_orders')
        .select('company_id, brand, store_id')
        .in('brand', GRABBA_BRANDS);
      
      const activityMap: Record<string, Set<string>> = {};
      data?.forEach(order => {
        const key = order.company_id || order.store_id;
        if (key) {
          if (!activityMap[key]) activityMap[key] = new Set();
          activityMap[key].add(order.brand);
        }
      });
      
      return Object.fromEntries(
        Object.entries(activityMap).map(([k, v]) => [k, Array.from(v)])
      ) as Record<string, GrabbaBrand[]>;
    },
  });
}

// Fetch tube inventory by brand
export function useGrabbaTubeInventory(brandFilter: GrabbaBrand[] = [...GRABBA_BRANDS]) {
  return useQuery({
    queryKey: ['grabba-tube-inventory', brandFilter],
    queryFn: async () => {
      const { data } = await supabase
        .from('store_tube_inventory')
        .select('*')
        .in('brand', brandFilter)
        .order('last_updated', { ascending: false });

      return data || [];
    },
  });
}

// Fetch wholesale orders by brand
export function useGrabbaOrders(brandFilter: GrabbaBrand[] = [...GRABBA_BRANDS], limit = 100) {
  return useQuery({
    queryKey: ['grabba-orders', brandFilter, limit],
    queryFn: async () => {
      const { data } = await supabase
        .from('wholesale_orders')
        .select('*, companies(name), stores(name)')
        .in('brand', brandFilter)
        .order('created_at', { ascending: false })
        .limit(limit);

      return data || [];
    },
  });
}

// Fetch communication logs by brand
export function useGrabbaCommunicationLogs(brandFilter: GrabbaBrand[] = [...GRABBA_BRANDS], limit = 50) {
  return useQuery({
    queryKey: ['grabba-communication-logs', brandFilter, limit],
    queryFn: async () => {
      const { data } = await supabase
        .from('communication_logs')
        .select('*')
        .in('brand', brandFilter)
        .order('created_at', { ascending: false })
        .limit(limit);

      return data || [];
    },
  });
}

// Fetch store payments (unpaid accounts)
export function useGrabbaPayments(brandFilter: GrabbaBrand[] = [...GRABBA_BRANDS]) {
  return useQuery({
    queryKey: ['grabba-payments', brandFilter],
    queryFn: async () => {
      // Get store_ids that have orders with these brands
      const { data: brandOrders } = await supabase
        .from('wholesale_orders')
        .select('store_id, company_id')
        .in('brand', brandFilter);

      const storeIds = [...new Set(brandOrders?.map(o => o.store_id).filter(Boolean))];
      const companyIds = [...new Set(brandOrders?.map(o => o.company_id).filter(Boolean))];

      const { data } = await supabase
        .from('store_payments')
        .select('*, stores(name), companies(name)')
        .or(`store_id.in.(${storeIds.join(',')}),company_id.in.(${companyIds.join(',')})`)
        .order('created_at', { ascending: false });

      return data || [];
    },
  });
}

// Fetch ambassadors with stats
export function useGrabbaAmbassadors() {
  return useQuery({
    queryKey: ['grabba-ambassadors'],
    queryFn: async () => {
      const { data: ambassadors } = await supabase
        .from('ambassadors')
        .select('*, profiles(full_name, avatar_url)')
        .eq('is_active', true);

      const { data: commissions } = await supabase
        .from('ambassador_commissions')
        .select('ambassador_id, amount, status');

      const ambassadorStats = (ambassadors || []).map(amb => {
        const ambCommissions = (commissions || []).filter(c => c.ambassador_id === amb.id);
        const totalEarned = ambCommissions.filter(c => c.status === 'paid').reduce((sum, c) => sum + (c.amount || 0), 0);
        const pending = ambCommissions.filter(c => c.status === 'pending').reduce((sum, c) => sum + (c.amount || 0), 0);
        
        return {
          ...amb,
          totalEarned,
          pendingCommission: pending,
        };
      });

      return ambassadorStats;
    },
  });
}

// Fetch drivers
export function useGrabbaDrivers() {
  return useQuery({
    queryKey: ['grabba-drivers'],
    queryFn: async () => {
      const { data } = await supabase
        .from('grabba_drivers')
        .select('*')
        .order('created_at', { ascending: false });

      return data || [];
    },
  });
}

// Fetch overall stats for penthouse
export function useGrabbaPenthouseStats() {
  return useQuery({
    queryKey: ['grabba-penthouse-stats'],
    queryFn: async () => {
      const [stores, wholesalers, ambassadors, drivers, orders, payments] = await Promise.all([
        supabase.from('stores').select('id', { count: 'exact', head: true }),
        supabase.from('wholesalers').select('id', { count: 'exact', head: true }),
        supabase.from('ambassadors').select('id', { count: 'exact', head: true }),
        supabase.from('grabba_drivers').select('id', { count: 'exact', head: true }),
        supabase.from('wholesale_orders').select('quantity, brand').in('brand', GRABBA_BRANDS),
        supabase.from('store_payments').select('owed_amount, paid_amount, payment_status'),
      ]);

      const totalTubes = (orders.data || []).reduce((sum: number, o: any) => sum + (o.quantity || 0), 0);
      const unpaidBalance = (payments.data || [])
        .filter((p: any) => p.payment_status !== 'paid')
        .reduce((sum: number, p: any) => sum + ((p.owed_amount || 0) - (p.paid_amount || 0)), 0);

      // Brand breakdown
      const brandStats = GRABBA_BRANDS.reduce((acc, brand) => {
        const brandOrders = (orders.data || []).filter((o: any) => o.brand === brand);
        acc[brand] = brandOrders.reduce((sum: number, o: any) => sum + (o.quantity || 0), 0);
        return acc;
      }, {} as Record<GrabbaBrand, number>);

      return {
        totalStores: stores.count || 0,
        totalWholesalers: wholesalers.count || 0,
        totalAmbassadors: ambassadors.count || 0,
        totalDrivers: drivers.count || 0,
        totalTubes,
        totalBoxes: Math.floor(totalTubes / 100),
        unpaidBalance,
        brandStats,
      };
    },
  });
}

// Count entities by brand
export function useGrabbaBrandCounts() {
  return useQuery({
    queryKey: ['grabba-brand-counts'],
    queryFn: async () => {
      const { data: orders } = await supabase
        .from('wholesale_orders')
        .select('brand, company_id, store_id')
        .in('brand', GRABBA_BRANDS);

      const counts: Record<string, number> = {};
      
      GRABBA_BRANDS.forEach(brand => {
        const brandOrders = (orders || []).filter(o => o.brand === brand);
        const uniqueEntities = new Set([
          ...brandOrders.map(o => o.company_id).filter(Boolean),
          ...brandOrders.map(o => o.store_id).filter(Boolean),
        ]);
        counts[brand] = uniqueEntities.size;
      });

      return counts;
    },
  });
}
