import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const PAGE = 1000;

function weekWindow(now: Date) {
  // most recent Sunday 00:00:00 UTC .. that Saturday 23:59:59 UTC
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - d.getUTCDay()); // back to Sunday
  const start = new Date(d);
  const end = new Date(d);
  end.setUTCDate(end.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);
  return { start, end };
}
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const pct = (w: number, l: number) =>
  w + l === 0 ? null : Math.round((w / (w + l)) * 10000) / 100;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Allow an explicit week override for backfills: { "week_start": "2026-07-27" }
    let overrideStart: Date | null = null;
    try {
      const body = await req.json();
      if (body?.week_start) overrideStart = new Date(`${body.week_start}T00:00:00.000Z`);
    } catch (_) { /* no body */ }

    let start: Date, end: Date;
    if (overrideStart) {
      start = overrideStart;
      end = new Date(overrideStart);
      end.setUTCDate(end.getUTCDate() + 6);
      end.setUTCHours(23, 59, 59, 999);
    } else {
      ({ start, end } = weekWindow(new Date()));
    }

    // ---- STEP 2: pull the week's decided picks (paged) ----
    type Pick = {
      id: string; capper_id: string | null; sport: string | null;
      result: string; profit_loss: number | null;
    };
    const picks: Pick[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from("sbo_capper_picks")
        .select("id, capper_id, sport, result, profit_loss")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .in("result", ["won", "lost", "push"])
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw new Error(`picks read failed: ${error.message}`);
      picks.push(...((data ?? []) as Pick[]));
      if (!data || data.length < PAGE) break;
    }

    // ---- Query A: overall ----
    const total_picks = picks.length;
    const total_wins = picks.filter((p) => p.result === "won").length;
    const total_losses = picks.filter((p) => p.result === "lost").length;
    const total_pushes = picks.filter((p) => p.result === "push").length;
    const overall_units_pnl =
      Math.round(picks.reduce((s, p) => s + Number(p.profit_loss ?? 0), 0) * 100) / 100;
    const overall_win_rate = pct(total_wins, total_losses) ?? 0;

    // ---- Query B: per-sport (HAVING decided >= 5) ----
    const bySport = new Map<string, { picks: number; wins: number; losses: number; units_pnl: number }>();
    for (const p of picks) {
      const k = p.sport ?? "UNKNOWN";
      const r = bySport.get(k) ?? { picks: 0, wins: 0, losses: 0, units_pnl: 0 };
      r.picks++;
      if (p.result === "won") r.wins++;
      if (p.result === "lost") r.losses++;
      r.units_pnl += Number(p.profit_loss ?? 0);
      bySport.set(k, r);
    }
    const sport_breakdown: Record<string, unknown> = {};
    const sportRanked: { sport: string; win_rate: number }[] = [];
    for (const [sport, r] of bySport) {
      const decided = r.wins + r.losses;
      if (decided < 5) continue; // RULE 2 noise floor
      const win_rate = pct(r.wins, r.losses)!;
      sport_breakdown[sport] = {
        picks: r.picks, wins: r.wins, losses: r.losses,
        win_rate, units_pnl: Math.round(r.units_pnl * 100) / 100,
      };
      sportRanked.push({ sport, win_rate });
    }
    sportRanked.sort((a, b) => b.win_rate - a.win_rate);
    const best_sport = sportRanked[0]?.sport ?? null;
    const worst_sport = sportRanked.length ? sportRanked[sportRanked.length - 1].sport : null;

    // ---- Query C: per-capper (HAVING picks >= 3) ----
    const capperIds = [...new Set(picks.map((p) => p.capper_id).filter(Boolean))] as string[];
    const capperMeta = new Map<string, { name: string; capper_weight: number | null }>();
    for (let i = 0; i < capperIds.length; i += 200) {
      const { data, error } = await supabase
        .from("sbo_cappers")
        .select("id, name, capper_weight")
        .in("id", capperIds.slice(i, i + 200));
      if (error) throw new Error(`cappers read failed: ${error.message}`);
      for (const c of data ?? []) capperMeta.set(c.id, { name: c.name, capper_weight: c.capper_weight });
    }

    const byCapper = new Map<string, { picks: number; wins: number; losses: number }>();
    for (const p of picks) {
      if (!p.capper_id) continue;
      const r = byCapper.get(p.capper_id) ?? { picks: 0, wins: 0, losses: 0 };
      r.picks++;
      if (p.result === "won") r.wins++;
      if (p.result === "lost") r.losses++;
      byCapper.set(p.capper_id, r);
    }
    const capper_breakdown: Record<string, unknown> = {};
    const capperRanked: { name: string; win_rate: number; decided: number }[] = [];
    for (const [id, r] of byCapper) {
      if (r.picks < 3) continue;
      const meta = capperMeta.get(id);
      if (!meta) continue;
      const decided = r.wins + r.losses;
      const win_rate = pct(r.wins, r.losses);
      capper_breakdown[meta.name] = {
        picks: r.picks, wins: r.wins, losses: r.losses,
        win_rate, capper_weight: meta.capper_weight,
      };
      if (decided >= 5 && win_rate !== null) capperRanked.push({ name: meta.name, win_rate, decided });
    }
    capperRanked.sort((a, b) => b.win_rate - a.win_rate);
    const best_capper = capperRanked[0]?.name ?? null;

    // ---- capper_weight_changes: prior week's report is the "before" source ----
    const prevStart = new Date(start);
    prevStart.setUTCDate(prevStart.getUTCDate() - 7);
    const { data: prevReport } = await supabase
      .from("sbo_weekly_reports")
      .select("capper_breakdown")
      .eq("week_start", ymd(prevStart))
      .maybeSingle();
    const prevBreak = (prevReport?.capper_breakdown ?? {}) as Record<string, { capper_weight?: number }>;
    const capper_weight_changes: Record<string, unknown> = {};
    for (const [name, row] of Object.entries(capper_breakdown as Record<string, { capper_weight: number | null }>)) {
      const after = Number(row.capper_weight ?? 0);
      const priorRaw = prevBreak?.[name]?.capper_weight;
      if (priorRaw === undefined || priorRaw === null) {
        capper_weight_changes[name] = { before: after, after, change: 0, note: "no change" };
      } else {
        const before = Number(priorRaw);
        capper_weight_changes[name] = {
          before, after, change: Math.round((after - before) * 1000) / 1000,
        };
      }
    }

    // ---- STEP 4: Claude narrative (null-guarded) ----
    let ai_narrative = "Narrative unavailable — API key not configured";
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (anthropicKey) {
      try {
        const payload = {
          week_start: ymd(start),
          week_end: ymd(end),
          overall: { total_picks, total_wins, overall_win_rate, overall_units_pnl },
          best_sport, worst_sport, best_capper,
          sport_breakdown, capper_breakdown,
        };
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": anthropicKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-5",
            max_tokens: 1000,
            system:
              "You are the AI analyst for a sports betting operation called Dynasty Connect. Write a concise, direct Monday morning performance review. Use real numbers. Be honest about bad weeks. Max 400 words.",
            messages: [{
              role: "user",
              content:
                `${JSON.stringify(payload, null, 2)}\n\nWrite the weekly review with exactly these sections:\n\n## Week Summary\n## Best Sport\n## Worst Sport\n## Top Capper\n## Capper Weight Changes\n## Action Items\n## Next Week Focus`,
            }],
          }),
        });
        if (res.ok) {
          const j = await res.json();
          const text = (j?.content ?? []).map((b: { text?: string }) => b.text ?? "").join("\n").trim();
          ai_narrative = text || "Narrative unavailable — empty model response";
        } else {
          const errTxt = await res.text();
          ai_narrative = `Narrative unavailable — model error ${res.status}: ${errTxt.slice(0, 200)}`;
        }
      } catch (e) {
        ai_narrative = `Narrative unavailable — ${e instanceof Error ? e.message : "call failed"}`;
      }
    }

    // ---- STEP 5: UPSERT ----
    const row = {
      report_date: ymd(new Date()),
      week_start: ymd(start),
      week_end: ymd(end),
      total_picks,
      total_wins,
      overall_win_rate,
      overall_units_pnl,
      best_sport,
      worst_sport,
      best_capper,
      sport_breakdown,
      capper_breakdown,
      prop_performance: {},
      capper_weight_changes,
      recommendations: [],
      ai_narrative,
    };
    const { data: saved, error: upsertErr } = await supabase
      .from("sbo_weekly_reports")
      .upsert(row, { onConflict: "week_start" })
      .select("id, week_start, week_end, total_picks, overall_win_rate")
      .single();
    if (upsertErr) throw new Error(`upsert failed: ${upsertErr.message}`);

    return json({
      success: true,
      report: saved,
      totals: { total_picks, total_wins, total_losses, total_pushes, overall_win_rate, overall_units_pnl },
      best_sport, worst_sport, best_capper,
      sports_qualified: sportRanked.length,
      cappers_reported: Object.keys(capper_breakdown).length,
      narrative_ok: !ai_narrative.startsWith("Narrative unavailable"),
      ai_narrative_preview: ai_narrative.slice(0, 200),
    });
  } catch (e) {
    return json({ success: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
