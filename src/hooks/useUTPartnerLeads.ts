import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { UT_DISPOSITIONS, UTDispositionValue, UT_SMS_TEMPLATES } from '@/config/utScripts';

export type UTLeadStatus = 'new' | 'contacted' | 'interested' | 'callback' | 'onboarded' | 'dead';
export type UTLeadCategory = 'event_hall' | 'decorator' | 'bartender' | 'caterer' | 'dj' | 'photographer' | 'rental_company' | 'florist' | 'entertainer' | 'staff' | 'security' | 'cleaner' | 'server' | 'other';
export type UTOutreachChannel = 'call' | 'sms' | 'email' | 'ai_call';

export interface UTPartnerLead {
  id: string;
  business_name: string;
  contact_name: string | null;
  category: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  source: string | null;
  status: string;
  assigned_to: string | null;
  ai_score: number;
  ai_score_reasons: any[];
  notes: string | null;
  onboarded_at: string | null;
  created_at: string;
  updated_at: string;
  follow_up_at: string | null;
  callback_due_at: string | null;
  last_contacted_at: string | null;
  last_outcome: string | null;
  outreach_count: number;
  owner_verified: boolean;
  best_time_to_call: string | null;
  assigned_va: string | null;
  priority_bucket: string | null;
  ai_call_eligible: boolean;
  ai_call_last_attempt_at: string | null;
  ai_call_result: string | null;
  ai_handoff_reason: string | null;
  recommended_ai_agent: string | null;
  next_step: string | null;
  onboarding_link_sent_at: string | null;
  last_sms_template: string | null;
  sms_count: number;
  automation_state: string | null;
}

export interface UTOutreachLog {
  id: string;
  lead_id: string;
  channel: string;
  outcome: string;
  notes: string | null;
  performed_by: string | null;
  duration_seconds: number | null;
  template_name: string | null;
  created_at: string;
}

export interface UTOnboardingRecord {
  id: string;
  partner_profile_id: string | null;
  source_lead_id: string | null;
  onboarding_token: string;
  onboarding_link: string | null;
  status: string;
  sent_at: string | null;
  completed_at: string | null;
  created_at: string;
}

const LEADS_KEY = 'ut-partner-leads';
const LOGS_KEY = 'ut-outreach-logs';
const PAGE_SIZE = 50;

// Selective columns for list view (no select('*'))
const LEAD_LIST_COLUMNS = 'id,business_name,contact_name,category,phone,email,city,state,status,ai_score,callback_due_at,follow_up_at,last_outcome,last_contacted_at,outreach_count,next_step,created_at,sms_count,ai_call_eligible,priority_bucket';

// ── Helper: apply queue filters to a query ─────────────────────────
function applyQueueFilters(query: any, filters?: {
  status?: string;
  category?: string;
  city?: string;
  search?: string;
  queueMode?: string;
}) {
  if (!filters) return query;
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.category && filters.category !== 'all') query = query.eq('category', filters.category);
  if (filters.city) query = query.ilike('city', `%${filters.city}%`);
  if (filters.search) {
    query = query.or(`business_name.ilike.%${filters.search}%,contact_name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%,city.ilike.%${filters.search}%`);
  }
  if (filters.queueMode === 'new') query = query.eq('status', 'new');
  if (filters.queueMode === 'callback_due') query = query.eq('status', 'callback').not('callback_due_at', 'is', null);
  if (filters.queueMode === 'interested') query = query.eq('status', 'interested');
  if (filters.queueMode === 'no_answer') query = query.eq('last_outcome', 'no_answer');
  if (filters.queueMode === 'high_score') query = query.gte('ai_score', 70);
  if (filters.queueMode === 'missing_phone') query = query.is('phone', null);
  return query;
}

