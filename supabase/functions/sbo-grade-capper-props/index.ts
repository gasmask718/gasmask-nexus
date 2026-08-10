// ═══════════════════════════════════════════════════════════════
// SBO — CAPPER PLAYER-PROP GRADER (MLB v1)
// ═══════════════════════════════════════════════════════════════
// Grades single-player prop picks in sbo_capper_picks against the box scores
// already ingested into sbo_player_game_stats.
//
// SCOPE LOCK (MLB only, this pass):
//   • bet_type = 'prop', player_name present, numeric line, OVER/UNDER
//   • separate from sbo-verify-results (market props) and from
//     sbo-grade-capper-picks-alt (CFL/MMA game-level)
//
// OUT OF SCOPE — not read, not written:
//   sbo_player_props, sbo_predictions, sbo_signals, clamp/readiness gates,
//   market lines / CLV, parlays, NRFI / team-level props, non-MLB sports.
//
// PLAYER IDENTITY (Stage 2c rules, non-negotiable):
//   1. player_id → player_key when the pick carries one (capper picks do not yet)
//   2. name + team narrowing
//   3. bail out — leave pending with a reason. NEVER guess, never blend rows.
//
// PUSH RULE: actual === line grades push. Exact equality, no tolerance, no
// rounding — identical to sbo-verify-results. Do not diverge.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  statSpecFor,
  isAmbiguousStrikeouts,
  STRIKEOUTS_PITCHING,
  STRIKEOUTS_BATTING,
  actualValue,
  gradeOverUnder,
  type StatSpec,
} from '../_shared/statLine.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GRADING_SOURCE = 'espn_box_score';

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

function normalizePlayer(name: string): string {
  if (!name) return '';
  return name.toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z\s]/g, '')
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, '')
    .replace(/\s+/g, ' ').trim();
}

function normalizeTeam(t: string | null): string {
  return (t || '').toLowerCase().replace(/[^a-z]/g, '');
}

