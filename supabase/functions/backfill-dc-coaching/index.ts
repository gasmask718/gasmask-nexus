// One-shot backfill: generate coaching analysis for DC call logs that have
// a transcript but no dynasty_call_analysis row. Uses Lovable AI Gateway
// (google/gemini-2.5-flash) — free during promo, no per-token cost.
// Keys analysis by dc_call_logs.call_sid so FinishedCallsBoard's
// effectiveCallId resolution matches.
//
// POST body (all optional):
//   { limit?: number = 15, days?: number = 7, only_call_sid?: string, dry_run?: boolean }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MODEL = "google/gemini-2.5-flash";

function clamp(n: any, min: number, max: number): number | null {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  return Math.max(min, Math.min(max, Math.round(v)));
}

const COACHING_SCHEMA = {
  type: "object",
  required: [
    "overall_score",
    "rapport_score",
    "objection_handling_score",
    "qualification_score",
    "closing_score",
    "energy_score",
    "what_went_well",
    "what_to_improve",
    "specific_coaching",
    "customer_sentiment",
    "rep_sentiment",
  ],
  properties: {
    overall_score: { type: "integer", minimum: 0, maximum: 10 },
    rapport_score: { type: "integer", minimum: 0, maximum: 10 },
    objection_handling_score: { type: "integer", minimum: 0, maximum: 10 },
    qualification_score: { type: "integer", minimum: 0, maximum: 10 },
    closing_score: { type: "integer", minimum: 0, maximum: 10 },
    energy_score: { type: "integer", minimum: 0, maximum: 10 },
    script_adherence_percentage: { type: "integer", minimum: 0, maximum: 100 },
    talk_to_listen_ratio: { type: "integer", minimum: 0, maximum: 100 },
    what_went_well: { type: "array", items: { type: "string" } },
    what_to_improve: { type: "array", items: { type: "string" } },
    missed_opportunities: { type: "array", items: { type: "string" } },
    best_moment: { type: "string" },
    worst_moment: { type: "string" },
    specific_coaching: { type: "string" },
    objections_raised: { type: "array", items: { type: "string" } },
    objection_handling_grade: { type: "string" },
    objection_handling_notes: { type: "string" },
    recommended_followup: { type: "string" },
    callback_timing: { type: "string" },
    suggested_talking_points: { type: "array", items: { type: "string" } },
    customer_sentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
    rep_sentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
  },
  additionalProperties: false,
};

