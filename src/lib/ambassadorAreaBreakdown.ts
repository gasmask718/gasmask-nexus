import type { PortfolioStore } from '@/hooks/useAmbassadorPortfolio';
import type { AmbassadorProspect } from '@/hooks/useAmbassadorProspects';

export const UPPER_MANHATTAN_AREAS = [
  'Washington Heights',
  'Dyckman',
  'Inwood',
  'Harlem',
] as const;

export type UpperManhattanArea = (typeof UPPER_MANHATTAN_AREAS)[number];

export interface AreaLayerCount {
  label: UpperManhattanArea | 'Manhattan overall';
  existing: number;
  prospects: number;
  landscape: number;
}

const normalize = (value?: string | null) => (value || '').trim().toLowerCase();

export function getStoreSourceArea(store: PortfolioStore): string {
  return store.store_neighborhood || store.store_city || store.store_borough || 'Area not recorded';
}

export function getProspectSourceArea(prospect: AmbassadorProspect): string {
  return prospect.city || prospect.neighborhood || 'Area not recorded';
}

function upperManhattanArea(value?: string | null): UpperManhattanArea | null {
  const label = normalize(value);
  if (label.includes('washington heights') || label.includes('washington hts')) return 'Washington Heights';
  if (label.includes('dyckman')) return 'Dyckman';
  if (label.includes('inwood')) return 'Inwood';
  if (label.includes('harlem')) return 'Harlem';
  return null;
}

function isManhattanStore(store: PortfolioStore): boolean {
  const values = [store.store_borough, store.store_city, store.store_neighborhood].map(normalize);
  return values.some((value) =>
    value === 'manhattan' ||
    value === 'new york' ||
    value === 'new york city' ||
    upperManhattanArea(value) !== null,
  );
}

function isManhattanProspect(prospect: AmbassadorProspect): boolean {
  return normalize(prospect.canonical_area) === 'manhattan';
}

export function buildUpperManhattanBreakdown(
  stores: PortfolioStore[],
  prospects: AmbassadorProspect[],
): AreaLayerCount[] {
  const rows: AreaLayerCount[] = UPPER_MANHATTAN_AREAS.map((label) => {
    const existing = stores.filter((store) => upperManhattanArea(getStoreSourceArea(store)) === label).length;
    const prospectCount = prospects.filter((prospect) => upperManhattanArea(getProspectSourceArea(prospect)) === label).length;
    return { label, existing, prospects: prospectCount, landscape: existing + prospectCount };
  });

  const manhattanExisting = new Set(stores.filter(isManhattanStore).map((store) => store.store_id)).size;
  const manhattanProspects = new Set(
    prospects.filter(isManhattanProspect).map((prospect) => prospect.prospect_id),
  ).size;

  rows.push({
    label: 'Manhattan overall',
    existing: manhattanExisting,
    prospects: manhattanProspects,
    landscape: manhattanExisting + manhattanProspects,
  });

  return rows;
}