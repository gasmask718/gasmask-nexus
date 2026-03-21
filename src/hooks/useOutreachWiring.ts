import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

/**
 * Wire outreach call outcomes to Floor 9 infrastructure
 */
export async function wireCallOutcome(
  outcome: string,
  lead: { id: string; store_name: string; phone?: string },
  languageDetected?: string
) {
  if (outcome === 'interested') {
    await (supabase.from('ai_work_tasks') as any).insert({
      task_title: `Follow up — ${lead.store_name} (interested)`,
      task_details: `Call resulted in interest. Follow up to close.${languageDetected ? ` Language: ${languageDetected}` : ''}`,
      status: 'pending',
      priority: 'high',
      task_type: 'interest_follow_up',
      department: 'sales',
      input_data: { lead_id: lead.id, store_name: lead.store_name, phone: lead.phone },
    });

    await (supabase.from('ai_instinct_log') as any).insert({
      action_type: 'call_interest_detected',
      reasoning: `Outbound call to ${lead.store_name} resulted in interest signal`,
      confidence_score: 0.85,
      input_data: { lead_id: lead.id, outcome, language: languageDetected },
    });
  }

  if (outcome === 'converted') {
    await (supabase.from('ai_drift_alerts') as any).insert({
      alert_type: 'lead_converted',
      severity: 'info',
      message: `New store converted: ${lead.store_name} — ready to be added to store profile`,
      status: 'open',
      metadata: { lead_id: lead.id, store_name: lead.store_name, phone: lead.phone },
    });

    await (supabase.from('ai_instinct_log') as any).insert({
      action_type: 'lead_conversion',
      reasoning: `Outbound call converted ${lead.store_name} to active customer`,
      confidence_score: 1.0,
      input_data: { lead_id: lead.id, outcome },
    });
  }

  if (outcome !== 'interested' && outcome !== 'converted') {
    await (supabase.from('ai_instinct_log') as any).insert({
      action_type: 'call_completed',
      reasoning: `Outbound call to ${lead.store_name} completed with outcome: ${outcome}`,
      confidence_score: 0.7,
      input_data: { lead_id: lead.id, outcome, language: languageDetected },
    });
  }
}

export function useOutreachLeads(status?: string) {
  return useQuery({
    queryKey: ['outreach-leads', status],
    queryFn: async () => {
      let query = (supabase.from('outreach_leads') as any)
        .select('*')
        .order('lead_score', { ascending: false })
        .limit(100);

      if (status) query = query.eq('status', status);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });
}

export function useOutreachCalls(leadId?: string) {
  return useQuery({
    queryKey: ['outreach-calls', leadId],
    queryFn: async () => {
      let query = (supabase.from('outreach_calls') as any)
        .select('*')
        .order('call_date', { ascending: false })
        .limit(50);

      if (leadId) query = query.eq('lead_id', leadId);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });
}

export function useActiveScript() {
  return useQuery({
    queryKey: ['active-outreach-script'],
    queryFn: async () => {
      const { data } = await (supabase.from('outreach_scripts') as any)
        .select('*')
        .eq('is_active', true)
        .maybeSingle();
      return data;
    },
  });
}

export function useOutreachSms(leadId?: string) {
  return useQuery({
    queryKey: ['outreach-sms', leadId],
    queryFn: async () => {
      let query = (supabase.from('outreach_sms') as any)
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(50);

      if (leadId) query = query.eq('lead_id', leadId);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });
}

export function useLanguageStats() {
  return useQuery({
    queryKey: ['language-stats'],
    queryFn: async () => {
      const { data, error } = await (supabase.from('outreach_calls') as any)
        .select('language_detected, call_score, outcome')
        .not('language_detected', 'is', null);
      if (error) throw error;

      const stats: Record<string, { count: number; avgScore: number; conversions: number }> = {};
      for (const call of data || []) {
        const lang = call.language_detected || 'unknown';
        if (!stats[lang]) stats[lang] = { count: 0, avgScore: 0, conversions: 0 };
        stats[lang].count++;
        stats[lang].avgScore += call.call_score || 0;
        if (call.outcome === 'converted') stats[lang].conversions++;
      }
      for (const lang of Object.keys(stats)) {
        stats[lang].avgScore = Math.round(stats[lang].avgScore / stats[lang].count);
      }
      return stats;
    },
  });
}
