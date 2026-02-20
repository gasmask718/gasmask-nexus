import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useMemo } from 'react';

export interface TubeSwitchRecord {
  id: string;
  store_id: string;
  old_tube_batch_id: string | null;
  old_tube_type: string | null;
  estimated_old_tube_quantity: number;
  switch_reason: string;
  switched_quantity: number;
  switched_by_user_id: string;
  notes: string | null;
  territory: string | null;
  verified: boolean;
  created_at: string;
}

export interface LogTubeSwitchInput {
  store_id: string;
  old_tube_type: string;
  estimated_old_tube_quantity: number;
  switched_quantity: number;
  switch_reason: string;
  notes?: string;
  verified?: boolean;
  old_tube_batch_id?: string;
  territory?: string;
}

export function useStoreTubeSwitches(storeId: string) {
  const query = useQuery({
    queryKey: ['store-tube-switches', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_tube_switches')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as TubeSwitchRecord[];
    },
    enabled: !!storeId,
  });

  const analytics = useMemo(() => {
    const records = query.data ?? [];
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const totalSwitches = records.length;
    const lastSwitchDate = records.length > 0 ? records[0].created_at : null;
    const last90Days = records.filter(r => new Date(r.created_at) >= ninetyDaysAgo).length;

    const outstanding = records.reduce((sum, r) => {
      const diff = r.estimated_old_tube_quantity - r.switched_quantity;
      return sum + (diff > 0 ? diff : 0);
    }, 0);

    const oldTubeEstimate = records.reduce((sum, r) => sum + r.estimated_old_tube_quantity, 0);

    let status: 'green' | 'yellow' | 'red' = 'green';
    if (outstanding > 0) {
      const totalEstimated = records.reduce((s, r) => s + r.estimated_old_tube_quantity, 0);
      const totalSwitched = records.reduce((s, r) => s + r.switched_quantity, 0);
      status = totalSwitched > 0 && totalSwitched < totalEstimated ? 'yellow' : 'red';
    }

    return {
      status,
      outstanding,
      oldTubeEstimate,
      totalSwitches,
      lastSwitchDate,
      last90Days,
    };
  }, [query.data]);

  return { ...query, analytics };
}

export function useLogTubeSwitch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: LogTubeSwitchInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.from('store_tube_switches').insert({
        ...input,
        switched_by_user_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['store-tube-switches', variables.store_id] });
      toast({ title: 'Tube switch logged', description: 'Record saved successfully.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error logging tube switch', description: error.message, variant: 'destructive' });
    },
  });
}
