import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useWholesalerProfile } from "./useWholesalerProfile";

export interface WholesalerFulfillment {
  id: string;
  order_id: string;
  wholesaler_id: string;
  status: string;
  shipping_label_url: string | null;
  tracking_number: string | null;
  carrier: string | null;
  items_snapshot: any;
  created_at: string | null;
  updated_at: string | null;
  order?: {
    id: string;
    payment_status: string | null;
    fulfillment_status: string | null;
    subtotal: number | null;
    total: number | null;
    shipping_address: any;
    created_at: string | null;
  } | null;
}

export function useWholesalerFulfillments(statusFilter?: string) {
  const { profile } = useWholesalerProfile();
  const queryClient = useQueryClient();

  const fulfillmentsQuery = useQuery({
    queryKey: ['wholesaler-fulfillments', profile?.id, statusFilter],
    queryFn: async () => {
      if (!profile) return [];

      let query = supabase
        .from('marketplace_fulfillments')
        .select(`
          *,
          order:marketplace_orders(id, payment_status, fulfillment_status, subtotal, total, shipping_address, created_at)
        `)
        .eq('wholesaler_id', profile.id)
        .order('created_at', { ascending: false });

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((f: any) => ({
        ...f,
        order: Array.isArray(f.order) ? f.order[0] : f.order,
      })) as WholesalerFulfillment[];
    },
    enabled: !!profile,
  });

  const generateLabel = useMutation({
    mutationFn: async (fulfillmentId: string) => {
      const { data, error } = await supabase.functions.invoke('generate-shipping-label', {
        body: { fulfillment_id: fulfillmentId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['wholesaler-fulfillments'] });
      toast.success(`Label generated — ${data.tracking_number}`);
    },
    onError: (error) => {
      toast.error(`Label generation failed: ${error.message}`);
    },
  });

  const markShipped = useMutation({
    mutationFn: async (fulfillmentId: string) => {
      const { error } = await supabase
        .from('marketplace_fulfillments')
        .update({
          status: 'shipped',
          updated_at: new Date().toISOString(),
        })
        .eq('id', fulfillmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wholesaler-fulfillments'] });
      queryClient.invalidateQueries({ queryKey: ['wholesaler-payouts'] });
      toast.success('Fulfillment marked as shipped');
    },
    onError: (error) => {
      toast.error(`Failed to mark shipped: ${error.message}`);
    },
  });

  const markCompleted = useMutation({
    mutationFn: async (fulfillmentId: string) => {
      const { error } = await supabase
        .from('marketplace_fulfillments')
        .update({
          status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', fulfillmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wholesaler-fulfillments'] });
      toast.success('Fulfillment completed');
    },
    onError: (error) => {
      toast.error(`Failed to complete: ${error.message}`);
    },
  });

  const counts = {
    pending: fulfillmentsQuery.data?.filter(f => f.status === 'pending').length || 0,
    label_generated: fulfillmentsQuery.data?.filter(f => f.status === 'label_generated').length || 0,
    shipped: fulfillmentsQuery.data?.filter(f => f.status === 'shipped').length || 0,
    completed: fulfillmentsQuery.data?.filter(f => f.status === 'completed').length || 0,
    total: fulfillmentsQuery.data?.length || 0,
  };

  return {
    fulfillments: fulfillmentsQuery.data || [],
    isLoading: fulfillmentsQuery.isLoading,
    counts,
    generateLabel: generateLabel.mutateAsync,
    isGeneratingLabel: generateLabel.isPending,
    markShipped: markShipped.mutateAsync,
    isMarkingShipped: markShipped.isPending,
    markCompleted: markCompleted.mutateAsync,
  };
}