async function analyzeOne(opts: {
  transcript: string;
  business: string;
  duration: number;
  lead_name: string | null;
  LOVABLE_API_KEY: string;
}): Promise<any> {
  const sys = `You are an elite call-coaching AI grading an outbound sales call for a "${opts.business}" business unit. Score every dimension 0-10 (harsh, calibrated). Return ONLY the JSON matching the schema — no prose.`;
  const usr = `CALL METADATA
duration_seconds: ${opts.duration}
lead_name: ${opts.lead_name ?? "unknown"}

TRANSCRIPT
${opts.transcript}`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: usr },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "submit_coaching",
            description: "Submit structured coaching analysis for the call.",
            parameters: COACHING_SCHEMA,
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "submit_coaching" } },
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AI gateway ${res.status}: ${t.slice(0, 200)}`);
  }
  const j = await res.json();
  const args =
    j.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) throw new Error("no tool_call in AI response");
  return typeof args === "string" ? JSON.parse(args) : args;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Number(body.limit) || 15, 50);
    const days = Number(body.days) || 7;
    const onlyCallSid: string | undefined = body.only_call_sid;
    const dryRun: boolean = !!body.dry_run;

    let q = supabase
      .from("dc_call_logs")
      .select(
        "id, call_sid, business, source_business, agent_name, duration_seconds, lead_name, transcript, created_at",
      )
      .not("transcript", "is", null)
      .gte("created_at", new Date(Date.now() - days * 86400_000).toISOString())
      .order("created_at", { ascending: false })
      .limit(limit * 4);

    if (onlyCallSid) q = q.eq("call_sid", onlyCallSid);

    const { data: logs, error: logsErr } = await q;
    if (logsErr) throw logsErr;

    const candidates = (logs || []).filter(
      (r: any) => (r.transcript?.length ?? 0) > 150,
    );

    const keys = Array.from(
      new Set(
        candidates.flatMap((r: any) => [r.call_sid, r.id].filter(Boolean)),
      ),
    ) as string[];
    const { data: existing } = await supabase
      .from("dynasty_call_analysis")
      .select("call_id")
      .in("call_id", keys);
    const have = new Set((existing || []).map((r: any) => r.call_id));

    const toRun = candidates
      .filter((r: any) => !have.has(r.call_sid) && !have.has(r.id))
      .slice(0, limit);

    if (dryRun) {
      return new Response(
        JSON.stringify({
          dry_run: true,
          would_analyze: toRun.map((r: any) => ({
            call_sid: r.call_sid,
            id: r.id,
            lead: r.lead_name,
            business: r.business,
            tx_len: r.transcript?.length ?? 0,
          })),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const results: any[] = [];
    for (const r of toRun) {
      const key = r.call_sid || r.id;
      try {
        // Parent row required by dynasty_call_analysis.call_id FK
        // → upsert a stub dynasty_ai_calls row keyed on call_sid.
        const { error: stubErr } = await supabase
          .from("dynasty_ai_calls")
          .upsert(
            {
              call_id: key,
              business_unit: r.business || r.source_business || "top_tier",
              agent_id: r.agent_name || "dc-bland-agent",
              agent_name: r.agent_name || null,
              direction: "outbound",
              call_type: "ai_outbound",
              duration_seconds: r.duration_seconds ?? null,
              contact_name: r.lead_name || null,
              call_started_at: r.created_at || null,
              call_ended_at: r.created_at || null,
              outcome: "completed",
            },
            { onConflict: "call_id" },
          );
        if (stubErr) throw stubErr;

        const a = await analyzeOne({
          transcript: r.transcript,
          business: r.business || r.source_business || "top_tier",
          duration: r.duration_seconds ?? 0,
          lead_name: r.lead_name || null,
          LOVABLE_API_KEY,
        });

        const row = {
          call_id: key,
          overall_score: clamp(a.overall_score, 0, 10),
          rapport_score: clamp(a.rapport_score, 0, 10),
          objection_handling_score: clamp(a.objection_handling_score, 0, 10),
          qualification_score: clamp(a.qualification_score, 0, 10),
          closing_score: clamp(a.closing_score, 0, 10),
          energy_score: clamp(a.energy_score, 0, 10),
          what_went_well: a.what_went_well || [],
          what_to_improve: a.what_to_improve || [],
          missed_opportunities: a.missed_opportunities || [],
          best_moment: a.best_moment ?? null,
          worst_moment: a.worst_moment ?? null,
          specific_coaching: a.specific_coaching ?? null,
          script_adherence_percentage: clamp(a.script_adherence_percentage, 0, 100),
          talk_to_listen_ratio: clamp(a.talk_to_listen_ratio, 0, 100),
          objections_raised: a.objections_raised || [],
          objection_handling_grade: a.objection_handling_grade ?? null,
          objection_handling_notes: a.objection_handling_notes ?? null,
          recommended_followup: a.recommended_followup ?? null,
          callback_timing: a.callback_timing ?? null,
          suggested_talking_points: a.suggested_talking_points || [],
          customer_sentiment: a.customer_sentiment ?? null,
          rep_sentiment: a.rep_sentiment ?? null,
          key_moments: [],
          analysis_version: "v1-backfill",
          claude_model: MODEL,
          analysis_cost_cents: 0,
          analyzed_at: new Date().toISOString(),
        };

        const { error: upErr } = await supabase
          .from("dynasty_call_analysis")
          .upsert(row, { onConflict: "call_id" });
        if (upErr) throw upErr;

        results.push({
          call_sid: r.call_sid,
          id: r.id,
          ok: true,
          overall_score: row.overall_score,
        });
      } catch (e) {
        results.push({
          call_sid: r.call_sid,
          id: r.id,
          ok: false,
          error: (e as Error).message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        scanned: candidates.length,
        already_analyzed: candidates.length - toRun.length,
        attempted: results.length,
        succeeded: results.filter((r) => r.ok).length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[backfill-dc-coaching] error", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
