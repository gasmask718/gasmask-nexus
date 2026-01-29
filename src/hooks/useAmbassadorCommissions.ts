import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CommissionCategory = 'store' | 'wholesaler' | 'influencer' | 'ambassador';
export type CommissionStatus = 'pending' | 'approved' | 'paid';

export interface CommissionEvent {
  id: string;
  ambassador_id: string;
  category: CommissionCategory;
  source_entity_type: string;
  source_entity_id: string;
  source_entity_name: string | null;
  trigger_type: string;
  gross_amount: number;
  commission_rate: number;
  commission_amount: number;
  status: CommissionStatus;
  reference_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  approved_at: string | null;
  paid_at: string | null;
}

export interface CommissionSummary {
  category: CommissionCategory;
  lifetime: number;
  currentPeriod: number;
  pending: number;
  approved: number;
  paid: number;
  count: number;
}

interface UseAmbassadorCommissionsOptions {
  ambassadorId: string;
  category?: CommissionCategory;
  status?: CommissionStatus;
  dateFrom?: Date;
  dateTo?: Date;
}

export function useAmbassadorCommissions(options: UseAmbassadorCommissionsOptions) {
  const { ambassadorId, category, status, dateFrom, dateTo } = options;

  // Fetch commission events
  const eventsQuery = useQuery({
    queryKey: ['commission-events', ambassadorId, category, status, dateFrom, dateTo],
    queryFn: async () => {
      let query = supabase
        .from('commission_events')
        .select('*')
        .eq('ambassador_id', ambassadorId)
        .order('created_at', { ascending: false });

      if (category) {
        query = query.eq('category', category);
      }
      if (status) {
        query = query.eq('status', status);
      }
      if (dateFrom) {
        query = query.gte('created_at', dateFrom.toISOString());
      }
      if (dateTo) {
        query = query.lte('created_at', dateTo.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as CommissionEvent[];
    },
    enabled: !!ambassadorId,
  });

  // Fetch summary by category
  const summaryQuery = useQuery({
    queryKey: ['commission-summary', ambassadorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commission_events')
        .select('category, status, commission_amount, created_at')
        .eq('ambassador_id', ambassadorId);

      if (error) throw error;

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const categories: CommissionCategory[] = ['store', 'wholesaler', 'influencer', 'ambassador'];
      const summaries: CommissionSummary[] = categories.map(cat => {
        const catEvents = (data || []).filter(e => e.category === cat);
        
        return {
          category: cat,
          lifetime: catEvents.reduce((sum, e) => sum + Number(e.commission_amount), 0),
          currentPeriod: catEvents
            .filter(e => new Date(e.created_at) >= startOfMonth)
            .reduce((sum, e) => sum + Number(e.commission_amount), 0),
          pending: catEvents
            .filter(e => e.status === 'pending')
            .reduce((sum, e) => sum + Number(e.commission_amount), 0),
          approved: catEvents
            .filter(e => e.status === 'approved')
            .reduce((sum, e) => sum + Number(e.commission_amount), 0),
          paid: catEvents
            .filter(e => e.status === 'paid')
            .reduce((sum, e) => sum + Number(e.commission_amount), 0),
          count: catEvents.length,
        };
      });

      return summaries;
    },
    enabled: !!ambassadorId,
  });

  // Calculate totals
  const totals = {
    lifetime: summaryQuery.data?.reduce((sum, s) => sum + s.lifetime, 0) || 0,
    pending: summaryQuery.data?.reduce((sum, s) => sum + s.pending, 0) || 0,
    paid: summaryQuery.data?.reduce((sum, s) => sum + s.paid, 0) || 0,
  };

  return {
    events: eventsQuery.data || [],
    summaries: summaryQuery.data || [],
    totals,
    isLoading: eventsQuery.isLoading || summaryQuery.isLoading,
    error: eventsQuery.error || summaryQuery.error,
    refetch: () => {
      eventsQuery.refetch();
      summaryQuery.refetch();
    },
  };
}
