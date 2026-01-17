import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Types for all intelligence modules
export interface WholesalerOrder {
  id: string;
  wholesaler_id: string;
  order_date: string;
  order_number: string | null;
  total_amount: number;
  items_count: number;
  skus: any[];
  status: string;
  payment_status: string;
  payment_received_date: string | null;
  days_to_payment: number | null;
  delivery_date: string | null;
  notes: string | null;
  created_at: string;
}

export interface WholesalerPayment {
  id: string;
  wholesaler_id: string;
  order_id: string | null;
  amount: number;
  payment_date: string;
  payment_method: string | null;
  days_from_invoice: number | null;
  on_time: boolean;
  notes: string | null;
}

export interface WholesalerDispute {
  id: string;
  wholesaler_id: string;
  order_id: string | null;
  dispute_type: string;
  description: string | null;
  severity: string;
  status: string;
  opened_at: string;
  resolved_at: string | null;
  resolution_days: number | null;
  resolution_notes: string | null;
}

export interface WholesalerVisit {
  id: string;
  wholesaler_id: string;
  visit_date: string;
  visited_by: string | null;
  visit_type: string;
  duration_minutes: number | null;
  observations: string | null;
  visibility_score: number | null;
  placement_feedback: string | null;
  issues_found: any[];
  opportunities: any[];
  follow_up_required: boolean;
  follow_up_notes: string | null;
}

export interface WholesalerCommunication {
  id: string;
  wholesaler_id: string;
  communication_type: string;
  direction: string;
  subject: string | null;
  summary: string | null;
  promises_made: any[];
  promises_kept: boolean | null;
  sentiment: string;
  communicated_by: string | null;
  communicated_at: string;
}

export interface WholesalerTerritory {
  id: string;
  wholesaler_id: string;
  neighborhood: string;
  borough: string | null;
  store_count: number;
  coverage_density: string;
  is_exclusive: boolean;
  overlap_with: any[];
}

export interface WholesalerProductPerformance {
  id: string;
  wholesaler_id: string;
  product_id: string | null;
  sku: string | null;
  product_name: string | null;
  period_start: string;
  period_end: string;
  units_sold: number;
  revenue: number;
  returns_count: number;
  return_rate: number;
  velocity_score: number;
  substitution_rate: number;
  price_erosion_percent: number;
  neighborhoods_sold: string[] | null;
}

export interface WholesalerHealthSnapshot {
  id: string;
  wholesaler_id: string;
  snapshot_date: string;
  health_score: number;
  order_consistency_score: number | null;
  payment_punctuality_score: number | null;
  communication_score: number | null;
  dispute_score: number | null;
  contract_adherence_score: number | null;
  price_sensitivity_score: number | null;
  trend: string;
  risk_factors: any[];
}

export interface WholesalerAISignal {
  id: string;
  wholesaler_id: string;
  signal_type: string;
  severity: string;
  headline: string;
  details: string | null;
  recommended_action: string | null;
  detected_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  is_active: boolean;
  metadata: any;
}

export interface WholesalerContract {
  id: string;
  wholesaler_id: string;
  contract_name: string;
  contract_type: string;
  start_date: string;
  end_date: string | null;
  auto_renew: boolean;
  terms: any;
  exclusivity_clauses: string[] | null;
  incentive_structure: any;
  penalty_structure: any;
  growth_targets: any;
  status: string;
  document_url: string | null;
}

