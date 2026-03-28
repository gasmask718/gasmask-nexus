import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const bodyText = await req.text();
  let body: Record<string, unknown> = {};
  try { body = JSON.parse(bodyText); } catch { body = {}; }

  const mode = (body.mode as string) || 'resolve';

  try {
    // ── MODE: ingest ── Store external results from API data
    if (mode === 'ingest') {
      const results = body.results as Array<{
        event_id?: string;
        sport?: string;
        player_name: string;
        team?: string;
        opponent?: string;
        stat_type: string;
        actual_value: number;
        game_date: string;
        api_provider?: string;
        raw_data?: Record<string, unknown>;
      }>;

      if (!results?.length) {
        return new Response(JSON.stringify({ error: 'No results provided' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const rows = results.map(r => ({
        event_id: r.event_id || null,
        sport: r.sport || 'NBA',
        player_name: r.player_name,
        team: r.team || null,
        opponent: r.opponent || null,
        stat_type: r.stat_type,
        actual_value: r.actual_value,
        game_date: r.game_date,
        source: 'api',
        api_provider: r.api_provider || 'manual',
        verified: true,
        raw_data: r.raw_data || null,
      }));

      const { data, error } = await supabase
        .from('sbo_external_results')
        .upsert(rows, { onConflict: 'player_name,stat_type,game_date,sport' })
        .select('id');

      if (error) throw error;

      return new Response(JSON.stringify({
        success: true,
        ingested: data?.length || 0,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── MODE: resolve ── Match capper picks to external results
    if (mode === 'resolve') {
      const sport = (body.sport as string) || 'NBA';
      const dateFrom = body.date_from as string;
      const dateTo = body.date_to as string;

      // Get unresolved capper picks
      let picksQuery = supabase
        .from('sbo_capper_picks')
        .select('id, player_name, stat_type, line, direction, game_date, capper_id')
        .is('result', null)
        .eq('data_source', 'manual');

      if (dateFrom) picksQuery = picksQuery.gte('game_date', dateFrom);
      if (dateTo) picksQuery = picksQuery.lte('game_date', dateTo);

      const { data: picks, error: picksErr } = await picksQuery.limit(500);
      if (picksErr) throw picksErr;
      if (!picks?.length) {
        return new Response(JSON.stringify({ resolved: 0, message: 'No unresolved picks found' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get external results for the date range
      const dates = [...new Set(picks.map(p => p.game_date).filter(Boolean))];
      if (!dates.length) {
        return new Response(JSON.stringify({ resolved: 0, message: 'No dates to match' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data: extResults, error: extErr } = await supabase
        .from('sbo_external_results')
        .select('*')
        .eq('sport', sport)
        .in('game_date', dates);

      if (extErr) throw extErr;
      if (!extResults?.length) {
        return new Response(JSON.stringify({ resolved: 0, message: 'No external results for these dates' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Match and resolve
      let resolved = 0;
      const updates: Array<{ id: string; result: string; external_result_id: string; data_source: string }> = [];

      for (const pick of picks) {
        const playerNorm = normalizeName(pick.player_name || '');
        const match = extResults.find(r =>
          normalizeName(r.player_name) === playerNorm &&
          (r.stat_type || '').toLowerCase() === (pick.stat_type || '').toLowerCase() &&
          r.game_date === pick.game_date
        );

        if (!match || match.actual_value == null) continue;

        const direction = (pick.direction || '').toLowerCase();
        const line = pick.line || 0;
        const actual = Number(match.actual_value);
        let result: string;

        if (actual === line) {
          result = 'push';
        } else if (['over', 'more', 'yes'].includes(direction)) {
          result = actual > line ? 'win' : 'loss';
        } else if (['under', 'less', 'no'].includes(direction)) {
          result = actual < line ? 'win' : 'loss';
        } else {
          continue;
        }

        updates.push({
          id: pick.id,
          result,
          external_result_id: match.id,
          data_source: 'external',
        });
        resolved++;
      }

      // Batch update picks
      for (const u of updates) {
        await supabase
          .from('sbo_capper_picks')
          .update({
            result: u.result,
            external_result_id: u.external_result_id,
            data_source: u.data_source,
          })
          .eq('id', u.id);
      }

      // Update capper stats (ONLY capper stats, NOT props_master)
      const capperIds = [...new Set(updates.map(u => {
        const pick = picks.find(p => p.id === u.id);
        return pick?.capper_id;
      }).filter(Boolean))];

      for (const capperId of capperIds) {
        const { data: capperPicks } = await supabase
          .from('sbo_capper_picks')
          .select('result')
          .eq('capper_id', capperId)
          .not('result', 'is', null);

        if (capperPicks?.length) {
          const wins = capperPicks.filter(p => p.result === 'win').length;
          const total = capperPicks.length;
          const winRate = Math.round((wins / total) * 100);

          await supabase
            .from('sbo_cappers')
            .update({
              win_rate: winRate,
              total_picks: total,
              last_active: new Date().toISOString(),
            })
            .eq('id', capperId);
        }
      }

      return new Response(JSON.stringify({
        success: true,
        resolved,
        cappers_updated: capperIds.length,
        message: `Resolved ${resolved} picks using external results (capper stats ONLY, main engine untouched)`,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── MODE: status ── Check external results coverage
    if (mode === 'status') {
      const { count: totalResults } = await supabase
        .from('sbo_external_results')
        .select('*', { count: 'exact', head: true });

      const { count: unresolvedPicks } = await supabase
        .from('sbo_capper_picks')
        .select('*', { count: 'exact', head: true })
        .is('result', null);

      const { count: externallyResolved } = await supabase
        .from('sbo_capper_picks')
        .select('*', { count: 'exact', head: true })
        .eq('data_source', 'external');

      return new Response(JSON.stringify({
        external_results_count: totalResults || 0,
        unresolved_capper_picks: unresolvedPicks || 0,
        externally_resolved_picks: externallyResolved || 0,
        isolation: 'ACTIVE — external results do NOT affect props_master',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: `Unknown mode: ${mode}` }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function normalizeName(name: string): string {
  return name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z\s]/g, '')
    .toLowerCase()
    .trim();
}
