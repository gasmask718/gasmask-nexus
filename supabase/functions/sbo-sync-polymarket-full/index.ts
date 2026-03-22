import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const NBA_TEAMS: Record<string, string[]> = {
  'Hawks': ['ATL', 'Atlanta'], 'Celtics': ['BOS', 'Boston'], 'Nets': ['BKN', 'Brooklyn'],
  'Hornets': ['CHA', 'Charlotte'], 'Bulls': ['CHI', 'Chicago'], 'Cavaliers': ['CLE', 'Cleveland'],
  'Mavericks': ['DAL', 'Dallas'], 'Nuggets': ['DEN', 'Denver'], 'Pistons': ['DET', 'Detroit'],
  'Warriors': ['GS', 'Golden State'], 'Rockets': ['HOU', 'Houston'], 'Pacers': ['IND', 'Indiana'],
  'Clippers': ['LAC', 'LA Clippers'], 'Lakers': ['LAL', 'LA Lakers'], 'Grizzlies': ['MEM', 'Memphis'],
  'Heat': ['MIA', 'Miami'], 'Bucks': ['MIL', 'Milwaukee'], 'Timberwolves': ['MIN', 'Minnesota'],
  'Pelicans': ['NO', 'New Orleans'], 'Knicks': ['NY', 'New York'], 'Thunder': ['OKC', 'Oklahoma City'],
  'Magic': ['ORL', 'Orlando'], 'Sixers': ['PHI', 'Philadelphia'], 'Suns': ['PHO', 'Phoenix'],
  'Blazers': ['POR', 'Portland'], 'Kings': ['SAC', 'Sacramento'], 'Spurs': ['SA', 'San Antonio'],
  'Raptors': ['TOR', 'Toronto'], 'Jazz': ['UTA', 'Utah'], 'Wizards': ['WAS', 'Washington'],
};

function findTeamInText(text: string): string | null {
  const lower = text.toLowerCase();
  for (const [teamName, aliases] of Object.entries(NBA_TEAMS)) {
    if (lower.includes(teamName.toLowerCase())) return teamName;
    for (const alias of aliases) {
      if (lower.includes(alias.toLowerCase())) return teamName;
    }
  }
  return null;
}

