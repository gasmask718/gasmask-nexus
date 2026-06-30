// @deprecated Use dc-post-call-analysis with business_unit_key='surplus_funds'.
// Retained for parallel parity comparison and rollback. Do not extend.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured');

    const { lead_id, transcript, call_id, dry_run } = await req.json();
    if (!lead_id || !transcript) throw new Error('lead_id and transcript required');
    const isDryRun = dry_run === true;

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
        system: 'You analyze call transcripts for a surplus funds recovery company. Extract structured data from the conversation. Return JSON only.',
        messages: [{
          role: 'user',
          content: `Analyze this call transcript and return JSON only — no other text:
{
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
}

Transcript:
${transcript}`
        }],
      }),
    });
    const claudeJson = await claudeRes.json();
    const text = claudeJson.content?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON in Claude response');
    const analysis = JSON.parse(match[0]);

    const update: Record<string, any> = {
      interest_score: analysis.interest_score,
      interest_level: analysis.interest_level,
      ai_summary: analysis.summary,
      recommended_action: analysis.recommended_action,
      callback_time: analysis.callback_time,
      updated_at: new Date().toISOString(),
    };
    if (analysis.email_provided) update.email = analysis.email_provided;

    if (!isDryRun) {
      await supabase.from('surplus_funds_leads').update(update).eq('id', lead_id);
    }

    return new Response(JSON.stringify({
      success: true,
      dry_run: isDryRun,
      analysis,
      call_id,
      would_update: { table: 'surplus_funds_leads', lead_id, payload: update },
      would_post_process: null,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[sf-post-call-analysis] error', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
