/**
 * Ambassador Profit Tracking Hook
 * Sources data via secure RPC functions (get_my_profit_dashboard, get_my_profit_breakdown)
 * Ambassadors see ONLY their own profit data (enforced server-side via SECURITY DEFINER)
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ProfitSummary {
  ambassador_id: string;
  ambassador_user_id: string;
  ambassador_name: string;
  total_invoices: number;
  total_units_sold: number;
  total_revenue: number;
  total_wholesale_cost: number;
  total_profit: number;
  avg_margin_pct: number;
  brands_sold: number;
  products_sold: number;
  stores_served: number;
  avg_confidence_score: number;
  estimated_row_count: number;
  confirmed_row_count: number;
}

export interface ProfitBreakdownRow {
  ambassador_id: string;
  brand: string | null;
  brand_id: string | null;
  product_name: string | null;
  product_id: string | null;
  sale_channel: string | null;
  store_id: string | null;
  store_name: string | null;
  units_sold: number;
  wholesale_cost: number;
  retail_revenue: number;
  net_profit: number;
  margin_pct: number;
  first_sale_at: string | null;
  last_sale_at: string | null;
  sale_month: string | null;
  attribution_method: string;
  attribution_valid: boolean;
  profit_confidence_score: number;
  profit_status: 'confirmed' | 'estimated';
}

export type ProfitDataStatus = 'loading' | 'empty' | 'loaded' | 'error';

export function useAmbassadorProfitDashboard() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['ambassador-profit-dashboard', user?.id],
    queryFn: async (): Promise<ProfitSummary | null> => {
      if (!user?.id) return null;

      const { data, error } = await (supabase as any).rpc('get_my_profit_dashboard');

      if (error) {
        console.error('[Wholesale Profit Ledger] Dashboard RPC error:', { userId: user.id, error: error.message, code: error.code });
        throw error;
      }
      if (!data || data.length === 0) {
        console.warn('[Wholesale Profit Ledger] No dashboard data returned', { ambassadorUserId: user.id });
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
    enabled: !!user?.id,
  });

  const profitDataStatus: ProfitDataStatus = query.isLoading
    ? 'loading'
    : query.isError
    ? 'error'
    : query.data
    ? 'loaded'
    : 'empty';

  return { ...query, profitDataStatus };
}

export function useAmbassadorProfitBreakdown(filters?: {
  brand?: string;
  store_id?: string;
  sale_channel?: string;
}) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['ambassador-profit-breakdown', user?.id, filters],
    queryFn: async (): Promise<ProfitBreakdownRow[]> => {
      if (!user?.id) return [];

      const { data, error } = await (supabase as any).rpc('get_my_profit_breakdown', {
        p_brand: filters?.brand || null,
        p_store_id: filters?.store_id || null,
        p_sale_channel: filters?.sale_channel || null,
      });

      if (error) {
        console.error('[Wholesale Profit Ledger] Breakdown RPC error:', { userId: user.id, error: error.message, code: error.code });
        throw error;
      }
      if (!data || data.length === 0) {
        console.warn('[Wholesale Profit Ledger] No breakdown data returned', { ambassadorUserId: user.id, filters });
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
    enabled: !!user?.id,
  });
}
