import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";
import { canonicalizeDisposition } from "../_shared/dnc.ts";
import { logLeadSync } from "../_shared/dc_sync_log.ts";
import { verifiedInsert } from "../_shared/verifiedWrite.ts";
import { isHealthProbe, healthProbeResponse } from "../_shared/healthProbe.ts";

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
    // Liveness probe from comms-health-monitor — answer, never persist.
    if (isHealthProbe(payload)) return healthProbeResponse("dc-bland-webhook", corsHeaders);
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

    // === DUAL-WRITE BACK TO SOURCE HUB (Surplus Funds / Real Estate / TopTier) ===
    // Warnings collected by per-hub branches and surfaced in the final 200 response
    // so silent partial failures (e.g. CHECK violations) are visible upstream.
    const ttWarnings: string[] = [];
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
        // --- Fix C: Bland analysis_schema semantic override (TT-only) ---
        // payload.analysis is populated by Bland's LLM post-call analysis when
        // the dispatch side registered an analysis_schema (see tt-trigger).
        // For the top_tier branch, semantic signals win over payload.disposition
        // / payload.status. Other hubs are unaffected — the override block is
        // gated on sourceHub === 'top_tier' | 'tt'.
        const blandAnalysis = (payload.analysis || null) as Record<string, unknown> | null;
        let semanticDisposition: string | null = null;
        let analysisFlagsExistingPartner = false;

        if ((sourceHub === 'top_tier' || sourceHub === 'tt') && blandAnalysis) {
          if (blandAnalysis.opted_out === true) {
            semanticDisposition = 'dnc';
          } else if (blandAnalysis.already_partner === true) {
            // 'existing_partner' is a stage value, not a canonical disposition —
            // route through a flag that mirrors transcriptFlagsExistingPartner.
            analysisFlagsExistingPartner = true;
          } else if (blandAnalysis.interested === true) {
            semanticDisposition = 'interested';
          } else if (blandAnalysis.callback_requested === true) {
            semanticDisposition = 'callback';
          } else if (blandAnalysis.wrong_vertical === true) {
            semanticDisposition = 'wrong_number';
          }
        }

        // --- Dynasty Direct semantic override ---
        // Wholesaler outreach analysis_schema fields override raw disposition.
        //   opted_out                                     → dnc
        //   reorder_needed OR pitch_interested            → interested
        //   callback_requested OR any_product_low_or_out  → callback
        // Falls through to payload.disposition/payload.status when analysis absent.
        if (sourceHub === 'dynasty_direct' && blandAnalysis) {
          if (blandAnalysis.opted_out === true) {
            semanticDisposition = 'dnc';
          } else if (blandAnalysis.reorder_needed === true || blandAnalysis.pitch_interested === true) {
            semanticDisposition = 'interested';
          } else if (blandAnalysis.callback_requested === true || blandAnalysis.any_product_low_or_out === true) {
            semanticDisposition = 'callback';
          }
        }

        // --- GASMASK semantic override ---
        // Prospect/reactivation outreach analysis fields override raw disposition.
        //   opted_out                              → dnc
        //   wrong_number                           → wrong_number
        //   callback_requested                     → callback
        //   interested OR reorder_needed           → interested
        if (sourceHub === 'gasmask' && blandAnalysis) {
          if (blandAnalysis.opted_out === true) {
            semanticDisposition = 'dnc';
          } else if (blandAnalysis.wrong_number === true) {
            semanticDisposition = 'wrong_number';
          } else if (blandAnalysis.callback_requested === true) {
            semanticDisposition = 'callback';
          } else if (blandAnalysis.interested === true || blandAnalysis.reorder_needed === true) {
            semanticDisposition = 'interested';
          }
        }

        // --- BRANDARO semantic override ---
        // For BRANDARO, semantic override feeds the local brandaroStatus mapping
        // below (values like 'disqualified' / 'sold' / 'hot_lead' are not shared
        // canonicals). We still set semanticDisposition for the shared
        // rawDisposition/canonical path so downstream dc_call_logs.outcome is
        // sensible, but the brandaro branch computes its own lead_status.
        if (sourceHub === 'brandaro' && blandAnalysis) {
          if (blandAnalysis.opted_out === true) {
            semanticDisposition = 'dnc';
          } else if (blandAnalysis.wrong_number === true) {
            semanticDisposition = 'wrong_number';
          } else if (blandAnalysis.callback_requested === true) {
            semanticDisposition = 'callback';
          } else if (blandAnalysis.interested === true) {
            semanticDisposition = 'interested';
          } else if (blandAnalysis.interested === false) {
            semanticDisposition = 'not_interested';
          }
        }

        const rawDisposition = semanticDisposition
          || (payload.disposition || payload.status || '').toLowerCase();
        // Canonical disposition code (see public.dc_disposition_codes).
        // Unknown values fall back to 'called' (logged inside canonicalizeDisposition).
        const canonical = canonicalizeDisposition(rawDisposition);
        const recordingUrl = payload.recording_url || payload.recording || null;
        const callTranscript = payload.concatenated_transcript || payload.transcript || null;

        // --- Fix B Part 2: shared dc_call_logs upsert (all four branches) ---
        // Keyed on call_sid (UNIQUE). Trigger side pre-creates the row; this
        // upsert fills in disposition/duration/recording/transcript on
        // completion, and back-creates the row if the trigger side didn't
        // (SF/RE/UT trigger paths do not yet pre-create). Failure logged as a
        // warning; never rolls back the branch-specific writes below.
        {
          const durationSeconds: number | null =
            typeof payload.corrected_duration === 'number' ? payload.corrected_duration
            : typeof payload.call_length === 'number' ? Math.round(payload.call_length * 60)
            : null;
          const branchBusiness = sourceHub === 'tt' ? 'top_tier'
            : sourceHub === 're' ? 'real_estate'
            : sourceHub === 'ut' ? 'unforgettable_times'
            : sourceHub;
          const gmCohort = (payload.request_data?.cohort_type
            || payload.variables?.cohort_type
            || 'prospect') as string;
          const sourceTable = branchBusiness === 'top_tier' ? 'crm_partners'
            : branchBusiness === 'surplus_funds' ? 'surplus_funds_leads'
            : branchBusiness === 'real_estate' ? 're_leads'
            : branchBusiness === 'unforgettable_times' ? 'ut_leads'
            : branchBusiness === 'dynasty_direct' ? 'wholesalers'
            : branchBusiness === 'gasmask' ? (gmCohort === 'reactivation' ? 'store_master' : 'sales_prospects')
            : branchBusiness === 'brandaro' ? 'brandaro_qualified_leads'
            : null;
          const { error: callLogUpsertErr } = await supabase
            .from('dc_call_logs')
            .upsert({
              call_sid: callId,
              source_business: branchBusiness,
              source_table: sourceTable,
              source_id: leadId,
              business: branchBusiness,
              to_number: payload.to || null,
              from_number: payload.from || null,
              direction: 'outbound',
              status: 'completed',
              outcome: canonical,
              duration_seconds: durationSeconds,
              answered_by: payload.answered_by || null,
              recording_url: recordingUrl,
              transcript: callTranscript,
              agent_type: 'bland',
            }, { onConflict: 'call_sid' });
          if (callLogUpsertErr) {
            console.error('[dc-bland-webhook dc_call_logs upsert failed]', callId, sourceHub, callLogUpsertErr);
            ttWarnings.push(`call_log_upsert_failed: ${callLogUpsertErr.message}`);
          }
        }

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
        } else if (sourceHub === 'unforgettable_times' || sourceHub === 'ut') {
          // Canonical key is 'unforgettable_times' (matches dc_agents.business_unit,
          // ut-trigger-bland-campaign's BUSINESS_UNIT_KEY, and the AddToDNC tool
          // body's source_business). 'ut' is accepted as a defensive alias so a
          // stray short-key dispatch never silently drops on the floor, but every
          // first-party caller uses the long form.
          const { data: prevUt } = await supabase
            .from('ut_partner_leads').select('status, outreach_count').eq('id', leadId).maybeSingle();
          const { error: utUpdateErr } = await supabase.from('ut_partner_leads').update({
            status: canonical,
            ai_call_result: canonical,
            last_outcome: canonical,
            last_contacted_at: new Date().toISOString(),
            outreach_count: (prevUt?.outreach_count || 0) + 1,
          }).eq('id', leadId);

          await logLeadSync(supabase, {
            business_unit_key: 'unforgettable_times',
            lead_id: leadId,
            sync_direction: 'out',
            status_before: prevUt?.status || null,
            status_after: canonical,
            sync_source: 'dc-bland-webhook:unforgettable_times',
            success: !utUpdateErr,
            error_message: utUpdateErr?.message || null,
          });

          if (canonical === 'interested' && callTranscript) {
            supabase.functions.invoke('dc-post-call-analysis', {
              body: { business_unit_key: 'unforgettable_times', lead_id: leadId, transcript: callTranscript, call_id: callId },
            }).catch((e) => console.error('[dc-post-call-analysis (unforgettable_times) invoke failed]', e));
          }
        } else if (sourceHub === 'top_tier' || sourceHub === 'tt') {
          // === TopTier Experience partner-acquisition branch ===
          // Cohort: crm_partners WHERE business_slug='toptier-experience'.
          // lead_id = crm_partners.id (uuid).
          //
          // Disposition → tt_acquisition_stage map (only mutates stage for
          // terminal/decisive outcomes; voicemail/no_answer/called leave the
          // stage as-is so the prospect stays callable next pass).
          //   interested      → pending_vetting   (NOT auto-promote; vetting team owns promotion)
          //   not_interested  → not_interested
          //   dnc             → dnc               (DNC list insertion handled below via transcript fallback,
          //                                        since the AddToDNC Bland tool remains degraded)
          //   wrong_number    → (no stage change) + phone_invalid = true
          //   callback        → callback          + tt_callback_at if parseable
          //   voicemail / no_answer / called → no stage change
          //
          // tt_last_disposition, tt_call_attempts, tt_last_call_at update on
          // EVERY disposition without exception.
          //
          // Existing-partner detection: transcript regex post-call (no global
          // disposition code for this case). If matched, overrides stage to
          // 'existing_partner' unless disposition already set a terminal state
          // (dnc / not_interested).
          //
          // DNC transcript fallback: if transcript contains opt-out phrases
          // ("take me off your list", "do not call", "remove me from your list",
          // "stop calling me"), set stage='dnc' AND insert into dnc_list. This
          // is the safety net for the degraded AddToDNC tool path.

          const { data: prevTt } = await supabase
            .from('crm_partners')
            .select('tt_acquisition_stage, tt_call_attempts, phone, email')
            .eq('id', leadId)
            .maybeSingle();

          const transcriptLower = (callTranscript || '').toLowerCase();
          const existingPartnerRegex = /\b(already (a |an )?(partner|in your network|work(ing)? with (top ?tier|you))|we already (work|partner) with top ?tier)\b/i;
          const dncRegex = /\b(take me off (your |the )?(list|database)|do not call( me)?|don'?t call( me)?( anymore)?|stop calling( me)?|remove me from (your |the )?list)\b/i;

          const transcriptFlagsExistingPartner = existingPartnerRegex.test(callTranscript || '');
          const transcriptFlagsDnc = dncRegex.test(callTranscript || '');

          // === STAGE vs DISPOSITION SPLIT (Step 6.2 fix) ===
          // Stage = lifecycle. Disposition = call-outcome. They are separate
          // columns and separate UPDATEs. A CHECK violation on the stage write
          // must NOT roll back the disposition/attempts/timestamp write.
          //
          // Stage-mutating dispositions:
          //   interested      → pending_vetting
          //   dnc             → dnc
          //   wrong_number    → attempted (and phone_invalid=true)
          // Transcript signals (override above unless terminal):
          //   transcript_dnc          → dnc
          //   transcript_existing     → existing_partner (only if newStage not dnc)
          // No stage change:
          //   not_interested, callback, voicemail, no_answer, called

          let newStage: string | null = null;

          // ---- UPDATE 1: always-runs disposition/attempts/timestamp write ----
          const dispUpdate: Record<string, unknown> = {
            tt_last_disposition: canonical,
            tt_call_attempts: (prevTt?.tt_call_attempts || 0) + 1,
            tt_last_call_at: new Date().toISOString(),
          };

          switch (canonical) {
            case 'interested':
              newStage = 'pending_vetting';
              break;
            case 'dnc':
              newStage = 'dnc';
              break;
            case 'wrong_number':
              newStage = 'attempted';
              dispUpdate.phone_invalid = true;
              break;
            case 'callback': {
              const cbRaw = (payload.variables?.callback_time
                || payload.analysis?.callback_time
                || payload.callback_time
                || null) as string | null;
              if (cbRaw) {
                const parsed = new Date(cbRaw);
                if (!isNaN(parsed.getTime())) dispUpdate.tt_callback_at = parsed.toISOString();
              }
              break;
            }
            // not_interested / voicemail / no_answer / called → no stage change
          }

          // Transcript-based DNC fallback (AddToDNC tool degraded).
          if (transcriptFlagsDnc) newStage = 'dnc';

          // Existing-partner detection — overrides only if newStage non-terminal.
          // Signals: transcript regex OR Bland analysis.already_partner === true.
          if ((transcriptFlagsExistingPartner || analysisFlagsExistingPartner) && newStage !== 'dnc') {
            newStage = 'existing_partner';
          }

          // --- Fix C: email capture from Bland analysis ---
          // Only writes when disposition resolved to 'interested' AND the
          // partner row currently has no email. Never overwrites.
          if (
            canonical === 'interested'
            && blandAnalysis
            && typeof blandAnalysis.email_captured === 'string'
            && blandAnalysis.email_captured.includes('@')
            && !prevTt?.email
          ) {
            dispUpdate.email = (blandAnalysis.email_captured as string).trim();
          }

          const { error: dispUpdateErr } = await supabase
            .from('crm_partners')
            .update(dispUpdate)
            .eq('id', leadId);

          if (dispUpdateErr) {
            ttWarnings.push(`disposition_update_failed: ${dispUpdateErr.message}`);
          }

          // ---- UPDATE 2: stage write, only when a stage transition is intended ----
          let stageWriteErr: string | null = null;
          if (newStage && newStage !== prevTt?.tt_acquisition_stage) {
            const { error: stageErr } = await supabase
              .from('crm_partners')
              .update({ tt_acquisition_stage: newStage })
              .eq('id', leadId);
            if (stageErr) {
              stageWriteErr = stageErr.message;
              ttWarnings.push(`stage_update_failed (${prevTt?.tt_acquisition_stage} → ${newStage}): ${stageErr.message}`);
            }
          }

          // Log: success only when both intended writes succeeded.
          const writeSucceeded = !dispUpdateErr && !stageWriteErr;
          await logLeadSync(supabase, {
            business_unit_key: 'top_tier',
            lead_id: leadId,
            sync_direction: 'out',
            status_before: prevTt?.tt_acquisition_stage || null,
            status_after: stageWriteErr ? (prevTt?.tt_acquisition_stage || null) : (newStage || prevTt?.tt_acquisition_stage || null),
            sync_source: 'dc-bland-webhook:top_tier',
            success: writeSucceeded,
            error_message: dispUpdateErr?.message || stageWriteErr || null,
          });


          // DNC list insertion via transcript catch (safety net).
          if (transcriptFlagsDnc) {
            const dncPhone = prevTt?.phone || payload.to || null;
            if (dncPhone) {
              try {
                await verifiedInsert(supabase, 'add top_tier opt-out to DNC list', (c: any) => c.from('dnc_list').upsert({
                  phone_number: dncPhone,
                  phone_e164: dncPhone,
                  source: 'dc-bland-webhook:top_tier:transcript_optout',
                  business: 'top_tier',
                  reason: 'Opt-out detected in call transcript (AddToDNC tool degraded; transcript fallback)',
                  metadata: {
                    call_id: callId,
                    crm_partner_id: leadId,
                    matched_at: new Date().toISOString(),
                  },
                }, { onConflict: 'phone_number' }));
              } catch (dncErr) {
                const m = dncErr instanceof Error ? dncErr.message : String(dncErr);
                console.error('[dc-bland-webhook:top_tier dnc upsert failed]', m);
                ttWarnings.push(`tt_dnc_upsert_failed: ${m}`);
              }
            }
          }

          // Post-call analysis ONLY on interested (per disposition contract).
          if (canonical === 'interested' && callTranscript) {
            supabase.functions.invoke('dc-post-call-analysis', {
              body: { business_unit_key: 'top_tier', lead_id: leadId, transcript: callTranscript, call_id: callId },
            }).catch((e) => console.error('[dc-post-call-analysis (top_tier) invoke failed]', e));
          }
        } else if (sourceHub === 'dynasty_direct') {
          // === Dynasty Direct wholesaler-outreach branch ===
          // Cohort: public.wholesalers. lead_id = wholesalers.id (uuid).
          //
          // Writeback columns (verified present via Step 0 migration):
          //   last_contacted_at, last_call_disposition, call_attempts,
          //   inventory_notes, callback_due_at, preferred_contact.
          //
          // UPDATE 1 (always): last_contacted_at, call_attempts,
          //   last_call_disposition, inventory_notes, preferred_contact.
          // UPDATE 2 (conditional): callback_due_at only when
          //   analysis.callback_requested === true. UPDATE 2 failure MUST NOT
          //   roll back UPDATE 1 — they are separate statements.
          //
          // Semantic disposition override applied above (opted_out /
          // reorder_needed / pitch_interested / callback_requested /
          // any_product_low_or_out).
          //
          // DNC on canonical='dnc' OR transcript regex fallback: insert dnc_list
          // with source='dc-bland-webhook:dynasty_direct:transcript_optout'.
          // AddToDNC tool remains omitted per degraded posture.

          const { data: prevDd } = await supabase
            .from('wholesalers')
            .select('call_attempts, preferred_contact, phone, last_call_disposition')
            .eq('id', leadId)
            .maybeSingle();

          const ddDncRegex = /\b(take me off (your |the )?(list|database)|do not call( me)?|don'?t call( me)?( anymore)?|stop calling( me)?|remove me from (your |the )?list)\b/i;
          const ddTranscriptFlagsDnc = ddDncRegex.test(callTranscript || '');

          const inventorySummary = (blandAnalysis?.inventory_summary as string) || null;

          // ---- UPDATE 1: always-runs writeback ----
          // NOTE: preferred_contact is intentionally NOT written here. It has a
          // Postgres CHECK constraint and unexpected Bland payload values were
          // causing the entire webhook update to fail. Keep this update minimal,
          // constraint-safe, and idempotent on retry.
          const ddUpdate1: Record<string, unknown> = {
            last_contacted_at: new Date().toISOString(),
            call_attempts: (prevDd?.call_attempts || 0) + 1,
            last_call_disposition: canonical,
          };
          if (inventorySummary) ddUpdate1.inventory_notes = inventorySummary;

          const { error: ddUpdate1Err } = await supabase
            .from('wholesalers')
            .update(ddUpdate1)
            .eq('id', leadId);

          if (ddUpdate1Err) {
            ttWarnings.push(`dd_update1_failed: ${ddUpdate1Err.message}`);
          }

          // ---- UPDATE 2: conditional callback_due_at ----
          let ddUpdate2ErrMsg: string | null = null;
          if (blandAnalysis?.callback_requested === true) {
            const cbRaw = (payload.variables?.callback_time
              || (blandAnalysis as any)?.callback_time
              || payload.callback_time
              || null) as string | null;
            let callbackDueAt: string | null = null;
            if (cbRaw) {
              const parsed = new Date(cbRaw);
              if (!isNaN(parsed.getTime())) callbackDueAt = parsed.toISOString();
            }
            // Fallback: 48h out if callback flagged but no parseable time.
            if (!callbackDueAt) {
              callbackDueAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
            }
            const { error: ddUpdate2Err } = await supabase
              .from('wholesalers')
              .update({ callback_due_at: callbackDueAt })
              .eq('id', leadId);
            if (ddUpdate2Err) {
              ddUpdate2ErrMsg = ddUpdate2Err.message;
              ttWarnings.push(`dd_update2_callback_failed: ${ddUpdate2Err.message}`);
            }
          }

          // Sync log — success only when UPDATE 1 succeeded.
          await logLeadSync(supabase, {
            business_unit_key: 'dynasty_direct',
            lead_id: leadId,
            sync_direction: 'out',
            status_before: prevDd?.last_call_disposition || null,
            status_after: canonical,
            sync_source: 'dc-bland-webhook:dynasty_direct',
            success: !ddUpdate1Err,
            error_message: ddUpdate1Err?.message || ddUpdate2ErrMsg || null,
          });

          // DNC list insertion: canonical dnc OR transcript regex fallback.
          if (canonical === 'dnc' || ddTranscriptFlagsDnc) {
            const dncPhone = prevDd?.phone || payload.to || null;
            if (dncPhone) {
              let dncErr: { message: string } | null = null;
              try {
                await verifiedInsert(supabase, 'add opt-out to DNC list', (c: any) => c.from('dnc_list').upsert({
                phone_number: dncPhone,
                phone_e164: dncPhone,
                source: 'dc-bland-webhook:dynasty_direct:transcript_optout',
                business: 'dynasty_direct',
                reason: canonical === 'dnc'
                  ? 'Opt-out captured via analysis.opted_out (canonical=dnc)'
                  : 'Opt-out detected in call transcript (AddToDNC tool degraded; transcript fallback)',
                metadata: {
                  call_id: callId,
                  wholesaler_id: leadId,
                  matched_at: new Date().toISOString(),
                  via: canonical === 'dnc' ? 'analysis' : 'transcript_regex',
                },
                }, { onConflict: 'phone_number' }));
              } catch (e) {
                dncErr = { message: e instanceof Error ? e.message : String(e) };
              }
              if (dncErr) {
                ttWarnings.push(`dd_dnc_upsert_failed: ${dncErr.message}`);
              }
            }
          }

          // Post-call analysis on interested (parity with other branches).
          if (canonical === 'interested' && callTranscript) {
            supabase.functions.invoke('dc-post-call-analysis', {
              body: { business_unit_key: 'dynasty_direct', lead_id: leadId, transcript: callTranscript, call_id: callId },
            }).catch((e) => console.error('[dc-post-call-analysis (dynasty_direct) invoke failed]', e));
          }
        } else if (sourceHub === 'gasmask') {
          // === GASMASK prospect / reactivation outreach branch ===
          // Cohort: 'prospect' → public.sales_prospects, 'reactivation' →
          // public.store_master. lead_id = <table>.id. Cohort is read from
          // payload.request_data.cohort_type (default 'prospect').
          //
          // Writeback columns (verified):
          //   <both>          gasmask_call_status (CHECK-constrained), notes (TEXT append), updated_at
          //   store_master    do_not_call (bool), do_not_call_reason (text)
          //   sales_prospects (no do_not_call column — opt-out expressed via gasmask_call_status='dnc')
          //
          // Split UPDATE pattern:
          //   UPDATE 1 (always): gasmask_call_status, notes append, updated_at
          //   UPDATE 2 (reactivation + opted_out only): do_not_call flag set
          //
          // Semantic override applied above (opted_out / wrong_number /
          // callback_requested / interested|reorder_needed). Falls through to
          // payload.disposition/status if analysis absent.
          //
          // DNC on opt-out: insert dnc_list source='dc-bland-webhook:gasmask:transcript_optout'.
          const cohort = (payload.request_data?.cohort_type
            || payload.variables?.cohort_type
            || 'prospect') as string;
          const targetTable = cohort === 'reactivation' ? 'store_master' : 'sales_prospects';
          const leadIdColumn = 'id';

          const { data: prevGm, error: prevGmErr } = await supabase
            .from(targetTable)
            .select('gasmask_call_status, notes, phone')
            .eq(leadIdColumn, leadId)
            .maybeSingle();

          if (prevGmErr) {
            ttWarnings.push(`gasmask_prev_read_failed: ${prevGmErr.message}`);
          }

          // Map canonical → gasmask_call_status CHECK-allowed values
          // CHECK: new|queued|called|voicemail|no_answer|callback|interested|booked|not_interested|wrong_number|dnc|cancelled
          const gmStatusMap: Record<string, string> = {
            interested: 'interested',
            not_interested: 'not_interested',
            dnc: 'dnc',
            wrong_number: 'wrong_number',
            callback: 'callback',
            voicemail: 'voicemail',
            no_answer: 'no_answer',
            called: 'called',
          };
          const gmStatus = gmStatusMap[canonical] || 'called';

          const noteLine = `[${new Date().toISOString()}] DC call ${callId} → ${gmStatus}${blandAnalysis?.summary ? ` — ${blandAnalysis.summary}` : ''}`;
          const gmUpdate1: Record<string, unknown> = {
            gasmask_call_status: gmStatus,
            notes: prevGm?.notes ? `${prevGm.notes}\n${noteLine}` : noteLine,
            updated_at: new Date().toISOString(),
          };
          const { error: gmUpdate1Err } = await supabase
            .from(targetTable)
            .update(gmUpdate1)
            .eq(leadIdColumn, leadId);
          if (gmUpdate1Err) {
            ttWarnings.push(`gm_update1_failed: ${gmUpdate1Err.message}`);
          }

          // UPDATE 2: reactivation cohort + opted_out only
          let gmUpdate2ErrMsg: string | null = null;
          if (cohort === 'reactivation' && blandAnalysis?.opted_out === true) {
            const optOutReason = (blandAnalysis?.opt_out_reason as string)
              || `Opted out via Dynasty Connect call ${callId}`;
            const { error: gmUpdate2Err } = await supabase
              .from('store_master')
              .update({
                do_not_call: true,
                do_not_call_reason: optOutReason,
              })
              .eq(leadIdColumn, leadId);
            if (gmUpdate2Err) {
              gmUpdate2ErrMsg = gmUpdate2Err.message;
              ttWarnings.push(`gm_update2_dnc_failed: ${gmUpdate2Err.message}`);
            }
          }

          await logLeadSync(supabase, {
            business_unit_key: 'gasmask',
            lead_id: leadId,
            sync_direction: 'out',
            status_before: prevGm?.gasmask_call_status || null,
            status_after: gmStatus,
            sync_source: 'dc-bland-webhook:gasmask',
            success: !gmUpdate1Err,
            error_message: gmUpdate1Err?.message || gmUpdate2ErrMsg || null,
          });

          // DNC list insertion on opt-out (transcript_optout parity with other branches)
          if (gmStatus === 'dnc' || blandAnalysis?.opted_out === true) {
            const dncPhone = prevGm?.phone || payload.to || null;
            if (dncPhone) {
              let dncErr: { message: string } | null = null;
              try {
                await verifiedInsert(supabase, 'add opt-out to DNC list', (c: any) => c.from('dnc_list').upsert({
                phone_number: dncPhone,
                phone_e164: dncPhone,
                source: 'dc-bland-webhook:gasmask:transcript_optout',
                business: 'gasmask',
                reason: (blandAnalysis?.opt_out_reason as string)
                  || `Opt-out captured on Dynasty Connect call ${callId}`,
                metadata: {
                  call_id: callId,
                  cohort,
                  target_table: targetTable,
                  lead_id: leadId,
                  matched_at: new Date().toISOString(),
                },
                }, { onConflict: 'phone_number' }));
              } catch (e) {
                dncErr = { message: e instanceof Error ? e.message : String(e) };
              }
              if (dncErr) ttWarnings.push(`gm_dnc_upsert_failed: ${dncErr.message}`);
            }
          }

          // Post-call analysis on interested with transcript (parity)
          if (gmStatus === 'interested' && callTranscript) {
            supabase.functions.invoke('dc-post-call-analysis', {
              body: {
                business_unit_key: 'gasmask',
                lead_id: leadId,
                transcript: callTranscript,
                call_id: callId,
                _cohort: cohort,
              },
            }).catch((e) => console.error('[dc-post-call-analysis (gasmask) invoke failed]', e));
          }
        } else if (sourceHub === 'brandaro') {
          // === BRANDARO qualified-leads outreach branch ===
          // Cohort: public.brandaro_qualified_leads. lead_id = row.id (uuid).
          //
          // Writeback columns (verified):
          //   lead_status (CHECK: new|queued|calling|no_answer|voicemail|
          //     wrong_number|not_interested|callback|send_info|interested|
          //     hot_lead|sold|disqualified),
          //   call_notes (TEXT append), next_callback_at, last_dc_call_at,
          //   dc_call_id, total_dc_calls, updated_at.
          //
          // Local lead_status mapping (does not use shared canonical for
          // hot_lead/sold/disqualified — those are brandaro-specific):
          //   analysis.opted_out                                   → disqualified
          //   analysis.wrong_number                                → wrong_number
          //   analysis.proposal_action_on_call === 'accepted'      → sold
          //   analysis.callback_requested                          → callback
          //   analysis.interested === true AND
          //     (budget_confirmed OR is_decision_maker)            → hot_lead
          //   analysis.interested === true                         → interested
          //   analysis.interested === false                        → not_interested
          //   else                                                 → fall through to canonical
          //
          // Split UPDATE pattern:
          //   UPDATE 1 (always): lead_status, call_notes append, last_dc_call_at,
          //                      dc_call_id, total_dc_calls++, updated_at
          //   UPDATE 2 (canonical=callback + parseable time): next_callback_at
          //
          // demo_status / proposal_status are NEVER written from this branch —
          // dc-post-call-analysis owns those columns (and only when the action
          // actually occurred on the call).

          const { data: prevBr, error: prevBrErr } = await supabase
            .from('brandaro_qualified_leads')
            .select('lead_status, call_notes, total_dc_calls, phone_number')
            .eq('id', leadId)
            .maybeSingle();
          if (prevBrErr) {
            ttWarnings.push(`brandaro_prev_read_failed: ${prevBrErr.message}`);
          }

          // Local status derivation
          const brAllowed = new Set([
            'new', 'queued', 'calling', 'no_answer', 'voicemail', 'wrong_number',
            'not_interested', 'callback', 'send_info', 'interested', 'hot_lead',
            'sold', 'disqualified',
          ]);
          let brStatus: string;
          if (blandAnalysis?.opted_out === true) {
            brStatus = 'disqualified';
          } else if (blandAnalysis?.wrong_number === true) {
            brStatus = 'wrong_number';
          } else if ((blandAnalysis as any)?.proposal_action_on_call === 'accepted') {
            brStatus = 'sold';
          } else if (blandAnalysis?.callback_requested === true) {
            brStatus = 'callback';
          } else if (blandAnalysis?.interested === true
            && ((blandAnalysis as any).budget_confirmed === true
              || (blandAnalysis as any).is_decision_maker === true)) {
            brStatus = 'hot_lead';
          } else if (blandAnalysis?.interested === true) {
            brStatus = 'interested';
          } else if (blandAnalysis?.interested === false) {
            brStatus = 'not_interested';
          } else {
            brStatus = brAllowed.has(canonical) ? canonical : 'calling';
          }

          const brNoteLine = `[${new Date().toISOString()}] DC call ${callId} → ${brStatus}${blandAnalysis?.summary ? ` — ${blandAnalysis.summary}` : ''}`;
          const brUpdate1: Record<string, unknown> = {
            lead_status: brStatus,
            call_notes: prevBr?.call_notes ? `${prevBr.call_notes}\n${brNoteLine}` : brNoteLine,
            last_dc_call_at: new Date().toISOString(),
            dc_call_id: callId,
            total_dc_calls: (prevBr?.total_dc_calls || 0) + 1,
            updated_at: new Date().toISOString(),
          };
          const { error: brUpdate1Err } = await supabase
            .from('brandaro_qualified_leads')
            .update(brUpdate1)
            .eq('id', leadId);
          if (brUpdate1Err) {
            ttWarnings.push(`brandaro_update1_failed: ${brUpdate1Err.message}`);
          }

          // UPDATE 2: next_callback_at only when canonical/status=callback + parseable time
          let brUpdate2ErrMsg: string | null = null;
          if (brStatus === 'callback') {
            const cbRaw = (payload.variables?.callback_time
              || (blandAnalysis as any)?.callback_time
              || payload.callback_time
              || null) as string | null;
            if (cbRaw) {
              const parsed = new Date(cbRaw);
              if (!isNaN(parsed.getTime())) {
                const { error: brUpdate2Err } = await supabase
                  .from('brandaro_qualified_leads')
                  .update({ next_callback_at: parsed.toISOString() })
                  .eq('id', leadId);
                if (brUpdate2Err) {
                  brUpdate2ErrMsg = brUpdate2Err.message;
                  ttWarnings.push(`brandaro_update2_callback_failed: ${brUpdate2Err.message}`);
                }
              }
            }
          }

          await logLeadSync(supabase, {
            business_unit_key: 'brandaro',
            lead_id: leadId,
            sync_direction: 'out',
            status_before: prevBr?.lead_status || null,
            status_after: brStatus,
            sync_source: 'dc-bland-webhook:brandaro',
            success: !brUpdate1Err,
            error_message: brUpdate1Err?.message || brUpdate2ErrMsg || null,
          });

          // DNC on opt-out
          if (blandAnalysis?.opted_out === true || brStatus === 'disqualified') {
            const dncPhone = prevBr?.phone_number || payload.to || null;
            if (dncPhone) {
              let dncErr: { message: string } | null = null;
              try {
                await verifiedInsert(supabase, 'add opt-out to DNC list', (c: any) => c.from('dnc_list').upsert({
                phone_number: dncPhone,
                phone_e164: dncPhone,
                source: 'dc-bland-webhook:brandaro:transcript_optout',
                business: 'brandaro',
                reason: (blandAnalysis?.opt_out_reason as string)
                  || `Opt-out captured on Dynasty Connect call ${callId}`,
                metadata: {
                  call_id: callId,
                  brandaro_lead_id: leadId,
                  matched_at: new Date().toISOString(),
                },
                }, { onConflict: 'phone_number' }));
              } catch (e) {
                dncErr = { message: e instanceof Error ? e.message : String(e) };
              }
              if (dncErr) ttWarnings.push(`brandaro_dnc_upsert_failed: ${dncErr.message}`);
            }
          }

          // Post-call analysis when interested / hot_lead with transcript
          if ((brStatus === 'interested' || brStatus === 'hot_lead') && callTranscript) {
            supabase.functions.invoke('dc-post-call-analysis', {
              body: {
                business_unit_key: 'brandaro',
                lead_id: leadId,
                transcript: callTranscript,
                call_id: callId,
              },
            }).catch((e) => console.error('[dc-post-call-analysis (brandaro) invoke failed]', e));
          }
        }

      }
    } catch (dualWriteErr) {
      console.error('[dual-write failed]', dualWriteErr);
    }

    const responseBody: Record<string, unknown> = { success: true };
    if (ttWarnings.length) responseBody.warnings = ttWarnings;
    return new Response(JSON.stringify(responseBody), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
