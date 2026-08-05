// Dynasty Direct category mapping.
//
// products_all.category is guarded by products_all_category_check, which only
// accepts the ten snake_case slugs below. The AI returns human-readable
// breadcrumbs ("Tobacco & Smoking > Papers & Wraps > Rolling Papers"), so every
// write path MUST run through mapDdCategory() first. If nothing maps cleanly we
// return null so the caller can demand a manual pick instead of failing at
// insert time with a check-constraint 500.

export const DD_CATEGORIES = [
  'disposable_vape',
  'nicotine_pouch',
  'tobacco_grabba',
  'rolling_papers',
  'lighters',
  'grinders',
  'glass',
  'vape_hardware',
  'cbd_hemp',
  'accessories',
] as const;

export type DdCategory = (typeof DD_CATEGORIES)[number];

export const DD_CATEGORY_LABELS: Record<DdCategory, string> = {
  disposable_vape: 'Disposable Vapes',
  nicotine_pouch: 'Nicotine Pouches',
  tobacco_grabba: 'Tobacco / Grabba',
  rolling_papers: 'Rolling Papers & Wraps',
  lighters: 'Lighters',
  grinders: 'Grinders',
  glass: 'Glass',
  vape_hardware: 'Vape Hardware',
  cbd_hemp: 'CBD / Hemp',
  accessories: 'Accessories',
};

// Keyword → canonical category. Ordered most-specific first; the matcher scores
// by keyword length so "rolling paper" beats a stray "tobacco" in the same text.
const KEYWORDS: [string, DdCategory][] = [
  ['rolling paper', 'rolling_papers'],
  ['rolling papers', 'rolling_papers'],
  ['cigarette paper', 'rolling_papers'],
  ['blunt wrap', 'rolling_papers'],
  ['hemp wrap', 'rolling_papers'],
  ['papers & wraps', 'rolling_papers'],
  ['pre-rolled cone', 'rolling_papers'],
  ['cones', 'rolling_papers'],
  ['wraps', 'rolling_papers'],
  ['papers', 'rolling_papers'],
  ['rolling', 'rolling_papers'],

  ['disposable vape', 'disposable_vape'],
  ['disposable e-cig', 'disposable_vape'],
  ['puff bar', 'disposable_vape'],
  ['disposable', 'disposable_vape'],

  ['nicotine pouch', 'nicotine_pouch'],
  ['nic pouch', 'nicotine_pouch'],
  ['snus', 'nicotine_pouch'],
  ['zyn', 'nicotine_pouch'],
  ['pouch', 'nicotine_pouch'],

  ['grabba', 'tobacco_grabba'],
  ['fronto', 'tobacco_grabba'],
  ['leaf tobacco', 'tobacco_grabba'],
  ['pipe tobacco', 'tobacco_grabba'],
  ['loose tobacco', 'tobacco_grabba'],
  ['cigar', 'tobacco_grabba'],
  ['tobacco', 'tobacco_grabba'],

  ['torch lighter', 'lighters'],
  ['butane', 'lighters'],
  ['lighter', 'lighters'],
  ['matches', 'lighters'],

  ['herb grinder', 'grinders'],
  ['grinder', 'grinders'],

  ['water pipe', 'glass'],
  ['bong', 'glass'],
  ['glass pipe', 'glass'],
  ['bubbler', 'glass'],
  ['rig', 'glass'],
  ['glass', 'glass'],

  ['vape hardware', 'vape_hardware'],
  ['vape battery', 'vape_hardware'],
  ['vape mod', 'vape_hardware'],
  ['pod system', 'vape_hardware'],
  ['coil', 'vape_hardware'],
  ['atomizer', 'vape_hardware'],
  ['e-liquid', 'vape_hardware'],
  ['vape', 'vape_hardware'],

  ['cbd', 'cbd_hemp'],
  ['hemp flower', 'cbd_hemp'],
  ['delta-8', 'cbd_hemp'],
  ['delta 8', 'cbd_hemp'],
  ['thca', 'cbd_hemp'],
  ['hemp', 'cbd_hemp'],

  ['accessory', 'accessories'],
  ['accessories', 'accessories'],
  ['tray', 'accessories'],
  ['storage', 'accessories'],
  ['smoking accessories', 'accessories'],
];

export interface CategoryMapping {
  category: DdCategory | null;
  /** 'exact' = already a valid slug, 'keyword' = matched a term, 'none' = needs a human. */
  method: 'exact' | 'keyword' | 'none';
  matched_term?: string;
  /** Raw text the AI produced, kept for audit. */
  raw: string | null;
}

/**
 * Map arbitrary AI/user category text onto a valid products_all category.
 * Never hyphenates or otherwise invents a slug — it either lands on one of the
 * ten allowed values or returns null.
 *
 * `extraContext` (product name, item type, tags) is searched as a fallback so a
 * blank or useless AI category still resolves when the product name is obvious.
 */
export function mapDdCategory(raw: unknown, extraContext?: string): CategoryMapping {
  const rawStr = raw == null ? null : String(raw).trim();
  const norm = (s: string) => s.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();

  if (rawStr) {
    const slug = rawStr.toLowerCase().trim().replace(/[\s-]+/g, '_');
    if ((DD_CATEGORIES as readonly string[]).includes(slug)) {
      return { category: slug as DdCategory, method: 'exact', raw: rawStr };
    }
  }

  // Search the AI text first, then the surrounding context.
  for (const haystack of [rawStr ? norm(rawStr) : '', extraContext ? norm(extraContext) : '']) {
    if (!haystack) continue;
    let best: { term: string; cat: DdCategory } | null = null;
    for (const [term, cat] of KEYWORDS) {
      if (!haystack.includes(term)) continue;
      if (!best || term.length > best.term.length) best = { term, cat };
    }
    if (best) return { category: best.cat, method: 'keyword', matched_term: best.term, raw: rawStr };
  }

  return { category: null, method: 'none', raw: rawStr };
}
