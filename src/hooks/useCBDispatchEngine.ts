import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DispatchResult {
  success: boolean;
  dispatched?: number;
  notifications?: Array<{ type: string; partner: string; success: boolean; error?: string }>;
  warning?: string;
  error?: string;
  elapsed_ms?: number;
}

interface QuoteSubmission {
  request_id: string;
  partner_id: string;
  quoted_price: number;
  vehicle_type?: string;
  capacity?: number;
  amenities?: string[];
  availability_status?: 'quoted' | 'unavailable' | 'alternate_offer' | 'declined';
  alternate_offer_notes?: string;
  quote_notes?: string;
  deposit_required?: number;
  response_method?: string;
}

interface QuoteSelection {
  request_id: string;
  quote_id: string;
  reason?: string;
  selected_by?: string;
  backup_quote_ids?: string[];
}

interface CustomerOffer {
  request_id: string;
  channels?: ('sms' | 'email')[];
}

/** Dispatch a coach bus request to matching partners */
export function useCBDispatch() {
  return useMutation({
    mutationFn: async (requestId: string): Promise<DispatchResult> => {
      const { data, error } = await supabase.functions.invoke('cb-dispatch-engine', {
        body: { action: 'dispatch', request_id: requestId },
      });
      if (error) throw new Error(error.message || 'Dispatch failed');
      if (!data?.success) throw new Error(data?.error || 'Unknown dispatch error');
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Dispatched to ${data.dispatched} partners`);
      if (data.warning) toast.warning(data.warning);
    },
    onError: (e: Error) => toast.error('Dispatch failed: ' + e.message),
  });
}

/** Submit a quote (partner action) */
export function useCBSubmitQuote() {
  return useMutation({
    mutationFn: async (submission: QuoteSubmission) => {
      const { data, error } = await supabase.functions.invoke('cb-dispatch-engine', {
        body: { action: 'submit_quote', ...submission },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Quote submission failed');
      return data;
    },
    onSuccess: () => toast.success('Quote submitted successfully'),
    onError: (e: Error) => toast.error('Quote submission failed: ' + e.message),
  });
}

/** Select a winning quote (admin action) */
export function useCBSelectQuote() {
  return useMutation({
    mutationFn: async (selection: QuoteSelection) => {
      const { data, error } = await supabase.functions.invoke('cb-dispatch-engine', {
        body: { action: 'select_quote', ...selection },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Selection failed');
      return data;
    },
    onSuccess: (data) => toast.success(`Quote selected – customer price: $${data.customer_price}`),
    onError: (e: Error) => toast.error('Selection failed: ' + e.message),
  });
}

/** Send final offer to customer */
export function useCBSendCustomerOffer() {
  return useMutation({
    mutationFn: async (offer: CustomerOffer) => {
      const { data, error } = await supabase.functions.invoke('cb-dispatch-engine', {
        body: { action: 'send_customer_offer', ...offer },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Offer send failed');
      return data;
    },
    onSuccess: () => toast.success('Customer offer sent!'),
    onError: (e: Error) => toast.error('Failed to send offer: ' + e.message),
  });
}

/** Fetch KPIs */
export function useCBKpis() {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('cb-dispatch-engine', {
        body: { action: 'kpis' },
      });
      if (error) throw new Error(error.message);
      return data?.kpis;
    },
  });
}

/** Get quote recommendations for a request */
export function useCBRecommendations() {
  return useMutation({
    mutationFn: async (requestId: string) => {
      const { data, error } = await supabase.functions.invoke('cb-dispatch-engine', {
        body: { action: 'recommend', request_id: requestId },
      });
      if (error) throw new Error(error.message);
      return data?.recommendations;
    },
  });
}
