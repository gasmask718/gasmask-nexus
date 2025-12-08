// ═══════════════════════════════════════════════════════════════════════════════
// VERTICAL ENFORCEMENT HOOK
// Fetches and manages vertical data from Supabase
// ═══════════════════════════════════════════════════════════════════════════════

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  VERTICALS, 
  type VerticalSlug, 
  getVerticalForBrand,
  getCrossPromotableBrands,
  isTopicAllowed,
  getSystemPromptForVertical 
} from '@/config/verticals';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface BrandVertical {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  industry: string;
  allow_cross_vertical: boolean;
  created_at: string;
}

export interface VerticalBrand {
  id: string;
  vertical_id: string;
  brand_id: string;
  brand_name: string;
  can_cross_promote: boolean;
  pitch_priority: number;
  created_at: string;
}

export interface VerticalGuardrail {
  id: string;
  vertical_id: string;
  guardrail_type: string;
  guardrail_value: string;
  priority: number;
  is_active: boolean;
  created_at: string;
}

export interface VerticalPitchRule {
  id: string;
  vertical_id: string;
  rule_type: string;
  rule_value: string;
  severity: string;
  created_at: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Fetch all verticals from database
 */
export function useVerticals() {
  return useQuery({
    queryKey: ['brand-verticals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brand_verticals')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as BrandVertical[];
    },
    staleTime: 1000 * 60 * 30, // Cache for 30 minutes (config data)
  });
}

/**
 * Fetch brands for a specific vertical
 */
export function useVerticalBrands(verticalId: string | null) {
  return useQuery({
    queryKey: ['vertical-brands', verticalId],
    queryFn: async () => {
      if (!verticalId) return [];
      
      const { data, error } = await supabase
        .from('vertical_brands')
        .select('*')
        .eq('vertical_id', verticalId)
        .order('pitch_priority');
      
      if (error) throw error;
      return data as VerticalBrand[];
    },
    enabled: !!verticalId,
    staleTime: 1000 * 60 * 30,
  });
}

/**
 * Fetch all vertical brands (for filtering)
 */
export function useAllVerticalBrands() {
  return useQuery({
    queryKey: ['all-vertical-brands'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vertical_brands')
        .select(`
          *,
          brand_verticals (
            id,
            name,
            slug,
            industry
          )
        `)
        .order('pitch_priority');
      
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 30,
  });
}

/**
 * Fetch guardrails for a vertical
 */
export function useVerticalGuardrails(verticalId: string | null) {
  return useQuery({
    queryKey: ['vertical-guardrails', verticalId],
    queryFn: async () => {
      if (!verticalId) return [];
      
      const { data, error } = await supabase
        .from('vertical_script_guardrails')
        .select('*')
        .eq('vertical_id', verticalId)
        .eq('is_active', true)
        .order('priority');
      
      if (error) throw error;
      return data as VerticalGuardrail[];
    },
    enabled: !!verticalId,
    staleTime: 1000 * 60 * 30,
  });
}

/**
 * Fetch pitch rules for a vertical
 */
export function useVerticalPitchRules(verticalId: string | null) {
  return useQuery({
    queryKey: ['vertical-pitch-rules', verticalId],
    queryFn: async () => {
      if (!verticalId) return [];
      
      const { data, error } = await supabase
        .from('vertical_pitch_rules')
        .select('*')
        .eq('vertical_id', verticalId)
        .order('rule_type');
      
      if (error) throw error;
      return data as VerticalPitchRule[];
    },
    enabled: !!verticalId,
    staleTime: 1000 * 60 * 30,
  });
}

/**
 * Check if a brand can be pitched to a store
 */
export function useCanPitchBrandToStore(storeId: string | null, brandId: string | null) {
  return useQuery({
    queryKey: ['can-pitch-brand', storeId, brandId],
    queryFn: async () => {
      if (!storeId || !brandId) return true;
      
      const { data, error } = await supabase
        .rpc('can_pitch_brand_to_store', {
          p_store_id: storeId,
          p_brand_id: brandId,
        });
      
      if (error) throw error;
      return data as boolean;
    },
    enabled: !!storeId && !!brandId,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Get allowed brands for a store
 */
export function useAllowedBrandsForStore(storeId: string | null) {
  return useQuery({
    queryKey: ['allowed-brands-for-store', storeId],
    queryFn: async () => {
      if (!storeId) return [];
      
      const { data, error } = await supabase
        .rpc('get_allowed_brands_for_store', {
          p_store_id: storeId,
        });
      
      if (error) throw error;
      return data as Array<{ brand_id: string; brand_name: string; vertical_name: string }>;
    },
    enabled: !!storeId,
    staleTime: 1000 * 60 * 5,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY HOOK - Combines DB data with static config
// ═══════════════════════════════════════════════════════════════════════════════

export function useVerticalEnforcement() {
  const { data: verticals, isLoading: verticalsLoading } = useVerticals();
  const { data: allBrands, isLoading: brandsLoading } = useAllVerticalBrands();
  
  const isLoading = verticalsLoading || brandsLoading;
  
  /**
   * Get all brands that can be cross-promoted with a given brand
   */
  const getCrossPromotableBrandsForBrand = (brandId: string): string[] => {
    const vertical = getVerticalForBrand(brandId);
    if (!vertical) return [brandId];
    return getCrossPromotableBrands(vertical.slug as VerticalSlug);
  };
  
  /**
   * Check if content is allowed for a vertical
   */
  const validateContent = (content: string, verticalSlug: VerticalSlug): {
    isValid: boolean;
    violations: string[];
  } => {
    const violations: string[] = [];
    const vertical = VERTICALS[verticalSlug];
    
    if (!vertical) {
      return { isValid: true, violations: [] };
    }
    
    const lowerContent = content.toLowerCase();
    
    for (const forbidden of vertical.forbiddenTopics) {
      if (lowerContent.includes(forbidden.toLowerCase())) {
        violations.push(`Contains forbidden topic: "${forbidden}"`);
      }
    }
    
    for (const forbiddenBrand of vertical.forbiddenBrands) {
      if (lowerContent.includes(forbiddenBrand.toLowerCase())) {
        violations.push(`Mentions forbidden brand: "${forbiddenBrand}"`);
      }
    }
    
    return {
      isValid: violations.length === 0,
      violations,
    };
  };
  
  /**
   * Get brands that can be shown in campaign builder for a vertical
   */
  const getAllowedBrandsForCampaign = (verticalSlug: VerticalSlug): VerticalBrand[] => {
    if (!allBrands) return [];
    
    const vertical = verticals?.find(v => v.slug === verticalSlug);
    if (!vertical) return [];
    
    return allBrands.filter(b => b.vertical_id === vertical.id);
  };
  
  /**
   * Get system prompt with vertical enforcement
   */
  const getEnforcedSystemPrompt = (
    verticalSlug: VerticalSlug,
    basePrompt: string = ''
  ): string => {
    const prefix = getSystemPromptForVertical(verticalSlug);
    return `${prefix}\n\n${basePrompt}`.trim();
  };
  
  return {
    verticals,
    allBrands,
    isLoading,
    getCrossPromotableBrandsForBrand,
    validateContent,
    getAllowedBrandsForCampaign,
    getEnforcedSystemPrompt,
    isTopicAllowed: (topic: string, vertical: VerticalSlug) => isTopicAllowed(topic, vertical),
  };
}

export default useVerticalEnforcement;
