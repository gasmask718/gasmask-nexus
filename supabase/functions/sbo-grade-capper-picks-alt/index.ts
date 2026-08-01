// ═══════════════════════════════════════════════════════════════
// SBO — ALT-SPORT CAPPER PICK GRADING (GAME / MATCH LEVEL ONLY)
// ═══════════════════════════════════════════════════════════════
// SCOPE LOCK (CFL + MMA only, this pass):
//   Grades rows in sbo_capper_picks. Nothing else.
//
// EXPLICITLY OUT OF SCOPE — this function does not read or write:
//   • sbo_player_props           (no props for these sports)
//   • sbo_predictions            (no AI predictions for these sports)
//   • sbo_player_game_stats / sbo_player_season_splits (stats brain)
//   • sbo_clamp_readiness        (clamp / readiness gates)
//   • sbo_odds / market lines / CLV
//
// Tennis and Golf are deliberately NOT built. Adding them requires a
// new spec (set-score parsing / leaderboard matchups).
//
// Cadence: folded into the existing daily postgame chain in
// sbo-day-engine. No new cron.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  ALT_PICK_SPORTS,
  altConfigForPickSport,
  fetchAltTeamFinals,
  fetchFightResults,
  findFighterOutcome,
  sideForTeam,
  type EspnFinal,
  type FightResult,
} from '../_shared/espnScoreboard.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** American odds → profit in units on a 1u stake. Default -110. */
function unitsFor(result: 'won' | 'lost' | 'push', odds: number | null): number {
  if (result === 'push') return 0;
  if (result === 'lost') return -1;
  const o = Number.isFinite(odds as number) && odds !== 0 ? (odds as number) : -110;
  return o > 0 ? o / 100 : 100 / Math.abs(o);
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split('T')[0];
}

type Verdict = { result: 'won' | 'lost' | 'push'; note: string } | null;

function gradeTeamPick(pick: any, finals: EspnFinal[], cfg: any): Verdict {
  const betType = (pick.bet_type || '').toLowerCase();
  if (!['moneyline', 'spread', 'total'].includes(betType)) return null;
  if (!pick.team) return null;

  let final: EspnFinal | null = null;
  let side: 'home' | 'away' | null = null;
  for (const f of finals) {
    const s = sideForTeam(cfg, pick.team, f);
    if (s) { final = f; side = s; break; }
  }
  if (!final || !side) return null;

  const ours = side === 'home' ? final.homeScore : final.awayScore;
  const theirs = side === 'home' ? final.awayScore : final.homeScore;
  const label = `${final.awayName} ${final.awayScore} @ ${final.homeName} ${final.homeScore}`;

  if (betType === 'moneyline') {
    if (ours === theirs) return { result: 'push', note: `Draw. ${label}` };
    return { result: ours > theirs ? 'won' : 'lost', note: `${pick.team} ML. ${label}` };
  }

  if (betType === 'spread') {
    if (pick.line === null || pick.line === undefined) return null;
    const adj = (ours - theirs) + Number(pick.line);
    if (Math.abs(adj) < 0.001) return { result: 'push', note: `Spread push. ${label}` };
    return { result: adj > 0 ? 'won' : 'lost', note: `${pick.team} ${Number(pick.line) > 0 ? '+' : ''}${pick.line}. ${label}` };
  }

  // total
  if (pick.line === null || pick.line === undefined) return null;
  const dir = (pick.direction || '').toUpperCase();
  if (dir !== 'OVER' && dir !== 'UNDER') return null;
  const total = final.homeScore + final.awayScore;
  if (Math.abs(total - Number(pick.line)) < 0.001) return { result: 'push', note: `Total push at ${pick.line}. ${label}` };
  const wentOver = total > Number(pick.line);
  return { result: (dir === 'OVER') === wentOver ? 'won' : 'lost', note: `${dir} ${pick.line} → ${total}. ${label}` };
}

