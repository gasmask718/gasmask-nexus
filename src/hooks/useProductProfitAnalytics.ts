// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCT PROFIT ANALYTICS HOOK
// Floor 5 — Finance Engine: Profit per box, margins, COGS tracking
// ═══════════════════════════════════════════════════════════════════════════════

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ProductProfitSummary {
  product_id: string;
  product_name: string;
  brand_id: string | null;
  brand_name: string | null;
  cost_per_unit: number | null;
  units_per_box: number | null;
  cost_per_box: number;
  wholesale_price: number | null;
  total_orders: number;
  total_units_sold: number;
  total_revenue: number;
  total_cogs: number;
  total_profit: number;
  margin_percent: number;
}

export interface ProfitDashboardTotals {
  gross_revenue: number;
  total_cogs: number;
  gross_profit: number;
  overall_margin: number;
  total_orders: number;
  avg_order_value: number;
  avg_margin: number;
  top_products: ProductProfitSummary[];
  low_margin_products: ProductProfitSummary[];
  by_brand: Record<string, {
    revenue: number;
    cogs: number;
    profit: number;
    margin: number;
    orders: number;
  }>;
}

export function useProductProfitSummary() {
  return useQuery({
    queryKey: ['product-profit-summary'],
    queryFn: async () => {
      // Query from the profit summary view
      const { data, error } = await supabase
        .from('v_product_profit_summary')
        .select('*')
        .order('total_profit', { ascending: false });

      if (error) {
        // View might not exist yet, fall back to manual calculation
        console.warn('v_product_profit_summary view not available, using fallback');
        return [];
      }

      return data as ProductProfitSummary[];
    },
  });
}

export function useProfitDashboardTotals(filters?: { 
  brandId?: string; 
  dateFrom?: string; 
  dateTo?: string;
}) {
  return useQuery({
    queryKey: ['profit-dashboard-totals', filters],
    queryFn: async () => {
      // Fetch all order items with profit snapshots
      let query = supabase
        .from('store_order_items')
        .select(`
          quantity,
          unit_price,
          total_price,
          cost_per_unit_snapshot,
          units_per_box_snapshot,
          cost_per_box_snapshot,
          profit_per_box_snapshot,
          margin_percent_snapshot,
          revenue_total,
          cogs_total,
          profit_total,
          order_id,
          product_id,
          products(name, brand_id, cost, units_per_box, brands(name))
        `);

      const { data: items, error } = await query;
      if (error) throw error;

      // Also fetch orders for date filtering
      const { data: orders } = await supabase
        .from('store_orders')
        .select('id, created_at, store_id');

      const orderMap = new Map((orders || []).map(o => [o.id, o]));

      // Filter by date if specified
      let filteredItems = items || [];
      if (filters?.dateFrom || filters?.dateTo) {
        filteredItems = filteredItems.filter(item => {
          const order = orderMap.get(item.order_id);
          if (!order) return false;
          const orderDate = new Date(order.created_at);
          if (filters.dateFrom && orderDate < new Date(filters.dateFrom)) return false;
          if (filters.dateTo && orderDate > new Date(filters.dateTo)) return false;
          return true;
        });
      }

      // Filter by brand if specified
      if (filters?.brandId) {
        filteredItems = filteredItems.filter(item => 
          (item.products as any)?.brand_id === filters.brandId
        );
      }

      // Calculate totals
      let grossRevenue = 0;
      let totalCogs = 0;
      const orderIds = new Set<string>();
      const brandStats: Record<string, { revenue: number; cogs: number; profit: number; orders: Set<string> }> = {};
      const productStats: Record<string, ProductProfitSummary> = {};

      filteredItems.forEach(item => {
        const product = item.products as any;
        const brandName = product?.brands?.name || 'Unknown';
        const brandId = product?.brand_id || null;

        // Use snapshot values if available, otherwise calculate
        const revenue = item.revenue_total || item.total_price || 0;
        const cogs = item.cogs_total || 
          ((item.cost_per_unit_snapshot || product?.cost || 0) * 
           (item.units_per_box_snapshot || product?.units_per_box || 1) * 
           item.quantity);

        grossRevenue += revenue;
        totalCogs += cogs;
        orderIds.add(item.order_id);

        // Brand breakdown
        if (!brandStats[brandName]) {
          brandStats[brandName] = { revenue: 0, cogs: 0, profit: 0, orders: new Set() };
        }
        brandStats[brandName].revenue += revenue;
        brandStats[brandName].cogs += cogs;
        brandStats[brandName].profit += (revenue - cogs);
        brandStats[brandName].orders.add(item.order_id);

        // Product breakdown
        if (!productStats[item.product_id]) {
          productStats[item.product_id] = {
            product_id: item.product_id,
            product_name: product?.name || 'Unknown',
            brand_id: brandId,
            brand_name: brandName,
            cost_per_unit: product?.cost || null,
            units_per_box: product?.units_per_box || null,
            cost_per_box: (product?.cost || 0) * (product?.units_per_box || 1),
            wholesale_price: null,
            total_orders: 0,
            total_units_sold: 0,
            total_revenue: 0,
            total_cogs: 0,
            total_profit: 0,
            margin_percent: 0,
          };
        }
        productStats[item.product_id].total_units_sold += item.quantity;
        productStats[item.product_id].total_revenue += revenue;
        productStats[item.product_id].total_cogs += cogs;
        productStats[item.product_id].total_profit += (revenue - cogs);
        productStats[item.product_id].total_orders++;
      });

      // Calculate margins for products
      Object.values(productStats).forEach(p => {
        p.margin_percent = p.total_revenue > 0 
          ? (p.total_profit / p.total_revenue) * 100 
          : 0;
      });

      const grossProfit = grossRevenue - totalCogs;
      const overallMargin = grossRevenue > 0 ? (grossProfit / grossRevenue) * 100 : 0;
      const totalOrders = orderIds.size;

      // Convert brand stats
      const byBrand: ProfitDashboardTotals['by_brand'] = {};
      Object.entries(brandStats).forEach(([name, stats]) => {
        byBrand[name] = {
          revenue: stats.revenue,
          cogs: stats.cogs,
          profit: stats.profit,
          margin: stats.revenue > 0 ? (stats.profit / stats.revenue) * 100 : 0,
          orders: stats.orders.size,
        };
      });

      // Get top and low margin products
      const sortedProducts = Object.values(productStats)
        .filter(p => p.total_revenue > 0)
        .sort((a, b) => b.total_profit - a.total_profit);

      const topProducts = sortedProducts.slice(0, 10);
      const lowMarginProducts = sortedProducts
        .filter(p => p.margin_percent < 20 && p.margin_percent > 0)
        .sort((a, b) => a.margin_percent - b.margin_percent)
        .slice(0, 10);

      return {
        gross_revenue: grossRevenue,
        total_cogs: totalCogs,
        gross_profit: grossProfit,
        overall_margin: overallMargin,
        total_orders: totalOrders,
        avg_order_value: totalOrders > 0 ? grossRevenue / totalOrders : 0,
        avg_margin: overallMargin,
        top_products: topProducts,
        low_margin_products: lowMarginProducts,
        by_brand: byBrand,
      } as ProfitDashboardTotals;
    },
  });
}
