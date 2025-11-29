import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface StoreStats {
  activeOrders: number;
  pendingOrders: number;
  awaitingDelivery: number;
  recentDeliveries: number;
  spendingThisWeek: number;
  totalSpend: number;
  unpaidInvoices: number;
}

export function useStoreStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['store-stats', user?.id],
    queryFn: async (): Promise<StoreStats> => {
      if (!user) {
        return {
          activeOrders: 0,
          pendingOrders: 0,
          awaitingDelivery: 0,
          recentDeliveries: 0,
          spendingThisWeek: 0,
          totalSpend: 0,
          unpaidInvoices: 0,
        };
      }

      const { data: orders, error } = await supabase
        .from('marketplace_orders')
        .select('id, total, payment_status, fulfillment_status, created_at')
        .eq('user_id', user.id);

      if (error) throw error;

      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const stats = (orders || []).reduce((acc, order) => {
        const total = Number(order.total) || 0;
        const createdAt = new Date(order.created_at || '');

        // Total spend
        if (order.payment_status === 'paid') {
          acc.totalSpend += total;
        }

        // This week spending
        if (createdAt >= weekAgo && order.payment_status === 'paid') {
          acc.spendingThisWeek += total;
        }

        // Order counts by status
        if (order.fulfillment_status === 'pending') {
          acc.pendingOrders++;
          acc.activeOrders++;
        } else if (order.fulfillment_status === 'processing' || order.fulfillment_status === 'shipped') {
          acc.awaitingDelivery++;
          acc.activeOrders++;
        } else if (order.fulfillment_status === 'delivered') {
          if (createdAt >= weekAgo) {
            acc.recentDeliveries++;
          }
        }

        // Unpaid invoices
        if (order.payment_status !== 'paid') {
          acc.unpaidInvoices++;
        }

        return acc;
      }, {
        activeOrders: 0,
        pendingOrders: 0,
        awaitingDelivery: 0,
        recentDeliveries: 0,
        spendingThisWeek: 0,
        totalSpend: 0,
        unpaidInvoices: 0,
      });

      return stats;
    },
    enabled: !!user,
  });
}