function gradeFightPick(pick: any, fights: FightResult[]): Verdict {
  const betType = (pick.bet_type || '').toLowerCase();
  // Fight-winner picks only. Method / round-total / parlay legs stay pending.
  if (betType !== 'moneyline') return null;
  const dir = (pick.direction || 'WIN').toUpperCase();
  if (dir !== 'WIN') return null;
  const name = pick.player_name || pick.team;
  if (!name) return null;
  const hit = findFighterOutcome(fights, name);
  if (!hit) return null;
  const opp = hit.fight.competitors.find(c => c.name !== hit.matched)?.name ?? 'opponent';
  return {
    result: hit.won ? 'won' : 'lost',
    note: `${hit.matched} vs ${opp} → ${hit.matched} ${hit.won ? 'WON' : 'LOST'}`,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const date: string = body.date || new Date().toISOString().split('T')[0];
    const lookbackDays: number = Number(body.lookback_days ?? 30);
    const dryRun: boolean = body.dry_run === true;
    const since = addDays(date, -Math.abs(lookbackDays));

    const { data: picks, error: pickErr } = await supabase
      .from('sbo_capper_picks')
      .select('id, sport, bet_type, team, player_name, line, direction, odds, game_date')
      .in('sport', ALT_PICK_SPORTS)
      .in('result', ['pending'])
      .not('game_date', 'is', null)
      .gte('game_date', since)
      .lte('game_date', date)
      .order('game_date', { ascending: true })
      .limit(1000);

    if (pickErr) throw pickErr;

    const pending = picks ?? [];
    // Group by (sport-config, date) so each ESPN scoreboard is fetched once.
    const buckets = new Map<string, any[]>();
    for (const p of pending) {
      const cfg = altConfigForPickSport(p.sport);
      if (!cfg) continue;
      const key = `${cfg.espnPath}|${p.game_date}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(p);
    }

    const updates: { id: string; result: 'won' | 'lost' | 'push'; units: number }[] = [];
    const feedNotes: string[] = [];
    const bySport: Record<string, { considered: number; graded: number; unmatched: number }> = {};

    for (const [key, group] of buckets) {
      const [, gameDate] = key.split('|');
      const cfg = altConfigForPickSport(group[0].sport)!;
      const sportLabel = cfg.pickSports[0];
      bySport[sportLabel] ??= { considered: 0, graded: 0, unmatched: 0 };
      bySport[sportLabel].considered += group.length;

      if (cfg.kind === 'team') {
        // Night games can land on the next UTC day.
        const finals: EspnFinal[] = [];
        let feedOk = false;
        for (const d of [gameDate, addDays(gameDate, 1)]) {
          const r = await fetchAltTeamFinals(cfg, d);
          if (r.ok) { feedOk = true; finals.push(...r.finals); }
          else feedNotes.push(`${sportLabel} ${d}: ${r.error}`);
        }
        if (feedOk && finals.length === 0) feedNotes.push(`${sportLabel} ${gameDate}: ESPN returned no completed events`);
        for (const p of group) {
          const v = gradeTeamPick(p, finals, cfg);
          if (!v) { bySport[sportLabel].unmatched++; continue; }
          updates.push({ id: p.id, result: v.result, units: unitsFor(v.result, p.odds) });
          bySport[sportLabel].graded++;
        }
      } else {
        const fights: FightResult[] = [];
        let feedOk = false;
        for (const d of [gameDate, addDays(gameDate, 1)]) {
          const r = await fetchFightResults(cfg, d);
          if (r.ok) { feedOk = true; fights.push(...r.fights); }
          else feedNotes.push(`${sportLabel} ${d}: ${r.error}`);
        }
        if (feedOk && fights.length === 0) feedNotes.push(`${sportLabel} ${gameDate}: ESPN returned no completed bouts`);
        for (const p of group) {
          const v = gradeFightPick(p, fights);
          if (!v) { bySport[sportLabel].unmatched++; continue; }
          updates.push({ id: p.id, result: v.result, units: unitsFor(v.result, p.odds) });
          bySport[sportLabel].graded++;
        }
      }
    }

    let written = 0;
    if (!dryRun) {
      for (const u of updates) {
        const { error } = await supabase
          .from('sbo_capper_picks')
          .update({
            result: u.result,
            pnl_units: u.units,
            profit_loss: u.units,
            resolved_at: new Date().toISOString(),
          })
          .eq('id', u.id);
        if (!error) written++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      date,
      since,
      dry_run: dryRun,
      pending_considered: pending.length,
      graded: updates.length,
      records_synced: written,
      by_sport: bySport,
      feed_notes: feedNotes.slice(0, 20),
      scope: 'capper picks only — no props, predictions, stats brain, clamp gates, or market lines',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e?.message ?? String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
