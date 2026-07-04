// Backfill / refresh Lead Intelligence for DC call logs.
// Writes to dc_lead_analysis keyed by dc_call_logs.call_sid (fallback: id) —
// matching FinishedCallsBoard.effectiveCallId resolution.
//
// POST body (all optional):
//   { limit?: number = 25, days?: number = 7, only_call_sid?: string,
//     force?: boolean = false  // re-analyze even if row exists
//   }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MODEL = "google/gemini-3-flash-preview";

const SCHEMA = {
  type: "object",
  required: [
    "interest_level",
    "interest_score",
    "sentiment",
    "recommended_action",
    "summary",
    "key_objections",
  ],
  properties: {
    interest_level: { type: "string", enum: ["high", "medium", "low", "none"] },
    interest_score: { type: "integer", minimum: 0, maximum: 10 },
    sentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
    recommended_action: { type: "string" },
    callback_requested: { type: "boolean" },
    callback_time: { type: "string" },
    contact_confirmed: { type: "boolean" },
    opted_out: { type: "boolean" },
    email_provided: { type: "string" },
    summary: { type: "string" },
    key_objections: { type: "array", items: { type: "string" } },
    red_flags: { type: "array", items: { type: "string" } },
    buying_signals: { type: "array", items: { type: "string" } },
  },
  additionalProperties: false,
};

const SYS = `You are an elite call-intelligence analyst grading outbound sales calls. Score interest 0-10 with strict calibration:

- 9-10: Explicit yes ("I want to try it", "sign me up", "let's do it", "send me the info")
- 7-8: Strong interest, minor questions, wants next step
- 5-6: Curious/considering, no commitment
- 3-4: Reluctant, needs more convincing
- 1-2: Objects but polite
- 0: Hard no / hang up / DNC

CRITICAL RULES:
- If prospect says any variant of "yes I want to try", "I'll take it", "sign me up", "let's do it" → interest_score MUST be >=8.
- Read full transcript carefully. Do not default to 0 unless there's an actual refusal.
- summary: 1-2 sentences, factual, mention key decision.
- key_objections: extract literal objections raised, not generic ones.
- recommended_action: concrete next step (e.g. "send onboarding link", "schedule callback tomorrow AM", "add to DNC").

Return ONLY the tool call — no prose.`;

async function analyze(transcript: string, business: string, lead: string | null, apiKey: string) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYS },
        {
          role: "user",
          content: `BUSINESS UNIT: ${business}\nLEAD NAME: ${lead ?? "unknown"}\n\nTRANSCRIPT:\n${transcript}`,
        },
      ],
      tools: [{
        type: "function",
        function: { name: "submit_lead_intel", description: "Submit lead intelligence analysis.", parameters: SCHEMA },
      }],
      tool_choice: { type: "function", function: { name: "submit_lead_intel" } },
    }),
  });
  if (!res.ok) throw new Error(`AI gateway ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  const args = j.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) throw new Error("no tool_call in response");
  return typeof args === "string" ? JSON.parse(args) : args;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Number(body.limit) || 25, 60);
    const days = Number(body.days) || 7;
    const force = !!body.force;
    const onlyCallSid: string | undefined = body.only_call_sid;

    let q = supabase
      .from("dc_call_logs")
      .select("id, call_sid, business, source_business, lead_name, transcript, created_at")
      .not("transcript", "is", null)
      .gte("created_at", new Date(Date.now() - days * 86400_000).toISOString())
      .order("created_at", { ascending: false })
      .limit(limit * 4);
    if (onlyCallSid) q = q.eq("call_sid", onlyCallSid);

    const { data: logs, error } = await q;
    if (error) throw error;

    const candidates = (logs || []).filter((r: any) => (r.transcript?.length ?? 0) > 150);

    let toRun = candidates;
    if (!force) {
      const keys = Array.from(new Set(candidates.flatMap((r: any) => [r.call_sid, r.id].filter(Boolean)))) as string[];
      const { data: existing } = await supabase
        .from("dc_lead_analysis")
        .select("call_id, interest_score")
        .in("call_id", keys);
      const have = new Map((existing || []).map((r: any) => [r.call_id, r.interest_score]));
      // Re-run rows that have interest_score = 0 or null (bad prior analysis)
      toRun = candidates.filter((r: any) => {
        const s = have.get(r.call_sid) ?? have.get(r.id);
        if (s === undefined) return true; // no row
        return s === null || s === 0;      // suspicious low score → refresh
      });
    }
    toRun = toRun.slice(0, limit);

    const results: any[] = [];
    for (const r of toRun) {
      const key = r.call_sid || r.id;
      try {
        const a = await analyze(
          r.transcript,
          r.business || r.source_business || "top_tier",
          r.lead_name,
          LOVABLE_API_KEY,
        );

        const row = {
          call_id: key,
          business_unit_key: r.business || r.source_business || "top_tier",
          lead_id: r.id, // dc_call_logs.id (uuid) — satisfies NOT NULL
          source_table: "dc_call_logs",
          interest_level: a.interest_level ?? null,
          interest_score: typeof a.interest_score === "number" ? a.interest_score : null,
          sentiment: a.sentiment ?? null,
          recommended_action: a.recommended_action ?? null,
          opted_out: a.opted_out ?? null,
          callback_requested: a.callback_requested ?? null,
          callback_time: a.callback_time ?? null,
          contact_confirmed: a.contact_confirmed ?? null,
          summary: a.summary ?? null,
          key_objections: a.key_objections ?? [],
          red_flags: a.red_flags ?? [],
          email_provided: a.email_provided ?? null,
          qualification_payload: a,
          analysis_version: "v2-backfill",
          claude_model: MODEL,
          analyzed_at: new Date().toISOString(),
        };

        const { error: upErr } = await supabase
          .from("dc_lead_analysis")
          .upsert(row, { onConflict: "call_id" });
        if (upErr) throw upErr;

        results.push({ call_sid: r.call_sid, id: r.id, ok: true, interest_score: row.interest_score, sentiment: row.sentiment });
      } catch (e) {
        results.push({ call_sid: r.call_sid, id: r.id, ok: false, error: (e as Error).message });
      }
    }

    return new Response(
      JSON.stringify({
        scanned: candidates.length,
        attempted: results.length,
        succeeded: results.filter((r) => r.ok).length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[backfill-dc-lead-intel] error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