// ── Paginated Leads Query (selective columns) ─────────────────────
export function useUTPartnerLeads(filters?: {
  status?: string;
  category?: string;
  city?: string;
  search?: string;
  queueMode?: string;
  page?: number;
}) {
  const page = filters?.page || 0;

  return useQuery({
    queryKey: [LEADS_KEY, filters],
    queryFn: async () => {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = (supabase.from('ut_partner_leads') as any)
        .select(LEAD_LIST_COLUMNS, { count: 'exact' })
        .order('callback_due_at', { ascending: true, nullsFirst: false })
        .order('ai_score', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to);

      query = applyQueueFilters(query, filters);

      const { data, error, count } = await query;
      if (error) throw error;
      return {
        leads: (data || []) as UTPartnerLead[],
        totalCount: count as number,
        page,
        pageSize: PAGE_SIZE,
        totalPages: Math.ceil((count || 0) / PAGE_SIZE),
      };
    },
  });
}

// ── Lead Detail Query (full record, on-demand) ────────────────────
export function useUTLeadDetail(leadId?: string) {
  return useQuery({
    queryKey: ['ut-lead-detail', leadId],
    enabled: !!leadId,
    queryFn: async () => {
      const { data, error } = await (supabase.from('ut_partner_leads') as any)
        .select('*')
        .eq('id', leadId)
        .single();
      if (error) throw error;
      return data as UTPartnerLead;
    },
  });
}

// ── Outreach Logs (infinite scroll, selective columns) ─────────────
const LOG_COLUMNS = 'id,lead_id,channel,outcome,notes,template_name,created_at';

export function useUTOutreachLogs(leadId?: string) {
  return useInfiniteQuery({
    queryKey: [LOGS_KEY, leadId],
    enabled: !!leadId,
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = (supabase.from('ut_outreach_logs') as any)
        .select(LOG_COLUMNS, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (leadId) query = query.eq('lead_id', leadId);

      const { data, error, count } = await query;
      if (error) throw error;
      return {
        logs: (data || []) as UTOutreachLog[],
        totalCount: count as number,
        page: pageParam,
      };
    },
    getNextPageParam: (lastPage) => {
      const nextPage = lastPage.page + 1;
      if (nextPage * PAGE_SIZE >= lastPage.totalCount) return undefined;
      return nextPage;
    },
  });
}

