import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SPORTS = ["mlb", "nba"];
const WINDOW_DAYS = 60;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    let sports = SPORTS;
    try {
      const body = await req.json();
      if (Array.isArray(body?.sports) && body.sports.length) sports = body.sports;
      else if (typeof body?.sport === "string") sports = [body.sport];
    } catch (_) { /* no body — evaluate all */ }

    const rows: any[] = [];

    for (const sport of sports) {
      const { data, error } = await supabase.rpc("sbo_evaluate_clamp_gates", {
        p_sport: sport,
        p_days: WINDOW_DAYS,
      });
      if (error) throw new Error(`${sport}: ${error.message}`);

      const m = (Array.isArray(data) ? data[0] : data) ?? {};
      const n = Number(m.n ?? 0);
      const wins = Number(m.wins ?? 0);
      const p = Number(m.p ?? 0);
      const ciLow = Number(m.ci_low ?? 0);
      const covTotal = Number(m.cov_total ?? 0);
      const covFull = Number(m.cov_full ?? 0);
      const covPct = covTotal > 0 ? covFull / covTotal : 0;
      const hiN = Number(m.hi_n ?? 0);
      const loN = Number(m.lo_n ?? 0);
      const hiRate = m.hi_rate === null || m.hi_rate === undefined ? null : Number(m.hi_rate);
      const loRate = m.lo_rate === null || m.lo_rate === undefined ? null : Number(m.lo_rate);

      const gateVolume = n >= 150;
      const gateAccuracy = p >= 0.524;
      const gateCi = ciLow >= 0.50;
      const gateCoverage = covTotal > 0 && covPct >= 0.60;
      const gateCalibration =
        hiN >= 20 && loN >= 20 && hiRate !== null && loRate !== null && hiRate > loRate;

      const gates: Record<string, boolean> = {
        volume: gateVolume,
        accuracy: gateAccuracy,
        ci: gateCi,
        coverage: gateCoverage,
        calibration: gateCalibration,
      };
      const blocking = Object.entries(gates).filter(([, v]) => !v).map(([k]) => k);
      const gatesPassed = 5 - blocking.length;

      const row = {
        sport,
        window_days: WINDOW_DAYS,
        graded_n: n,
        wins,
        win_rate: p,
        ci_lower: ciLow,
        coverage_total: covTotal,
        coverage_full: covFull,
        coverage_pct: covPct,
        hi_bucket_n: hiN,
        hi_bucket_rate: hiRate,
        lo_bucket_n: loN,
        lo_bucket_rate: loRate,
        gate_volume: gateVolume,
        gate_accuracy: gateAccuracy,
        gate_ci: gateCi,
        gate_coverage: gateCoverage,
        gate_calibration: gateCalibration,
        gates_passed: gatesPassed,
        all_gates_pass: blocking.length === 0,
        blocking_gates: blocking,
        notes: {
          thresholds: { volume: 150, accuracy: 0.524, ci: 0.5, coverage: 0.6, bucket_min_n: 20 },
          raw: m,
        },
      };

      const { data: inserted, error: insErr } = await supabase
        .from("sbo_clamp_readiness")
        .insert(row)
        .select()
        .single();
      if (insErr) throw new Error(`${sport} insert: ${insErr.message}`);
      rows.push(inserted);
    }

    return new Response(JSON.stringify({ success: true, evaluated: rows }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("sbo-clamp-readiness error", e);
    return new Response(JSON.stringify({ success: false, error: String((e as Error).message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
