import { supabase } from '@/integrations/supabase/client';

export const DD_STAGES = [
  'not_contacted',
  'contacted',
  'interested',
  'sampling',
  'active',
  'lost',
] as const;
export type DdStage = (typeof DD_STAGES)[number];

export const DD_STAGE_LABELS: Record<DdStage, string> = {
  not_contacted: 'Not Contacted',
  contacted: 'Contacted',
  interested: 'Interested',
  sampling: 'Sampling',
  active: 'Active',
  lost: 'Lost',
};

export const DD_STAGE_COLORS: Record<DdStage, string> = {
  not_contacted: '#6b7280',
  contacted: '#3b82f6',
  interested: '#06b6d4',
  sampling: '#eab308',
  active: '#22c55e',
  lost: '#ef4444',
};

export const DD_CHANNELS = ['call', 'email', 'sms', 'in_person'] as const;

export interface DdLead {
  id: string;
  business_name: string;
  address_line: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone_e164: string | null;
  website: string | null;
  lead_type: string | null;
  category: string | null;
  lat: number | null;
  lng: number | null;
  business: string | null;
  source: string | null;
  source_payload: any;
  created_at: string;
}

export interface DdStageRow {
  id: string;
  wholesaler_id: string;
  stage: string;
  notes: string | null;
  team_member: string | null;
  contacted_at: string;
  next_action: string | null;
  next_action_due: string | null;
}

export interface DdLeadFilters {
  states?: string[];
  leadType?: 'wholesaler' | 'retail_store' | null;
  hasPhone?: boolean;
  search?: string;
  bbox?: { west: number; south: number; east: number; north: number } | null;
  limit?: number;
}

const DD_COLS =
  'id,business_name,address_line,city,state,zip,phone_e164,website,lead_type,category,lat,lng,business,source,source_payload,created_at';

/** Dynasty Direct leads live in public.leads, tagged business='dynasty_direct'. */
export async function fetchDdLeads(filters: DdLeadFilters = {}): Promise<DdLead[]> {
  let q = supabase
    .from('leads')
    .select(DD_COLS)
    .eq('business', 'dynasty_direct')
    .limit(filters.limit ?? 2000);

  if (filters.states?.length) q = q.in('state', filters.states);
  if (filters.leadType) q = q.eq('lead_type', filters.leadType);
  if (filters.hasPhone) q = q.not('phone_e164', 'is', null);
  if (filters.search) q = q.ilike('business_name', `%${filters.search}%`);
  if (filters.bbox) {
    q = q
      .gte('lng', filters.bbox.west)
      .lte('lng', filters.bbox.east)
      .gte('lat', filters.bbox.south)
      .lte('lat', filters.bbox.north);
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as DdLead[];
}

export async function fetchDdStages(ids?: string[]): Promise<Record<string, DdStageRow>> {
  let q = supabase
    .from('dd_wholesaler_stages')
    .select('*')
    .order('contacted_at', { ascending: false })
    .limit(5000);
  if (ids?.length) q = q.in('wholesaler_id', ids);
  const { data, error } = await q;
  if (error) throw error;
  const latest: Record<string, DdStageRow> = {};
  for (const row of (data ?? []) as DdStageRow[]) {
    if (!latest[row.wholesaler_id]) latest[row.wholesaler_id] = row;
  }
  return latest;
}

export async function setDdStage(input: {
  wholesaler_id: string;
  stage: DdStage;
  notes?: string;
  next_action?: string;
  next_action_due?: string | null;
}) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error('You must be signed in to update a stage.');
  const { data, error } = await supabase
    .from('dd_wholesaler_stages')
    .insert({ ...input, team_member: uid })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function logDdOutreach(input: {
  wholesaler_id: string;
  channel: string;
  outcome?: string;
  notes?: string;
}) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error('You must be signed in to log outreach.');
  const { data, error } = await supabase
    .from('dd_outreach_log')
    .insert({ ...input, team_member: uid })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchDdOutreach(wholesalerId: string) {
  const { data, error } = await supabase
    .from('dd_outreach_log')
    .select('*')
    .eq('wholesaler_id', wholesalerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchDdStateCounts() {
  const { data, error } = await supabase.from('v_dd_state_counts').select('*');
  if (error) throw error;
  return data ?? [];
}
