/**
 * Finance Signal Hook — Triggers Floor 5 → Mission Control signal scan
 * Phase 2.1: Unpaid invoices >30 days → governed mission emission
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SignalResult {
  signal_type: string;
  invoice_id: string;
  invoice_number: string;
  action: 'mission_created' | 'duplicate_detected' | 'context_appended';
  mission_id?: string;
  details: string;
}

export interface SignalScanResponse {
  success: boolean;
  signals_detected: number;
  missions_created: number;
  duplicates_found: number;
  results: SignalResult[];
}

export function useFinanceSignal() {
  const queryClient = useQueryClient();
  const [lastScanResult, setLastScanResult] = useState<SignalScanResponse | null>(null);

  const scanMutation = useMutation({
    mutationFn: async (): Promise<SignalScanResponse> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('finance-signal-scanner', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      return data as SignalScanResponse;
    },
    onSuccess: (data) => {
      setLastScanResult(data);
      // Refresh mission list
      queryClient.invalidateQueries({ queryKey: ['owner-missions'] });

      if (data.missions_created > 0) {
        toast.success(
          `Floor 5 Signal: ${data.missions_created} new mission${data.missions_created > 1 ? 's' : ''} created from overdue invoices`,
        );
      } else if (data.signals_detected > 0) {
        toast.info(
          `Floor 5 Signal: ${data.signals_detected} overdue invoice${data.signals_detected > 1 ? 's' : ''} detected, all already tracked`,
        );
      } else {
        toast.success('Floor 5 Signal: No overdue invoices detected');
      }
    },
    onError: (err) => {
      toast.error(`Signal scan failed: ${err.message}`);
    },
  });

  return {
    runScan: scanMutation.mutate,
    isScanning: scanMutation.isPending,
    lastScanResult,
    scanError: scanMutation.error,
  };
}
