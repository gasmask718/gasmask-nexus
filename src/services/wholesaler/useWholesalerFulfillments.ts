import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useWholesalerProfile } from "./useWholesalerProfile";

export interface VendorShippingAddress {
  name: string | null;
  address1: string | null;
  address2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
}

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
  // Privacy-safe fields from vendor_fulfillment_view
  payment_status: string | null;
  order_fulfillment_status: string | null;
  subtotal: number | null;
  total: number | null;
  order_created_at: string | null;
  // Shipping — only populated after payment confirmed
  ship_to: VendorShippingAddress | null;
  // Dispute info (category + dates only, no PII)
  dispute_status: string | null;
  dispute_reason: string | null;
  dispute_opened_at: string | null;
  dispute_resolved_at: string | null;
}

export function useWholesalerFulfillments(statusFilter?: string) {
  const { profile } = useWholesalerProfile();
  const queryClient = useQueryClient();

  const fulfillmentsQuery = useQuery({
    queryKey: ['wholesaler-fulfillments', profile?.id, statusFilter],
    queryFn: async () => {
      if (!profile) return [];

      // Use the privacy-safe vendor_fulfillment_view
      let query = supabase
        .from('vendor_fulfillment_view')
        .select('*')
        .eq('wholesaler_id', profile.id)
        .order('fulfillment_created_at', { ascending: false });

      if (statusFilter) {
        query = query.eq('fulfillment_status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((row: any) => ({
        id: row.fulfillment_id,
        order_id: row.order_id,
        wholesaler_id: row.wholesaler_id,
        status: row.fulfillment_status,
        shipping_label_url: row.shipping_label_url,
        tracking_number: row.tracking_number,
        carrier: row.carrier,
        items_snapshot: row.items_snapshot,
        created_at: row.fulfillment_created_at,
        updated_at: row.fulfillment_updated_at,
        payment_status: row.payment_status,
        order_fulfillment_status: row.order_fulfillment_status,
        subtotal: row.subtotal,
        total: row.total,
        order_created_at: row.order_created_at,
        // Payment-gated shipping info
        ship_to: row.ship_to_name ? {
          name: row.ship_to_name,
          address1: row.ship_to_address1,
          address2: row.ship_to_address2,
          city: row.ship_to_city,
          state: row.ship_to_state,
          zip: row.ship_to_zip,
          country: row.ship_to_country,
        } : null,
        dispute_status: row.dispute_status,
        dispute_reason: row.dispute_reason,
        dispute_opened_at: row.dispute_opened_at,
        dispute_resolved_at: row.dispute_resolved_at,
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
    onError: (error: any) => {
      const msg = error?.message || 'Unknown error';
      if (msg.includes('shipping label')) {
        toast.error('Cannot ship: generate a shipping label first.');
      } else if (msg.includes('tracking')) {
        toast.error('Cannot ship: no tracking number found.');
      } else {
        toast.error(`Failed to mark shipped: ${msg}`);
      }
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
