/**
 * Hook for fetching real entity counts from the database
 * Used for KPI tiles in the Global CRM Dashboard
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ExtendedEntityType } from '@/config/crmBlueprints';

// Maps entity types to their database tables and count logic
const ENTITY_COUNT_CONFIG: Record<ExtendedEntityType, {
  table: string;
  businessIdField?: string;
  additionalFilters?: Record<string, any>;
}> = {
  partner: { table: 'ambassadors', businessIdField: 'business_id' },
  influencer: { table: 'ambassadors', businessIdField: 'business_id', additionalFilters: { ambassador_type: 'influencer' } },
  customer: { table: 'crm_customers', businessIdField: 'business_id' },
  client: { table: 'crm_contacts', businessIdField: 'business_id', additionalFilters: { contact_type: 'client' } },
  model: { table: 'crm_contacts', businessIdField: 'business_id', additionalFilters: { contact_type: 'model' } },
  vendor: { table: 'crm_contacts', businessIdField: 'business_id', additionalFilters: { contact_type: 'vendor' } },
  event_hall: { table: 'crm_contacts', businessIdField: 'business_id', additionalFilters: { contact_type: 'event_hall' } },
  rental_company: { table: 'crm_contacts', businessIdField: 'business_id', additionalFilters: { contact_type: 'rental_company' } },
  supplier: { table: 'crm_contacts', businessIdField: 'business_id', additionalFilters: { contact_type: 'supplier' } },
  staff: { table: 'crm_contacts', businessIdField: 'business_id', additionalFilters: { contact_type: 'staff' } },
  booking: { table: 'crm_deals', businessIdField: 'business_id', additionalFilters: { deal_type: 'booking' } },
  event_booking: { table: 'crm_deals', businessIdField: 'business_id', additionalFilters: { deal_type: 'event_booking' } },
  funding_application: { table: 'crm_deals', businessIdField: 'business_id', additionalFilters: { deal_type: 'funding_application' } },
  collab: { table: 'crm_deals', businessIdField: 'business_id', additionalFilters: { deal_type: 'collab' } },
  promo_campaign: { table: 'ai_call_campaigns', businessIdField: 'business_id' },
  task: { table: 'crm_tasks', businessIdField: 'business_id' },
  note: { table: 'crm_notes', businessIdField: 'entity_id' }, // Notes are linked to entities
  interaction: { table: 'crm_interactions', businessIdField: 'business_id' },
  asset: { table: 'crm_assets', businessIdField: 'business_id' },
  media: { table: 'crm_assets', businessIdField: 'business_id', additionalFilters: { asset_type: 'media' } },
};

// Fallback tables that exist in most Supabase setups
const FALLBACK_COUNTS: Record<string, { table: string; businessIdField?: string }> = {
  partner: { table: 'ambassadors', businessIdField: 'business_id' },
  customer: { table: 'crm_customers', businessIdField: 'business_id' },
  influencer: { table: 'ambassadors', businessIdField: 'business_id' },
  booking: { table: 'crm_deals', businessIdField: 'business_id' },
};

interface EntityCounts {
  [key: string]: number;
}

/**
 * Fetches counts for multiple entity types in a single hook call
 */
export function useCRMEntityCounts(
  businessId: string | null,
  entityTypes: ExtendedEntityType[]
): {
  counts: EntityCounts;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['crm-entity-counts', businessId, entityTypes],
    queryFn: async () => {
      if (!businessId) return {};
      
      const counts: EntityCounts = {};
      
      // Fetch counts for each entity type in parallel
      await Promise.all(
        entityTypes.map(async (entityType) => {
          try {
            const config = ENTITY_COUNT_CONFIG[entityType];
            if (!config) {
              counts[entityType] = 0;
              return;
            }
            
            let query = supabase
              .from(config.table as any)
              .select('*', { count: 'exact', head: true });
            
            // Apply business filter if applicable
            if (config.businessIdField && businessId) {
              query = query.eq(config.businessIdField, businessId);
            }
            
            // Apply additional filters
            if (config.additionalFilters) {
              Object.entries(config.additionalFilters).forEach(([key, value]) => {
                query = query.eq(key, value);
              });
            }
            
            const { count, error } = await query;
            
            if (error) {
              console.warn(`Error fetching count for ${entityType}:`, error.message);
              counts[entityType] = 0;
            } else {
              counts[entityType] = count || 0;
            }
          } catch (err) {
            console.warn(`Failed to fetch count for ${entityType}:`, err);
            counts[entityType] = 0;
          }
        })
      );
      
      return counts;
    },
    enabled: !!businessId && entityTypes.length > 0,
    staleTime: 30000, // Cache for 30 seconds
    refetchOnWindowFocus: false,
  });

  return {
    counts: data || {},
    isLoading,
    error: error as Error | null,
    refetch,
  };
}

/**
 * Fetches count for a single entity type
 */
export function useSingleEntityCount(
  businessId: string | null,
  entityType: ExtendedEntityType
): {
  count: number;
  isLoading: boolean;
  error: Error | null;
} {
  const { counts, isLoading, error } = useCRMEntityCounts(
    businessId,
    entityType ? [entityType] : []
  );

  return {
    count: counts[entityType] || 0,
    isLoading,
    error,
  };
}

/**
 * Fetches all entity counts for a business (used in Data Management)
 */
export function useAllEntityCounts(businessId: string | null) {
  const allEntityTypes: ExtendedEntityType[] = [
    'partner', 'customer', 'influencer', 'client', 'model',
    'vendor', 'event_hall', 'rental_company', 'supplier', 'staff',
    'booking', 'event_booking', 'funding_application', 'collab',
    'promo_campaign', 'task', 'note', 'interaction', 'asset', 'media'
  ];

  return useCRMEntityCounts(businessId, allEntityTypes);
}

/**
 * Fetches total records across all entity types for a business
 */
export function useTotalRecordCount(businessId: string | null) {
  const { counts, isLoading, error } = useAllEntityCounts(businessId);
  
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  
  return { total, isLoading, error };
}
