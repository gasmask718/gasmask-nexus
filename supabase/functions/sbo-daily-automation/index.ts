import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  console.log('🚀 SBO Daily Automation started:', new Date().toISOString());

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Validate required secrets
  const requiredSecrets = [
    'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'ODDS_API_KEY',
    'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER',
  ];
  const missing = requiredSecrets.filter(k => !Deno.env.get(k));
  if (missing.length > 0) {
    const msg = `Missing secrets: ${missing.join(', ')}`;
    console.error(msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const results: {
    started_at: string;
    steps: any[];
    errors: string[];
    completed_at: string;
  } = {
    started_at: new Date().toISOString(),
    steps: [],
    errors: [],
    completed_at: '',
  };

  const callFn = async (fnName: string, body: any = {}) => {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    try { return JSON.parse(text); } catch { return { raw: text }; }
  };

  const runStep = async (name: string, fn: () => Promise<any>) => {
    console.log(`▶ Starting: ${name}`);
    const start = Date.now();
    try {
      const result = await fn();
      const step = { name, status: 'success', duration_ms: Date.now() - start, result };
      results.steps.push(step);
      console.log(`✅ ${name} done (${step.duration_ms}ms)`);
      return result;
    } catch (e: any) {
      const err = e?.message || String(e);
      results.steps.push({ name, status: 'failed', duration_ms: Date.now() - start, error: err });
      results.errors.push(`${name}: ${err}`);
      console.error(`❌ ${name} failed:`, err);
      return null;
    }
  };

  // ── STEP A: Fetch tonight's games ──
  await runStep('fetch_games_odds', async () => {
    const res = await callFn('get-todays-games');
    return { games_fetched: res?.games?.length || res?.saved || 0 };
  });
  await new Promise(r => setTimeout(r, 3000));

  // ── STEP B: Run AI predictions ──
  await runStep('run_predictions', async () => {
    const res = await callFn('sbo-analyze-tonight');
    return { predictions_created: res?.predictions_created || res?.total || 0 };
  });
  await new Promise(r => setTimeout(r, 5000));

  // ── STEP C: Fetch player props ──
  await runStep('fetch_player_props', async () => {
    const ODDS_API_KEY = Deno.env.get('ODDS_API_KEY')!;
    const todayEST = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

    const { data: games } = await supabase
      .from('sbo_games')
      .select('id, external_id, home_team, away_team')
      .gte('game_date', `${todayEST}T00:00:00+00:00`)
      .lte('game_date', `${todayEST}T23:59:59+00:00`);

    if (!games?.length) return { props_fetched: 0, reason: 'No games found' };

    let totalProps = 0;
    for (const game of games.slice(0, 10)) {
      try {
        if (!game.external_id) continue;
        const url = `https://api.the-odds-api.com/v4/sports/basketball_nba/events/${game.external_id}/odds?apiKey=${ODDS_API_KEY}&regions=us&markets=player_points,player_rebounds,player_assists,player_threes,player_blocks,player_steals&oddsFormat=american`;
        const res = await fetch(url);
        if (!res.ok) { await res.text(); continue; }
        const eventData = await res.json();
        const bookmaker = eventData?.bookmakers?.find((b: any) => b.key === 'draftkings') || eventData?.bookmakers?.[0];
        if (!bookmaker) continue;

        for (const market of (bookmaker.markets || [])) {
          const propType = market.key.replace('player_', '');
          const playerMap: Record<string, { over?: any; under?: any }> = {};
          for (const outcome of (market.outcomes || [])) {
            const pn = outcome.description;
            if (!playerMap[pn]) playerMap[pn] = {};
            if (outcome.name === 'Over') playerMap[pn].over = outcome;
            if (outcome.name === 'Under') playerMap[pn].under = outcome;
          }

          for (const [playerName, sides] of Object.entries(playerMap)) {
            if (!sides.over && !sides.under) continue;
            const line = sides.over?.point || sides.under?.point;
            if (!line) continue;
            await supabase.from('sbo_player_props').upsert({
              player_name: playerName,
              prop_type: propType,
              line,
              over_odds: sides.over?.price || null,
              under_odds: sides.under?.price || null,
              game_id: game.id,
              game_date: todayEST,
              sportsbook: 'draftkings',
            }, { onConflict: 'player_name,prop_type,game_date,sportsbook' });
            totalProps++;
          }
        }
        await new Promise(r => setTimeout(r, 300));
      } catch (e: any) {
        console.error(`Props fetch failed for ${game.home_team}:`, e.message);
      }
    }
    return { props_fetched: totalProps };
  });
  await new Promise(r => setTimeout(r, 3000));

  // ── STEP D: Run AI prop analysis ──
  await runStep('analyze_props', async () => {
    const todayEST = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const { data: todayProps } = await supabase
      .from('sbo_player_props')
      .select('id, player_name, sbo_predictions(id)')
      .gte('game_date', todayEST)
      .limit(100);

    const needsAnalysis = (todayProps || []).filter((p: any) => !p.sbo_predictions?.length);
    let analyzed = 0;
    for (const prop of needsAnalysis.slice(0, 30)) {
      try {
        await callFn('sbo-run-predictions', { prop_id: prop.id, prediction_type: 'player_prop' });
        analyzed++;
        await new Promise(r => setTimeout(r, 400));
      } catch (e: any) {
        console.error(`Prop analysis failed for ${prop.player_name}:`, e.message);
      }
    }
    return { props_analyzed: analyzed };
  });
  await new Promise(r => setTimeout(r, 5000));

  // ── STEP E: Verify yesterday's results ──
  await runStep('verify_yesterday_results', async () => {
    return await callFn('sbo-verify-results', { force_yesterday: true, verify_props: true });
  });
  await new Promise(r => setTimeout(r, 3000));

  // ── STEP F: Verify pending parlays ──
  await runStep('verify_parlays', async () => {
    const { data: pendingParlays } = await supabase
      .from('sbo_parlays')
      .select('id')
      .eq('status', 'pending');

    let verified = 0;
    for (const p of (pendingParlays || [])) {
      try {
        await callFn('sbo-verify-parlay', { parlay_id: p.id });
        verified++;
      } catch (e: any) { console.error('Parlay verify failed:', e.message); }
    }
    return { parlays_verified: verified };
  });

  // ── STEP G: Build and send ChingWorld SMS ──
  await runStep('send_chingworld_sms', async () => {
    const { data: recipients } = await supabase
      .from('sbo_sms_recipients')
      .select('phone_number, name')
      .eq('active', true)
      .eq('auto_send', true);

    if (!recipients?.length) return { sent: 0, reason: 'No auto-send recipients' };

    const todayEST = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const dateLabel = new Date().toLocaleDateString('en-US', {
      timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });

    // Get game picks
    const { data: gamePicks } = await supabase
      .from('sbo_saved_picks')
      .select('*')
      .eq('pick_date', todayEST)
      .eq('pick_type', 'game')
      .gte('confidence', 75)
      .order('confidence', { ascending: false })
      .limit(5);

    // Get props with predictions
    const { data: allProps } = await supabase
      .from('sbo_player_props')
      .select('*, sbo_predictions(final_confidence, predicted_outcome)')
      .eq('game_date', todayEST);

    const PROP_LABELS: Record<string, string> = {
      points: 'Points', pts: 'Points', rebounds: 'Rebounds', reb: 'Rebounds',
      assists: 'Assists', ast: 'Assists', threes: '3PT', three_pointers: '3PT',
      blocks: 'Blocks', blk: 'Blocks', steals: 'Steals', stl: 'Steals',
    };
    const normProp = (t: string) => PROP_LABELS[t?.toLowerCase()?.trim()] || t || 'Prop';

    const formatProp = (p: any) => {
      const pred = p.sbo_predictions?.[0];
      const dir = (pred?.predicted_outcome || 'OVER').toUpperCase();
      const odds = dir === 'OVER' ? p.over_odds : p.under_odds;
      const oddsStr = odds ? (odds > 0 ? `+${odds}` : `${odds}`) : '';
      return `${p.player_name}${p.team ? ` (${p.team})` : ''}\n${normProp(p.prop_type)} ${dir} ${p.line} | ${pred?.final_confidence || '?'}% | ${oddsStr}\n\n`;
    };

    const topProps = (allProps || []).filter((p: any) => (p.sbo_predictions?.[0]?.final_confidence || 0) >= 90).slice(0, 5);
    const steals = (allProps || []).filter((p: any) => ['steals', 'stl'].includes((p.prop_type || '').toLowerCase()) && (p.sbo_predictions?.[0]?.final_confidence || 0) >= 75)
      .sort((a: any, b: any) => (b.sbo_predictions?.[0]?.final_confidence || 0) - (a.sbo_predictions?.[0]?.final_confidence || 0)).slice(0, 5);
    const blocks = (allProps || []).filter((p: any) => ['blocks', 'blk'].includes((p.prop_type || '').toLowerCase()) && (p.sbo_predictions?.[0]?.final_confidence || 0) >= 80)
      .sort((a: any, b: any) => (b.sbo_predictions?.[0]?.final_confidence || 0) - (a.sbo_predictions?.[0]?.final_confidence || 0)).slice(0, 5);

    let msg = `🏆 CHINGWORLD PICKS 🏆\n📅 ${dateLabel}\n─────────────────────\n\n`;
    if (topProps.length > 0) { msg += `🔥 TOP PROPS (90%+)\n`; topProps.forEach((p: any) => { msg += formatProp(p); }); msg += `─────────────────────\n\n`; }
    if (steals.length > 0) { msg += `🤿 STEALS\n`; steals.forEach((p: any) => { msg += formatProp(p); }); msg += `─────────────────────\n\n`; }
    if (blocks.length > 0) { msg += `🛡️ BLOCKS\n`; blocks.forEach((p: any) => { msg += formatProp(p); }); msg += `─────────────────────\n\n`; }
    if (gamePicks?.length) { msg += `🏀 GAME PICKS\n`; gamePicks.forEach((p: any) => { msg += `${p.label} | ${p.confidence}%\n\n`; }); msg += `─────────────────────\n\n`; }
    if (topProps.length === 0 && steals.length === 0 && blocks.length === 0 && (!gamePicks || gamePicks.length === 0)) {
      msg += `No picks generated yet today.\n\n─────────────────────\n\n`;
    }
    msg += `💡 Bet responsibly\nGood luck! 🎯`;

    // Split into segments
    const segments: string[] = [];
    if (msg.length <= 1550) { segments.push(msg); }
    else {
      const lines = msg.split('\n');
      let cur = ''; let segNum = 1;
      for (const line of lines) {
        if ((cur + line + '\n').length > 1500 && cur.length > 100) {
          segments.push(cur + `\n(${segNum} of TOTAL)`);
          segNum++;
          cur = `🏆 CHINGWORLD (cont.)\n─────────────────────\n\n${line}\n`;
        } else { cur += line + '\n'; }
      }
      if (cur) segments.push(cur);
      const total = segments.length;
      for (let i = 0; i < segments.length; i++) {
        segments[i] = segments[i].replace(/\(\d+ of TOTAL\)/g, `(${i + 1} of ${total})`);
      }
    }

    // Send via Twilio
    const TWILIO_SID = Deno.env.get('TWILIO_ACCOUNT_SID')!;
    const TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')!;
    const FROM = Deno.env.get('TWILIO_PHONE_NUMBER')!;
    const authHeader = 'Basic ' + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`);
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`;

    let sent = 0, failed = 0;
    for (const r of recipients) {
      for (let i = 0; i < segments.length; i++) {
        try {
          const res = await fetch(twilioUrl, {
            method: 'POST',
            headers: { 'Authorization': authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ From: FROM, To: r.phone_number, Body: segments[i] }),
          });
          if (res.ok) { await res.json(); sent++; } else { await res.text(); failed++; }
          if (i < segments.length - 1) await new Promise(r => setTimeout(r, 1000));
        } catch { failed++; }
      }
      await new Promise(r => setTimeout(r, 500));
    }

    // Update last_sent_at
    await supabase.from('sbo_sms_recipients').update({ last_sent_at: new Date().toISOString() }).eq('auto_send', true).eq('active', true);

    // Log
    await supabase.from('sbo_sms_sends_log').insert({
      recipient_count: recipients.length,
      message_preview: msg.slice(0, 200),
      picks_included: topProps.length + steals.length + blocks.length + (gamePicks?.length || 0),
      send_type: 'auto',
      status: failed === 0 ? 'sent' : sent > 0 ? 'partial' : 'failed',
    });

    return { sent, failed, recipients: recipients.length, segments: segments.length };
  });

  results.completed_at = new Date().toISOString();

  // Log the full run
  await supabase.from('sbo_automation_log').insert({
    run_at: results.started_at,
    completed_at: results.completed_at,
    steps: results.steps,
    errors: results.errors,
    status: results.errors.length === 0 ? 'success' : results.errors.length < results.steps.length ? 'partial' : 'failed',
  }).catch((e: any) => console.error('Log insert failed:', e));

  // Send alert to test recipients if any errors
  if (results.errors.length > 0) {
    try {
      const { data: testRecipients } = await supabase
        .from('sbo_sms_recipients')
        .select('phone_number')
        .eq('group_tag', 'test')
        .eq('active', true);

      if (testRecipients?.length) {
        const TWILIO_SID = Deno.env.get('TWILIO_ACCOUNT_SID')!;
        const TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')!;
        const FROM = Deno.env.get('TWILIO_PHONE_NUMBER')!;
        const alertMsg = `⚠️ CHINGWORLD AUTOMATION ALERT\n${results.errors.length} step(s) failed:\n${results.errors.slice(0, 3).join('\n')}\nManual run may be needed today.\nTime: ${new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' })} ET`;

        for (const r of testRecipients) {
          await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
            method: 'POST',
            headers: { 'Authorization': 'Basic ' + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`), 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ From: FROM, To: r.phone_number, Body: alertMsg }),
          }).then(r => r.text()).catch(() => {});
        }
      }
    } catch { /* alert sending is best-effort */ }
  }

  console.log('🏁 Automation complete:', JSON.stringify(results, null, 2));

  return new Response(JSON.stringify(results), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
