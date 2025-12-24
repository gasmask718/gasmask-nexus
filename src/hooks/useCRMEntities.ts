import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CRMCategorySlug, EntityType } from '@/config/crmCategories';
import { toast } from 'sonner';

// Entity to table mapping - maps CRM entity types to database tables
const ENTITY_TABLE_MAP: Record<EntityType, string> = {
  partner: 'ambassadors',
  influencer: 'ambassador_profiles', 
  customer: 'crm_contacts',
  vehicle: 'vehicles',
  property: 'properties',
  asset: 'assets',
  booking: 'bookings',
  service: 'services',
  affiliate_link: 'affiliate_clicks',
  store: 'store_master',
  contact: 'crm_contacts',
  deal: 'acquisitions_pipeline',
  lead: 'leads_raw',
};

// Column mappings for display - entity type to columns to fetch
const ENTITY_COLUMNS: Record<EntityType, string> = {
  partner: 'id, user_id, tracking_code, total_earnings, tier, is_active, created_at',
  influencer: 'id, user_id, instagram_handle, tiktok_handle, country, status, commission_rate, referral_code, created_at',
  customer: 'id, name, phone, email, type, relationship_status, organization, business_id, created_at, updated_at',
  vehicle: 'id, name, make, model, year, color, plate, status, daily_rate, created_at',
  property: 'id, name, address, city, state, bedrooms, bathrooms, price, status, created_at',
  asset: 'id, name, type, value, status, created_at',
  booking: 'id, customer_name, service_type, booking_date, status, total_amount, created_at',
  service: 'id, name, description, price, category, status, created_at',
  affiliate_link: 'id, ambassador_id, landing_page, converted, created_at',
  store: 'id, name, address, city, state, phone, store_type, status, created_at',
  contact: 'id, name, phone, email, type, relationship_status, organization, business_id, created_at, updated_at',
  deal: 'id, status, offer_amount, expected_assignment_fee, closing_date, buyer_name, created_at',
  lead: 'id, full_name, phone, email, source, status, priority, created_at',
};

// Name field mapping for different entity types
const NAME_FIELD_MAP: Record<EntityType, string> = {
  partner: 'tracking_code',
  influencer: 'instagram_handle',
  customer: 'name',
  vehicle: 'name',
  property: 'name',
  asset: 'name',
  booking: 'customer_name',
  service: 'name',
  affiliate_link: 'landing_page',
  store: 'name',
  contact: 'name',
  deal: 'buyer_name',
  lead: 'full_name',
};

// Status field mapping
const STATUS_FIELD_MAP: Record<EntityType, string> = {
  partner: 'is_active',
  influencer: 'status',
  customer: 'relationship_status',
  vehicle: 'status',
  property: 'status',
  asset: 'status',
  booking: 'status',
  service: 'status',
  affiliate_link: 'converted',
  store: 'status',
  contact: 'relationship_status',
  deal: 'status',
  lead: 'status',
};

interface UseCRMEntitiesOptions {
  categorySlug: CRMCategorySlug;
  entityType: EntityType;
  businessId?: string | null;
  searchTerm?: string;
  limit?: number;
}

export function useCRMEntities({
  categorySlug,
  entityType,
  businessId,
  searchTerm = '',
  limit = 100,
}: UseCRMEntitiesOptions) {
  const tableName = ENTITY_TABLE_MAP[entityType];
  const columns = ENTITY_COLUMNS[entityType];
  const nameField = NAME_FIELD_MAP[entityType];
  
  return useQuery({
    queryKey: ['crm-entities', categorySlug, entityType, businessId, searchTerm],
    queryFn: async () => {
      if (!tableName) {
        console.warn(`No table mapping for entity type: ${entityType}`);
        return [];
      }

      try {
        let query = supabase
          .from(tableName as any)
          .select(columns)
          .order('created_at', { ascending: false })
          .limit(limit);

        // Apply business filter if available and table has business_id
        if (businessId && ['crm_contacts', 'bookings', 'services'].includes(tableName)) {
          query = query.eq('business_id', businessId);
        }

        // Apply soft delete filter if table supports it
        if (['crm_contacts', 'ambassadors', 'ambassador_profiles'].includes(tableName)) {
          query = query.is('deleted_at', null);
        }

        // Apply active filter for partners/ambassadors
        if (tableName === 'ambassadors') {
          query = query.eq('is_active', true);
        }

        // Apply search if provided
        if (searchTerm && nameField) {
          query = query.ilike(nameField, `%${searchTerm}%`);
        }

        const { data, error } = await query;
        
        if (error) {
          console.error(`Error fetching ${entityType}:`, error);
          throw error;
        }

        // Normalize data to common format
        return (data || []).map((item: any) => ({
          id: item.id,
          name: item[nameField] || item.name || item.tracking_code || 'Unnamed',
          status: item[STATUS_FIELD_MAP[entityType]] || 'unknown',
          rawData: item,
        }));
      } catch (error) {
        console.error(`Failed to fetch ${entityType} from ${tableName}:`, error);
        return [];
      }
    },
    enabled: !!tableName,
  });
}

