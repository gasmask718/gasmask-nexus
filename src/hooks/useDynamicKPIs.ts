/**
 * Dynamic KPI System Hook
 * Fetches and calculates KPIs based on configuration stored in the database
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";

export interface KPICategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string;
  sort_order: number;
  is_system: boolean;
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
  business_id: string | null;
}

export interface CalculatedKPI extends KPIDefinition {
  value: number;
  isLoading: boolean;
}

// Fetch KPI categories
export function useKPICategories(businessId?: string) {
  return useQuery({
    queryKey: ["kpi_categories", businessId],
    queryFn: async () => {
      let query = supabase
        .from("kpi_categories")
        .select("*")
        .order("sort_order", { ascending: true });

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
export function useKPIDefinitions(categoryId?: string, businessId?: string) {
  return useQuery({
    queryKey: ["kpi_definitions", categoryId, businessId],
    queryFn: async () => {
      let query = supabase
        .from("kpi_definitions")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

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

// Calculate KPI value based on condition type
async function calculateKPIValue(kpi: KPIDefinition): Promise<number> {
  const { entity_type, condition_type, condition_config } = kpi;
  
  try {
    switch (condition_type) {
      case "count":
        // Simple count of all entities
        const { count: countResult } = await supabase
          .from(entity_type)
          .select("*", { count: "exact", head: true });
        return countResult || 0;

      case "missing_relationship": {
        // Count entities missing a relationship
        const { related_entity, relationship_field } = condition_config;
        
        // Get all entity IDs
        const { data: entities } = await supabase
          .from(entity_type)
          .select("id");
        
        if (!entities || entities.length === 0) return 0;
        
        // Get IDs that have the relationship
        const { data: relatedEntities } = await supabase
          .from(related_entity)
          .select(relationship_field)
          .not(relationship_field, "is", null);
        
        const relatedIds = new Set((relatedEntities || []).map(e => e[relationship_field]));
        const missingCount = entities.filter(e => !relatedIds.has(e.id)).length;
        
        return missingCount;
      }

      case "status_match": {
        // Count entities matching a specific status
        const { status_field, status_value } = condition_config;
        const { count: statusCount } = await supabase
          .from(entity_type)
          .select("*", { count: "exact", head: true })
          .eq(status_field, status_value);
        return statusCount || 0;
      }

      case "date_based": {
        // Count entities based on date conditions
        const { date_field, operator, days_offset } = condition_config;
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + (days_offset || 0));
        const dateStr = targetDate.toISOString();
        
        let query = supabase.from(entity_type).select("*", { count: "exact", head: true });
        
        switch (operator) {
          case "before":
            query = query.lt(date_field, dateStr);
            break;
          case "after":
            query = query.gt(date_field, dateStr);
            break;
          case "on":
            query = query.eq(date_field, dateStr.split("T")[0]);
            break;
        }
        
        const { count: dateCount } = await query;
        return dateCount || 0;
      }

      case "null_field": {
        // Count entities where a field is null
        const { field } = condition_config;
        const { count: nullCount } = await supabase
          .from(entity_type)
          .select("*", { count: "exact", head: true })
          .is(field, null);
        return nullCount || 0;
      }

      case "not_null_field": {
        // Count entities where a field is not null
        const { field } = condition_config;
        const { count: notNullCount } = await supabase
          .from(entity_type)
          .select("*", { count: "exact", head: true })
          .not(field, "is", null);
        return notNullCount || 0;
      }

      default:
        console.warn(`Unknown KPI condition type: ${condition_type}`);
        return 0;
    }
  } catch (error) {
    console.error(`Error calculating KPI ${kpi.name}:`, error);
    return 0;
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
          const value = await calculateKPIValue(kpi);
          return { ...kpi, value, isLoading: false } as CalculatedKPI;
        })
      );
      
      return results;
    },
    enabled: !!definitions && definitions.length > 0,
  });
}

// Hook to get all KPIs grouped by category
export function useAllDynamicKPIs(businessId?: string) {
  const { data: categories, isLoading: categoriesLoading } = useKPICategories(businessId);
  const { data: allDefinitions, isLoading: definitionsLoading } = useKPIDefinitions(undefined, businessId);

  const kpisQuery = useQuery({
    queryKey: ["all_calculated_kpis", businessId, allDefinitions?.map(d => d.id)],
    queryFn: async () => {
      if (!allDefinitions || allDefinitions.length === 0) return [];
      
      const results = await Promise.all(
        allDefinitions.map(async (kpi) => {
          const value = await calculateKPIValue(kpi);
          return { ...kpi, value, isLoading: false } as CalculatedKPI;
        })
      );
      
      return results;
    },
    enabled: !!allDefinitions && allDefinitions.length > 0,
  });

  // Group KPIs by category
  const groupedKPIs = useMemo(() => {
    if (!categories || !kpisQuery.data) return [];
    
    return categories.map(category => ({
      category,
      kpis: kpisQuery.data.filter(kpi => kpi.category_id === category.id),
    })).filter(group => group.kpis.length > 0);
  }, [categories, kpisQuery.data]);

  return {
    groupedKPIs,
    isLoading: categoriesLoading || definitionsLoading || kpisQuery.isLoading,
    categories,
    allKPIs: kpisQuery.data,
  };
}
