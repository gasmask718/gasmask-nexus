// ═══════════════════════════════════════════════════════════════════════════════
// VERTICAL ENFORCEMENT SYSTEM
// Brand Verticals, Cross-Promotion Rules, and Pitch Permissions
// ═══════════════════════════════════════════════════════════════════════════════

import { Building2, Sparkles, Heart, Briefcase } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// VERTICAL DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

export type VerticalSlug = 'grabba-tobacco' | 'luxury-lifestyle' | 'adult-creator' | 'business-services';

export interface VerticalConfig {
  slug: VerticalSlug;
  name: string;
  description: string;
  industry: string;
  icon: LucideIcon;
  color: string;
  gradient: string;
  brands: string[];
  forbiddenBrands: string[];
  allowedTopics: string[];
  forbiddenTopics: string[];
  systemPromptPrefix: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GRABBA & TOBACCO VERTICAL (Category A - Cross-pitchable)
// ═══════════════════════════════════════════════════════════════════════════════

export const GRABBA_TOBACCO_VERTICAL: VerticalConfig = {
  slug: 'grabba-tobacco',
  name: 'Grabba & Tobacco',
  description: 'All grabba products, tubes, accessories, and tobacco-related items',
  industry: 'tobacco',
  icon: Building2,
  color: '#FF0000',
  gradient: 'from-red-600 to-orange-500',
  brands: ['gasmask', 'hotmama', 'scalati', 'grabba'],
  forbiddenBrands: ['playboxxx', 'toptier', 'unforgettable'],
  allowedTopics: [
    'tubes', 'bags', 'grabba', 'boxes', 'lighters', 'accessories',
    'flavors', 'discounts', 'delivery', 'wholesale', 'bulk orders',
    'new products', 'promotions', 'restock', 'inventory'
  ],
  forbiddenTopics: [
    'Playboxxx', 'TopTier Experience', 'Unforgettable Times',
    'adult services', 'luxury events', 'chauffeur', 'creator economy',
    'adult content', 'entertainment services'
  ],
  systemPromptPrefix: `You are speaking to a smoke shop within the Grabba & Tobacco vertical.
You may ONLY discuss products in this vertical:
- GasMask (tubes, bags, accessories)
- Hot Mama (tubes, bags, accessories)
- Grabba R Us (grabba leaf products)
- Hot Scolatti (tubes, bags, accessories)

You may cross-promote ANY product within this family.
Do NOT mention or reference other businesses outside this vertical.
Do NOT promote Playboxxx, TopTier, Unforgettable Times, or any non-tobacco brands.
Focus on wholesale tobacco products and accessories only.`
};

// ═══════════════════════════════════════════════════════════════════════════════
// LUXURY & LIFESTYLE VERTICAL (Category B - Isolated)
// ═══════════════════════════════════════════════════════════════════════════════

export const LUXURY_LIFESTYLE_VERTICAL: VerticalConfig = {
  slug: 'luxury-lifestyle',
  name: 'Luxury & Lifestyle',
  description: 'Premium experiences, chauffeur services, and high-end events',
  industry: 'luxury',
  icon: Sparkles,
  color: '#FFD700',
  gradient: 'from-amber-400 to-yellow-500',
  brands: ['toptier', 'unforgettable'],
  forbiddenBrands: ['gasmask', 'hotmama', 'scalati', 'grabba', 'playboxxx'],
  allowedTopics: [
    'luxury experiences', 'chauffeur', 'events', 'VIP services',
    'premium packages', 'concierge', 'entertainment'
  ],
  forbiddenTopics: [
    'tobacco', 'smoke shop', 'tubes', 'grabba', 'wholesale',
    'adult content', 'Playboxxx'
  ],
  systemPromptPrefix: `You are speaking to a luxury/lifestyle customer.
You may ONLY discuss premium experiences and services:
- TopTier Experience
- Unforgettable Times

Do NOT mention tobacco products, smoke shops, or adult services.`
};

// ═══════════════════════════════════════════════════════════════════════════════
// ADULT & CREATOR ECONOMY VERTICAL (Category B - Isolated)
// ═══════════════════════════════════════════════════════════════════════════════

export const ADULT_CREATOR_VERTICAL: VerticalConfig = {
  slug: 'adult-creator',
  name: 'Adult & Creator Economy',
  description: 'Adult content platforms and creator services',
  industry: 'adult',
  icon: Heart,
  color: '#FF69B4',
  gradient: 'from-pink-500 to-rose-500',
  brands: ['playboxxx'],
  forbiddenBrands: ['gasmask', 'hotmama', 'scalati', 'grabba', 'toptier', 'unforgettable'],
  allowedTopics: [
    'creator tools', 'content platform', 'subscriptions',
    'creator economy', 'monetization'
  ],
  forbiddenTopics: [
    'tobacco', 'smoke shop', 'tubes', 'grabba', 'wholesale',
    'luxury events', 'chauffeur'
  ],
  systemPromptPrefix: `You are speaking to a Playboxxx user.
You may ONLY discuss the Playboxxx platform and creator services.
Do NOT mention tobacco products, smoke shops, or luxury services.`
};

// ═══════════════════════════════════════════════════════════════════════════════
// BUSINESS SERVICES VERTICAL
// ═══════════════════════════════════════════════════════════════════════════════

export const BUSINESS_SERVICES_VERTICAL: VerticalConfig = {
  slug: 'business-services',
  name: 'Business Services',
  description: 'Funding, credit, and business operations services',
  industry: 'services',
  icon: Briefcase,
  color: '#4F46E5',
  gradient: 'from-indigo-500 to-purple-600',
  brands: [],
  forbiddenBrands: ['playboxxx'],
  allowedTopics: [
    'funding', 'credit', 'business loans', 'merchant services',
    'operations', 'consulting'
  ],
  forbiddenTopics: [
    'adult content', 'Playboxxx'
  ],
  systemPromptPrefix: `You are speaking about business services.
Focus on professional business solutions only.`
};

// ═══════════════════════════════════════════════════════════════════════════════
// VERTICAL REGISTRY
// ═══════════════════════════════════════════════════════════════════════════════

export const VERTICALS: Record<VerticalSlug, VerticalConfig> = {
  'grabba-tobacco': GRABBA_TOBACCO_VERTICAL,
  'luxury-lifestyle': LUXURY_LIFESTYLE_VERTICAL,
  'adult-creator': ADULT_CREATOR_VERTICAL,
  'business-services': BUSINESS_SERVICES_VERTICAL,
};

export const VERTICAL_LIST = Object.values(VERTICALS);

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get vertical config by slug
 */
export function getVerticalConfig(slug: VerticalSlug): VerticalConfig {
  return VERTICALS[slug];
}

/**
 * Get vertical for a brand
 */
export function getVerticalForBrand(brandId: string): VerticalConfig | null {
  for (const vertical of VERTICAL_LIST) {
    if (vertical.brands.includes(brandId)) {
      return vertical;
    }
  }
  return null;
}

/**
 * Check if a brand can be pitched (is within allowed vertical)
 */
export function canPitchBrand(brandId: string, targetVertical: VerticalSlug): boolean {
  const vertical = VERTICALS[targetVertical];
  if (!vertical) return false;
  
  // Check if brand is in this vertical
  if (vertical.brands.includes(brandId)) return true;
  
  // Check if brand is forbidden
  if (vertical.forbiddenBrands.includes(brandId)) return false;
  
  return false;
}

/**
 * Get all brands that can be cross-promoted within a vertical
 */
export function getCrossPromotableBrands(verticalSlug: VerticalSlug): string[] {
  const vertical = VERTICALS[verticalSlug];
  return vertical?.brands || [];
}

/**
 * Check if a topic is allowed in a vertical
 */
export function isTopicAllowed(topic: string, verticalSlug: VerticalSlug): boolean {
  const vertical = VERTICALS[verticalSlug];
  if (!vertical) return true;
  
  const lowerTopic = topic.toLowerCase();
  
  // Check forbidden topics first
  for (const forbidden of vertical.forbiddenTopics) {
    if (lowerTopic.includes(forbidden.toLowerCase())) {
      return false;
    }
  }
  
  return true;
}

/**
 * Get forbidden topics for a vertical
 */
export function getForbiddenTopics(verticalSlug: VerticalSlug): string[] {
  return VERTICALS[verticalSlug]?.forbiddenTopics || [];
}

/**
 * Get system prompt prefix for a vertical
 */
export function getSystemPromptForVertical(verticalSlug: VerticalSlug): string {
  return VERTICALS[verticalSlug]?.systemPromptPrefix || '';
}

/**
 * Get brand display info for cross-promotion
 */
export function getCrossPromotionInfo(verticalSlug: VerticalSlug): {
  allowedBrands: string[];
  forbiddenBrands: string[];
  allowedTopics: string[];
  forbiddenTopics: string[];
} {
  const vertical = VERTICALS[verticalSlug];
  if (!vertical) {
    return {
      allowedBrands: [],
      forbiddenBrands: [],
      allowedTopics: [],
      forbiddenTopics: [],
    };
  }
  
  return {
    allowedBrands: vertical.brands,
    forbiddenBrands: vertical.forbiddenBrands,
    allowedTopics: vertical.allowedTopics,
    forbiddenTopics: vertical.forbiddenTopics,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// BRAND FAMILY MAPPING (for quick lookups)
// ═══════════════════════════════════════════════════════════════════════════════

export const GRABBA_FAMILY_BRANDS = GRABBA_TOBACCO_VERTICAL.brands;

export const isGrabbaFamilyBrand = (brandId: string): boolean => {
  return GRABBA_FAMILY_BRANDS.includes(brandId);
};

export const canCrossPromoteGrabba = (brandId: string): boolean => {
  return isGrabbaFamilyBrand(brandId);
};