// Hook for creating new entities
export function useCreateCRMEntity(categorySlug: CRMCategorySlug, entityType: EntityType) {
  const queryClient = useQueryClient();
  const tableName = ENTITY_TABLE_MAP[entityType];

  return useMutation({
    mutationFn: async (data: Record<string, any>) => {
      if (!tableName) {
        throw new Error(`No table mapping for entity type: ${entityType}`);
      }

      const { data: result, error } = await supabase
        .from(tableName as any)
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-entities', categorySlug, entityType] });
      toast.success(`${entityType} created successfully`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to create ${entityType}: ${error.message}`);
    },
  });
}

// Hook for updating entities
export function useUpdateCRMEntity(categorySlug: CRMCategorySlug, entityType: EntityType) {
  const queryClient = useQueryClient();
  const tableName = ENTITY_TABLE_MAP[entityType];

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, any> }) => {
      if (!tableName) {
        throw new Error(`No table mapping for entity type: ${entityType}`);
      }

      const { data: result, error } = await supabase
        .from(tableName as any)
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-entities', categorySlug, entityType] });
      toast.success(`${entityType} updated successfully`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to update ${entityType}: ${error.message}`);
    },
  });
}

// Hook for deleting entities (soft delete where supported)
export function useDeleteCRMEntity(categorySlug: CRMCategorySlug, entityType: EntityType) {
  const queryClient = useQueryClient();
  const tableName = ENTITY_TABLE_MAP[entityType];

  return useMutation({
    mutationFn: async (id: string) => {
      if (!tableName) {
        throw new Error(`No table mapping for entity type: ${entityType}`);
      }

      // Use soft delete for supported tables
      if (['crm_contacts', 'ambassadors', 'ambassador_profiles'].includes(tableName)) {
        const { error } = await supabase
          .from(tableName as any)
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from(tableName as any)
          .delete()
          .eq('id', id);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-entities', categorySlug, entityType] });
      toast.success(`${entityType} deleted successfully`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete ${entityType}: ${error.message}`);
    },
  });
}

// Hook to get entity counts for dashboard
export function useCRMEntityCounts(categorySlug: CRMCategorySlug, entityTypes: EntityType[], businessId?: string | null) {
  return useQuery({
    queryKey: ['crm-entity-counts', categorySlug, entityTypes, businessId],
    queryFn: async () => {
      const counts: Record<EntityType, number> = {} as Record<EntityType, number>;
      
      await Promise.all(
        entityTypes.map(async (entityType) => {
          const tableName = ENTITY_TABLE_MAP[entityType];
          if (!tableName) {
            counts[entityType] = 0;
            return;
          }

          try {
            let query = supabase
              .from(tableName as any)
              .select('id', { count: 'exact', head: true });

            // Apply filters
            if (businessId && ['crm_contacts', 'bookings', 'services'].includes(tableName)) {
              query = query.eq('business_id', businessId);
            }

            if (['crm_contacts', 'ambassadors', 'ambassador_profiles'].includes(tableName)) {
              query = query.is('deleted_at', null);
            }

            if (tableName === 'ambassadors') {
              query = query.eq('is_active', true);
            }

            const { count, error } = await query;
            counts[entityType] = error ? 0 : (count || 0);
          } catch (error) {
            counts[entityType] = 0;
          }
        })
      );

      return counts;
    },
  });
}
