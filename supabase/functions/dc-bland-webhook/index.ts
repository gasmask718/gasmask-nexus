import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";
import { canonicalizeDisposition } from "../_shared/dnc.ts";
import { logLeadSync } from "../_shared/dc_sync_log.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // === SHARED-SECRET WEBHOOK VERIFICATION ===
  // Bland's webhook delivery does not include a verifiable HMAC/signature in
  // their current public API surface, so we require a shared-secret query
  // param (?secret=<DC_BLAND_WEBHOOK_SECRET>) OR header (x-dc-webhook-secret).
  // The dispatch side registers the webhook URL with this secret baked in.
  const expectedSecret = Deno.env.get('DC_BLAND_WEBHOOK_SECRET');
  if (expectedSecret) {
    const url = new URL(req.url);
    const providedSecret = url.searchParams.get('secret')
      || req.headers.get('x-dc-webhook-secret')
      || '';
    if (providedSecret !== expectedSecret) {
      console.warn('[dc-bland-webhook] rejected — invalid/missing secret');
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } else {
    console.warn('[dc-bland-webhook] DC_BLAND_WEBHOOK_SECRET not configured — accepting unverified webhook');
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );


    const payload = await req.json();
    const callId = payload.call_id || payload.callId || payload.id;
    if (!callId) throw new Error('No call_id in webhook');

    const { data: existingQueueCall } = await supabase
      .from('dynasty_call_queue')
      .select('status')
      .eq('bland_call_id', callId)
      .maybeSingle();

    if (existingQueueCall?.status === 'cancelled') {
      console.log('[WEBHOOK IGNORED] Call already cancelled:', callId);
      return new Response(JSON.stringify({ success: true, skipped: 'already_cancelled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const event = payload.event || payload.type || null;
    console.log('[BLAND WEBHOOK]', event || 'completion', callId);

    // === LIVE EVENTS (Phase 3): ringing / answered / transcript / failed ===
    // These short-circuit BEFORE the existing end-of-call analysis flow.
    if (event) {
      const liveEvents = new Set([
        'call_started', 'call.ringing', 'queue_status',
        'call_answered', 'call.answered',
        'transcript', 'call.transcript', 'transcript_partial',
        'call_failed', 'call.failed', 'call_error',
      ]);

      if (liveEvents.has(event)) {
        // Look up business_type from queue for this call
        const { data: queueRow } = await supabase
          .from('dynasty_call_queue')
          .select('business_type')
          .eq('bland_call_id', callId)
          .maybeSingle();
        const businessType = queueRow?.business_type || null;

        const upsertHistory = async (patch: Record<string, unknown>) => {
          const { data: existing } = await supabase
            .from('dynasty_call_history')
            .select('id')
            .eq('call_id', callId)
            .maybeSingle();

          if (existing) {
            await supabase.from('dynasty_call_history').update(patch).eq('call_id', callId);
          } else {
            await supabase.from('dynasty_call_history').insert({
              call_id: callId,
              phone_number: payload.to,
              from_number: payload.from,
              business_type: businessType,
              status: (patch.status as string) || 'initiated',
              started_at: new Date().toISOString(),
              ...patch,
            });
          }
        };

        switch (event) {
          case 'call_started':
          case 'call.ringing':
          case 'queue_status':
            await upsertHistory({ status: 'ringing', rang_at: new Date().toISOString() });
            await supabase.from('dynasty_call_queue')
              .update({ status: 'calling', called_at: new Date().toISOString() })
              .eq('bland_call_id', callId);
            break;

          case 'call_answered':
          case 'call.answered':
            await upsertHistory({ status: 'in-progress', answered_at: new Date().toISOString() });
            await supabase.from('dynasty_call_queue')
              .update({ status: 'in-progress' })
              .eq('bland_call_id', callId);
            break;

          case 'transcript':
          case 'call.transcript':
          case 'transcript_partial':
            await supabase.from('dynasty_call_transcripts').insert({
              call_id: callId,
              timestamp: payload.timestamp || Date.now(),
              speaker: (payload.speaker === 'user' || payload.user === 'user') ? 'prospect' : 'ai',
              text: payload.text || payload.transcript || '',
            });
            break;

          case 'call_failed':
          case 'call.failed':
          case 'call_error':
            await upsertHistory({
              status: 'failed',
              ended_at: new Date().toISOString(),
              error_message: payload.error_message || payload.error || 'unknown',
            });
            await supabase.from('dynasty_call_queue')
              .update({
                status: 'failed',
                error_message: payload.error_message || payload.error || 'unknown',
              })
              .eq('bland_call_id', callId);
            break;
        }

        return new Response(JSON.stringify({ success: true, event }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // === END-OF-CALL COMPLETION (existing flow) ===
    // Also mirror completion into dynasty_call_history for the live monitoring UI.
    try {
      const { data: existing } = await supabase
        .from('dynasty_call_history')
        .select('id')
        .eq('call_id', callId)
        .maybeSingle();

      // Look up business_type from queue
      const { data: queueRow } = await supabase
        .from('dynasty_call_queue')
        .select('business_type')
        .eq('bland_call_id', callId)
        .maybeSingle();

      const completionPatch: Record<string, unknown> = {
        status: 'completed',
        ended_at: new Date().toISOString(),
        duration: payload.call_length || payload.duration || payload.call_duration || payload.corrected_duration || null,
        recording_url: payload.recording_url || payload.recording || null,
        call_summary: payload.summary || payload.concatenated_transcript || payload.transcript || null,
        variables: payload.variables || payload.analysis || null,
      };
      console.log('[COMPLETION DATA]', completionPatch);

      if (existing) {
        await supabase.from('dynasty_call_history').update(completionPatch).eq('call_id', callId);
      } else {
        await supabase.from('dynasty_call_history').insert({
          call_id: callId,
          phone_number: payload.to,
          from_number: payload.from,
          business_type: queueRow?.business_type || null,
          started_at: new Date().toISOString(),
          ...completionPatch,
        });
      }
    } catch (e) {
      console.error('[history mirror failed]', e);
    }

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

              // Fetch call record to check source tracking
              const { data: callData } = await supabase
                .from('dynasty_ai_calls')
                .select('*')
                .eq('call_id', callId)
                .single();

              // Sync back to Brandaro source lead if applicable
              if (callData?.source_table === 'brandaro_qualified_leads' && callData?.source_lead_id) {
                const analysisSummary = {
                  overall_score: analysis.overall_score,
                  lead_quality: analysis.lead_quality,
                  what_went_well: analysis.what_went_well,
                  what_to_improve: analysis.what_to_improve,
                  specific_coaching: analysis.specific_coaching,
                  recommended_followup: analysis.recommended_followup,
                  customer_sentiment: analysis.customer_sentiment,
                };

                await supabase
                  .from('brandaro_qualified_leads')
                  .update({
                    dc_call_id: callId,
                    last_dc_call_date: new Date().toISOString(),
                    total_dc_calls: undefined, // trigger handles increment
                    call_source: 'dynasty_connect',
                    claude_analysis_summary: analysisSummary,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', callData.source_lead_id);

                console.log(`Synced DC call ${callId} back to Brandaro lead ${callData.source_lead_id}`);
              }

              // Auto-create pipeline entry for hot/warm leads
              if (['hot', 'warm'].includes(analysis.lead_quality)) {
                if (callData) {
                  // Dynasty pipeline
                  await supabase.from('dynasty_lead_pipeline').insert({
                    call_id: callId,
                    business_unit: callData.business_unit,
                    contact_name: callData.contact_name,
                    company_name: callData.company_name,
                    phone_number: callData.to_number,
                    stage: analysis.lead_quality === 'hot' ? 'hot' : 'warm',
                  });

                  // Brandaro close pipeline (if from Brandaro)
                  if (callData.source_table === 'brandaro_qualified_leads' && callData.source_lead_id) {
                    await supabase.from('brandaro_close_pipeline').upsert({
                      lead_id: callData.source_lead_id,
                      stage: analysis.lead_quality,
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    }, { onConflict: 'lead_id' });
                  }
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

    // === DUAL-WRITE BACK TO SOURCE HUB (Surplus Funds / Real Estate) ===
    try {
      const requestData = payload.request_data || payload.variables || {};
      let sourceHub: string | null = requestData.hub || null;
      let leadId: string | null = requestData.lead_id || null;

      if (!sourceHub || !leadId) {
        const { data: dcLead } = await supabase
          .from('dc_leads')
          .select('external_ref_id, lead_type, business_id')
          .eq('phone', payload.to)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (dcLead) {
          leadId = leadId || dcLead.external_ref_id;
          sourceHub = sourceHub || dcLead.business_id || (dcLead.lead_type?.startsWith('surplus_funds') ? 'surplus_funds' : dcLead.lead_type?.startsWith('re_') ? 're' : null);
        }
      }

      if (sourceHub && leadId) {
        const rawDisposition = (payload.disposition || payload.status || '').toLowerCase();
        // Canonical disposition code (see public.dc_disposition_codes).
        // Unknown values fall back to 'called' (logged inside canonicalizeDisposition).
        const canonical = canonicalizeDisposition(rawDisposition);
        const recordingUrl = payload.recording_url || payload.recording || null;
        const callTranscript = payload.concatenated_transcript || payload.transcript || null;

        if (sourceHub === 'surplus_funds') {
          // Capture status_before for sync log instrumentation (Step 5).
          const { data: prevSf } = await supabase
            .from('surplus_funds_leads').select('status').eq('id', leadId).maybeSingle();
          await supabase.rpc('increment_call_count', { row_id: leadId, target_table: 'surplus_funds_leads' });
          const { error: sfUpdateErr } = await supabase.from('surplus_funds_leads').update({
            status: canonical,
            last_called_at: new Date().toISOString(),
            call_outcome: canonical,
            call_recording_url: recordingUrl,
            call_transcript: callTranscript,
            bland_call_id: callId,
            interest_level: canonical === 'interested' ? 'high' : canonical === 'not_interested' ? 'low' : null,
          }).eq('id', leadId);

          // Step 5 sync log — instrumentation only, never alters behavior.
          await logLeadSync(supabase, {
            business_unit_key: 'surplus_funds',
            lead_id: leadId,
            sync_direction: 'out',
            status_before: prevSf?.status || null,
            status_after: canonical,
            sync_source: 'dc-bland-webhook:surplus_funds',
            success: !sfUpdateErr,
            error_message: sfUpdateErr?.message || null,
          });

          if (canonical === 'interested' && callTranscript) {
            // Cutover: dc-post-call-analysis is the unified entry point.
            // sf-post-call-analysis remains deployed but @deprecated.
            supabase.functions.invoke('dc-post-call-analysis', {
              body: { business_unit_key: 'surplus_funds', lead_id: leadId, transcript: callTranscript, call_id: callId },
            }).catch((e) => console.error('[dc-post-call-analysis (surplus_funds) invoke failed]', e));
          }
        } else if (sourceHub === 're') {
          // Capture status_before for sync log instrumentation (Step 5).
          const { data: prevRe } = await supabase
            .from('re_leads').select('status').eq('id', leadId).maybeSingle();
          await supabase.rpc('increment_call_count', { row_id: leadId, target_table: 're_leads' });
          const { error: reUpdateErr } = await supabase.from('re_leads').update({
            status: canonical,
            last_called_at: new Date().toISOString(),
            call_outcome: canonical,
            call_recording_url: recordingUrl,
            call_transcript: callTranscript,
            bland_call_id: callId,
          }).eq('id', leadId);

          // Step 5 sync log — instrumentation only, never alters behavior.
          await logLeadSync(supabase, {
            business_unit_key: 'real_estate',
            lead_id: leadId,
            sync_direction: 'out',
            status_before: prevRe?.status || null,
            status_after: canonical,
            sync_source: 'dc-bland-webhook:real_estate',
            success: !reUpdateErr,
            error_message: reUpdateErr?.message || null,
          });



          if (canonical === 'interested') {
            await supabase.from('re_va_tasks').insert({
              lead_id: leadId,
              task_type: 'seller_callback',
              priority: 'urgent',
              status: 'queued',
              notes: `Seller expressed interest on Bland AI call ${callId}. Transcript available.`,
              script: 'Follow up call to qualify property and set appointment.',
              due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            });
            if (callTranscript) {
              // Cutover: dc-post-call-analysis is the unified entry point.
              // re-post-call-analysis remains deployed but @deprecated.
              supabase.functions.invoke('dc-post-call-analysis', {
                body: { business_unit_key: 'real_estate', lead_id: leadId, transcript: callTranscript, call_id: callId },
              }).catch((e) => console.error('[dc-post-call-analysis (real_estate) invoke failed]', e));
            }
          }
        }
      }
    } catch (dualWriteErr) {
      console.error('[dual-write failed]', dualWriteErr);
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
