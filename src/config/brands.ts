// ═══════════════════════════════════════════════════════════════════════════════
// CANONICAL BRAND IDENTITY REGISTRY — SINGLE SOURCE OF TRUTH
// ALL brand names, colors, aliases, and visual tokens are defined HERE.
// No component may hardcode brand names or colors.
// ═══════════════════════════════════════════════════════════════════════════════

export type CanonicalBrandId = 'gasmask' | 'hotmama' | 'hotscolatti' | 'grabba_r_us';

export interface BrandIdentity {
  id: CanonicalBrandId;
  /** Human-readable display name — use this in ALL UI surfaces */
  displayName: string;
  /** Optional short form (e.g. "Grabba" for "Grabba R Us") */
  shortName?: string;
  /** Primary hex color */
  primaryColor: string;
  /** Tailwind class for soft background */
  softBgClass: string;
  /** Tailwind class for border */
  borderClass: string;
  /** Tailwind class for text */
  textClass: string;
  /** Tailwind class for badge/pill styling */
  pillClass: string;
  /** Tailwind gradient classes */
  gradient: string;
  /** Emoji icon */
  icon: string;
  /** All known data aliases for normalization (lowercase) */
  aliases: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// THE 4 CANONICAL BRANDS — NON-NEGOTIABLE
// ═══════════════════════════════════════════════════════════════════════════════

export const CANONICAL_BRANDS: Record<CanonicalBrandId, BrandIdentity> = {
  gasmask: {
    id: 'gasmask',
    displayName: 'GasMask',
    primaryColor: '#FF0000',
    softBgClass: 'bg-red-500/10',
    borderClass: 'border-red-500/30',
    textClass: 'text-red-600 dark:text-red-400',
    pillClass: 'bg-red-500/20 text-red-300 border-red-500/40',
    gradient: 'from-red-600 to-red-900',
    icon: '🔴',
    aliases: ['gas mask', 'gasmask', 'gasmask bags', 'gasmask crm', 'gas mask crm'],
  },
  hotmama: {
    id: 'hotmama',
    displayName: 'HotMama',
    primaryColor: '#FF4F9D',
    softBgClass: 'bg-pink-500/10',
    borderClass: 'border-pink-500/30',
    textClass: 'text-pink-600 dark:text-pink-400',
    pillClass: 'bg-pink-500/20 text-pink-300 border-pink-500/40',
    gradient: 'from-pink-500 via-pink-400 to-pink-300',
    icon: '💖',
    aliases: ['hot mama', 'hotmama', 'hot mama grabba'],
  },
  hotscolatti: {
    id: 'hotscolatti',
    displayName: 'Hotscolatti',
    shortName: 'Hotscolatti',
    primaryColor: '#FF7A00',
    softBgClass: 'bg-orange-500/10',
    borderClass: 'border-orange-500/30',
    textClass: 'text-orange-600 dark:text-orange-400',
    pillClass: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    gradient: 'from-orange-500 to-amber-600',
    icon: '🟠',
    aliases: ['scalati', 'scolatti', 'hot scolatti', 'hot scalati', 'hotscolati', 'hotscalati', 'hotscolatti', 'hotscollati'],
  },
  grabba_r_us: {
    id: 'grabba_r_us',
    displayName: 'Grabba R Us',
    shortName: 'Grabba',
    primaryColor: '#A020F0',
    softBgClass: 'bg-purple-500/10',
    borderClass: 'border-purple-500/30',
    textClass: 'text-purple-600 dark:text-purple-400',
    pillClass: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    gradient: 'from-purple-600 to-violet-700',
    icon: '🟪',
    aliases: ['grabba', 'grabba r us', 'grabbarus', 'grabba_r_us'],
  },
};

/** Ordered list of all canonical brand IDs */
export const CANONICAL_BRAND_IDS: CanonicalBrandId[] = ['gasmask', 'hotmama', 'hotscolatti', 'grabba_r_us'];

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS — Import these instead of hardcoding anything
// ═══════════════════════════════════════════════════════════════════════════════

/** Get full brand identity config. Falls back to gasmask if unknown. */
export function getBrandIdentity(brandId: string): BrandIdentity {
  return CANONICAL_BRANDS[brandId as CanonicalBrandId] || CANONICAL_BRANDS.gasmask;
}

/** Get human-readable display name for a brand ID */
export function getBrandDisplayName(brandId: string): string {
  return getBrandIdentity(brandId).displayName;
}

/** Get primary hex color for a brand ID */
export function getBrandPrimaryColor(brandId: string): string {
  return getBrandIdentity(brandId).primaryColor;
}

/**
 * Normalize any raw brand string to a canonical brand ID.
 * Handles aliases, casing, and common data variations.
 * Returns null if the input doesn't match any known brand.
 */
export function normalizeBrandId(input: string | null | undefined): CanonicalBrandId | null {
  if (!input) return null;
  const normalized = input.toLowerCase().trim();

  // Direct match on canonical ID
  if (normalized in CANONICAL_BRANDS) return normalized as CanonicalBrandId;

  // Alias match
  for (const brand of Object.values(CANONICAL_BRANDS)) {
    if (brand.aliases.some(alias => alias.toLowerCase() === normalized)) {
      return brand.id;
    }
  }

  return null;
}