// ── Onboarding Record (selective columns) ─────────────────────────
export function useUTOnboarding(leadId?: string) {
  return useQuery({
    queryKey: ['ut-onboarding', leadId],
    enabled: !!leadId,
    queryFn: async () => {
      const { data, error } = await (supabase.from('ut_partner_onboarding') as any)
        .select('id,onboarding_link,status,sent_at,completed_at,onboarding_token')
        .eq('source_lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as UTOnboardingRecord | null;
    },
  });
}

// ── Lead Mutations ─────────────────────────────────────────────────
export function useUTLeadMutations() {
  const qc = useQueryClient();
  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: [LEADS_KEY] });
    qc.invalidateQueries({ queryKey: [LOGS_KEY] });
    qc.invalidateQueries({ queryKey: ['ut-lead-stats'] });
    qc.invalidateQueries({ queryKey: ['ut-va-performance'] });
    qc.invalidateQueries({ queryKey: ['ut-onboarding'] });
  };

  const createLead = useMutation({
    mutationFn: async (input: {
      business_name: string; contact_name?: string; category: string;
      phone?: string; email?: string; city?: string; state?: string; source?: string; notes?: string;
    }) => {
      const { error } = await (supabase.from('ut_partner_leads') as any).insert({
        business_name: input.business_name, contact_name: input.contact_name || null,
        category: input.category, phone: input.phone || null, email: input.email || null,
        city: input.city || null, state: input.state || null, source: input.source || 'manual', notes: input.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); toast.success('Partner lead added'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateLead = useMutation({
    mutationFn: async (input: { id: string } & Partial<UTPartnerLead>) => {
      const { id, ...updates } = input;
      const { error } = await (supabase.from('ut_partner_leads') as any)
        .update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(),
    onError: (e: Error) => toast.error(e.message),
  });

  const saveCallDisposition = useMutation({
    mutationFn: async (input: {
      lead_id: string; channel: UTOutreachChannel; disposition: UTDispositionValue;
      notes?: string; follow_up_at?: string; callback_due_at?: string; template_name?: string;
    }) => {
      const dispo = UT_DISPOSITIONS.find(d => d.value === input.disposition);
      if (!dispo) throw new Error('Invalid disposition');

      const { error: logErr } = await (supabase.from('ut_outreach_logs') as any).insert({
        lead_id: input.lead_id, channel: input.channel, outcome: input.disposition,
        notes: input.notes || null, template_name: input.template_name || null,
      });
      if (logErr) throw logErr;

      const { data: currentLead } = await (supabase.from('ut_partner_leads') as any)
        .select('status, outreach_count').eq('id', input.lead_id).single();

      const statusPriority: Record<string, number> = { dead: 0, new: 1, contacted: 2, callback: 3, interested: 4, onboarded: 5 };
      const currentPriority = statusPriority[currentLead?.status || 'new'] || 0;
      const newStatusPriority = statusPriority[dispo.statusMap] || 0;

      const leadUpdate: any = {
        last_contacted_at: new Date().toISOString(), last_outcome: input.disposition,
        updated_at: new Date().toISOString(), outreach_count: (currentLead?.outreach_count || 0) + 1,
      };

      if (dispo.statusMap === 'dead' || newStatusPriority >= currentPriority) leadUpdate.status = dispo.statusMap;
      if (input.follow_up_at) leadUpdate.follow_up_at = input.follow_up_at;
      if (input.callback_due_at) leadUpdate.callback_due_at = input.callback_due_at;

      if (input.disposition === 'interested') leadUpdate.next_step = 'onboarding';
      if (input.disposition === 'callback_requested') leadUpdate.next_step = 'callback';
      if (input.disposition === 'send_info') leadUpdate.next_step = 'send_info';
      if (input.disposition === 'onboarded') { leadUpdate.onboarded_at = new Date().toISOString(); leadUpdate.next_step = 'completed'; }

      const { error: updateErr } = await (supabase.from('ut_partner_leads') as any).update(leadUpdate).eq('id', input.lead_id);
      if (updateErr) throw updateErr;

      return { disposition: input.disposition, statusMap: dispo.statusMap, lead_id: input.lead_id };
    },
    onSuccess: (result) => {
      invalidateAll();
      const emoji = result.disposition === 'onboarded' ? '🎉' : result.disposition === 'interested' ? '🔥' : '✅';
      toast.success(`${emoji} Disposition saved: ${result.disposition}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendSmsTemplate = useMutation({
    mutationFn: async (input: { lead: UTPartnerLead; templateKey: string; vaName?: string }) => {
      const tpl = UT_SMS_TEMPLATES.find(t => t.key === input.templateKey);
      if (!tpl) throw new Error('Template not found');
      if (!input.lead.phone) throw new Error('Lead has no phone number');

      const body = tpl.body
        .replace(/\[Contact Name\]/g, input.lead.contact_name || 'there')
        .replace(/\[Business Name\]/g, input.lead.business_name)
        .replace(/\[City\]/g, input.lead.city || 'your area')
        .replace(/\[VA Name\]/g, input.vaName || 'Your Partner Rep')
        .replace(/\[LINK\]/g, 'https://unforgettabletimes.com/join');

      const { data } = await supabase.functions.invoke('send-sms', {
        body: { to_number: input.lead.phone, message_body: body, idempotency_key: crypto.randomUUID(),
          metadata: { brand: 'unforgettable_times', template: input.templateKey, lead_id: input.lead.id } },
      });

      await (supabase.from('ut_outreach_logs') as any).insert({
        lead_id: input.lead.id, channel: 'sms', outcome: 'sms_sent',
        notes: `Template: ${tpl.label}`, template_name: input.templateKey,
      });

      await (supabase.from('ut_partner_leads') as any).update({
        last_sms_template: input.templateKey, sms_count: (input.lead.sms_count || 0) + 1,
        last_contacted_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq('id', input.lead.id);

      return { success: data?.success ?? true, templateLabel: tpl.label };
    },
    onSuccess: (result) => { invalidateAll(); toast.success(`📱 ${result.templateLabel} SMS sent`); },
    onError: (e: Error) => toast.error(`SMS failed: ${e.message}`),
  });

  const handoffToPartnerProfile = useMutation({
    mutationFn: async (lead: UTPartnerLead) => {
      const { data: profile, error: profileErr } = await (supabase.from('ut_partner_profiles') as any).upsert({
        lead_id: lead.id, source_lead_id: lead.id, business_name: lead.business_name,
        contact_name: lead.contact_name, category: lead.category, phone: lead.phone,
        email: lead.email, city: lead.city, state: lead.state, onboarding_status: 'pending',
      }, { onConflict: 'lead_id' }).select().single();
      if (profileErr) throw profileErr;

      const token = crypto.randomUUID().replace(/-/g, '').slice(0, 24);
      const link = `https://unforgettabletimes.com/onboard/${token}`;
      const { data: onboarding, error: onbErr } = await (supabase.from('ut_partner_onboarding') as any).insert({
        partner_profile_id: profile?.id || null, source_lead_id: lead.id,
        onboarding_token: token, onboarding_link: link, status: 'pending',
      }).select().single();
      if (onbErr) throw onbErr;

      return { profile, onboarding };
    },
    onSuccess: () => { invalidateAll(); toast.success('🎉 Moved to Partner Profile + onboarding created'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendOnboardingLink = useMutation({
    mutationFn: async (input: { lead: UTPartnerLead; onboardingLink: string; onboardingId: string }) => {
      if (!input.lead.phone) throw new Error('No phone');
      const tpl = UT_SMS_TEMPLATES.find(t => t.key === 'onboarding_link_text')!;
      const body = tpl.body.replace(/\[LINK\]/g, input.onboardingLink).replace(/\[Contact Name\]/g, input.lead.contact_name || 'there');

      await supabase.functions.invoke('send-sms', {
        body: { to_number: input.lead.phone, message_body: body, idempotency_key: crypto.randomUUID(),
          metadata: { brand: 'unforgettable_times', template: 'onboarding_link_text', lead_id: input.lead.id } },
      });

      await (supabase.from('ut_partner_onboarding') as any).update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', input.onboardingId);
      await (supabase.from('ut_partner_leads') as any).update({ onboarding_link_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', input.lead.id);
      await (supabase.from('ut_outreach_logs') as any).insert({ lead_id: input.lead.id, channel: 'sms', outcome: 'onboarding_link_sent', template_name: 'onboarding_link_text' });
    },
    onSuccess: () => { invalidateAll(); toast.success('📱 Onboarding link sent'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteLead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from('ut_partner_leads') as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); toast.success('Lead deleted'); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { createLead, updateLead, saveCallDisposition, sendSmsTemplate, handoffToPartnerProfile, sendOnboardingLink, deleteLead };
}

// ── Stats (database-computed via RPC) ──────────────────────────────
export function useUTLeadStats() {
  return useQuery({
    queryKey: ['ut-lead-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ut_get_lead_stats' as any);
      if (error) throw error;
      return data as {
        total: number;
        by_status: Record<string, number>;
        by_category: Record<string, { total: number; onboarded: number }>;
        by_city: Record<string, { total: number; onboarded: number }>;
        by_source: Record<string, number>;
        avg_score: number;
        avg_touches_to_onboard: number;
      };
    },
  });
}

// ── VA Performance (database-computed via RPC) ─────────────────────
export function useUTVAPerformance() {
  return useQuery({
    queryKey: ['ut-va-performance'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ut_get_va_performance' as any);
      if (error) throw error;
      return data as {
        calls_made: number;
        connected: number;
        interested: number;
        onboarded: number;
        sms_sent: number;
        follow_ups_set: number;
        no_answer_rate: number;
        conversion_rate: number;
      };
    },
    refetchInterval: 30000,
  });
}

// ── Outcome Distribution (database-computed via RPC) ───────────────
export function useUTOutcomeDistribution() {
  return useQuery({
    queryKey: ['ut-outcome-distribution'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ut_get_outcome_distribution' as any);
      if (error) throw error;
      return (data || {}) as Record<string, number>;
    },
  });
}
