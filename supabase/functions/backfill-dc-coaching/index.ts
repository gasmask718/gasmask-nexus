// One-shot backfill: run claude-call-analyzer coaching pass on DC call logs
// that have a transcript but no dynasty_call_analysis row yet.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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

    // Skip rows that already have a dynasty_call_analysis row (by call_sid OR id).
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
        const invokeRes = await fetch(
          `${SUPABASE_URL}/functions/v1/claude-call-analyzer`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${SERVICE_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              call_id: key,
              business_unit: r.business || r.source_business || "top_tier",
              transcript: r.transcript,
              duration_seconds: r.duration_seconds ?? 0,
              contact_name: r.lead_name || null,
              company_name: null,
            }),
          },
        );
        const json = await invokeRes.json().catch(() => ({}));
        results.push({
          call_sid: r.call_sid,
          id: r.id,
          ok: invokeRes.ok,
          status: invokeRes.status,
          overall_score: json?.analysis?.overall_score ?? null,
          error: invokeRes.ok ? null : (json?.error || `HTTP ${invokeRes.status}`),
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
