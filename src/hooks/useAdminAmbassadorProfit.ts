/**
 * Admin-scoped Ambassador Profit Hook
 * Uses get_ambassador_profit_dashboard / get_ambassador_profit_breakdown RPCs
 * which accept an ambassador_id parameter (unlike get_my_* which use auth.uid())
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ProfitSummary, ProfitBreakdownRow } from './useAmbassadorProfit';

export function useAdminAmbassadorProfitDashboard(ambassadorId?: string) {
  return useQuery({
    queryKey: ['admin-ambassador-profit-dashboard', ambassadorId],
    queryFn: async (): Promise<ProfitSummary | null> => {
      if (!ambassadorId) return null;

      const { data, error } = await (supabase as any).rpc('get_ambassador_profit_dashboard', {
        p_ambassador_id: ambassadorId,
      });

      if (error) {
        console.error('[Admin Wholesale Profit] Dashboard RPC error:', { ambassadorId, error: error.message, code: error.code });
        throw error;
      }
      if (!data || data.length === 0) {
        console.warn('[Admin Wholesale Profit] No dashboard data returned', { ambassadorId });
        return null;
      }

      const d = data[0];
      return {
        ambassador_id: d.ambassador_id,
        ambassador_user_id: d.ambassador_user_id,
        ambassador_name: d.ambassador_name,
        total_invoices: Number(d.total_invoices || 0),
        total_units_sold: Number(d.total_units_sold || 0),
        total_revenue: Number(d.total_revenue || 0),
        total_wholesale_cost: Number(d.total_wholesale_cost || 0),
        total_profit: Number(d.total_profit || 0),
        avg_margin_pct: Number(d.avg_margin_pct || 0),
        brands_sold: Number(d.brands_sold || 0),
        products_sold: Number(d.products_sold || 0),
        stores_served: Number(d.stores_served || 0),
        avg_confidence_score: Number(d.avg_confidence_score || 0),
        estimated_row_count: Number(d.estimated_row_count || 0),
        confirmed_row_count: Number(d.confirmed_row_count || 0),
      };
    },
    enabled: !!ambassadorId,
  });
}

export function useAdminAmbassadorProfitBreakdown(
  ambassadorId?: string,
  filters?: { brand?: string; store_id?: string; sale_channel?: string }
) {
  return useQuery({
    queryKey: ['admin-ambassador-profit-breakdown', ambassadorId, filters],
    queryFn: async (): Promise<ProfitBreakdownRow[]> => {
      if (!ambassadorId) return [];

      const { data, error } = await (supabase as any).rpc('get_ambassador_profit_breakdown', {
        p_ambassador_id: ambassadorId,
        p_brand: filters?.brand || null,
        p_store_id: filters?.store_id || null,
        p_sale_channel: filters?.sale_channel || null,
      });

      if (error) {
        console.error('[Admin Wholesale Profit] Breakdown RPC error:', { ambassadorId, error: error.message, code: error.code });
        throw error;
      }
      if (!data || data.length === 0) {
        console.warn('[Admin Wholesale Profit] No breakdown data returned', { ambassadorId, filters });
      }

      return (data || []).map((row: any): ProfitBreakdownRow => ({
        ambassador_id: row.ambassador_id,
        brand: row.brand,
        brand_id: row.brand_id,
        product_name: row.product_name,
        product_id: row.product_id,
        sale_channel: row.sale_channel,
        store_id: row.store_id,
        store_name: row.store_name,
        units_sold: Number(row.units_sold || 0),
        wholesale_cost: Number(row.wholesale_cost || 0),
        retail_revenue: Number(row.retail_revenue || 0),
        net_profit: Number(row.net_profit || 0),
        margin_pct: Number(row.margin_pct || 0),
        first_sale_at: row.first_sale_at,
        last_sale_at: row.last_sale_at,
        sale_month: row.sale_month,
        attribution_method: row.attribution_method || 'windowed_assignment',
        attribution_valid: row.attribution_valid ?? true,
        profit_confidence_score: Number(row.profit_confidence_score || 0),
        profit_status: row.profit_status || 'estimated',
      }));
    },
    enabled: !!ambassadorId,
  });
}
