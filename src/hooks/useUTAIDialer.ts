import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { UTPartnerLead } from './useUTPartnerLeads';

/**
 * UT AI Dialer — Twilio → ElevenLabs bridge for outreach calls.
 * Uses the standardized Three-Stage AI Handoff:
 * 1. Greeting (Polly.Joanna TTS)
 * 2. 3s Pause
 * 3. ElevenLabs agent handoff via WebSocket
 */

// Map lead categories to ElevenLabs agent IDs
const CATEGORY_AGENT_MAP: Record<string, string> = {
  // Sales Introduction for new leads
  new: 'agent_0301kmdmp16aevv8svr78pbr75n8',
  // Follow-up for callbacks / interested
  callback: 'agent_3101kmdn5q9tfh7r3padaq6j37r3',
  interested: 'agent_3101kmdn5q9tfh7r3padaq6j37r3',
  // Reactivation for dead / contacted leads with 3+ touches
  reactivation: 'agent_5901kmdnb01sfzs9hp76mz806813',
};

function resolveAgentForLead(lead: UTPartnerLead): string {
  if (lead.status === 'interested' || lead.status === 'callback') {
    return CATEGORY_AGENT_MAP.callback;
  }
  if ((lead.status === 'dead' || lead.status === 'contacted') && lead.outreach_count >= 3) {
    return CATEGORY_AGENT_MAP.reactivation;
  }
  return CATEGORY_AGENT_MAP.new;
}

export function useUTAIDialer() {
  const qc = useQueryClient();

  const placeAICall = useMutation({
    mutationFn: async (input: { lead: UTPartnerLead; agentOverride?: string }) => {
      const { lead, agentOverride } = input;
      if (!lead.phone) throw new Error('Lead has no phone number');

      const agentId = agentOverride || resolveAgentForLead(lead);

      const { data, error } = await supabase.functions.invoke('twilio-outbound-call', {
        body: {
          to_number: lead.phone,
          agent_id: agentId,
          source_table: 'ut_partner_leads',
          source_id: lead.id,
          source_business: 'unforgettable_times',
          metadata: {
            brand: 'unforgettable_times',
            lead_id: lead.id,
            business_name: lead.business_name,
            category: lead.category,
            source_table: 'ut_partner_leads',
            source_id: lead.id,
            source_business: 'unforgettable_times',
          },
        },
      });

      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || 'Call failed');

      // Log the AI call attempt
      await (supabase.from('ut_outreach_logs') as any).insert({
        lead_id: lead.id,
        channel: 'ai_call',
        outcome: 'ai_call_initiated',
        notes: `AI agent: ${agentId}`,
      });

      // Update lead with AI call attempt
      await (supabase.from('ut_partner_leads') as any).update({
        ai_call_last_attempt_at: new Date().toISOString(),
        ai_call_result: 'initiated',
        last_contacted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', lead.id);

      return { success: true, callSid: data?.callSid, agentId };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['ut-partner-leads'] });
      qc.invalidateQueries({ queryKey: ['ut-outreach-logs'] });
      qc.invalidateQueries({ queryKey: ['ut-va-performance'] });
      toast.success(`🤖 AI call initiated (${result.agentId.slice(-8)})`);
    },
    onError: (e: Error) => toast.error(`AI call failed: ${e.message}`),
  });

  const bulkAICall = useMutation({
    mutationFn: async (leads: UTPartnerLead[]) => {
      const results: { leadId: string; success: boolean; error?: string }[] = [];
      
      // Process sequentially with 2s delay to avoid rate limits
      for (const lead of leads) {
        try {
          if (!lead.phone) {
            results.push({ leadId: lead.id, success: false, error: 'No phone' });
            continue;
          }
          await placeAICall.mutateAsync({ lead });
          results.push({ leadId: lead.id, success: true });
          // 2s delay between calls
          await new Promise(r => setTimeout(r, 2000));
        } catch (e: any) {
          results.push({ leadId: lead.id, success: false, error: e.message });
        }
      }

      return results;
    },
    onSuccess: (results) => {
      const success = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      toast.success(`🤖 Bulk AI calls: ${success} initiated, ${failed} failed`);
    },
  });

  return { placeAICall, bulkAICall, resolveAgentForLead };
}
