// Mirror of supabase/functions/_shared/ddCategory.ts — the ten values allowed by
// the products_all_category_check constraint. Keep both lists in sync.

export const DD_CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: 'disposable_vape', label: 'Disposable Vapes' },
  { value: 'nicotine_pouch', label: 'Nicotine Pouches' },
  { value: 'tobacco_grabba', label: 'Tobacco / Grabba' },
  { value: 'rolling_papers', label: 'Rolling Papers & Wraps' },
  { value: 'lighters', label: 'Lighters' },
  { value: 'grinders', label: 'Grinders' },
  { value: 'glass', label: 'Glass' },
  { value: 'vape_hardware', label: 'Vape Hardware' },
  { value: 'cbd_hemp', label: 'CBD / Hemp' },
  { value: 'accessories', label: 'Accessories' },
];

export const DD_CATEGORY_VALUES = DD_CATEGORY_OPTIONS.map((o) => o.value);
