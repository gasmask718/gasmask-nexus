import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface FulfillmentResult {
  success: boolean;
  model: string;
  notifications: Array<{
    type: string;
    partner: string;
    success: boolean;
    error?: string;
  }>;
  warning?: string;
  error?: string;
}

/**
 * Triggers the fulfillment flow for a TopTier booking.
 * - request_confirm: notifies ONE partner via SMS + Email
 * - quote_broadcast: notifies MULTIPLE partners to collect quotes
 */
export function useBookingFulfillment() {
  return useMutation({
    mutationFn: async (bookingId: string): Promise<FulfillmentResult> => {
      const { data, error } = await supabase.functions.invoke('tt-booking-fulfillment', {
        body: { booking_id: bookingId },
      });
      if (error) throw new Error(error.message || 'Fulfillment trigger failed');
      if (!data?.success) throw new Error(data?.error || 'Unknown fulfillment error');
      return data as FulfillmentResult;
    },
    onSuccess: (data) => {
      const sent = data.notifications?.filter(n => n.success).length || 0;
      if (data.model === 'request_confirm') {
        toast.success(`Partner notified (${sent} notification${sent !== 1 ? 's' : ''} sent)`);
      } else {
        toast.success(`Quote request broadcast to partners (${sent} notification${sent !== 1 ? 's' : ''} sent)`);
      }
      if (data.warning) toast.warning(data.warning);
    },
    onError: (e: Error) => {
      toast.error('Fulfillment failed: ' + e.message);
    },
  });
}
