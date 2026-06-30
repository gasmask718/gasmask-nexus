// Generic Dynasty Connect post-call analysis.
// Accepts a business_unit_key + call_log_id (and/or lead_id + transcript),
// looks up dc_business_units.lead_table_name, runs the shared Claude analysis
// for that unit, and writes the structured result back to the lead row.
//
// Drop-in replacement target for sf-post-call-analysis / re-post-call-analysis.
// Old functions remain deployed until manual cutover.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

type PostProcessPayload = { table: string; payload: Record<string, any> } | null;

type AnalysisConfig = {
  systemPrompt: string;
  jsonSchema: string;
  applyUpdate: (analysis: any) => Record<string, any>;
  buildPostProcess?: (leadId: string, analysis: any) => PostProcessPayload;
};

const ANALYSIS_CONFIGS: Record<string, AnalysisConfig> = {
  surplus_funds: {
    systemPrompt: 'You analyze call transcripts for a surplus funds recovery company. Extract structured data from the conversation. Return JSON only.',
    jsonSchema: `{
  "interest_level": "high"|"medium"|"low"|"none",
  "interest_score": 1-10,
  "claimant_confirmed_identity": true|false,
  "claimant_knows_about_funds": true|false,
  "key_objections": [],
  "agreed_to_callback": true|false,
  "callback_time": string|null,
  "email_provided": string|null,
  "sentiment": "positive"|"neutral"|"negative",
  "red_flags": [],
  "recommended_action": "send_contract"|"schedule_callback"|"attorney_review"|"remove"|"monitor",
  "summary": string
}`,
    applyUpdate: (a) => {
      const update: Record<string, any> = {
        interest_score: a.interest_score,
        interest_level: a.interest_level,
        ai_summary: a.summary,
        recommended_action: a.recommended_action,
        callback_time: a.callback_time,
        updated_at: new Date().toISOString(),
      };
      if (a.email_provided) update.email = a.email_provided;
      return update;
    },
  },
  real_estate: {
    systemPrompt: 'You analyze call transcripts for a wholesale real estate company. Extract structured data from the conversation. Return JSON only.',
    jsonSchema: `{
  "interest_level": "high"|"medium"|"low"|"none",
  "interest_score": 1-10,
  "seller_motivation": "high"|"medium"|"low",
  "timeline_to_sell": string|null,
  "mortgage_situation": string|null,
  "property_condition": string|null,
  "asking_price_mentioned": number|null,
  "agreed_to_appointment": true|false,
  "appointment_time": string|null,
  "key_objections": [],
  "sentiment": "positive"|"neutral"|"negative",
  "recommended_action": "book_appointment"|"send_offer"|"warm_follow_up"|"remove"|"skip_trace",
  "summary": string
}`,
    applyUpdate: (a) => {
      const motivationScoreMap: Record<string, number> = { high: 9, medium: 6, low: 3 };
      const update: Record<string, any> = {
        interest_score: a.interest_score,
        interest_level: a.interest_level,
        ai_summary: a.summary,
        recommended_action: a.recommended_action,
        appointment_time: a.appointment_time,
        seller_motivation_score: motivationScoreMap[a.seller_motivation] ?? null,
        motivation: a.seller_motivation,
        timeline: a.timeline_to_sell,
        updated_at: new Date().toISOString(),
      };
      if (a.asking_price_mentioned) update.asking_price = a.asking_price_mentioned;
      return update;
    },
    postProcess: async (supabase, leadId, a) => {
      if (a.recommended_action === 'book_appointment') {
        await supabase.from('re_va_tasks').insert({
          lead_id: leadId,
          task_type: 'appointment_set',
          priority: 'urgent',
          status: 'queued',
          notes: `AI recommends booking appointment. Summary: ${a.summary}`,
          script: 'Confirm appointment time and qualify property details.',
          due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        });
      }
    },
  },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured');

    const body = await req.json();
    const businessUnitKey: string = body.business_unit_key || body.hub;
    const leadId: string | undefined = body.lead_id;
    const callId: string | undefined = body.call_id || body.call_log_id;
    let transcript: string | undefined = body.transcript;

    if (!businessUnitKey) throw new Error('business_unit_key required');
    if (!leadId) throw new Error('lead_id required');

    const config = ANALYSIS_CONFIGS[businessUnitKey];
    if (!config) {
      throw new Error(`No analysis config registered for business_unit_key="${businessUnitKey}"`);
    }

    // Resolve lead table from registry
    const { data: unit, error: unitErr } = await supabase
      .from('dc_businesses')
      .select('business_key, lead_table_name, sync_enabled')
      .eq('business_key', businessUnitKey)
      .maybeSingle();
    if (unitErr) throw new Error(`registry lookup failed: ${unitErr.message}`);
    if (!unit?.lead_table_name) {
      throw new Error(`dc_businesses.lead_table_name not set for ${businessUnitKey}`);
    }
    const leadTable = unit.lead_table_name as string;

    // If transcript not provided, try pulling from dynasty_ai_calls by call_id
    if (!transcript && callId) {
      const { data: call } = await supabase
        .from('dynasty_ai_calls')
        .select('transcript')
        .eq('call_id', callId)
        .maybeSingle();
      transcript = call?.transcript || undefined;
    }
    if (!transcript) throw new Error('transcript required (provide directly or via resolvable call_id)');

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 1200,
        system: config.systemPrompt,
        messages: [{
          role: 'user',
          content: `Analyze this call transcript and return JSON only — no other text:\n${config.jsonSchema}\n\nTranscript:\n${transcript}`,
        }],
      }),
    });
    const claudeJson = await claudeRes.json();
    const text = claudeJson.content?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON in Claude response');
    const analysis = JSON.parse(match[0]);

    const update = config.applyUpdate(analysis);
    const { error: updateErr } = await supabase.from(leadTable).update(update).eq('id', leadId);
    if (updateErr) throw new Error(`lead update failed: ${updateErr.message}`);

    if (config.postProcess) {
      try { await config.postProcess(supabase, leadId, analysis); }
      catch (e) { console.error(`[dc-post-call-analysis] postProcess(${businessUnitKey}) failed`, e); }
    }

    return new Response(JSON.stringify({
      success: true,
      business_unit_key: businessUnitKey,
      lead_table: leadTable,
      analysis,
      call_id: callId,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('[dc-post-call-analysis] error', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
