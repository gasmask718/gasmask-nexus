import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { UT_DISPOSITIONS, UTDispositionValue } from '@/config/utScripts';

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
  // Production fields
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

const LEADS_KEY = 'ut-partner-leads';
const LOGS_KEY = 'ut-outreach-logs';

// ── Leads Query ────────────────────────────────────────────────────
export function useUTPartnerLeads(filters?: {
  status?: string;
  category?: string;
  city?: string;
  search?: string;
  queueMode?: 'all' | 'new' | 'callback_due' | 'interested' | 'no_answer' | 'high_score' | 'missing_phone';
}) {
  return useQuery({
    queryKey: [LEADS_KEY, filters],
    queryFn: async () => {
      let query = (supabase.from('ut_partner_leads') as any)
        .select('*')
        .order('ai_score', { ascending: false })
        .order('created_at', { ascending: false });

      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.category && filters.category !== 'all') query = query.eq('category', filters.category);
      if (filters?.city) query = query.ilike('city', `%${filters.city}%`);
      if (filters?.search) {
        query = query.or(`business_name.ilike.%${filters.search}%,contact_name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%,city.ilike.%${filters.search}%`);
      }

      // Queue mode filters
      if (filters?.queueMode === 'new') query = query.eq('status', 'new');
      if (filters?.queueMode === 'callback_due') {
        query = query.eq('status', 'callback').not('callback_due_at', 'is', null);
      }
      if (filters?.queueMode === 'interested') query = query.eq('status', 'interested');
      if (filters?.queueMode === 'no_answer') query = query.eq('last_outcome', 'no_answer');
      if (filters?.queueMode === 'high_score') query = query.gte('ai_score', 70);
      if (filters?.queueMode === 'missing_phone') query = query.is('phone', null);

      const { data, error } = await query.limit(500);
      if (error) throw error;
      return (data || []) as UTPartnerLead[];
    },
  });
}

