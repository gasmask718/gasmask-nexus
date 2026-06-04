import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CommissionCategory = 'store' | 'wholesaler' | 'influencer' | 'ambassador';
export type CommissionStatus = 'pending' | 'approved' | 'paid';

// Map ledger source_channel → category (former compat layer)
function channelToCategory(channel: string | null | undefined): CommissionCategory {
  switch (channel) {
    case 'store_order': return 'store';
    case 'wholesale_order': return 'wholesaler';
    case 'affiliate': return 'influencer';
    default: return 'ambassador';
  }
}

const CATEGORY_TO_CHANNEL: Record<CommissionCategory, string> = {
  store: 'store_order',
  wholesaler: 'wholesale_order',
  influencer: 'affiliate',
  ambassador: 'ambassador',
};

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

function toEvent(row: any): CommissionEvent {
  return {
    id: row.id,
    ambassador_id: row.ambassador_id,
    category: channelToCategory(row.source_channel),
    source_entity_type: row.source_channel,
    source_entity_id: row.source_id,
    source_entity_name: row.source_name,
    trigger_type: row.source_channel,
    gross_amount: Number(row.gross_amount || 0),
    commission_rate: Number(row.commission_rate || 0),
    commission_amount: Number(row.commission_amount || 0),
    status: row.status as CommissionStatus,
    reference_id: null,
    metadata: {},
    created_at: row.created_at ?? row.earned_at,
    approved_at: row.approved_at,
    paid_at: row.paid_at,
  };
}

export function useAmbassadorCommissions(options: UseAmbassadorCommissionsOptions) {
  const { ambassadorId, category, status, dateFrom, dateTo } = options;

  const eventsQuery = useQuery({
    queryKey: ['commission-events', ambassadorId, category, status, dateFrom, dateTo],
    queryFn: async () => {
      let query = supabase
        .from('commission_ledger')
        .select('*')
        .eq('ambassador_id', ambassadorId)
        .neq('status', 'reversed')
        .order('created_at', { ascending: false });

      if (category) query = query.eq('source_channel', CATEGORY_TO_CHANNEL[category]);
      if (status) query = query.eq('status', status);
      if (dateFrom) query = query.gte('created_at', dateFrom.toISOString());
      if (dateTo) query = query.lte('created_at', dateTo.toISOString());

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(toEvent);
    },
    enabled: !!ambassadorId,
  });

  const summaryQuery = useQuery({
    queryKey: ['commission-summary', ambassadorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commission_ledger')
        .select('source_channel, status, commission_amount, created_at')
        .eq('ambassador_id', ambassadorId)
        .neq('status', 'reversed');

      if (error) throw error;

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const categories: CommissionCategory[] = ['store', 'wholesaler', 'influencer', 'ambassador'];
      const summaries: CommissionSummary[] = categories.map(cat => {
        const catEvents = (data || []).filter(e => channelToCategory(e.source_channel) === cat);
        return {
          category: cat,
          lifetime: catEvents.reduce((sum, e) => sum + Number(e.commission_amount), 0),
          currentPeriod: catEvents
            .filter(e => new Date(e.created_at) >= startOfMonth)
            .reduce((sum, e) => sum + Number(e.commission_amount), 0),
          pending: catEvents.filter(e => e.status === 'pending').reduce((sum, e) => sum + Number(e.commission_amount), 0),
          approved: catEvents.filter(e => e.status === 'approved').reduce((sum, e) => sum + Number(e.commission_amount), 0),
          paid: catEvents.filter(e => e.status === 'paid').reduce((sum, e) => sum + Number(e.commission_amount), 0),
          count: catEvents.length,
        };
      });

      return summaries;
    },
    enabled: !!ambassadorId,
  });

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
    refetch: () => { eventsQuery.refetch(); summaryQuery.refetch(); },
  };
}
