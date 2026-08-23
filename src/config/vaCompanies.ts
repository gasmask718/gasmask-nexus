/**
 * Canonical VA company registry — the nine calling businesses.
 *
 * The DB rows live in `va_companies` (id, slug, name, brand_color).
 * This module carries the client-side behavior the table doesn't:
 * which businesses each company calls for and where its call list
 * comes from. Slugs are the join key.
 */

export type VALeadSource = 'brandaro_qualified_leads' | 'v_store_who_to_contact' | null;

export interface VACompanyConfig {
  slug: string;
  /** businesses.slug values this company places calls for */
  businessSlugs: string[];
  /** table/view the Leads tab + power dialer pull from; null = no list configured yet */
  leadSource: VALeadSource;
  /** brandaro_sales_script_steps only exists for Brandaro */
  hasScripts: boolean;
}

/**
 * Dynasty Connect is the switchboard: a VA with a Dynasty Connect
 * membership may pick ANY active company and call on its behalf
 * (leads, caller ID and scripts all re-scope to the pick).
 */
export const SWITCHBOARD_COMPANY_SLUG = 'dynasty_connect';

const NO_LIST: Pick<VACompanyConfig, 'businessSlugs' | 'leadSource' | 'hasScripts'> = {
  businessSlugs: [],
  leadSource: null,
  hasScripts: false,
};

export const VA_COMPANY_CONFIG: Record<string, VACompanyConfig> = {
  brandaro: {
    slug: 'brandaro',
    businessSlugs: ['brandaro'],
    leadSource: 'brandaro_qualified_leads',
    hasScripts: true,
  },
  // GasMask, Grabba R Us, Hot Scolatti and Hot Mama are ONE company (Grabba brands).
  // The old "Hot Scalati" business row was deleted 2026-08-21; the live slug is hot_scolatti.
  gasmask_grabba: {
    slug: 'gasmask_grabba',
    businessSlugs: ['gasmask', 'grabba_r_us', 'hot_scolatti', 'hot_mama'],
    leadSource: 'v_store_who_to_contact',
    hasScripts: false,
  },
  dynasty_connect: { slug: 'dynasty_connect', ...NO_LIST },
  toptier: { slug: 'toptier', ...NO_LIST },
  surplus_funds: { slug: 'surplus_funds', ...NO_LIST },
  real_estate: { slug: 'real_estate', ...NO_LIST },
  unforgettable_times: { slug: 'unforgettable_times', ...NO_LIST },
  brightsun_solar: { slug: 'brightsun_solar', ...NO_LIST },
  dynasty_direct: { slug: 'dynasty_direct', ...NO_LIST },
};

export function getVACompanyConfig(slug: string | null | undefined): VACompanyConfig {
  if (slug && VA_COMPANY_CONFIG[slug]) return VA_COMPANY_CONFIG[slug];
  return { slug: slug ?? 'unknown', ...NO_LIST };
}
