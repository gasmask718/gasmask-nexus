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

    const payload = await req.json();
    const callId = payload.call_id;
    if (!callId) throw new Error('No call_id in webhook');

    // Update call record
    const updateData: any = {
      duration_seconds: payload.call_length || payload.duration,
      transcript: payload.concatenated_transcript || payload.transcript,
      recording_url: payload.recording_url,
      outcome: payload.status === 'completed' ? 'completed' : payload.status || 'completed',
      call_ended_at: new Date().toISOString(),
    };

    await supabase.from('dynasty_ai_calls').update(updateData).eq('call_id', callId);

    // Update queue
    await supabase.from('dynasty_call_queue').update({
      status: 'completed', completed_at: new Date().toISOString(),
    }).eq('bland_call_id', callId);

    // Run Claude analysis if we have a transcript
    const transcript = payload.concatenated_transcript || payload.transcript;
    if (transcript) {
      const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
      if (ANTHROPIC_API_KEY) {
        try {
          const analysisRes = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key': ANTHROPIC_API_KEY,
              'anthropic-version': '2023-06-01',
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 2000,
              messages: [{
                role: 'user',
                content: `Analyze this sales call transcript and return a JSON object with these fields:
{
  "overall_score": (1-10),
  "rapport_score": (1-10),
  "objection_handling_score": (1-10),
  "qualification_score": (1-10),
  "closing_score": (1-10),
  "energy_score": (1-10),
  "lead_quality": "hot"|"warm"|"cold"|"dead",
  "what_went_well": ["point1", "point2"],
  "what_to_improve": ["point1", "point2"],
  "best_moment": "quote from transcript",
  "worst_moment": "quote from transcript",
  "specific_coaching": "coaching paragraph",
  "customer_sentiment": "positive"|"neutral"|"negative",
  "objections_raised": ["objection1"],
  "recommended_followup": "followup recommendation",
  "callback_timing": "when to call back"
}

TRANSCRIPT:
${transcript}`
              }],
            }),
          });

          const analysisData = await analysisRes.json();
          const content = analysisData.content?.[0]?.text;
          if (content) {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const analysis = JSON.parse(jsonMatch[0]);
              await supabase.from('dynasty_call_analysis').insert({
                call_id: callId,
                overall_score: analysis.overall_score,
                rapport_score: analysis.rapport_score,
                objection_handling_score: analysis.objection_handling_score,
                qualification_score: analysis.qualification_score,
                closing_score: analysis.closing_score,
                energy_score: analysis.energy_score,
                what_went_well: analysis.what_went_well,
                what_to_improve: analysis.what_to_improve,
                best_moment: analysis.best_moment,
                worst_moment: analysis.worst_moment,
                specific_coaching: analysis.specific_coaching,
                customer_sentiment: analysis.customer_sentiment,
                objections_raised: analysis.objections_raised,
                recommended_followup: analysis.recommended_followup,
                callback_timing: analysis.callback_timing,
                claude_model: 'claude-sonnet-4-20250514',
                analyzed_at: new Date().toISOString(),
              });

              // Update lead quality on call record
              await supabase.from('dynasty_ai_calls').update({
                lead_quality: analysis.lead_quality,
              }).eq('call_id', callId);

              // Auto-create pipeline entry for hot/warm leads
              if (['hot', 'warm'].includes(analysis.lead_quality)) {
                const { data: callData } = await supabase
                  .from('dynasty_ai_calls')
                  .select('*')
                  .eq('call_id', callId)
                  .single();

                if (callData) {
                  await supabase.from('dynasty_lead_pipeline').insert({
                    call_id: callId,
                    business_unit: callData.business_unit,
                    contact_name: callData.contact_name,
                    company_name: callData.company_name,
                    phone_number: callData.to_number,
                    stage: analysis.lead_quality === 'hot' ? 'hot' : 'warm',
                  });
                }
              }

              // Track objections
              if (analysis.objections_raised?.length) {
                for (const obj of analysis.objections_raised) {
                  const { data: existing } = await supabase
                    .from('dynasty_objection_library')
                    .select('*')
                    .eq('objection_text', obj)
                    .single();

                  if (existing) {
                    await supabase.from('dynasty_objection_library').update({
                      times_encountered: (existing.times_encountered || 0) + 1,
                      last_seen_at: new Date().toISOString(),
                    }).eq('id', existing.id);
                  } else {
                    await supabase.from('dynasty_objection_library').insert({
                      objection_text: obj,
                      objection_category: 'uncategorized',
                      times_encountered: 1,
                      first_seen_at: new Date().toISOString(),
                      last_seen_at: new Date().toISOString(),
                    });
                  }
                }
              }
            }
          }
        } catch (analysisError) {
          console.error('Claude analysis failed:', analysisError);
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