function classifyMarket(question: string) {
  const q = question.toLowerCase();

  const propPatterns = [
    { pattern: /(\d+\.?\d*)\+?\s*points/i, type: 'points' },
    { pattern: /(\d+\.?\d*)\+?\s*assists/i, type: 'assists' },
    { pattern: /(\d+\.?\d*)\+?\s*rebounds/i, type: 'rebounds' },
    { pattern: /(\d+\.?\d*)\+?\s*three/i, type: 'threes' },
    { pattern: /(\d+\.?\d*)\+?\s*3-point/i, type: 'threes' },
    { pattern: /(\d+\.?\d*)\+?\s*steals/i, type: 'steals' },
    { pattern: /(\d+\.?\d*)\+?\s*blocks/i, type: 'blocks' },
    { pattern: /over\/under\s+(\d+\.?\d*)\s+points/i, type: 'points' },
    { pattern: /over\/under\s+(\d+\.?\d*)\s+assists/i, type: 'assists' },
  ];

  for (const { pattern, type } of propPatterns) {
    const match = question.match(pattern);
    if (match) {
      const line = parseFloat(match[1]);
      const nameMatch = question.match(/^([A-Z][a-z]+\s+[A-Z][a-z]+)/);
      return { market_type: 'player_prop', home_team: null, away_team: null, player_name: nameMatch ? nameMatch[1] : null, prop_type: type, prop_line: line };
    }
  }

  if (q.includes(' vs ') || q.includes(' vs. ') || q.includes(' beat ') || q.includes(' win ')) {
    const vsParts = question.split(/\s+vs\.?\s+/i);
    if (vsParts.length >= 2) {
      return { market_type: 'moneyline', home_team: findTeamInText(vsParts[1]), away_team: findTeamInText(vsParts[0]), player_name: null, prop_type: null, prop_line: null };
    }
  }

  if (q.includes('total') || q.includes('over') || q.includes('under')) {
    return { market_type: 'total', home_team: findTeamInText(question), away_team: null, player_name: null, prop_type: null, prop_line: null };
  }

  if (q.includes('spread') || q.includes('cover') || q.includes('points ahead')) {
    return { market_type: 'spread', home_team: findTeamInText(question), away_team: null, player_name: null, prop_type: null, prop_line: null };
  }

  return { market_type: 'other', home_team: null, away_team: null, player_name: null, prop_type: null, prop_line: null };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const today = new Date().toISOString().split('T')[0];

    const { data: todayGames } = await supabase
      .from('sbo_games')
      .select('id, home_team, away_team, game_date')
      .gte('game_date', today + 'T00:00:00')
      .lte('game_date', today + 'T23:59:59');

    // Fetch from CLOB API
    const clobResponse = await fetch(
      'https://clob.polymarket.com/markets?' + new URLSearchParams({ next_cursor: 'MA==', order: 'VOLUME24HR', ascending: 'false' }),
      { headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; DynastyOS/1.0)' } }
    );

    // Fetch from Gamma API
    const gammaResponse = await fetch(
      'https://gamma-api.polymarket.com/markets?' + new URLSearchParams({ tag_slug: 'nba', limit: '200', order: 'volume24hr', ascending: 'false', active: 'true' }),
      { headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; DynastyOS/1.0)' } }
    );

    const clobData = clobResponse.ok ? await clobResponse.json() : { data: [] };
    const gammaData = gammaResponse.ok ? await gammaResponse.json() : [];

    const gammaById: Record<string, any> = {};
    for (const m of (Array.isArray(gammaData) ? gammaData : [])) {
      if (m.conditionId) gammaById[m.conditionId] = m;
    }

    let synced = 0, gamesToday = 0, propsFound = 0, moneylines = 0;
    const markets = clobData.data || clobData.markets || clobData || [];

    for (const market of (Array.isArray(markets) ? markets : [])) {
      try {
        const conditionId = market.condition_id || market.conditionId;
        const question = market.question || '';
        if (!conditionId || !question) continue;

        const qLower = question.toLowerCase();
        const isNBA = qLower.includes('nba') ||
          Object.keys(NBA_TEAMS).some(t => qLower.includes(t.toLowerCase())) ||
          qLower.includes('knicks') || qLower.includes('lakers') ||
          qLower.includes('celtics') || qLower.includes('warriors');
        if (!isNBA) continue;

        const gammaMarket = gammaById[conditionId] || {};
        const classification = classifyMarket(question);

        const tokens = market.tokens || [];
        let yesPrice = 0.5, noPrice = 0.5;
        let homePrice: number | null = null, awayPrice: number | null = null;
        let overPrice: number | null = null, underPrice: number | null = null;

        for (const token of tokens) {
          const outcome = (token.outcome || '').toLowerCase();
          const price = parseFloat(token.price || '0.5');
          if (outcome === 'yes') yesPrice = price;
          else if (outcome === 'no') noPrice = price;
          else if (classification.home_team && outcome.includes(classification.home_team.toLowerCase())) homePrice = price;
          else if (classification.away_team && outcome.includes(classification.away_team.toLowerCase())) awayPrice = price;
          else if (outcome === 'over') overPrice = price;
          else if (outcome === 'under') underPrice = price;
        }

        let matchedGameId: string | null = null;
        for (const game of todayGames || []) {
          const homeMatch = classification.home_team && (game.home_team.toLowerCase().includes(classification.home_team.toLowerCase()) || classification.home_team.toLowerCase().includes(game.home_team.toLowerCase().split(' ').pop() || ''));
          const awayMatch = classification.away_team && (game.away_team.toLowerCase().includes(classification.away_team.toLowerCase()) || classification.away_team.toLowerCase().includes(game.away_team.toLowerCase().split(' ').pop() || ''));
          if (homeMatch || awayMatch) {
            matchedGameId = game.id;
            if (classification.market_type === 'moneyline') gamesToday++;
            break;
          }
        }

        const volume24h = parseFloat(market.volume24hr || gammaMarket.volume24hr || gammaMarket.volume || '0');
        const volumeTotal = parseFloat(market.volume || gammaMarket.volumeNum || '0');
        const liquidity = parseFloat(market.liquidity || gammaMarket.liquidityNum || '0');

        await supabase.from('sbo_polymarket_markets').upsert({
          condition_id: conditionId, question, description: gammaMarket.description || null,
          category: 'nba', game_id: matchedGameId, market_type: classification.market_type,
          home_team: classification.home_team, away_team: classification.away_team,
          player_name: classification.player_name, prop_type: classification.prop_type, prop_line: classification.prop_line,
          token_yes_price: yesPrice, token_no_price: noPrice, token_home_price: homePrice, token_away_price: awayPrice,
          token_over_price: overPrice, token_under_price: underPrice,
          volume_24h: volume24h, volume_total: volumeTotal, liquidity,
          implied_prob_yes: yesPrice * 100, implied_prob_home: homePrice ? homePrice * 100 : null,
          implied_prob_over: overPrice ? overPrice * 100 : null,
          is_active: market.active !== false, end_date: market.end_date_iso || gammaMarket.endDate || null,
          tokens, raw_data: { clob: market, gamma: gammaMarket },
          fetched_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }, { onConflict: 'condition_id' });

        synced++;
        if (classification.market_type === 'player_prop') propsFound++;
        if (classification.market_type === 'moneyline') moneylines++;
      } catch (e) { console.error('Market processing error:', e); }
    }

    await supabase.from('sbo_sync_log').insert({ feed_name: 'polymarket_full', last_synced_at: new Date().toISOString(), records_synced: synced, status: 'success' });
    await supabase.from('sbo_api_costs').insert({ run_date: today, feed_name: 'sbo-sync-polymarket-full', api_provider: 'polymarket', endpoint_called: 'clob + gamma APIs', records_returned: synced, estimated_cost_cents: 0, api_calls_made: 2, response_status: 'success' });

    return new Response(JSON.stringify({ success: true, synced, moneylines, props_found: propsFound, games_matched: gamesToday }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
