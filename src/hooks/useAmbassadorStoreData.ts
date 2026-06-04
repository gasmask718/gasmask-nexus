/**
 * Hook to fetch ambassador store data with clear separation between:
 * 1. Stores Sourced (attribution/credit) - immutable
 * 2. Stores Assigned (operational responsibility) - can change
 * 3. Pipeline stages (lead flow)
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface StoreData {
  id: string;
  store_name: string;
  city?: string;
  neighborhood?: string;
  status?: string;
  health_status?: string;
  sourced_at?: string;
  last_visit_at?: string;
  last_order_at?: string;
  created_at?: string;
}

interface SourcedStore {
  store: StoreData;
  sourcedAt: string;
  currentManager?: string;
  currentManagerId?: string;
  lifetimeRevenue: number;
  commissionEarned: number;
}

interface AssignedStore {
  store: StoreData;
  assignedAt: string;
  sourcedBy?: string;
  sourcedById?: string;
  lastVisit?: string;
  lastOrder?: string;
  healthStatus: 'healthy' | 'at_risk' | 'dormant';
}

interface PipelineStage {
  stage: string;
  label: string;
  count: number;
  stores: StoreData[];
}

const PIPELINE_STAGES = [
  { stage: 'lead', label: 'Lead' },
  { stage: 'contacted', label: 'Contacted' },
  { stage: 'interested', label: 'Interested' },
  { stage: 'onboarded', label: 'Onboarded' },
  { stage: 'active', label: 'Active' },
  { stage: 'dormant', label: 'Dormant' },
  { stage: 'lost', label: 'Lost' },
];

export function useAmbassadorStoreData(ambassadorId: string | undefined) {
  // Fetch stores sourced by this ambassador (attribution credit)
  const { data: sourcedStoresData = [], isLoading: isLoadingSourced } = useQuery({
    queryKey: ['ambassador-sourced-stores', ambassadorId],
    queryFn: async () => {
      if (!ambassadorId) return [];

      // Get stores where this ambassador is the source
      const { data: stores, error } = await supabase
        .from('store_master')
        .select(`
          id,
          store_name,
          city,
          address,
          sourced_by_ambassador_id,
          assigned_ambassador_id,
          sourced_at,
          health_status,
          last_visit_at,
          last_order_at,
          created_at
        `)
        .is('deleted_at', null)
        .eq('sourced_by_ambassador_id', ambassadorId);

      if (error) {
        console.error('Error fetching sourced stores:', error);
        return [];
      }

      return (stores || []) as any[];
    },
    enabled: !!ambassadorId,
  });

  // Fetch stores assigned to this ambassador (operational responsibility)
  // Uses BOTH direct store_master.assigned_ambassador_id AND ambassador_assignments table
  const { data: assignedStoresData = [], isLoading: isLoadingAssigned } = useQuery({
    queryKey: ['ambassador-assigned-stores', ambassadorId],
    queryFn: async () => {
      if (!ambassadorId) return [];

      const storeMap = new Map<string, any>();

      // 1. Primary: ambassador_assignments table (legacy/primary source)
      const { data: assignments, error: assignError } = await supabase
        .from('ambassador_assignments')
        .select(`
          id,
          store_id,
          created_at,
          assignment_role,
          commission_rate
        `)
        .eq('ambassador_id', ambassadorId)
        .eq('active', true);

      if (assignError) {
        console.error('Error fetching assignments:', assignError);
      }

      // Fetch store details for assignments
      const assignmentStoreIds = (assignments || [])
        .map((a: any) => a.store_id)
        .filter(Boolean);

      if (assignmentStoreIds.length > 0) {
        const { data: assignedStoreDetails } = await supabase
          .from('store_master')
          .select(`
            id,
            store_name,
            city,
            address,
            sourced_by_ambassador_id,
            health_status,
            last_visit_at,
            last_order_at,
            created_at
          `)
          .in('id', assignmentStoreIds);

        // Build map from store details
        const storeDetailsMap = new Map<string, any>();
        (assignedStoreDetails || []).forEach((s: any) => {
          storeDetailsMap.set(s.id, s);
        });

        // Merge assignments with store details
        (assignments || []).forEach((a: any) => {
          const storeDetails = storeDetailsMap.get(a.store_id);
          if (storeDetails && !storeMap.has(storeDetails.id)) {
            storeMap.set(storeDetails.id, {
              store: storeDetails,
              assignedAt: a.created_at,
              fromAssignment: true,
              role: a.assignment_role,
              commissionRate: a.commission_rate,
            });
          }
        });
      }

      // 2. Secondary: direct assignment on store_master (new column)
      const { data: directAssigned, error: directError } = await supabase
        .from('store_master')
        .select(`
          id,
          store_name,
          city,
          address,
          sourced_by_ambassador_id,
          assigned_ambassador_id,
          health_status,
          last_visit_at,
          last_order_at,
          created_at
        `)
        .eq('assigned_ambassador_id', ambassadorId);

      if (directError) {
        console.error('Error fetching direct assigned stores:', directError);
      }

      // Add direct assignments (these take precedence if not already in map)
      (directAssigned || []).forEach((store: any) => {
        if (!storeMap.has(store.id)) {
          storeMap.set(store.id, {
            store,
            assignedAt: store.created_at,
            fromAssignment: false,
          });
        }
      });

      return Array.from(storeMap.values());
    },
    enabled: !!ambassadorId,
  });

  // Fetch ambassador names for display
  const { data: ambassadorMap = {} } = useQuery({
    queryKey: ['ambassador-names-map', ambassadorId],
    queryFn: async () => {
      // Collect all ambassador IDs we need to look up
      const ids = new Set<string>();
      
      sourcedStoresData.forEach((s: any) => {
        if (s.assigned_ambassador_id) ids.add(s.assigned_ambassador_id);
      });
      
      assignedStoresData.forEach((a: any) => {
        if (a.store?.sourced_by_ambassador_id) ids.add(a.store.sourced_by_ambassador_id);
      });

      if (ids.size === 0) return {};

      const { data: ambassadors } = await supabase
        .from('ambassadors')
        .select('id, name')
        .in('id', Array.from(ids));

      const map: Record<string, string> = {};
      (ambassadors || []).forEach(a => {
        map[a.id] = a.name || 'Unknown';
      });
      return map;
    },
    enabled: !!ambassadorId && (sourcedStoresData.length > 0 || assignedStoresData.length > 0),
  });

  // Fetch commission data for sourced stores from canonical ledger
  // ledger.source_id = store id when source_channel = 'store_order'
  const { data: commissionData = [] } = useQuery({
    queryKey: ['ambassador-store-commissions', ambassadorId],
    queryFn: async () => {
      if (!ambassadorId) return [];

      const { data, error } = await supabase
        .from('commission_ledger')
        .select('source_id, source_channel, gross_amount, commission_amount')
        .eq('ambassador_id', ambassadorId)
        .eq('source_channel', 'store_order')
        .neq('status', 'reversed');

      if (error) {
        console.error('Error fetching commissions:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!ambassadorId,
  });

  // Fetch pipeline data (leads sourced by this ambassador)
  // Note: sales_prospects uses assigned_to for ambassador tracking and pipeline_stage for stage
  const { data: pipelineData = [], isLoading: isLoadingPipeline } = useQuery({
    queryKey: ['ambassador-pipeline', ambassadorId],
    queryFn: async () => {
      if (!ambassadorId) return [];

      // First get the user_id for this ambassador
      const { data: ambData } = await supabase
        .from('ambassadors')
        .select('user_id')
        .eq('id', ambassadorId)
        .single();

      if (!ambData?.user_id) return [];

      // Get leads where this ambassador is assigned
      const { data: leads, error } = await supabase
        .from('sales_prospects')
        .select('id, store_name, city, pipeline_stage, created_at')
        .eq('lead_type', 'store')
        .eq('assigned_to', ambData.user_id)
        .eq('archived', false);

      if (error) {
        console.error('Error fetching pipeline:', error);
        return [];
      }
      return (leads || []) as any[];
    },
    enabled: !!ambassadorId,
  });

  // Transform data into final format

  // 1. Sourced Stores
  const sourcedStores: SourcedStore[] = sourcedStoresData.map((store: any) => {
    // Calculate revenue and commission for this store
    // ledger.source_id = store id for store_order rows
    const storeCommissions = commissionData.filter((c: any) => c.source_id === store.id);
    const lifetimeRevenue = storeCommissions.reduce((sum, c: any) => sum + Number(c.gross_amount || 0), 0);
    const commissionEarned = storeCommissions.reduce((sum, c: any) => sum + Number(c.commission_amount || 0), 0);

    return {
      store: {
        id: store.id,
        store_name: store.store_name,
        city: store.city,
        neighborhood: store.address, // Use address as neighborhood fallback
        health_status: store.health_status,
        status: store.health_status || 'active',
      },
      sourcedAt: store.sourced_at || store.created_at,
      currentManager: store.assigned_ambassador_id ? ambassadorMap[store.assigned_ambassador_id] : undefined,
      currentManagerId: store.assigned_ambassador_id,
      lifetimeRevenue,
      commissionEarned,
    };
  });

  // 2. Assigned Stores
  const assignedStores: AssignedStore[] = assignedStoresData.map((item: any) => {
    const store = item.store;
    if (!store) return null; // Skip if no store data

    const sourcedById = store.sourced_by_ambassador_id;

    // Determine health status
    let healthStatus: 'healthy' | 'at_risk' | 'dormant' = 'healthy';
    if (store.health_status === 'dormant' || store.health_status === 'lost') {
      healthStatus = 'dormant';
    } else if (store.health_status === 'at_risk') {
      healthStatus = 'at_risk';
    } else if (store.last_order_at) {
      const daysSinceOrder = (Date.now() - new Date(store.last_order_at).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceOrder > 30) healthStatus = 'at_risk';
      if (daysSinceOrder > 60) healthStatus = 'dormant';
    }

    return {
      store: {
        id: store.id,
        store_name: store.store_name,
        city: store.city,
        neighborhood: store.neighborhood || store.address, // Prefer neighborhood, fallback to address
        health_status: store.health_status,
      },
      assignedAt: item.assignedAt,
      sourcedBy: sourcedById ? ambassadorMap[sourcedById] : undefined,
      sourcedById,
      lastVisit: store.last_visit_at,
      lastOrder: store.last_order_at,
      healthStatus,
      commissionRate: item.commissionRate,
    };
  }).filter(Boolean) as AssignedStore[];

  // 3. Pipeline Stages
  const pipeline: PipelineStage[] = PIPELINE_STAGES.map(({ stage, label }) => {
    const storesInStage = pipelineData.filter((lead: any) => {
      const leadStage = (lead.pipeline_stage || 'lead').toLowerCase();
      return leadStage === stage;
    });

    return {
      stage,
      label,
      count: storesInStage.length,
      stores: storesInStage.map((lead: any) => ({
        id: lead.id,
        store_name: lead.store_name || 'Unnamed Lead',
        city: lead.city,
        created_at: lead.created_at,
      })),
    };
  });

  return {
    sourcedStores,
    assignedStores,
    pipeline,
    isLoading: isLoadingSourced || isLoadingAssigned || isLoadingPipeline,
  };
}
