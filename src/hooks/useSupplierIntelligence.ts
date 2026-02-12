import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useSupplierRankings() {
  return useQuery({
    queryKey: ['supplier-rankings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_supplier_rankings' as any)
        .select('*')
        .order('rank_overall');
      if (error) throw error;
      return data || [];
    },
  });
}

export function useSupplierAlerts() {
  return useQuery({
    queryKey: ['supplier-price-alerts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_supplier_price_alerts' as any)
        .select('*')
        .order('severity', { ascending: false })
        .limit(25);
      if (error) throw error;
      return data || [];
    },
  });
}

export function useSupplierProductScorecard(supplier: string) {
  return useQuery({
    queryKey: ['supplier-product-scorecard', supplier],
    enabled: !!supplier,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_supplier_product_scorecard' as any)
        .select('*')
        .eq('supplier_name', supplier)
        .order('overall_score', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useSupplierScorecard() {
  return useQuery({
    queryKey: ['supplier-scorecard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_supplier_scorecard' as any)
        .select('*')
        .order('overall_score', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useSupplierDecisionMatrix() {
  return useQuery({
    queryKey: ['supplier-decision-matrix'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_supplier_decision_matrix' as any)
        .select('*')
        .lte('action_priority', 3)
        .order('action_priority')
        .order('risk_score', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useNegotiationQueue() {
  return useQuery({
    queryKey: ['supplier-negotiation-queue'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_supplier_negotiation_queue' as any)
        .select('*')
        .order('priority_rank');
      if (error) throw error;
      return data || [];
    },
  });
}

export function useContractRiskIndex(supplier?: string) {
  return useQuery({
    queryKey: ['supplier-contract-risk-index', supplier],
    queryFn: async () => {
      let q = supabase
        .from('v_supplier_contract_risk_index' as any)
        .select('*')
        .order('contract_risk_index', { ascending: false });
      if (supplier) q = q.eq('supplier_name', supplier);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });
}

export function useCostTrendProjection(supplier?: string) {
  return useQuery({
    queryKey: ['supplier-cost-trend-projection', supplier],
    enabled: !!supplier,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_supplier_cost_trend_projection' as any)
        .select('*')
        .eq('supplier_name', supplier)
        .order('projected_unit_cost_60d', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useForecastDecisionOverlay(supplier?: string) {
  return useQuery({
    queryKey: ['supplier-forecast-overlay', supplier],
    enabled: !!supplier,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_supplier_forecast_decision_overlay' as any)
        .select('*')
        .eq('supplier_name', supplier)
        .order('combined_risk_score', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useRenegotiationWindow(supplier?: string) {
  return useQuery({
    queryKey: ['supplier-renegotiation-window', supplier],
    enabled: !!supplier,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_supplier_renegotiation_window' as any)
        .select('*')
        .eq('supplier_name', supplier);
      if (error) throw error;
      return data || [];
    },
  });
}
