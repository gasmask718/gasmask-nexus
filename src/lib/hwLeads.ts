import { supabase } from '@/integrations/supabase/client';

export const HW_STAGES = [
  'not_contacted',
  'contacted',
  'interested',
  'samples_sent',
  'negotiating',
  'onboarding',
  'active',
  'dormant',
  'lost',
] as const;
export type HwStage = (typeof HW_STAGES)[number];

export const HW_STAGE_LABELS: Record<HwStage, string> = {
  not_contacted: 'Not Contacted',
  contacted: 'Contacted',
  interested: 'Interested',
  samples_sent: 'Samples Sent',
  negotiating: 'Negotiating',
  onboarding: 'Onboarding',
  active: 'Active',
  dormant: 'Dormant',
  lost: 'Lost',
};

export const HW_STAGE_COLORS: Record<HwStage, string> = {
  not_contacted: '#6b7280',
  contacted: '#3b82f6',
  interested: '#06b6d4',
  samples_sent: '#8b5cf6',
  negotiating: '#eab308',
  onboarding: '#f97316',
  active: '#22c55e',
  dormant: '#a3a3a3',
  lost: '#ef4444',
};

export const HW_CHANNELS = ['call', 'email', 'linkedin', 'sms', 'in_person', 'video'] as const;

export interface HwLead {
  id: string;
  bucket: number | null;
  business_name: string;
  license_number: string | null;
  license_type: string | null;
  license_status: string | null;
  state: string;
  city: string | null;
  address: string | null;
  already_delivers: boolean;
  phone: string | null;
  email: string | null;
  website: string | null;
  lat: number | null;
  long: number | null;
  source: string | null;
  medical_flag: boolean;
  created_at: string;
}

export interface HwLeadStage {
  id: string;
  lead_id: string;
  stage: string;
  notes: string | null;
  contact_method: string | null;
  team_member: string | null;
  contacted_at: string;
  next_action: string | null;
  next_action_due: string | null;
}

export interface HwLeadFilters {
  states?: string[];
  bucket?: number | null;
  alreadyDelivers?: boolean | null;
  medicalOnly?: boolean;
  hasPhone?: boolean;
  /** Map surfaces only: skip rows without coordinates so the row budget goes to pins. */
  geoOnly?: boolean;
  search?: string;
  bbox?: { west: number; south: number; east: number; north: number } | null;
  limit?: number;
}

/** Fetch Highway leads. Bounding-box + limit keeps the map bounded at scale. */
export async function fetchHwLeads(filters: HwLeadFilters = {}): Promise<HwLead[]> {
  let q = supabase.from('hw_leads').select('*').limit(filters.limit ?? 2000);

  if (filters.states?.length) q = q.in('state', filters.states);
  if (filters.bucket != null) q = q.eq('bucket', filters.bucket);
  if (filters.alreadyDelivers != null) q = q.eq('already_delivers', filters.alreadyDelivers);
  if (filters.medicalOnly) q = q.eq('medical_flag', true);
  if (filters.hasPhone) q = q.not('phone', 'is', null);
  if (filters.search) q = q.ilike('business_name', `%${filters.search}%`);
  if (filters.bbox) {
    q = q
      .gte('long', filters.bbox.west)
      .lte('long', filters.bbox.east)
      .gte('lat', filters.bbox.south)
      .lte('lat', filters.bbox.north);
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as HwLead[];
}

/** Latest stage row per lead (own rows only — enforced by RLS). */
export async function fetchHwStages(leadIds?: string[]): Promise<Record<string, HwLeadStage>> {
  let q = supabase
    .from('hw_lead_stages')
    .select('*')
    .order('contacted_at', { ascending: false })
    .limit(5000);
  if (leadIds?.length) q = q.in('lead_id', leadIds);
  const { data, error } = await q;
  if (error) throw error;
  const latest: Record<string, HwLeadStage> = {};
  for (const row of (data ?? []) as HwLeadStage[]) {
    if (!latest[row.lead_id]) latest[row.lead_id] = row;
  }
  return latest;
}

export async function setHwStage(input: {
  lead_id: string;
  stage: HwStage;
  notes?: string;
  contact_method?: string;
  next_action?: string;
  next_action_due?: string | null;
}) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error('You must be signed in to update a stage.');
  const { data, error } = await supabase
    .from('hw_lead_stages')
    .insert({ ...input, team_member: uid })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function logHwOutreach(input: {
  lead_id: string;
  channel: string;
  outcome?: string;
  duration_seconds?: number;
  notes?: string;
}) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error('You must be signed in to log outreach.');
  const { data, error } = await supabase
    .from('hw_outreach_log')
    .insert({ ...input, team_member: uid })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchHwOutreach(leadId: string) {
  const { data, error } = await supabase
    .from('hw_outreach_log')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchHwStateCounts() {
  const { data, error } = await supabase.from('v_hw_state_counts').select('*');
  if (error) throw error;
  return data ?? [];
}

export function toCsv(rows: Record<string, any>[]): string {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const esc = (v: any) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n');
}

export function downloadCsv(filename: string, rows: Record<string, any>[]) {
  const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
