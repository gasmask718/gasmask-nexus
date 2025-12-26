/**
 * Hook for accessing CRM Blueprint configuration
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';
import { 
  getCRMBlueprint, 
  getDefaultBlueprint, 
  CRMBlueprint,
  ExtendedEntityType,
  EntitySchema,
  PipelineStage,
} from '@/config/crmBlueprints';

interface UseCRMBlueprintResult {
  blueprint: CRMBlueprint;
  isLoading: boolean;
  error: Error | null;
  businessId: string | null;
  businessSlug: string | null;
  businessName: string | null;
  getEntitySchema: (entityType: ExtendedEntityType) => EntitySchema | null;
  getPipeline: (pipelineKey: string) => PipelineStage[];
  isEntityEnabled: (entityType: ExtendedEntityType) => boolean;
  hasFeature: (feature: keyof CRMBlueprint['features']) => boolean;
}

export function useCRMBlueprint(businessSlugOverride?: string): UseCRMBlueprintResult {
  const { currentBusiness } = useBusiness();
  
  // Determine which business to use
  const effectiveSlug = businessSlugOverride || currentBusiness?.slug;
  
  // Fetch business details if we have an ID but not a slug
  const { data: businessData, isLoading: businessLoading } = useQuery({
    queryKey: ['business-for-blueprint', effectiveSlug],
    queryFn: async () => {
      if (!effectiveSlug) return null;
      const { data, error } = await supabase
        .from('businesses')
        .select('id, slug, name')
        .eq('slug', effectiveSlug)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!effectiveSlug,
  });

  // Get the blueprint for this business
  const blueprint = useMemo(() => {
    if (!effectiveSlug) return getDefaultBlueprint();
    return getCRMBlueprint(effectiveSlug) || getDefaultBlueprint();
  }, [effectiveSlug]);

  // Helper functions
  const getEntitySchema = (entityType: ExtendedEntityType): EntitySchema | null => {
    return blueprint.entitySchemas[entityType] || null;
  };

  const getPipeline = (pipelineKey: string): PipelineStage[] => {
    return blueprint.pipelines[pipelineKey] || [];
  };

  const isEntityEnabled = (entityType: ExtendedEntityType): boolean => {
    return blueprint.enabledEntityTypes.includes(entityType);
  };

  const hasFeature = (feature: keyof CRMBlueprint['features']): boolean => {
    return blueprint.features[feature] || false;
  };

  return {
    blueprint,
    isLoading: businessLoading,
    error: null,
    businessId: businessData?.id || currentBusiness?.id || null,
    businessSlug: effectiveSlug || null,
    businessName: businessData?.name || currentBusiness?.name || blueprint.businessName,
    getEntitySchema,
    getPipeline,
    isEntityEnabled,
    hasFeature,
  };
}

// Hook to get all available entity types for a business
export function useAvailableEntityTypes(businessSlug?: string) {
  const { blueprint } = useCRMBlueprint(businessSlug);
  
  return useMemo(() => {
    return blueprint.enabledEntityTypes.map(type => {
      const schema = blueprint.entitySchemas[type];
      return {
        key: type,
        label: schema?.label || type,
        labelPlural: schema?.labelPlural || `${type}s`,
        icon: schema?.icon || 'Circle',
        color: schema?.color || '#6b7280',
      };
    });
  }, [blueprint]);
}

// Hook to get KPI configuration for a business
export function useCRMKPIs(businessSlug?: string) {
  const { blueprint } = useCRMBlueprint(businessSlug);
  return blueprint.kpiConfig;
}

// Hook to get list view configuration
export function useListViewConfig(businessSlug: string | undefined, entityType: ExtendedEntityType) {
  const { blueprint } = useCRMBlueprint(businessSlug);
  return blueprint.listViews[entityType] || null;
}

// Hook to get profile tabs for an entity type
export function useProfileTabs(businessSlug: string | undefined, entityType: ExtendedEntityType) {
  const { blueprint } = useCRMBlueprint(businessSlug);
  return blueprint.profileTabs[entityType] || [];
}
