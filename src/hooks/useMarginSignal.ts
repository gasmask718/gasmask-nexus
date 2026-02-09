/**
 * Margin Deviation Signal Hook — Triggers Floor 5 → Mission Control strategic signal
 * Phase 2.4: Margin below industry expectation → governed mission emission
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface MarginSignalResult {
  signal_type: string;
  business_id: string;
  business_name: string;
  action: 'mission_created' | 'duplicate_detected' | 'context_appended';
  mission_id?: string;
  details: string;
}

export interface MarginSignalScanResponse {
  success: boolean;
  signals_detected: number;
  missions_created: number;
  duplicates_found: number;
  results: MarginSignalResult[];
}

export function useMarginSignal() {
  const queryClient = useQueryClient();
  const [lastScanResult, setLastScanResult] = useState<MarginSignalScanResponse | null>(null);

  const scanMutation = useMutation({
    mutationFn: async (): Promise<MarginSignalScanResponse> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('margin-deviation-scanner', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      return data as MarginSignalScanResponse;
    },
    onSuccess: (data) => {
      setLastScanResult(data);
      queryClient.invalidateQueries({ queryKey: ['owner-missions'] });

      if (data.missions_created > 0) {
        toast.success(
          `Floor 5 Strategy Signal: ${data.missions_created} margin deviation${data.missions_created > 1 ? 's' : ''} detected`,
        );
      } else if (data.signals_detected > 0) {
        toast.info(
          `Floor 5 Strategy Signal: ${data.signals_detected} deviation${data.signals_detected > 1 ? 's' : ''} found, all already tracked`,
        );
      } else {
        toast.success('Floor 5 Strategy Signal: All margins within industry expectations');
      }
    },
    onError: (err) => {
      toast.error(`Margin signal scan failed: ${err.message}`);
    },
  });

  return {
    runScan: scanMutation.mutate,
    isScanning: scanMutation.isPending,
    lastScanResult,
    scanError: scanMutation.error,
  };
}
