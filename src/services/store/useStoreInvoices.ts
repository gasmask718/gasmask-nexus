import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface StoreInvoice {
  id: string;
  orderId: string;
  orderNumber: string;
  total: number;
  status: 'paid' | 'unpaid' | 'overdue';
  dueDate: string;
  createdAt: string;
  wholesalerName: string;
}

export function useStoreInvoices() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['store-invoices', user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Get orders that serve as invoices
      const { data, error } = await supabase
        .from('marketplace_orders')
        .select(`
          id,
          total,
          payment_status,
          created_at,
          wholesaler:wholesaler_profiles(company_name)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(order => {
        const createdAt = new Date(order.created_at || '');
        const dueDate = new Date(createdAt);
        dueDate.setDate(dueDate.getDate() + 30); // Net 30 terms

        let status: 'paid' | 'unpaid' | 'overdue' = 'unpaid';
        if (order.payment_status === 'paid') {
          status = 'paid';
        } else if (new Date() > dueDate) {
          status = 'overdue';
        }

        return {
          id: order.id,
          orderId: order.id,
          orderNumber: order.id.slice(0, 8).toUpperCase(),
          total: Number(order.total) || 0,
          status,
          dueDate: dueDate.toISOString(),
          createdAt: order.created_at || '',
          wholesalerName: (order.wholesaler as any)?.company_name || 'Unknown',
        } as StoreInvoice;
      });
    },
    enabled: !!user,
  });
}