// ── Outreach Logs ──────────────────────────────────────────────────
export function useUTOutreachLogs(leadId?: string) {
  return useQuery({
    queryKey: [LOGS_KEY, leadId],
    queryFn: async () => {
      let query = (supabase.from('ut_outreach_logs') as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (leadId) query = query.eq('lead_id', leadId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as UTOutreachLog[];
    },
  });
}

// ── Lead Mutations ─────────────────────────────────────────────────
export function useUTLeadMutations() {
  const qc = useQueryClient();

  const createLead = useMutation({
    mutationFn: async (input: {
      business_name: string;
      contact_name?: string;
      category: string;
      phone?: string;
      email?: string;
      city?: string;
      state?: string;
      source?: string;
      notes?: string;
    }) => {
      const { error } = await (supabase.from('ut_partner_leads') as any).insert({
        business_name: input.business_name,
        contact_name: input.contact_name || null,
        category: input.category,
        phone: input.phone || null,
        email: input.email || null,
        city: input.city || null,
        state: input.state || null,
        source: input.source || 'manual',
        notes: input.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [LEADS_KEY] });
      toast.success('Partner lead added');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateLead = useMutation({
    mutationFn: async (input: { id: string } & Partial<UTPartnerLead>) => {
      const { id, ...updates } = input;
      const { error } = await (supabase.from('ut_partner_leads') as any)
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [LEADS_KEY] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveCallDisposition = useMutation({
    mutationFn: async (input: {
      lead_id: string;
      channel: UTOutreachChannel;
      disposition: UTDispositionValue;
      notes?: string;
      follow_up_at?: string;
      callback_due_at?: string;
      template_name?: string;
    }) => {
      const dispo = UT_DISPOSITIONS.find(d => d.value === input.disposition);
      if (!dispo) throw new Error('Invalid disposition');

      // 1. Log outreach
      const { error: logErr } = await (supabase.from('ut_outreach_logs') as any).insert({
        lead_id: input.lead_id,
        channel: input.channel,
        outcome: input.disposition,
        notes: input.notes || null,
        template_name: input.template_name || null,
      });
      if (logErr) throw logErr;

      // 2. Update lead
      const leadUpdate: any = {
        last_contacted_at: new Date().toISOString(),
        last_outcome: input.disposition,
        updated_at: new Date().toISOString(),
      };

      // Get current lead to check status priority
      const { data: currentLead } = await (supabase.from('ut_partner_leads') as any)
        .select('status, outreach_count')
        .eq('id', input.lead_id)
        .single();

      const statusPriority: Record<string, number> = {
        dead: 0, new: 1, contacted: 2, callback: 3, interested: 4, onboarded: 5
      };
      const currentPriority = statusPriority[currentLead?.status || 'new'] || 0;
      const newStatusPriority = statusPriority[dispo.statusMap] || 0;

      // Only downgrade status for terminal dispositions, otherwise only upgrade
      if (dispo.statusMap === 'dead' || newStatusPriority >= currentPriority) {
        leadUpdate.status = dispo.statusMap;
      }

      // Increment outreach count
      leadUpdate.outreach_count = (currentLead?.outreach_count || 0) + 1;

      if (input.follow_up_at) leadUpdate.follow_up_at = input.follow_up_at;
      if (input.callback_due_at) leadUpdate.callback_due_at = input.callback_due_at;

      if (input.disposition === 'onboarded') {
        leadUpdate.onboarded_at = new Date().toISOString();
      }

      const { error: updateErr } = await (supabase.from('ut_partner_leads') as any)
        .update(leadUpdate)
        .eq('id', input.lead_id);
      if (updateErr) throw updateErr;

      return { disposition: input.disposition, statusMap: dispo.statusMap };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: [LEADS_KEY] });
      qc.invalidateQueries({ queryKey: [LOGS_KEY] });
      qc.invalidateQueries({ queryKey: ['ut-lead-stats'] });
      qc.invalidateQueries({ queryKey: ['ut-va-performance'] });
      const emoji = result.disposition === 'onboarded' ? '🎉' : result.disposition === 'interested' ? '🔥' : '✅';
      toast.success(`${emoji} Disposition saved: ${result.disposition}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const logOutreach = useMutation({
    mutationFn: async (input: {
      lead_id: string;
      channel: string;
      outcome: string;
      notes?: string;
      duration_seconds?: number;
      template_name?: string;
    }) => {
      const { error } = await (supabase.from('ut_outreach_logs') as any).insert({
        lead_id: input.lead_id,
        channel: input.channel,
        outcome: input.outcome,
        notes: input.notes || null,
        duration_seconds: input.duration_seconds || null,
        template_name: input.template_name || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [LEADS_KEY] });
      qc.invalidateQueries({ queryKey: [LOGS_KEY] });
      toast.success('Outreach logged');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handoffToPartnerProfile = useMutation({
    mutationFn: async (lead: UTPartnerLead) => {
      // Create or update partner profile
      const { error } = await (supabase.from('ut_partner_profiles') as any).upsert({
        lead_id: lead.id,
        source_lead_id: lead.id,
        business_name: lead.business_name,
        contact_name: lead.contact_name,
        category: lead.category,
        phone: lead.phone,
        email: lead.email,
        city: lead.city,
        state: lead.state,
        onboarding_status: 'pending',
      }, { onConflict: 'lead_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [LEADS_KEY] });
      toast.success('🎉 Moved to Partner Profile');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteLead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from('ut_partner_leads') as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [LEADS_KEY] });
      toast.success('Lead deleted');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { createLead, updateLead, saveCallDisposition, logOutreach, handoffToPartnerProfile, deleteLead };
}

// ── Stats ──────────────────────────────────────────────────────────
export function useUTLeadStats() {
  return useQuery({
    queryKey: ['ut-lead-stats'],
    queryFn: async () => {
      const { data, error } = await (supabase.from('ut_partner_leads') as any).select('status, category, ai_score, city');
      if (error) throw error;
      const leads = data || [];

      const byStatus: Record<string, number> = {};
      const byCategory: Record<string, number> = {};
      const byCity: Record<string, number> = {};
      let totalScore = 0;

      for (const l of leads) {
        byStatus[l.status] = (byStatus[l.status] || 0) + 1;
        byCategory[l.category] = (byCategory[l.category] || 0) + 1;
        if (l.city) byCity[l.city] = (byCity[l.city] || 0) + 1;
        totalScore += l.ai_score || 0;
      }

      return {
        total: leads.length,
        byStatus,
        byCategory,
        byCity,
        avgScore: leads.length ? Math.round(totalScore / leads.length) : 0,
      };
    },
  });
}

// ── VA Performance (today) ─────────────────────────────────────────
export function useUTVAPerformance() {
  return useQuery({
    queryKey: ['ut-va-performance'],
    queryFn: async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      
      const { data: logs, error } = await (supabase.from('ut_outreach_logs') as any)
        .select('channel, outcome, created_at')
        .gte('created_at', todayStart.toISOString());
      if (error) throw error;

      const todayLogs = logs || [];
      const callLogs = todayLogs.filter((l: any) => l.channel === 'call' || l.channel === 'ai_call');
      const smsLogs = todayLogs.filter((l: any) => l.channel === 'sms');
      const connected = callLogs.filter((l: any) => !['no_answer', 'wrong_number'].includes(l.outcome));
      const interested = todayLogs.filter((l: any) => l.outcome === 'interested');
      const onboarded = todayLogs.filter((l: any) => l.outcome === 'onboarded');
      const followUps = todayLogs.filter((l: any) => ['callback_requested', 'follow_up_required', 'voicemail_left'].includes(l.outcome));
      const noAnswer = callLogs.filter((l: any) => l.outcome === 'no_answer');

      return {
        callsMade: callLogs.length,
        connected: connected.length,
        interested: interested.length,
        onboarded: onboarded.length,
        smsSent: smsLogs.length,
        followUpsSet: followUps.length,
        noAnswerRate: callLogs.length > 0 ? Math.round((noAnswer.length / callLogs.length) * 100) : 0,
        conversionRate: connected.length > 0 ? Math.round((interested.length / connected.length) * 100) : 0,
      };
    },
    refetchInterval: 30000, // Refresh every 30s
  });
}
