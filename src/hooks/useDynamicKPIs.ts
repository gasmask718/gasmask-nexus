/**
 * Dynamic KPI System Hook
 * Fetches and calculates KPIs based on configuration stored in the database
 * Supports: count, status_match, null_field, not_null_field, date_based conditions
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useCallback } from "react";

export interface KPICategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string;
  sort_order: number;
  is_system: boolean;
  is_archived: boolean;
  visible_roles: string[];
  business_id: string | null;
}

export interface KPIDefinition {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string | null;
  entity_type: string;
  condition_type: string;
  condition_config: Record<string, any>;
  icon: string;
  color: string;
  drilldown_path: string | null;
  drilldown_filters: Record<string, any> | null;
  sort_order: number;
  is_active: boolean;
  is_archived: boolean;
  visible_roles: string[];
  editable_roles: string[];
  business_id: string | null;
}

export interface CalculatedKPI extends KPIDefinition {
  value: number;
  isLoading: boolean;
  error?: string;
}

// Entity table mapping for type-safe queries
const ENTITY_TABLE_MAP: Record<string, string> = {
  drivers: 'drivers',
  vehicles: 'vehicles',
  crm_partners: 'crm_partners',
  crm_customers: 'crm_customers',
  crm_contacts: 'people',
  crm_deals: 'crm_deals',
  bookings: 'bookings',
  store_master: 'store_master',
};

// Fetch KPI categories
export function useKPICategories(businessId?: string, includeArchived = false) {
  return useQuery({
    queryKey: ["kpi_categories", businessId, includeArchived],
    queryFn: async () => {
      let query = supabase
        .from("kpi_categories")
        .select("*")
        .order("sort_order", { ascending: true });

      if (!includeArchived) {
        query = query.eq("is_archived", false);
      }

      if (businessId) {
        query = query.or(`business_id.eq.${businessId},business_id.is.null`);
      } else {
        query = query.is("business_id", null);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as KPICategory[];
    },
  });
}

// Fetch KPI definitions
export function useKPIDefinitions(categoryId?: string, businessId?: string, includeInactive = false, includeArchived = false) {
  return useQuery({
    queryKey: ["kpi_definitions", categoryId, businessId, includeInactive, includeArchived],
    queryFn: async () => {
      let query = supabase
        .from("kpi_definitions")
        .select("*")
        .order("sort_order", { ascending: true });

      if (!includeInactive) {
        query = query.eq("is_active", true);
      }

      if (!includeArchived) {
        query = query.eq("is_archived", false);
      }

      if (categoryId) {
        query = query.eq("category_id", categoryId);
      }

      if (businessId) {
        query = query.or(`business_id.eq.${businessId},business_id.is.null`);
      } else {
        query = query.is("business_id", null);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as KPIDefinition[];
    },
  });
}

// Type-safe query executor for each supported table
async function executeTableQuery(
  tableName: string, 
  conditionType: string, 
  config: Record<string, any>
): Promise<number> {
  try {
    switch (tableName) {
      case 'drivers': {
        let query = supabase.from('drivers').select('*', { count: 'exact', head: true });
        query = applyConditions(query, conditionType, config);
        const { count, error } = await query;
        if (error) throw error;
        return count || 0;
      }
      case 'crm_customers': {
        let query = supabase.from('crm_customers').select('*', { count: 'exact', head: true });
        query = applyConditions(query, conditionType, config);
        const { count, error } = await query;
        if (error) throw error;
        return count || 0;
      }
      case 'people': {
        let query = supabase.from('people').select('*', { count: 'exact', head: true });
        query = applyConditions(query, conditionType, config);
        const { count, error } = await query;
        if (error) throw error;
        return count || 0;
      }
      case 'crm_deals': {
        let query = supabase.from('crm_deals').select('*', { count: 'exact', head: true });
        query = applyConditions(query, conditionType, config);
        const { count, error } = await query;
        if (error) throw error;
        return count || 0;
      }
      case 'crm_partners': {
        let query = supabase.from('crm_partners').select('*', { count: 'exact', head: true });
        query = applyConditions(query, conditionType, config);
        const { count, error } = await query;
        if (error) throw error;
        return count || 0;
      }
      case 'store_master': {
        let query = supabase.from('store_master').select('*', { count: 'exact', head: true });
        query = applyConditions(query, conditionType, config);
        const { count, error } = await query;
        if (error) throw error;
        return count || 0;
      }
      default:
        console.warn(`Table ${tableName} not supported for KPI queries`);
        return 0;
    }
  } catch (error) {
    console.error(`Error querying ${tableName}:`, error);
    return 0;
  }
}

// Apply conditions to query based on condition type
function applyConditions(query: any, conditionType: string, config: Record<string, any>): any {
  switch (conditionType) {
    case 'status_match':
      if (config.status_field && config.status_value) {
        return query.eq(config.status_field, config.status_value);
      }
      break;
    case 'null_field':
      if (config.field) {
        return query.is(config.field, null);
      }
      break;
    case 'not_null_field':
      if (config.field) {
        return query.not(config.field, 'is', null);
      }
      break;
    case 'date_based':
      if (config.date_field && config.operator) {
        const daysOffset = config.days_offset || 0;
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + daysOffset);
        const dateStr = targetDate.toISOString();
        
        switch (config.operator) {
          case 'before':
            return query.lt(config.date_field, dateStr);
          case 'after':
            return query.gt(config.date_field, dateStr);
          case 'on':
            return query.eq(config.date_field, dateStr.split('T')[0]);
        }
      }
      break;
    case 'count':
    default:
      // No additional conditions for count
      break;
  }
  return query;
}

// Calculate KPI value based on condition type
async function calculateKPIValue(kpi: KPIDefinition): Promise<{ value: number; error?: string }> {
  const { entity_type, condition_type, condition_config } = kpi;
  
  try {
    const tableName = ENTITY_TABLE_MAP[entity_type];
    if (!tableName) {
      return { value: 0, error: `Unknown entity type: ${entity_type}` };
    }

    const value = await executeTableQuery(tableName, condition_type, condition_config || {});
    return { value };
  } catch (error) {
    console.error(`Error calculating KPI ${kpi.name}:`, error);
    return { value: 0, error: String(error) };
  }
}

// Hook to get calculated KPIs for a category
export function useCalculatedKPIs(categorySlug?: string, businessId?: string) {
  const { data: categories } = useKPICategories(businessId);
  const category = categories?.find(c => c.slug === categorySlug);
  
  const { data: definitions, isLoading: definitionsLoading } = useKPIDefinitions(
    category?.id, 
    businessId
  );

  return useQuery({
    queryKey: ["calculated_kpis", categorySlug, businessId, definitions?.map(d => d.id)],
    queryFn: async () => {
      if (!definitions || definitions.length === 0) return [];
      
      const results = await Promise.all(
        definitions.map(async (kpi) => {
          const { value, error } = await calculateKPIValue(kpi);
          return { ...kpi, value, isLoading: false, error } as CalculatedKPI;
        })
      );
      
      return results;
    },
    enabled: !!definitions && definitions.length > 0,
    staleTime: 30000, // Cache for 30 seconds
  });
}

// Hook to get all KPIs grouped by category
export function useAllDynamicKPIs(businessId?: string, userRole?: string) {
  const { data: categories, isLoading: categoriesLoading } = useKPICategories(businessId);
  const { data: allDefinitions, isLoading: definitionsLoading } = useKPIDefinitions(undefined, businessId);

  const kpisQuery = useQuery({
    queryKey: ["all_calculated_kpis", businessId, allDefinitions?.map(d => d.id)],
    queryFn: async () => {
      if (!allDefinitions || allDefinitions.length === 0) return [];
      
      const results = await Promise.all(
        allDefinitions.map(async (kpi) => {
          const { value, error } = await calculateKPIValue(kpi);
          return { ...kpi, value, isLoading: false, error } as CalculatedKPI;
        })
      );
      
      return results;
    },
    enabled: !!allDefinitions && allDefinitions.length > 0,
    staleTime: 30000,
  });

  // Group KPIs by category, filtered by role visibility
  const groupedKPIs = useMemo(() => {
    if (!categories || !kpisQuery.data) return [];
    
    return categories
      .filter(category => {
        // Check role visibility
        if (userRole && category.visible_roles && category.visible_roles.length > 0) {
          return category.visible_roles.includes(userRole);
        }
        return true;
      })
      .map(category => ({
        category,
        kpis: kpisQuery.data.filter(kpi => {
          if (kpi.category_id !== category.id) return false;
          // Check role visibility
          if (userRole && kpi.visible_roles && kpi.visible_roles.length > 0) {
            return kpi.visible_roles.includes(userRole);
          }
          return true;
        }),
      }))
      .filter(group => group.kpis.length > 0);
  }, [categories, kpisQuery.data, userRole]);

  return {
    groupedKPIs,
    isLoading: categoriesLoading || definitionsLoading || kpisQuery.isLoading,
    categories,
    allKPIs: kpisQuery.data,
    refetch: kpisQuery.refetch,
  };
}

// Hook for KPI preview (used in management UI)
export function useKPIPreview(kpi: Partial<KPIDefinition> | null) {
  return useQuery({
    queryKey: ["kpi_preview", kpi?.entity_type, kpi?.condition_type, JSON.stringify(kpi?.condition_config)],
    queryFn: async () => {
      if (!kpi?.entity_type || !kpi?.condition_type) {
        return { value: 0, error: "Missing entity type or condition type" };
      }
      
      const tableName = ENTITY_TABLE_MAP[kpi.entity_type];
      if (!tableName) {
        return { value: 0, error: `Unknown entity type: ${kpi.entity_type}` };
      }

      const value = await executeTableQuery(tableName, kpi.condition_type, kpi.condition_config || {});
      return { value, error: null };
    },
    enabled: !!kpi?.entity_type && !!kpi?.condition_type,
    staleTime: 5000,
  });
}

// Hook for managing KPI operations
export function useKPIManagement() {
  const queryClient = useQueryClient();

  const invalidateKPIs = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["kpi_categories"] });
    queryClient.invalidateQueries({ queryKey: ["kpi_definitions"] });
    queryClient.invalidateQueries({ queryKey: ["all_calculated_kpis"] });
    queryClient.invalidateQueries({ queryKey: ["calculated_kpis"] });
  }, [queryClient]);

  const reorderCategories = useCallback(async (orderedIds: string[]) => {
    const updates = orderedIds.map((id, index) => 
      supabase.from("kpi_categories").update({ sort_order: index }).eq("id", id)
    );
    await Promise.all(updates);
    invalidateKPIs();
  }, [invalidateKPIs]);

  const reorderKPIs = useCallback(async (categoryId: string, orderedIds: string[]) => {
    const updates = orderedIds.map((id, index) => 
      supabase.from("kpi_definitions").update({ sort_order: index }).eq("id", id)
    );
    await Promise.all(updates);
    invalidateKPIs();
  }, [invalidateKPIs]);

  const archiveCategory = useCallback(async (id: string) => {
    await supabase.from("kpi_categories").update({ is_archived: true }).eq("id", id);
    invalidateKPIs();
  }, [invalidateKPIs]);

  const unarchiveCategory = useCallback(async (id: string) => {
    await supabase.from("kpi_categories").update({ is_archived: false }).eq("id", id);
    invalidateKPIs();
  }, [invalidateKPIs]);

  const archiveKPI = useCallback(async (id: string) => {
    await supabase.from("kpi_definitions").update({ is_archived: true }).eq("id", id);
    invalidateKPIs();
  }, [invalidateKPIs]);

  const unarchiveKPI = useCallback(async (id: string) => {
    await supabase.from("kpi_definitions").update({ is_archived: false }).eq("id", id);
    invalidateKPIs();
  }, [invalidateKPIs]);

  const toggleKPIActive = useCallback(async (id: string, isActive: boolean) => {
    await supabase.from("kpi_definitions").update({ is_active: isActive }).eq("id", id);
    invalidateKPIs();
  }, [invalidateKPIs]);

  return {
    invalidateKPIs,
    reorderCategories,
    reorderKPIs,
    archiveCategory,
    unarchiveCategory,
    archiveKPI,
    unarchiveKPI,
    toggleKPIActive,
  };
}
