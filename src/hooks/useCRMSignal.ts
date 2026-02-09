/**
 * CRM Inactivity Signal Hook — Triggers Floor 1 → Mission Control signal scan
 * Phase 2.3: Inactive high-value clients >30 days → governed mission emission
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CRMSignalResult {
  signal_type: string;
  store_id: string;
  store_name: string;
  action: 'mission_created' | 'duplicate_detected' | 'context_appended';
  mission_id?: string;
  details: string;
}

export interface CRMSignalScanResponse {
  success: boolean;
  signals_detected: number;
  missions_created: number;
  duplicates_found: number;
  results: CRMSignalResult[];
}

export function useCRMSignal() {
  const queryClient = useQueryClient();
  const [lastScanResult, setLastScanResult] = useState<CRMSignalScanResponse | null>(null);

  const scanMutation = useMutation({
    mutationFn: async (): Promise<CRMSignalScanResponse> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('crm-inactivity-scanner', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      return data as CRMSignalScanResponse;
    },
    onSuccess: (data) => {
      setLastScanResult(data);
      queryClient.invalidateQueries({ queryKey: ['owner-missions'] });

      if (data.missions_created > 0) {
        toast.success(
          `Floor 1 Signal: ${data.missions_created} new mission${data.missions_created > 1 ? 's' : ''} created from inactive clients`,
        );
      } else if (data.signals_detected > 0) {
        toast.info(
          `Floor 1 Signal: ${data.signals_detected} inactive client${data.signals_detected > 1 ? 's' : ''} detected, all already tracked`,
        );
      } else {
        toast.success('Floor 1 Signal: No inactive high-value clients detected');
      }
    },
    onError: (err) => {
      toast.error(`CRM signal scan failed: ${err.message}`);
    },
  });

  return {
    runScan: scanMutation.mutate,
    isScanning: scanMutation.isPending,
    lastScanResult,
    scanError: scanMutation.error,
  };
}