// Hook for fetching full wholesaler intelligence data
export function useWholesalerIntelligence(wholesalerId: string | undefined) {
  const queryClient = useQueryClient();

  // Full wholesaler profile with extended fields
  const profileQuery = useQuery({
    queryKey: ['wholesaler-intelligence-profile', wholesalerId],
    queryFn: async () => {
      if (!wholesalerId) return null;
      const { data, error } = await supabase
        .from('wholesalers')
        .select(`
          *,
          assigned_rep:profiles!wholesalers_assigned_rep_id_fkey(id, name, avatar_url)
        `)
        .eq('id', wholesalerId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!wholesalerId,
  });

  // Orders with trends
  const ordersQuery = useQuery({
    queryKey: ['wholesaler-orders', wholesalerId],
    queryFn: async () => {
      if (!wholesalerId) return [];
      const { data, error } = await supabase
        .from('wholesaler_orders')
        .select('*')
        .eq('wholesaler_id', wholesalerId)
        .order('order_date', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as WholesalerOrder[];
    },
    enabled: !!wholesalerId,
  });

  // Payments
  const paymentsQuery = useQuery({
    queryKey: ['wholesaler-payments', wholesalerId],
    queryFn: async () => {
      if (!wholesalerId) return [];
      const { data, error } = await supabase
        .from('wholesaler_payments')
        .select('*')
        .eq('wholesaler_id', wholesalerId)
        .order('payment_date', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as WholesalerPayment[];
    },
    enabled: !!wholesalerId,
  });

  // Disputes
  const disputesQuery = useQuery({
    queryKey: ['wholesaler-disputes', wholesalerId],
    queryFn: async () => {
      if (!wholesalerId) return [];
      const { data, error } = await supabase
        .from('wholesaler_disputes')
        .select('*')
        .eq('wholesaler_id', wholesalerId)
        .order('opened_at', { ascending: false });
      if (error) throw error;
      return (data || []) as WholesalerDispute[];
    },
    enabled: !!wholesalerId,
  });

  // Visits
  const visitsQuery = useQuery({
    queryKey: ['wholesaler-visits', wholesalerId],
    queryFn: async () => {
      if (!wholesalerId) return [];
      const { data, error } = await supabase
        .from('wholesaler_visits')
        .select('*')
        .eq('wholesaler_id', wholesalerId)
        .order('visit_date', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as WholesalerVisit[];
    },
    enabled: !!wholesalerId,
  });

  // Communications
  const communicationsQuery = useQuery({
    queryKey: ['wholesaler-communications', wholesalerId],
    queryFn: async () => {
      if (!wholesalerId) return [];
      const { data, error } = await supabase
        .from('wholesaler_communications')
        .select('*')
        .eq('wholesaler_id', wholesalerId)
        .order('communicated_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as WholesalerCommunication[];
    },
    enabled: !!wholesalerId,
  });

  // Territory coverage - first try explicit table, then derive from wholesale_orders
  const territoryQuery = useQuery({
    queryKey: ['wholesaler-territory', wholesalerId],
    queryFn: async () => {
      if (!wholesalerId) return [];
      
      // First try the explicit territory coverage table
      const { data: explicitData, error: explicitError } = await supabase
        .from('wholesaler_territory_coverage')
        .select('*')
        .eq('wholesaler_id', wholesalerId)
        .order('store_count', { ascending: false });
      
      if (!explicitError && explicitData && explicitData.length > 0) {
        return explicitData as WholesalerTerritory[];
      }
      
      // If no explicit data, derive from wholesale_orders → stores
      const { data: ordersData, error: ordersError } = await supabase
        .from('wholesale_orders')
        .select('store_id, stores!wholesale_orders_store_id_fkey(id, name, address_city)')
        .eq('wholesaler_id', wholesalerId)
        .not('store_id', 'is', null);
      
      if (ordersError || !ordersData) return [];
      
      // Aggregate stores by city (as proxy for territory)
      const storesByCity: Record<string, { stores: Set<string>; storeNames: string[] }> = {};
      ordersData.forEach((order: any) => {
        if (order.stores) {
          const city = order.stores.address_city || 'Unknown';
          if (!storesByCity[city]) {
            storesByCity[city] = { stores: new Set(), storeNames: [] };
          }
          if (order.store_id && !storesByCity[city].stores.has(order.store_id)) {
            storesByCity[city].stores.add(order.store_id);
            storesByCity[city].storeNames.push(order.stores.name || 'Unknown Store');
          }
        }
      });
      
      // Convert to WholesalerTerritory format
      return Object.entries(storesByCity).map(([city, data], idx) => ({
        id: `derived-${idx}`,
        wholesaler_id: wholesalerId,
        neighborhood: city,
        borough: null,
        store_count: data.stores.size,
        coverage_density: data.stores.size >= 5 ? 'high' : data.stores.size >= 2 ? 'medium' : 'low',
        is_exclusive: false,
        overlap_with: [],
      })) as WholesalerTerritory[];
    },
    enabled: !!wholesalerId,
  });

  // Tubes sold by brand - derived from wholesale_orders (Grabba brands)
  const GRABBA_BRANDS = ['grabba', 'hot grabba', 'dark grabba', 'grabba leaf', 'gasmask', 'hotscolati', 'hotmama', 'grabba_r_us'];
  
  const tubesSoldByBrandQuery = useQuery({
    queryKey: ['wholesaler-tubes-by-brand', wholesalerId],
    queryFn: async () => {
      if (!wholesalerId) return [];
      
      const { data, error } = await supabase
        .from('wholesale_orders')
        .select('brand, tubes_total, created_at')
        .eq('wholesaler_id', wholesalerId)
        .not('brand', 'is', null);
      
      if (error) throw error;
      
      // Aggregate by brand
      const brandAggregates: Record<string, { tubes_sold: number; last_sold_date: string | null; order_count: number }> = {};
      
      // Initialize all Grabba brands with 0
      GRABBA_BRANDS.forEach(brand => {
        brandAggregates[brand.toLowerCase()] = { tubes_sold: 0, last_sold_date: null, order_count: 0 };
      });
      
      (data || []).forEach((order: any) => {
        const brand = (order.brand || '').toLowerCase();
        if (!brandAggregates[brand]) {
          brandAggregates[brand] = { tubes_sold: 0, last_sold_date: null, order_count: 0 };
        }
        brandAggregates[brand].tubes_sold += order.tubes_total || 0;
        brandAggregates[brand].order_count += 1;
        
        // Track most recent sale
        if (!brandAggregates[brand].last_sold_date || 
            new Date(order.created_at) > new Date(brandAggregates[brand].last_sold_date)) {
          brandAggregates[brand].last_sold_date = order.created_at;
        }
      });
      
      return Object.entries(brandAggregates).map(([brand, agg]) => ({
        brand,
        brand_display: brand.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        tubes_sold: agg.tubes_sold,
        last_sold_date: agg.last_sold_date,
        order_count: agg.order_count,
      }));
    },
    enabled: !!wholesalerId,
  });

  // Product performance
  const productPerformanceQuery = useQuery({
    queryKey: ['wholesaler-product-performance', wholesalerId],
    queryFn: async () => {
      if (!wholesalerId) return [];
      const { data, error } = await supabase
        .from('wholesaler_product_performance')
        .select('*')
        .eq('wholesaler_id', wholesalerId)
        .order('revenue', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as WholesalerProductPerformance[];
    },
    enabled: !!wholesalerId,
  });

  // Health snapshots for trend
  const healthSnapshotsQuery = useQuery({
    queryKey: ['wholesaler-health-snapshots', wholesalerId],
    queryFn: async () => {
      if (!wholesalerId) return [];
      const { data, error } = await supabase
        .from('wholesaler_health_snapshots')
        .select('*')
        .eq('wholesaler_id', wholesalerId)
        .order('snapshot_date', { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data || []) as WholesalerHealthSnapshot[];
    },
    enabled: !!wholesalerId,
  });

  // AI Signals
  const signalsQuery = useQuery({
    queryKey: ['wholesaler-ai-signals', wholesalerId],
    queryFn: async () => {
      if (!wholesalerId) return [];
      const { data, error } = await supabase
        .from('wholesaler_ai_signals')
        .select('*')
        .eq('wholesaler_id', wholesalerId)
        .eq('is_active', true)
        .order('detected_at', { ascending: false });
      if (error) throw error;
      return (data || []) as WholesalerAISignal[];
    },
    enabled: !!wholesalerId,
  });

  // Contracts
  const contractsQuery = useQuery({
    queryKey: ['wholesaler-contracts', wholesalerId],
    queryFn: async () => {
      if (!wholesalerId) return [];
      const { data, error } = await supabase
        .from('wholesaler_contracts')
        .select('*')
        .eq('wholesaler_id', wholesalerId)
        .order('start_date', { ascending: false });
      if (error) throw error;
      return (data || []) as WholesalerContract[];
    },
    enabled: !!wholesalerId,
  });

  // Mutations with schema contract enforcement
  const updateProfile = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      if (!wholesalerId) throw new Error('No wholesaler ID');
      
      // Import dynamically to avoid circular deps
      const { sanitizeWholesalerUpdate } = await import('@/lib/schemaContract');
      
      // Enforce schema contract - strip unknown fields
      const sanitizedUpdates = sanitizeWholesalerUpdate(updates);
      
      if (Object.keys(sanitizedUpdates).length === 0) {
        throw new Error('No valid fields to update');
      }
      
      const { error } = await supabase
        .from('wholesalers')
        .update(sanitizedUpdates)
        .eq('id', wholesalerId);
      if (error) throw error;
      
      // Log audit trail for changes
      try {
        const currentProfile = profileQuery.data;
        if (currentProfile) {
          const { useEntityAudit } = await import('@/hooks/useEntityAudit');
          // Note: We can't use hooks here, so we'll log directly
          const changes = Object.entries(sanitizedUpdates).filter(
            ([key, newValue]) => JSON.stringify(currentProfile[key as keyof typeof currentProfile]) !== JSON.stringify(newValue)
          );
          
          if (changes.length > 0) {
            await supabase.from('entity_audit_log').insert(
              changes.map(([field, newValue]) => ({
                entity_type: 'wholesaler',
                entity_id: wholesalerId,
                field_changed: field,
                old_value: currentProfile[field as keyof typeof currentProfile] ?? null,
                new_value: newValue ?? null,
              }))
            );
          }
        }
      } catch (auditError) {
        console.error('Failed to log audit:', auditError);
        // Don't fail the update if audit logging fails
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wholesaler-intelligence-profile', wholesalerId] });
      toast.success('Profile updated');
    },
    onError: (error) => toast.error(`Failed to update: ${error.message}`),
  });

  const addCommunication = useMutation({
    mutationFn: async (data: Partial<WholesalerCommunication>) => {
      if (!wholesalerId) throw new Error('No wholesaler ID');
      const { error } = await supabase
        .from('wholesaler_communications')
        .insert({
          wholesaler_id: wholesalerId,
          communication_type: data.communication_type || 'call',
          direction: data.direction || 'outbound',
          subject: data.subject || null,
          summary: data.summary || null,
          sentiment: data.sentiment || 'neutral',
          communicated_at: data.communicated_at || new Date().toISOString(),
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wholesaler-communications', wholesalerId] });
      toast.success('Communication logged');
    },
  });

  const addVisit = useMutation({
    mutationFn: async (data: Partial<WholesalerVisit>) => {
      if (!wholesalerId) throw new Error('No wholesaler ID');
      const { error } = await supabase
        .from('wholesaler_visits')
        .insert({
          wholesaler_id: wholesalerId,
          visit_type: data.visit_type || 'routine',
          visit_date: data.visit_date || new Date().toISOString(),
          duration_minutes: data.duration_minutes || null,
          observations: data.observations || null,
          visibility_score: data.visibility_score || null,
          placement_feedback: data.placement_feedback || null,
          follow_up_required: data.follow_up_required || false,
          follow_up_notes: data.follow_up_notes || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wholesaler-visits', wholesalerId] });
      toast.success('Visit logged');
    },
  });

  const acknowledgeSignal = useMutation({
    mutationFn: async (signalId: string) => {
      const { error } = await supabase
        .from('wholesaler_ai_signals')
        .update({ acknowledged_at: new Date().toISOString() })
        .eq('id', signalId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wholesaler-ai-signals', wholesalerId] });
    },
  });

  const resolveSignal = useMutation({
    mutationFn: async (signalId: string) => {
      const { error } = await supabase
        .from('wholesaler_ai_signals')
        .update({ resolved_at: new Date().toISOString(), is_active: false })
        .eq('id', signalId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wholesaler-ai-signals', wholesalerId] });
      toast.success('Signal resolved');
    },
  });

  // Calculate derived metrics
  const calculateOrderMetrics = () => {
    const orders = ordersQuery.data || [];
    if (orders.length === 0) return null;

    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const avgOrderValue = totalRevenue / totalOrders;
    
    // Calculate frequency (orders per 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentOrders = orders.filter(o => new Date(o.order_date) >= thirtyDaysAgo);
    const orderFrequency = recentOrders.length;

    // Find SKU concentration
    const skuCounts: Record<string, number> = {};
    orders.forEach(o => {
      (o.skus || []).forEach((sku: any) => {
        skuCounts[sku.name || sku.id] = (skuCounts[sku.name || sku.id] || 0) + 1;
      });
    });
    const topSku = Object.entries(skuCounts).sort((a, b) => b[1] - a[1])[0];
    const skuConcentrationRisk = topSku ? (topSku[1] / totalOrders) > 0.5 : false;

    return {
      totalOrders,
      totalRevenue,
      avgOrderValue,
      orderFrequency,
      skuConcentrationRisk,
      topSku: topSku ? topSku[0] : null,
    };
  };

  const calculatePaymentMetrics = () => {
    const payments = paymentsQuery.data || [];
    if (payments.length === 0) return null;

    const onTimePayments = payments.filter(p => p.on_time);
    const punctualityRate = (onTimePayments.length / payments.length) * 100;
    const avgDaysToPayment = payments.reduce((sum, p) => sum + (p.days_from_invoice || 0), 0) / payments.length;

    return {
      totalPayments: payments.length,
      punctualityRate,
      avgDaysToPayment,
      latePaments: payments.length - onTimePayments.length,
    };
  };

  return {
    profile: profileQuery.data,
    orders: ordersQuery.data || [],
    payments: paymentsQuery.data || [],
    disputes: disputesQuery.data || [],
    visits: visitsQuery.data || [],
    communications: communicationsQuery.data || [],
    territory: territoryQuery.data || [],
    productPerformance: productPerformanceQuery.data || [],
    tubesByBrand: tubesSoldByBrandQuery.data || [],
    healthSnapshots: healthSnapshotsQuery.data || [],
    signals: signalsQuery.data || [],
    contracts: contractsQuery.data || [],
    
    orderMetrics: calculateOrderMetrics(),
    paymentMetrics: calculatePaymentMetrics(),
    
    isLoading: profileQuery.isLoading,
    
    updateProfile: updateProfile.mutateAsync,
    addCommunication: addCommunication.mutateAsync,
    addVisit: addVisit.mutateAsync,
    acknowledgeSignal: acknowledgeSignal.mutateAsync,
    resolveSignal: resolveSignal.mutateAsync,
    
    refetchAll: () => {
      queryClient.invalidateQueries({ queryKey: ['wholesaler-intelligence-profile', wholesalerId] });
      queryClient.invalidateQueries({ queryKey: ['wholesaler-orders', wholesalerId] });
      queryClient.invalidateQueries({ queryKey: ['wholesaler-payments', wholesalerId] });
      queryClient.invalidateQueries({ queryKey: ['wholesaler-disputes', wholesalerId] });
      queryClient.invalidateQueries({ queryKey: ['wholesaler-visits', wholesalerId] });
      queryClient.invalidateQueries({ queryKey: ['wholesaler-communications', wholesalerId] });
      queryClient.invalidateQueries({ queryKey: ['wholesaler-territory', wholesalerId] });
      queryClient.invalidateQueries({ queryKey: ['wholesaler-product-performance', wholesalerId] });
      queryClient.invalidateQueries({ queryKey: ['wholesaler-health-snapshots', wholesalerId] });
      queryClient.invalidateQueries({ queryKey: ['wholesaler-ai-signals', wholesalerId] });
      queryClient.invalidateQueries({ queryKey: ['wholesaler-contracts', wholesalerId] });
    },
  };
}
