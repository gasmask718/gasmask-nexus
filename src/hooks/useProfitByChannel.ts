import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SaleChannel = 'retail' | 'wholesale' | 'street';

export interface ChannelProfitData {
  sale_channel: SaleChannel;
  invoice_count: number;
  total_units_sold: number;
  total_revenue: number;
  total_profit: number;
  avg_margin_pct: number;
  month: string;
}

export interface ChannelProfitSummary {
  retail: {
    revenue: number;
    profit: number;
    margin: number;
    orders: number;
  };
  wholesale: {
    revenue: number;
    profit: number;
    margin: number;
    orders: number;
  };
  street: {
    revenue: number;
    profit: number;
    margin: number;
    orders: number;
  };
  total: {
    revenue: number;
    profit: number;
    margin: number;
  };
}

/**
 * Hook to fetch profit data by sales channel.
 * INTERNAL USE ONLY - for Finance dashboards.
 * 
 * This data must NEVER be exposed to:
 * - Invoices
 * - Customer-facing views
 * - PDFs
 * - Portal pages
 */
export function useProfitByChannel(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['profit-by-channel', startDate, endDate],
    queryFn: async (): Promise<ChannelProfitSummary> => {
      // Query invoice line items with profit data
      let query = supabase
        .from('invoice_line_items')
        .select('sale_channel, total, profit_at_sale, invoice_id')
        .is('deleted_at', null);

      // Add date filtering if provided (would need to join with invoices)
      // For now, get all data
      const { data, error } = await query;

      if (error) {
        console.error('Error fetching profit by channel:', error);
        throw error;
      }

      // Aggregate by channel
      const channelData: Record<SaleChannel, { revenue: number; profit: number; orders: Set<string> }> = {
        retail: { revenue: 0, profit: 0, orders: new Set() },
        wholesale: { revenue: 0, profit: 0, orders: new Set() },
        street: { revenue: 0, profit: 0, orders: new Set() },
      };

      (data || []).forEach(item => {
        const channel = (item.sale_channel as SaleChannel) || 'retail';
        if (channelData[channel]) {
          channelData[channel].revenue += Number(item.total) || 0;
          channelData[channel].profit += Number(item.profit_at_sale) || 0;
          if (item.invoice_id) {
            channelData[channel].orders.add(item.invoice_id);
          }
        }
      });

      // Calculate margins
      const calculateMargin = (profit: number, revenue: number) => 
        revenue > 0 ? (profit / revenue) * 100 : 0;

      const totalRevenue = channelData.retail.revenue + channelData.wholesale.revenue + channelData.street.revenue;
      const totalProfit = channelData.retail.profit + channelData.wholesale.profit + channelData.street.profit;

      return {
        retail: {
          revenue: channelData.retail.revenue,
          profit: channelData.retail.profit,
          margin: calculateMargin(channelData.retail.profit, channelData.retail.revenue),
          orders: channelData.retail.orders.size,
        },
        wholesale: {
          revenue: channelData.wholesale.revenue,
          profit: channelData.wholesale.profit,
          margin: calculateMargin(channelData.wholesale.profit, channelData.wholesale.revenue),
          orders: channelData.wholesale.orders.size,
        },
        street: {
          revenue: channelData.street.revenue,
          profit: channelData.street.profit,
          margin: calculateMargin(channelData.street.profit, channelData.street.revenue),
          orders: channelData.street.orders.size,
        },
        total: {
          revenue: totalRevenue,
          profit: totalProfit,
          margin: calculateMargin(totalProfit, totalRevenue),
        },
      };
    },
    staleTime: 60000, // Cache for 1 minute
  });
}

/**
 * Get profit breakdown for a single product across channels.
 * INTERNAL USE ONLY.
 */
export function useProductProfitByChannel(productId: string) {
  return useQuery({
    queryKey: ['product-profit-by-channel', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoice_line_items')
        .select('sale_channel, quantity, total, profit_at_sale')
        .is('deleted_at', null)
        .eq('product_id', productId);

      if (error) throw error;

      const channelData: Record<SaleChannel, { units: number; revenue: number; profit: number }> = {
        retail: { units: 0, revenue: 0, profit: 0 },
        wholesale: { units: 0, revenue: 0, profit: 0 },
        street: { units: 0, revenue: 0, profit: 0 },
      };

      (data || []).forEach(item => {
        const channel = (item.sale_channel as SaleChannel) || 'retail';
        if (channelData[channel]) {
          channelData[channel].units += Number(item.quantity) || 0;
          channelData[channel].revenue += Number(item.total) || 0;
          channelData[channel].profit += Number(item.profit_at_sale) || 0;
        }
      });

      return channelData;
    },
    enabled: !!productId,
  });
}
