import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type UTLeadStatus = 'new' | 'contacted' | 'interested' | 'callback' | 'onboarded' | 'dead';
export type UTLeadCategory = 'event_hall' | 'decorator' | 'bartender' | 'caterer' | 'dj' | 'photographer' | 'rental_company' | 'florist' | 'entertainer' | 'staff' | 'other';
export type UTOutreachChannel = 'call' | 'sms' | 'email' | 'ai_call';
export type UTOutreachOutcome = 'no_answer' | 'voicemail' | 'interested' | 'callback' | 'not_interested' | 'closed' | 'wrong_number';

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
}

export interface UTOutreachLog {
  id: string;
  lead_id: string;
  channel: string;
  outcome: string;
  notes: string | null;
  performed_by: string | null;
  duration_seconds: number | null;
  created_at: string;
}

const LEADS_KEY = 'ut-partner-leads';
const LOGS_KEY = 'ut-outreach-logs';

export function useUTPartnerLeads(filters?: { status?: string; category?: string; city?: string }) {
  return useQuery({
    queryKey: [LEADS_KEY, filters],
    queryFn: async () => {
      let query = (supabase.from('ut_partner_leads') as any)
        .select('*')
        .order('ai_score', { ascending: false })
        .order('created_at', { ascending: false });

      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.category) query = query.eq('category', filters.category);
      if (filters?.city) query = query.ilike('city', `%${filters.city}%`);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as UTPartnerLead[];
    },
  });
}

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
      toast.success('Lead updated');
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
    }) => {
      const { error } = await (supabase.from('ut_outreach_logs') as any).insert({
        lead_id: input.lead_id,
        channel: input.channel,
        outcome: input.outcome,
        notes: input.notes || null,
        duration_seconds: input.duration_seconds || null,
      });
      if (error) throw error;

      // Auto-update lead status based on outcome
      const statusMap: Record<string, string> = {
        interested: 'interested',
        callback: 'callback',
        closed: 'onboarded',
        not_interested: 'dead',
      };
      const newStatus = statusMap[input.outcome];
      if (newStatus) {
        await (supabase.from('ut_partner_leads') as any)
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', input.lead_id);
      } else {
        await (supabase.from('ut_partner_leads') as any)
          .update({ status: 'contacted', updated_at: new Date().toISOString() })
          .eq('id', input.lead_id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [LEADS_KEY] });
      qc.invalidateQueries({ queryKey: [LOGS_KEY] });
      toast.success('Outreach logged');
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

  return { createLead, updateLead, logOutreach, deleteLead };
}

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
