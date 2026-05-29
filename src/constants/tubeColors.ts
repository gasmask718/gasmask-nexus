// ═══════════════════════════════════════════════════════════════════════════════
// TUBE BRAND COLORS — Derives from CANONICAL_BRANDS + product sub-variants
// For brand-level identity, always import from src/config/brands.ts
// This file adds tube-inventory-specific product variants (Bags/Tubes, Light/Dark)
// ═══════════════════════════════════════════════════════════════════════════════

import { CANONICAL_BRANDS } from '@/config/brands';

export const TUBE_BRAND_COLORS: Record<string, { hex: string; tailwind: string; name: string }> = {
  // ── Canonical brands (derived from registry) ──
  gasmask: {
    hex: CANONICAL_BRANDS.gasmask.primaryColor,
    tailwind: 'text-red-500',
    name: CANONICAL_BRANDS.gasmask.displayName,
  },
  gasmasktubes: {
    hex: '#3B82F6',
    tailwind: 'text-blue-500',
    name: 'GasMask Tubes',
  },
  hotmama: {
    hex: CANONICAL_BRANDS.hotmama.primaryColor,
    tailwind: 'text-pink-500',
    name: CANONICAL_BRANDS.hotmama.displayName,
  },
  grabba_r_us: {
    hex: CANONICAL_BRANDS.grabba_r_us.primaryColor,
    tailwind: 'text-purple-500',
    name: CANONICAL_BRANDS.grabba_r_us.displayName,
  },
  // Legacy alias — tube inventory may still reference 'grabba'
  grabba: {
    hex: CANONICAL_BRANDS.grabba_r_us.primaryColor,
    tailwind: 'text-purple-500',
    name: CANONICAL_BRANDS.grabba_r_us.displayName,
  },
  'hotscolatti-light': {
    hex: '#FBBF24',
    tailwind: 'text-amber-400',
    name: 'Hotscolatti Light',
  },
  'hotscolatti-dark': {
    hex: '#92400E',
    tailwind: 'text-amber-900',
    name: 'Hotscolatti Dark',
  },
  hotscalatibros: {
    hex: '#3B82F6',
    tailwind: 'text-blue-500',
    name: 'Hotscolatti Bros',
  },
  hotscalatimixpack: {
    hex: '#F59E0B',
    tailwind: 'text-amber-500',
    name: 'Hotscolatti Mix',
  },
  gasmaskredtops: {
    hex: '#DC2626',
    tailwind: 'text-red-600',
    name: 'GasMask Redtops',
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
