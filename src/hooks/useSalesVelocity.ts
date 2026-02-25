/**
 * useSalesVelocity — Fetches SKU sales velocity and inventory coverage intelligence
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SkuSalesVelocity {
  brand: string;
  units_sold_last_7_days: number;
  units_sold_last_14_days: number;
  units_sold_last_30_days: number;
  avg_daily_velocity_30d: number;
  avg_daily_velocity_14d: number;
  demand_trend: 'accelerating' | 'declining' | 'stable';
}

export interface InventoryCoverage {
  brand: string;
  current_boxes_available: number;
  units_sold_last_7_days: number;
  units_sold_last_14_days: number;
  units_sold_last_30_days: number;
  avg_daily_velocity_30d: number;
  avg_daily_velocity_14d: number;
  demand_trend: 'accelerating' | 'declining' | 'stable';
  days_of_inventory_remaining: number | null;
  risk_level: 'green' | 'amber' | 'red' | 'critical' | 'no_demand';
  required_boxes_for_30_days: number;
  recommended_lbs_to_produce: number | null;
  raw_inventory_lbs: number;
  procurement_needed_lbs: number | null;
  is_overstock: boolean;
  baseline_boxes_per_lb: number | null;
  baseline_lbs_per_box: number | null;
}

export function useSalesVelocity() {
  return useQuery({
    queryKey: ['sku-sales-velocity'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_sku_sales_velocity' as any)
        .select('*');
      if (error) throw error;
      return (data || []) as unknown as SkuSalesVelocity[];
    },
  });
}

export function useInventoryCoverage() {
  return useQuery({
    queryKey: ['inventory-coverage-intelligence'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_inventory_coverage_intelligence' as any)
        .select('*');
      if (error) throw error;
      return (data || []) as unknown as InventoryCoverage[];
    },
  });
}

export function getRiskColor(risk: string) {
  switch (risk) {
    case 'critical': return 'text-destructive';
    case 'red': return 'text-destructive';
    case 'amber': return 'text-yellow-500';
    case 'green': return 'text-emerald-500';
    default: return 'text-muted-foreground';
  }
}

export function getRiskBadgeVariant(risk: string): 'destructive' | 'secondary' | 'default' | 'outline' {
  switch (risk) {
    case 'critical':
    case 'red': return 'destructive';
    case 'amber': return 'secondary';
    case 'green': return 'default';
    default: return 'outline';
  }
}

export function getDemandTrendIcon(trend: string) {
  switch (trend) {
    case 'accelerating': return '↑';
    case 'declining': return '↓';
    default: return '→';
  }
}

export function getDemandTrendColor(trend: string) {
  switch (trend) {
    case 'accelerating': return 'text-emerald-500';
    case 'declining': return 'text-destructive';
    default: return 'text-muted-foreground';
  }
}