type StatRow = {
  player_key: string | null;
  player_id: string | null;
  player_name: string;
  team: string | null;
  game_date: string;
  stat_line: Record<string, unknown>;
};

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
    const limit: number = Number(body.limit ?? 500);
    const since = addDays(date, -Math.abs(lookbackDays));

    // Sports to grade. Default is the Phase 6 MLB scope plus the free-ESPN
    // basketball sports whose box scores now exist (Phase 7a). Case-insensitive:
    // sbo_capper_picks stores 'MLB'/'NBA' uppercase, sbo_player_game_stats lowercase.
    const sports: string[] = (Array.isArray(body.sports) && body.sports.length
      ? body.sports
      : ['mlb', 'nba', 'wnba']).map((s: string) => String(s).toLowerCase());
    const sportVariants = sports.flatMap((s) => [s, s.toUpperCase()]);

    // ── 1. Candidate picks ────────────────────────────────────────
    const { data: picks, error: pickErr } = await supabase
      .from('sbo_capper_picks')
      .select('id, sport, bet_type, prop_type, player_name, team, opponent, line, direction, odds, game_date, result')
      .in('sport', sportVariants)
      .eq('bet_type', 'prop')
      .eq('result', 'pending')
      .not('player_name', 'is', null)
      .not('game_date', 'is', null)
      .gte('game_date', since)
      .lte('game_date', date)
      .order('game_date', { ascending: false })
      .limit(limit);
    if (pickErr) throw pickErr;
    const pending = picks ?? [];

    // ── 2. Box scores for the (sport, date) pairs in play (paginated) ──
    const datesBySport = new Map<string, Set<string>>();
    for (const p of pending as any[]) {
      const s = String(p.sport || '').toLowerCase();
      if (!datesBySport.has(s)) datesBySport.set(s, new Set());
      datesBySport.get(s)!.add(p.game_date);
    }
    // Keyed 'sport|date' so an NBA date can never read an MLB box score.
    const statsByKey = new Map<string, StatRow[]>();
    for (const [sport, dateSet] of datesBySport) {
      const dates = [...dateSet];
      if (!dates.length) continue;
      const page = 1000;
      for (let from = 0; ; from += page) {
        const { data, error } = await supabase
          .from('sbo_player_game_stats')
          .select('player_key, player_id, player_name, team, game_date, stat_line')
          .eq('sport', sport)
          .in('game_date', dates)
          .range(from, from + page - 1);
        if (error) throw error;
        for (const r of (data ?? []) as StatRow[]) {
          const k = `${sport}|${r.game_date}`;
          if (!statsByKey.has(k)) statsByKey.set(k, []);
          statsByKey.get(k)!.push(r);
        }
        if (!data || data.length < page) break;
      }
    }


    // ── 3. Grade ──────────────────────────────────────────────────
    type Graded = {
      id: string; player: string; prop: string; direction: string; line: number;
      actual: number; result: 'won' | 'lost' | 'push'; units: number; why: string;
    };
    type Skipped = { id: string; player: string; prop: string; reason: string };

    const graded: Graded[] = [];
    const skipped: Skipped[] = [];
    const reasonCounts: Record<string, number> = {};
    const bump = (r: string) => { reasonCounts[r] = (reasonCounts[r] ?? 0) + 1; };

    for (const p of pending as any[]) {
      const label = `${p.player_name} ${p.direction ?? '?'} ${p.line ?? '?'} ${p.prop_type ?? '?'}`;
      const skip = (reason: string) => {
        skipped.push({ id: p.id, player: p.player_name, prop: p.prop_type, reason });
        bump(reason.split(' —')[0]);
      };

      const dir = (p.direction || '').toUpperCase();
      if (dir !== 'OVER' && dir !== 'UNDER') { skip('no OVER/UNDER direction'); continue; }
      if (p.line === null || p.line === undefined || !Number.isFinite(Number(p.line))) {
        skip('no numeric line'); continue;
      }

      let spec: StatSpec | null = statSpecFor(p.prop_type || '');
      const ambiguousK = !spec && isAmbiguousStrikeouts(p.prop_type || '');
      if (!spec && !ambiguousK) {
        skip(`prop type not gradable from box score (${p.prop_type})`); continue;
      }

      // ── Player resolution (Stage 2c order) ──
      const rows = statsByDate.get(p.game_date) ?? [];
      if (!rows.length) { skip('no box scores ingested for that date'); continue; }
      const target = normalizePlayer(p.player_name);
      let matches = rows.filter((r) => normalizePlayer(r.player_name) === target);

      if (!matches.length) { skip('player not found in box scores for that date'); continue; }
      if (matches.length > 1) {
        const pickTeam = normalizeTeam(p.team);
        const narrowed = pickTeam
          ? matches.filter((r) => {
              const rt = normalizeTeam(r.team);
              return rt && (rt === pickTeam || rt.includes(pickTeam) || pickTeam.includes(rt));
            })
          : [];
        // Distinct identities left after narrowing? If >1 identity, bail — never blend.
        const identities = new Set(narrowed.map((r) => r.player_key ?? r.player_name));
        if (narrowed.length && identities.size === 1) matches = narrowed;
        else { skip('ambiguous player identity — multiple matches, cannot disambiguate'); continue; }
      }
      const row = matches[0];

      // Disambiguate bare "strikeouts" by which side of the box score the row has.
      if (!spec) {
        const pitched = row.stat_line?.['pitched'] === true;
        const batted = row.stat_line?.['batted'] === true;
        if (pitched && !batted) spec = STRIKEOUTS_PITCHING;
        else if (batted && !pitched) spec = STRIKEOUTS_BATTING;
        else { skip('ambiguous strikeouts prop — player both pitched and batted'); continue; }
      }

      const actual = actualValue(row.stat_line ?? {}, spec);
      if (actual === null) {
        skip(`box score missing ${spec.label} for that player`); continue;
      }

      const line = Number(p.line);
      const result = gradeOverUnder(actual, line, dir);
      graded.push({
        id: p.id,
        player: p.player_name,
        prop: p.prop_type,
        direction: dir,
        line,
        actual,
        result,
        units: unitsFor(result, p.odds),
        why: `${label} → ${spec.label} = ${actual} (${result}${result === 'push' ? ', exact equality' : ''})`,
      });
    }

    // ── 4. Write (only when not a dry run) ────────────────────────
    let written = 0;
    if (!dryRun) {
      for (const g of graded) {
        const { error } = await supabase
          .from('sbo_capper_picks')
          .update({
            result: g.result,
            pnl_units: g.units,
            profit_loss: g.units,
            actual_value: g.actual,
            graded_at: new Date().toISOString(),
            grading_source: GRADING_SOURCE,
            resolved_at: new Date().toISOString(),
            unsupported: false,
            unsupported_reason: null,
          })
          .eq('id', g.id);
        if (!error) written++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      dry_run: dryRun,
      date,
      since,
      pending_considered: pending.length,
      would_grade: graded.length,
      records_written: written,
      left_pending: skipped.length,
      by_result: graded.reduce((a: Record<string, number>, g) => {
        a[g.result] = (a[g.result] ?? 0) + 1; return a;
      }, {}),
      skip_reasons: reasonCounts,
      grade_table: graded,
      pending_table: skipped,
      scope: 'MLB capper single-player props only — no market props, predictions, signals, or clamp gates',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e?.message ?? String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
