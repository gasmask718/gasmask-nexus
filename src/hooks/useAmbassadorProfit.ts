/**
 * Ambassador Profit Tracking Hook
 * Sources data from v_ambassador_profit_dashboard and v_ambassador_profit_breakdown views
 * Ambassadors see ONLY their own profit data (filtered by user_id)
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
}

export function useAmbassadorProfitDashboard() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['ambassador-profit-dashboard', user?.id],
    queryFn: async (): Promise<ProfitSummary | null> => {
      if (!user?.id) return null;

      const { data, error } = await (supabase as any)
        .from('v_ambassador_profit_dashboard')
        .select('*')
        .eq('ambassador_user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Profit dashboard error:', error);
        throw error;
      }
      if (!data) return null;

      const d = data as any;
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
      };
    },
    enabled: !!user?.id,
  });
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

      let query = (supabase as any)
        .from('v_ambassador_profit_breakdown')
        .select('*')
        .eq('ambassador_user_id', user.id)
        .order('sale_month', { ascending: false });

      if (filters?.brand) {
        query = query.eq('brand', filters.brand);
      }
      if (filters?.store_id) {
        query = query.eq('store_id', filters.store_id);
      }
      if (filters?.sale_channel) {
        query = query.eq('sale_channel', filters.sale_channel);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Profit breakdown error:', error);
        throw error;
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
      }));
    },
    enabled: !!user?.id,
  });
}
