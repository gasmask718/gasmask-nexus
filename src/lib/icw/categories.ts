// ICW (I Clean We Clean) category taxonomy.
// Single source of truth for category_groups on icw_workers and icw_sourced_leads.

export const ICW_CATEGORIES = [
  'Cleaning',
  'Mobile Wash',
  'Lawn Care',
  'Snow Removal',
  'Handyman',
  'Moving',
  'Floors',
  'Professional Reorganizer',
] as const;

export type ICWCategory = (typeof ICW_CATEGORIES)[number];

/** Categories that are commonly licence-gated (informational only for now). */
export const ICW_LICENSE_GATED_CATEGORIES: ICWCategory[] = ['Handyman', 'Floors'];
