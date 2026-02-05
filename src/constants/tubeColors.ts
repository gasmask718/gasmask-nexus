// ═══════════════════════════════════════════════════════════════════════════════
// TUBE BRAND COLORS - AUTHORITATIVE SOURCE OF TRUTH
// Single source of truth for all tube brand colorization across the system
// ═══════════════════════════════════════════════════════════════════════════════

export const TUBE_BRAND_COLORS: Record<string, { hex: string; tailwind: string; name: string }> = {
  gasmask: {
    hex: '#EF4444',
    tailwind: 'text-red-500',
    name: 'GasMask Bags',
  },
  gasmasktubes: {
    hex: '#3B82F6',
    tailwind: 'text-blue-500',
    name: 'GasMask Tubes',
  },
  hotmama: {
    hex: '#EC4899',
    tailwind: 'text-pink-500',
    name: 'HotMama',
  },
  grabba: {
    hex: '#A855F7',
    tailwind: 'text-purple-500',
    name: 'Grabba r us',
  },
  'hotscolatti-light': {
    hex: '#FBBF24',
    tailwind: 'text-amber-400',
    name: 'Hot Scolatti Light',
  },
  'hotscolatti-dark': {
    hex: '#92400E',
    tailwind: 'text-amber-900',
    name: 'Hot Scolatti Dark',
  },
  fronto: {
    hex: '#22C55E',
    tailwind: 'text-green-500',
    name: 'Fronto',
  },
};

export function getTubeBrandColor(brandId: string) {
  return TUBE_BRAND_COLORS[brandId] || TUBE_BRAND_COLORS.gasmask;
}

export function getTubeBrandHex(brandId: string): string {
  return getTubeBrandColor(brandId).hex;
}

export function getTubeBrandTailwind(brandId: string): string {
  return getTubeBrandColor(brandId).tailwind;
}
