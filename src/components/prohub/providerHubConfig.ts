/**
 * Shared configuration for the two provider-signup lead hubs:
 *   • Goddess In You  (giy_leads / giy_interactions / giy_followups)
 *   • Services.io     (svc_leads / svc_interactions / svc_followups)
 *
 * Both hubs receive PROFESSIONAL / PROVIDER applications (not customer leads)
 * and are modelled on the solar_leads end-to-end pattern.
 */

export const PROVIDER_STATUSES = [
  'new',
  'contacted',
  'responded',
  'interested',
  'qualified',
  'onboarding',
  'converted',
  'lost',
] as const;

export type ProviderStatus = (typeof PROVIDER_STATUSES)[number];

export const STATUS_BADGE: Record<string, string> = {
  new: 'bg-muted text-muted-foreground border-border',
  contacted: 'bg-blue-500/15 text-blue-400 border-blue-500/40',
  responded: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/40',
  interested: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/40',
  qualified: 'bg-amber-500/15 text-amber-400 border-amber-500/40',
  onboarding: 'bg-violet-500/15 text-violet-400 border-violet-500/40',
  converted: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40',
  lost: 'bg-destructive/15 text-destructive border-destructive/40',
};

export const INTERACTION_TYPES = [
  'sms_sent',
  'sms_reply',
  'call_made',
  'call_answered',
  'note',
  'status_change',
] as const;

export interface ProviderHubConfig {
  /** Human label used in headings and toasts. */
  brand: string;
  /** react-query key namespace. */
  key: 'giy' | 'svc';
  leadsTable: 'giy_leads' | 'svc_leads';
  interactionsTable: 'giy_interactions' | 'svc_interactions';
  followupsTable: 'giy_followups' | 'svc_followups';
  /** Column holding the array of skills / categories. */
  tagsColumn: 'specialties' | 'service_categories';
  tagsLabel: string;
  /** Column holding the geography filter. */
  geoColumn: 'city' | 'metro';
  geoLabel: string;
  /** Column holding the live profile link required before converting. */
  profileUrlColumn: 'roster_profile_url' | 'provider_profile_url';
  profileUrlLabel: string;
  /** Optional extra text column rendered on the detail form. */
  extraField?: { column: 'license_status'; label: string };
  /** Tailwind classes for the hub header accent. */
  accentHeader: string;
  accentText: string;
}

export const GIY_CONFIG: ProviderHubConfig = {
  brand: 'Goddess In You',
  key: 'giy',
  leadsTable: 'giy_leads',
  interactionsTable: 'giy_interactions',
  followupsTable: 'giy_followups',
  tagsColumn: 'specialties',
  tagsLabel: 'Specialty',
  geoColumn: 'city',
  geoLabel: 'City',
  profileUrlColumn: 'roster_profile_url',
  profileUrlLabel: 'Roster profile URL',
  accentHeader:
    'bg-[#0A0A0C] border border-purple-500/30 shadow-[0_0_40px_-20px_rgba(168,85,247,0.6)]',
  accentText: 'text-purple-400',
};

export const SVC_CONFIG: ProviderHubConfig = {
  brand: 'Services.io',
  key: 'svc',
  leadsTable: 'svc_leads',
  interactionsTable: 'svc_interactions',
  followupsTable: 'svc_followups',
  tagsColumn: 'service_categories',
  tagsLabel: 'Service category',
  geoColumn: 'metro',
  geoLabel: 'Metro',
  profileUrlColumn: 'provider_profile_url',
  profileUrlLabel: 'Provider profile URL',
  extraField: { column: 'license_status', label: 'License status' },
  accentHeader: 'bg-card border border-border',
  accentText: 'text-primary',
};

export interface ProviderLead {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  state: string | null;
  city?: string | null;
  metro?: string | null;
  specialties?: string[] | null;
  service_categories?: string[] | null;
  years_experience: number | null;
  license_status?: string | null;
  portfolio_url?: string | null;
  lead_score: number | null;
  lead_source: string | null;
  status: string;
  assigned_to: string | null;
  roster_profile_url?: string | null;
  provider_profile_url?: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
