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
        system: 'You analyze call transcripts for a wholesale real estate company. Extract structured data from the conversation. Return JSON only.',
        messages: [{
          role: 'user',
          content: `Analyze this call transcript and return JSON only:
{
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

    const motivationScoreMap: Record<string, number> = { high: 9, medium: 6, low: 3 };
    const update: Record<string, any> = {
      interest_score: analysis.interest_score,
      interest_level: analysis.interest_level,
      ai_summary: analysis.summary,
      recommended_action: analysis.recommended_action,
      appointment_time: analysis.appointment_time,
      seller_motivation_score: motivationScoreMap[analysis.seller_motivation] ?? null,
      motivation: analysis.seller_motivation,
      timeline: analysis.timeline_to_sell,
      updated_at: new Date().toISOString(),
    };
    if (analysis.asking_price_mentioned) update.asking_price = analysis.asking_price_mentioned;

    let wouldInsertTask: Record<string, any> | null = null;
    if (analysis.recommended_action === 'book_appointment') {
      wouldInsertTask = {
        lead_id,
        task_type: 'appointment_set',
        priority: 'urgent',
        status: 'queued',
        notes: `AI recommends booking appointment. Summary: ${analysis.summary}`,
        script: 'Confirm appointment time and qualify property details.',
        due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
    }

    if (!isDryRun) {
      await supabase.from('re_leads').update(update).eq('id', lead_id);
      if (wouldInsertTask) {
        await supabase.from('re_va_tasks').insert(wouldInsertTask);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      dry_run: isDryRun,
      analysis,
      call_id,
      would_update: { table: 're_leads', lead_id, payload: update },
      would_post_process: wouldInsertTask ? { table: 're_va_tasks', payload: wouldInsertTask } : null,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[re-post-call-analysis] error', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
