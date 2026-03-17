import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * brandaro-voice-agent
 * 
 * AI Voice Sales Agent for Brandaro campaigns.
 * 
 * Actions:
 *   - get_system_prompt: Returns the full ElevenLabs system prompt built from the active script
 *   - process_response: Analyzes caller speech, detects objections, determines next action
 *   - log_outcome: Records final call outcome and triggers demo/follow-up
 *   - evaluate_handoff: Scores call intent and decides if human transfer is needed
 */

interface CallContext {
  lead_id?: string;
  call_sid?: string;
  campaign_id?: string;
  current_stage: string;
  objections_so_far: string[];
  contact_captured: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();

    if (body.dry_run) {
      return new Response(JSON.stringify({ ok: true, dry_run: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action } = body;

    switch (action) {
      case "get_system_prompt":
        return await handleGetSystemPrompt(supabase, body);
      case "process_response":
        return await handleProcessResponse(supabase, body);
      case "log_outcome":
        return await handleLogOutcome(supabase, body);
      case "evaluate_handoff":
        return await handleEvaluateHandoff(supabase, body);
      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("brandaro-voice-agent error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─── GET SYSTEM PROMPT ──────────────────────────────────────────────
// Builds the full ElevenLabs-compatible system prompt from the active script
async function handleGetSystemPrompt(supabase: any, body: any) {
  const { script_id, lead_name, business_name, business_type } = body;

  let script;
  if (script_id) {
    const { data } = await supabase
      .from("brandaro_voice_agent_scripts")
      .select("*")
      .eq("id", script_id)
      .single();
    script = data;
  } else {
    const { data } = await supabase
      .from("brandaro_voice_agent_scripts")
      .select("*")
      .eq("is_active", true)
      .order("script_version", { ascending: false })
      .limit(1)
      .single();
    script = data;
  }

  if (!script) {
    return new Response(JSON.stringify({ error: "No active script found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Load objection handlers for this script
  const { data: objections } = await supabase
    .from("brandaro_voice_objections")
    .select("*")
    .eq("script_id", script.id);

  const systemPrompt = buildSystemPrompt(script, objections || [], {
    lead_name,
    business_name,
    business_type,
  });

  return new Response(JSON.stringify({ 
    system_prompt: systemPrompt,
    script_id: script.id,
    voice_style: script.voice_style,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildSystemPrompt(
  script: any,
  objections: any[],
  context: { lead_name?: string; business_name?: string; business_type?: string }
): string {
  const { lead_name, business_name, business_type } = context;
  const style = script.voice_style || {};

  let prompt = `You are Brandaro AI — a natural, confident, human-like sales assistant calling local businesses.

VOICE STYLE:
- Tone: ${style.tone || "friendly"}, ${style.pace || "calm"}, ${style.formality || "casual_confident"}
- Speak like a real human, not a script. Keep responses SHORT — 1-2 sentences max.
- Use natural pauses. Never speak in paragraphs.
- Style: ${style.style || "conversational_not_scripted"}

YOUR OBJECTIVE:
1. Identify if the business needs a website
2. Create interest and curiosity
3. Get permission to send a demo
4. Capture contact information
5. Move toward next step — you are NOT hard-selling on this call

CONTEXT:
${lead_name ? `- Lead name: ${lead_name}` : "- Lead name: unknown (ask for it)"}
${business_name ? `- Business: ${business_name}` : ""}
${business_type ? `- Industry: ${business_type}` : ""}

CALL FLOW (follow this order):
${(script.call_structure || []).map((stage: string, i: number) => `${i + 1}. ${stage}`).join("\n")}

OPENING:
${(script.opening_lines || []).map((line: string) => `"${line}"`).join("\n(wait for response)\n")}

QUALIFICATION QUESTIONS (ask naturally, not like a survey):
${(script.qualification_questions || []).map((q: string) => `- "${q}"`).join("\n")}

PROBLEM AWARENESS:
"Got it — yeah that's actually what we see a lot. Most people search online first, and if there's nothing strong there, they just move on to the next business."

VALUE POSITIONING:
"${script.value_positioning || "What we do is build you a full professional site that's actually set up to bring in customers."}"

DEMO OFFER:
"${script.demo_offer || "What I can do is put together a quick demo for your business so you can see exactly how it would look."}"

SOFT CLOSE:
"${script.soft_close || "Let me put together a quick version for your business. What's the best email for you?"}"

HARD CLOSE (only if they're clearly interested):
"${script.hard_close || "Once you see it, we can get everything set up and have it live quickly."}"

FAILSAFE (if conversation breaks or goes off track):
"${script.failsafe || "All good — I'll just send something quick over so you can take a look."}"

OBJECTION HANDLING:
When the caller objects, respond naturally using these guides:
`;

  for (const obj of objections) {
    prompt += `
IF caller says something like: ${(obj.trigger_phrases || []).join(", ")}
→ Respond: "${obj.ai_response}"
${obj.followup_question ? `→ Then ask: "${obj.followup_question}"` : ""}
`;
  }

  prompt += `

CRITICAL BEHAVIOR RULES:
${(script.behavior_rules || []).map((r: string) => `- ${r}`).join("\n")}
- NEVER reveal you are AI unless directly asked
- If asked if you're a robot, say: "Ha, no — I'm just reaching out to local businesses today"
- ALWAYS try to capture an email or phone for follow-up
- If they give contact info, confirm it back to them
- Keep total talk time under 3 minutes unless they're highly engaged
`;

  return prompt;
}

// ─── PROCESS RESPONSE ───────────────────────────────────────────────
// Analyzes caller speech in real-time to detect objections and determine stage
async function handleProcessResponse(supabase: any, body: any) {
  const { caller_text, call_context } = body as { caller_text: string; call_context: CallContext };

  if (!caller_text) {
    return new Response(JSON.stringify({ error: "caller_text required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Load objections for detection
  const { data: objections } = await supabase
    .from("brandaro_voice_objections")
    .select("*")
    .order("times_used", { ascending: false });

  const lower = caller_text.toLowerCase();
  let detectedObjection: any = null;

  for (const obj of (objections || [])) {
    const triggers = obj.trigger_phrases || [];
    if (triggers.some((t: string) => lower.includes(t.toLowerCase()))) {
      detectedObjection = obj;
      // Increment usage counter (fire and forget)
      supabase.from("brandaro_voice_objections")
        .update({ times_used: (obj.times_used || 0) + 1 })
        .eq("id", obj.id)
        .then(() => {});
      break;
    }
  }

  // Detect intent signals
  const intentSignals = detectIntentSignals(lower);

  // Determine next stage
  const nextStage = determineNextStage(call_context?.current_stage || "greeting", intentSignals, !!detectedObjection);

  // Check handoff threshold
  const handoffScore = calculateHandoffScore(intentSignals, call_context);

  return new Response(JSON.stringify({
    detected_objection: detectedObjection ? {
      key: detectedObjection.objection_key,
      suggested_response: detectedObjection.ai_response,
      followup: detectedObjection.followup_question,
    } : null,
    intent_signals: intentSignals,
    next_stage: nextStage,
    handoff_score: handoffScore,
    should_transfer: handoffScore >= 85,
    contact_detected: detectContactInfo(caller_text),
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function detectIntentSignals(text: string): Record<string, boolean> {
  return {
    positive_interest: /yes|yeah|sure|sounds good|interested|tell me more|okay|let's do it/i.test(text),
    negative_signal: /no|not interested|stop calling|don't call|hang up|go away/i.test(text),
    question_asked: /how much|what do you|can you|do you|is it|does it/i.test(text),
    demo_interest: /demo|show me|see it|take a look|send it|let me see/i.test(text),
    urgency: /need it now|asap|right away|today|immediately|soon/i.test(text),
    budget_concern: /expensive|cost|afford|budget|price|money|cheap/i.test(text),
    human_request: /real person|human|manager|supervisor|talk to someone/i.test(text),
    contact_sharing: /@|\.com|\.net|email|my number|text me|send to/i.test(text),
  };
}

function detectContactInfo(text: string): { email?: string; phone?: string } | null {
  const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
  const phoneMatch = text.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  if (!emailMatch && !phoneMatch) return null;
  return {
    email: emailMatch?.[0],
    phone: phoneMatch?.[0],
  };
}

function determineNextStage(currentStage: string, signals: Record<string, boolean>, hasObjection: boolean): string {
  const stages = ["greeting", "reason_for_call", "qualification", "problem_awareness", "value_positioning", "demo_offer", "objection_handling", "close"];
  const currentIdx = stages.indexOf(currentStage);

  if (signals.negative_signal) return "failsafe";
  if (signals.human_request) return "transfer_human";
  if (signals.demo_interest || signals.contact_sharing) return "close";
  if (hasObjection) return "objection_handling";
  if (signals.positive_interest && currentIdx < stages.length - 1) return stages[currentIdx + 1];

  return currentStage;
}

function calculateHandoffScore(signals: Record<string, boolean>, context?: CallContext): number {
  let score = 0;
  if (signals.positive_interest) score += 25;
  if (signals.demo_interest) score += 30;
  if (signals.urgency) score += 20;
  if (signals.contact_sharing) score += 20;
  if (signals.question_asked) score += 10;
  if (signals.human_request) score += 50;
  if (context?.contact_captured) score += 15;
  if (signals.negative_signal) score -= 40;
  if (signals.budget_concern) score -= 10;
  return Math.max(0, Math.min(100, score));
}

// ─── LOG OUTCOME ────────────────────────────────────────────────────
async function handleLogOutcome(supabase: any, body: any) {
  const {
    lead_id, script_id, call_sid, campaign_id,
    stage_reached, objections_encountered, objections_handled,
    contact_captured, demo_requested, transferred_to_human,
    transfer_reason, handoff_score, intent_level,
    duration_seconds, outcome, ai_notes, contact_info,
  } = body;

  // Insert call record
  const { data: callRecord, error } = await supabase
    .from("brandaro_voice_agent_calls")
    .insert({
      lead_id,
      script_id,
      call_sid,
      campaign_id,
      call_stage_reached: stage_reached || "greeting",
      objections_encountered: objections_encountered || [],
      objections_handled: objections_handled || [],
      contact_captured: contact_captured || false,
      demo_requested: demo_requested || false,
      transferred_to_human: transferred_to_human || false,
      transfer_reason,
      handoff_score: handoff_score || 0,
      intent_level: intent_level || "unknown",
      call_duration_seconds: duration_seconds,
      outcome: outcome || "completed",
      ai_notes,
    })
    .select()
    .single();

  if (error) throw error;

  // Update objection conversion stats
  if (objections_handled?.length > 0 && (outcome === "demo_requested" || outcome === "contact_captured")) {
    for (const objKey of objections_handled) {
      const { data: handler } = await supabase
        .from("brandaro_voice_objections")
        .select("id, times_converted")
        .eq("objection_key", objKey)
        .limit(1)
        .single();

      if (handler) {
        await supabase.from("brandaro_voice_objections")
          .update({ times_converted: (handler.times_converted || 0) + 1 })
          .eq("id", handler.id);
      }
    }
  }

  // If demo requested, trigger demo generation + close pipeline + follow-up sequences
  if (demo_requested && lead_id) {
    console.log(`🎯 Demo requested by lead ${lead_id} — triggering generation + pipeline`);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    
    // Update lead status
    await supabase.from("brandaro_qualified_leads")
      .update({ 
        status: "demo_requested",
        updated_at: new Date().toISOString(),
      })
      .eq("id", lead_id);

    // Create close pipeline entry
    await supabase.from("brandaro_close_pipeline").upsert({
      lead_id,
      stage: "demo_sent",
      demo_sent_at: new Date().toISOString(),
      priority_score: (handoff_score || 0) >= 80 ? 90 : 50,
    }, { onConflict: "lead_id" }).then(() => {});

    // Create auto follow-up sequence
    const delays = [
      { step: 1, minutes: 2, msg: "Hey! Just sent over a quick demo for your business — check it out when you get a sec 🔥" },
      { step: 2, minutes: 120, msg: "Quick follow-up — did you get a chance to look at the demo? Happy to walk you through it." },
      { step: 3, minutes: 1440, msg: "Hey! Just wanted to make sure you saw what we put together. It's ready whenever you are." },
      { step: 4, minutes: 4320, msg: "Last check-in — your custom demo is still available. Want me to get this set up for you?" },
    ];

    for (const d of delays) {
      await supabase.from("brandaro_followup_sequences").insert({
        lead_id,
        voice_call_id: callRecord.id,
        trigger_event: "demo_requested",
        sequence_step: d.step,
        channel: "sms",
        message_content: d.msg,
        scheduled_at: new Date(Date.now() + d.minutes * 60000).toISOString(),
        status: "pending",
      }).then(() => {});
    }

    // Fire and forget: trigger demo generation
    fetch(`${supabaseUrl}/functions/v1/brandaro-generate-demo`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ lead_id }),
    }).catch((e) => console.error("Demo trigger failed:", e));
  }

  // Hot lead auto-attack: if handoff_score > 80 and not already demo'd
  if ((handoff_score || 0) >= 80 && !demo_requested && lead_id) {
    console.log(`🔥 Hot lead detected (score ${handoff_score}) — auto-attack triggered`);
    
    // Create pipeline entry at "interested" stage
    await supabase.from("brandaro_close_pipeline").upsert({
      lead_id,
      stage: "interested",
      interested_at: new Date().toISOString(),
      priority_score: 95,
    }, { onConflict: "lead_id" }).then(() => {});

    // Instant SMS follow-up
    await supabase.from("brandaro_followup_sequences").insert({
      lead_id,
      voice_call_id: callRecord.id,
      trigger_event: "hot_lead_auto",
      sequence_step: 1,
      channel: "sms",
      message_content: "Hey! Great chatting with you — I'm putting together something specifically for your business. You'll have it shortly 🚀",
      scheduled_at: new Date(Date.now() + 60000).toISOString(), // 1 min
      status: "pending",
    }).then(() => {});
  }

  // If contact info captured, update lead
  if (contact_info && lead_id) {
    const updates: Record<string, any> = {};
    if (contact_info.email) updates.email = contact_info.email;
    if (contact_info.phone) updates.phone = contact_info.phone;
    if (Object.keys(updates).length > 0) {
      await supabase.from("brandaro_qualified_leads")
        .update(updates)
        .eq("id", lead_id);
    }
  }

  return new Response(JSON.stringify({ 
    success: true, 
    call_id: callRecord.id,
    demo_triggered: demo_requested || false,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── EVALUATE HANDOFF ───────────────────────────────────────────────
// Determines if the current call should be transferred to a human VA
async function handleEvaluateHandoff(supabase: any, body: any) {
  const { handoff_score, current_stage, caller_text, call_context } = body;

  // Load active handoff rules
  const { data: rules } = await supabase
    .from("brandaro_handoff_rules")
    .select("*")
    .eq("is_active", true)
    .order("priority", { ascending: true });

  let shouldTransfer = false;
  let matchedRule: any = null;
  const lower = (caller_text || "").toLowerCase();

  for (const rule of (rules || [])) {
    // Check score threshold
    if (handoff_score >= rule.min_intent_score) {
      // Check stage requirement
      const stages = ["greeting", "reason_for_call", "qualification", "problem_awareness", "value_positioning", "demo_offer", "objection_handling", "close"];
      const currentIdx = stages.indexOf(current_stage || "greeting");
      const requiredIdx = stages.indexOf(rule.required_stage || "greeting");

      if (currentIdx >= requiredIdx) {
        // Check trigger phrases
        const hasPhrase = (rule.trigger_phrases || []).some((p: string) => lower.includes(p.toLowerCase()));

        if (hasPhrase || !rule.trigger_phrases?.length) {
          shouldTransfer = rule.auto_transfer;
          matchedRule = rule;
          break;
        }
      }
    }
  }

  return new Response(JSON.stringify({
    should_transfer: shouldTransfer,
    matched_rule: matchedRule?.rule_name || null,
    handoff_score,
    recommendation: shouldTransfer 
      ? "Transfer to human VA — high intent detected" 
      : handoff_score >= 60 
        ? "Continue AI — building toward transfer threshold"
        : "Continue AI — still qualifying",
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
