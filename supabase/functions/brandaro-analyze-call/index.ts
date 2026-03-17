import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const HEAT_DELTAS: Record<string, number> = {
  answered_call: 5,
  full_conversation: 10,
  interested_statement: 20,
  asks_price: 20,
  asks_results: 15,
  asks_next_step: 20,
  requests_demo: 30,
  gives_callback_time: 15,
  asks_payment: 50,
  too_expensive: -5,
  not_interested: -15,
  too_busy: -3,
  no_answer: -1,
  missed_callback: -10,
  completed_callback: 20,
  closer_handoff: 35,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { call_session_id, transcript, notes, va_user_id, lead_id } = await req.json();
    if (!call_session_id) throw new Error("call_session_id required");

    const inputText = transcript || notes || "";
    if (!inputText) throw new Error("transcript or notes required");

    // Call Lovable AI for analysis
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a sales conversation intelligence engine. Analyze the provided call transcript or call notes.

Return structured JSON with:
- summary (string)
- outcome (one of: no_answer, voicemail, wrong_number, gatekeeper, short_conversation, interested, not_interested, callback_requested, demo_requested, closer_ready, payment_ready, do_not_call)
- interest_level (one of: none, low, medium, high, very_high)
- urgency_level (one of: low, medium, high, immediate)
- objections_detected (array of {type, text, severity, recommended_response, strategy})
- buying_signals (array of {type, text, strength})
- next_best_action (one of: retry_later, schedule_callback, send_demo, send_followup_sms, escalate_hot_lead, handoff_to_closer, send_payment_link, nurture_sequence, mark_do_not_call)
- lead_heat_delta (number, positive or negative)
- should_escalate_to_closer (boolean)
- should_create_callback (boolean)
- recommended_callback_at (ISO string or null)
- payment_ready (boolean)
- confidence_score (0-100)
- recommended_response (string - what the VA should say next)
- recommended_strategy (string - brief strategy note)

Rules:
- Focus on sales advancement, not generic summarization.
- Detect objections precisely.
- Detect buying signals precisely.
- If the lead asks price, asks next steps, asks timeline, asks examples, or requests follow-up, treat this as meaningful interest.
- If the lead sounds ready, mark should_escalate_to_closer true.
- Never invent extreme certainty from weak evidence.
- Output valid JSON only.`,
          },
          { role: "user", content: inputText },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "analyze_call",
              description: "Return structured call analysis",
              parameters: {
                type: "object",
                properties: {
                  summary: { type: "string" },
                  outcome: { type: "string" },
                  interest_level: { type: "string" },
                  urgency_level: { type: "string" },
                  objections_detected: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string" },
                        text: { type: "string" },
                        severity: { type: "string" },
                        recommended_response: { type: "string" },
                        strategy: { type: "string" },
                      },
                      required: ["type"],
                    },
                  },
                  buying_signals: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string" },
                        text: { type: "string" },
                        strength: { type: "number" },
                      },
                      required: ["type"],
                    },
                  },
                  next_best_action: { type: "string" },
                  lead_heat_delta: { type: "number" },
                  should_escalate_to_closer: { type: "boolean" },
                  should_create_callback: { type: "boolean" },
                  recommended_callback_at: { type: "string" },
                  payment_ready: { type: "boolean" },
                  confidence_score: { type: "number" },
                  recommended_response: { type: "string" },
                  recommended_strategy: { type: "string" },
                },
                required: ["summary", "outcome", "interest_level", "urgency_level", "objections_detected", "buying_signals", "next_best_action", "lead_heat_delta", "should_escalate_to_closer", "confidence_score"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "analyze_call" } },
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again later" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits required" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error ${aiResp.status}: ${errText}`);
    }

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No analysis returned");

    const analysis = JSON.parse(toolCall.function.arguments);

    // Update call session with analysis
    await supabase.from("brandaro_va_call_sessions").update({
      summary: analysis.summary,
      call_outcome: analysis.outcome,
      interest_level: analysis.interest_level,
      urgency_level: analysis.urgency_level,
      objection_count: analysis.objections_detected?.length || 0,
      buying_signal_count: analysis.buying_signals?.length || 0,
      ai_analyzed: true,
      updated_at: new Date().toISOString(),
    }).eq("id", call_session_id);

    // Insert objection events
    if (analysis.objections_detected?.length > 0) {
      const objRows = analysis.objections_detected.map((o: any) => ({
        call_session_id,
        va_user_id,
        lead_id,
        objection_type: o.type,
        objection_text: o.text || null,
        severity: o.severity || "medium",
        ai_recommended_response: o.recommended_response || null,
        ai_strategy: o.strategy || null,
      }));
      await supabase.from("brandaro_va_objection_events").insert(objRows);
    }

    // Insert buying signals
    if (analysis.buying_signals?.length > 0) {
      const sigRows = analysis.buying_signals.map((s: any) => ({
        call_session_id,
        va_user_id,
        lead_id,
        signal_type: s.type,
        signal_text: s.text || null,
        signal_strength: s.strength || 1,
      }));
      await supabase.from("brandaro_va_buying_signals").insert(sigRows);
    }

    // Update lead heat
    if (lead_id) {
      const heatDelta = analysis.lead_heat_delta || 0;
      const { data: existing } = await supabase
        .from("brandaro_va_lead_heat")
        .select("*")
        .eq("lead_id", lead_id)
        .maybeSingle();

      const newScore = Math.max(0, (existing?.heat_score || 0) + heatDelta);
      const heatStatus =
        newScore >= 90 ? "closing_now" :
        newScore >= 70 ? "hot" :
        newScore >= 45 ? "interested" :
        newScore >= 20 ? "warming" : "cold";

      const closingProb = Math.min(100, Math.round(newScore * 0.9));

      const heatRow = {
        lead_id,
        latest_call_session_id: call_session_id,
        heat_score: newScore,
        closing_probability: closingProb,
        status: heatStatus,
        next_best_action: analysis.next_best_action,
        escalation_level: newScore >= 90 ? "critical" : newScore >= 70 ? "high" : newScore >= 45 ? "medium" : "low",
        recommended_callback_at: analysis.recommended_callback_at || null,
        last_signal_at: analysis.buying_signals?.length > 0 ? new Date().toISOString() : existing?.last_signal_at,
        last_objection_at: analysis.objections_detected?.length > 0 ? new Date().toISOString() : existing?.last_objection_at,
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        await supabase.from("brandaro_va_lead_heat").update(heatRow).eq("lead_id", lead_id);
      } else {
        await supabase.from("brandaro_va_lead_heat").insert(heatRow);
      }

      // Create alerts for hot leads
      if (newScore >= 70 && (!existing || existing.heat_score < 70)) {
        await supabase.from("brandaro_va_alerts").insert({
          va_user_id,
          title: newScore >= 90 ? "🔥 CLOSING NOW — Lead ready to buy" : "🔥 HOT LEAD detected",
          description: `Heat score: ${newScore}. Action: ${analysis.next_best_action}`,
          severity: newScore >= 90 ? "critical" : "high",
          alert_type: "hot_lead",
        });
      }

      // Auto-create closer handoff
      if (analysis.should_escalate_to_closer) {
        await supabase.from("brandaro_va_closer_handoffs").insert({
          lead_id,
          source_call_session_id: call_session_id,
          va_user_id,
          handoff_reason: analysis.recommended_strategy || "AI detected high closing probability",
          lead_heat_score: newScore,
          qualification_notes: analysis.summary,
        });
      }
    }

    // Create AI recommendation
    await supabase.from("brandaro_va_ai_recommendations").insert({
      va_user_id,
      lead_id,
      call_session_id,
      recommendation_type: analysis.next_best_action,
      recommendation_title: analysis.recommended_strategy || `Next: ${analysis.next_best_action}`,
      recommendation_body: analysis.recommended_response || analysis.summary,
      recommended_action: analysis.next_best_action,
      priority: analysis.should_escalate_to_closer ? 10 : analysis.payment_ready ? 9 : 5,
    });

    // Auto-create tasks based on outcome
    const taskMap: Record<string, { type: string; priority: number; reason: string }> = {
      no_answer: { type: "reattempt_no_answer", priority: 3, reason: "No answer — retry needed" },
      callback_requested: { type: "scheduled_callback", priority: 7, reason: "Callback requested by lead" },
      interested: { type: "send_followup_sms", priority: 6, reason: "Lead showed interest — follow up" },
      demo_requested: { type: "send_demo_reminder", priority: 8, reason: "Demo requested — send immediately" },
      closer_ready: { type: "escalate_hot_lead", priority: 10, reason: "Lead is closer-ready" },
      payment_ready: { type: "payment_reminder", priority: 10, reason: "Lead is payment-ready" },
    };

    const task = taskMap[analysis.outcome];
    if (task) {
      const dueAt = analysis.recommended_callback_at
        ? new Date(analysis.recommended_callback_at).toISOString()
        : new Date(Date.now() + (analysis.outcome === "no_answer" ? 3600000 : 1800000)).toISOString();

      await supabase.from("brandaro_va_task_queue").insert({
        va_user_id,
        lead_id,
        task_type: task.type,
        priority: task.priority,
        source_reason: task.reason,
        due_at: dueAt,
        metadata: { call_session_id, ai_analysis: true },
      });
    }

    // Update daily conversion metrics
    const today = new Date().toISOString().split("T")[0];
    const { data: existingMetric } = await supabase
      .from("brandaro_va_conversion_metrics")
      .select("*")
      .eq("va_user_id", va_user_id)
      .eq("metric_date", today)
      .maybeSingle();

    const metricUpdate: any = {
      objections_handled: (existingMetric?.objections_handled || 0) + (analysis.objections_detected?.length || 0),
      buying_signals_detected: (existingMetric?.buying_signals_detected || 0) + (analysis.buying_signals?.length || 0),
      updated_at: new Date().toISOString(),
    };

    if (analysis.outcome === "interested" || analysis.outcome === "closer_ready" || analysis.outcome === "payment_ready") {
      metricUpdate.interested_leads = (existingMetric?.interested_leads || 0) + 1;
    }
    if (analysis.outcome === "demo_requested") {
      metricUpdate.demos_booked = (existingMetric?.demos_booked || 0) + 1;
    }
    if (analysis.should_escalate_to_closer) {
      metricUpdate.closer_handoffs = (existingMetric?.closer_handoffs || 0) + 1;
    }
    if (analysis.payment_ready) {
      metricUpdate.payment_ready_leads = (existingMetric?.payment_ready_leads || 0) + 1;
    }

    if (existingMetric) {
      await supabase.from("brandaro_va_conversion_metrics").update(metricUpdate).eq("id", existingMetric.id);
    } else {
      await supabase.from("brandaro_va_conversion_metrics").insert({
        va_user_id,
        metric_date: today,
        ...metricUpdate,
      });
    }

    return new Response(JSON.stringify({ success: true, analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-call error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
