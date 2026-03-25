import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  console.log('🚀 sbo-daily-automation started:', new Date().toISOString());

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Validate secrets
  const missing = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER', 'ODDS_API_KEY']
    .filter(k => !Deno.env.get(k));
  if (missing.length > 0) {
    const msg = `Missing secrets: ${missing.join(', ')}`;
    console.error(msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const log: Record<string, any> = {
    started_at: new Date().toISOString(),
    steps: {},
    errors: [] as string[],
  };

  // ── STEP 1: Fetch tonight's games ──
  try {
    console.log('Step 1: Fetching games...');
    const { data, error } = await supabase.functions.invoke('get-todays-games', { body: {} });
    if (error) throw new Error(error.message || String(error));
    log.steps.fetch_games = { status: 'success', games: data?.games?.length || data?.saved || 0 };
    console.log('Step 1 done:', log.steps.fetch_games.games, 'games');
  } catch (e: any) {
    log.steps.fetch_games = { status: 'failed', error: e.message };
    log.errors.push('fetch_games: ' + e.message);
    console.error('Step 1 failed:', e.message);
  }

  await new Promise(r => setTimeout(r, 3000));

  // ── STEP 1.5: Ingest book props (Bovada, DK, FanDuel, etc.) ──
  try {
    console.log('Step 1.5: Ingesting sportsbook player props...');
    const { data, error } = await supabase.functions.invoke('sbo-ingest-book-props', {
      body: { bookmakers: 'bovada,betonlineag,draftkings,fanduel,betmgm' },
    });
    if (error) throw new Error(error.message || String(error));
    log.steps.ingest_book_props = { status: 'success', inserted: data?.inserted || 0, updated: data?.updated || 0, books: Object.keys(data?.book_stats || {}) };
    console.log('Step 1.5 done:', data?.inserted, 'inserted,', data?.updated, 'updated');
  } catch (e: any) {
    log.steps.ingest_book_props = { status: 'failed', error: e.message };
    log.errors.push('ingest_book_props: ' + e.message);
    console.error('Step 1.5 failed:', e.message);
  }

  await new Promise(r => setTimeout(r, 3000));

  // ── STEP 2: Run AI predictions ──
  try {
    console.log('Step 2: Running predictions...');
    const { data, error } = await supabase.functions.invoke('sbo-analyze-tonight', { body: {} });
    if (error) throw new Error(error.message || String(error));
    log.steps.predictions = { status: 'success', created: data?.predictions_created || data?.total || 0 };
    console.log('Step 2 done:', log.steps.predictions.created, 'predictions');
  } catch (e: any) {
    log.steps.predictions = { status: 'failed', error: e.message };
    log.errors.push('predictions: ' + e.message);
    console.error('Step 2 failed:', e.message);
  }

  await new Promise(r => setTimeout(r, 3000));

  // ── STEP 3: Verify yesterday's results ──
  try {
    console.log('Step 3: Verifying results...');
    const { data, error } = await supabase.functions.invoke('sbo-verify-results', {
      body: { force_yesterday: true, verify_props: true },
    });
    if (error) throw new Error(error.message || String(error));
    log.steps.verify = { status: 'success', verified: data?.verified || 0 };
    console.log('Step 3 done');
  } catch (e: any) {
    log.steps.verify = { status: 'failed', error: e.message };
    log.errors.push('verify: ' + e.message);
    console.error('Step 3 failed:', e.message);
  }

  await new Promise(r => setTimeout(r, 2000));

  // ── STEP 4: Build and send ChingWorld SMS ──
  try {
    console.log('Step 4: Sending ChingWorld SMS...');

    const todayEST = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const dateLabel = new Date().toLocaleDateString('en-US', {
      timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });

    // Get auto-send recipients
    const { data: recipients } = await supabase
      .from('sbo_sms_recipients')
      .select('phone_number, name')
      .eq('active', true)
      .eq('auto_send', true);

    if (!recipients?.length) {
      log.steps.sms = { status: 'skipped', reason: 'No auto-send recipients' };
      console.log('Step 4 skipped: no auto recipients');
    } else {
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

      // Blocked combo prop types (45-46% accuracy — confirmed losers)
      const COMBO_PROPS_BLOCKED = ['pts_ast', 'pts_reb', 'points_assists', 'points_rebounds', 'pa', 'pr'];
      const isBlocked = (pt: string) => {
        const clean = (pt || '').toLowerCase().replace(/[\s_\-+]/g, '');
        return COMBO_PROPS_BLOCKED.some(b => b.replace(/[\s_\-+]/g, '') === clean);
      };

      const getFiltered = (types: string[], minConf: number, max: number) =>
        (allProps || [])
          .filter((p: any) => {
            const t = (p.prop_type || '').toLowerCase();
            const c = p.sbo_predictions?.[0]?.final_confidence || 0;
            return types.includes(t) && c >= minConf && !isBlocked(t);
          })
          .sort((a: any, b: any) => {
            // UNDER picks first (68% hist. accuracy vs 45% OVER)
            const aUnder = (a.sbo_predictions?.[0]?.predicted_outcome || '').toLowerCase() === 'under';
            const bUnder = (b.sbo_predictions?.[0]?.predicted_outcome || '').toLowerCase() === 'under';
            if (aUnder && !bUnder) return -1;
            if (!aUnder && bUnder) return 1;
            return (b.sbo_predictions?.[0]?.final_confidence || 0) - (a.sbo_predictions?.[0]?.final_confidence || 0);
          })
          .slice(0, max);

      // Sweet Spot: 80-89% confidence range — 81% historical accuracy
      const sweetSpotProps = (allProps || [])
        .filter((p: any) => {
          const c = p.sbo_predictions?.[0]?.final_confidence || 0;
          return c >= 80 && c <= 89 && !isBlocked(p.prop_type);
        })
        .sort((a: any, b: any) => {
          const aUnder = (a.sbo_predictions?.[0]?.predicted_outcome || '').toLowerCase() === 'under';
          const bUnder = (b.sbo_predictions?.[0]?.predicted_outcome || '').toLowerCase() === 'under';
          if (aUnder && !bUnder) return -1;
          if (!aUnder && bUnder) return 1;
          return 0;
        })
        .slice(0, 6);

      const topProps = (allProps || [])
        .filter((p: any) => (p.sbo_predictions?.[0]?.final_confidence || 0) >= 90 && !isBlocked(p.prop_type))
        .slice(0, 5);
      const stealsProps = getFiltered(['steals', 'stl', 'player_steals'], 65, 6);
      const blocksProps = getFiltered(['blocks', 'blk', 'player_blocks', 'blocked_shots'], 60, 6);

      const formatProp = (p: any, typeLabel: string) => {
        const pred = p.sbo_predictions?.[0];
        const pick = (pred?.predicted_outcome || 'OVER').toUpperCase();
        const odds = pick === 'OVER' ? p.over_odds : p.under_odds;
        const oddsStr = odds ? (odds > 0 ? `+${odds}` : `${odds}`) : '';
        const underTag = pick === 'UNDER' ? ' 📊' : '';
        return `${p.player_name} (${p.team || 'NBA'})\n${typeLabel} ${pick} ${p.line} | ${pred?.final_confidence}%${underTag} | ${oddsStr}\n\n`;
      };

      let msg = `🏆 CHINGWORLD PICKS 🏆\n📅 ${dateLabel}\n─────────────────────\n\n`;

      if (sweetSpotProps.length > 0) {
        msg += `🎯 SWEET SPOT (80-89% — 81% hist. acc)\n`;
        sweetSpotProps.forEach((p: any) => { msg += formatProp(p, p.prop_type); });
        msg += `─────────────────────\n\n`;
      }
      if (topProps.length > 0) {
        msg += `🔥 TOP PROPS (90%+)\n`;
        topProps.forEach((p: any) => { msg += formatProp(p, p.prop_type); });
        msg += `─────────────────────\n\n`;
      }
      if (blocksProps.length > 0) {
        msg += `🛡️ BLOCKS — 91% HIST. ACCURACY 🔥\n`;
        blocksProps.forEach((p: any) => { msg += formatProp(p, 'Blocks'); });
        msg += `─────────────────────\n\n`;
      }
      if (stealsProps.length > 0) {
        msg += `🤿 STEALS — 83% HIST. ACCURACY 💪\n`;
        stealsProps.forEach((p: any) => { msg += formatProp(p, 'Steals'); });
        msg += `─────────────────────\n\n`;
      }
      if (gamePicks?.length) {
        msg += `🏀 GAME PICKS\n`;
        gamePicks.forEach((p: any) => { msg += `${p.label} | ${p.confidence}%\n`; });
        msg += `\n─────────────────────\n\n`;
      }

      if (topProps.length === 0 && stealsProps.length === 0 && blocksProps.length === 0 && sweetSpotProps.length === 0 && (!gamePicks || gamePicks.length === 0)) {
        msg += `Picks processing — check back soon.\n\n─────────────────────\n\n`;
      }

      msg += `💡 Bet responsibly\nGood luck! 🎯`;

      // Send via Twilio directly
      const TWILIO_SID = Deno.env.get('TWILIO_ACCOUNT_SID')!;
      const TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')!;
      const FROM = Deno.env.get('TWILIO_PHONE_NUMBER')!;
      const authHeader = 'Basic ' + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`);
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`;

      let sent = 0;
      let failed = 0;

      for (const recipient of recipients) {
        try {
          const twilioRes = await fetch(twilioUrl, {
            method: 'POST',
            headers: { 'Authorization': authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ From: FROM, To: recipient.phone_number, Body: msg }),
          });
          if (twilioRes.ok) {
            await twilioRes.json();
            sent++;
            console.log(`SMS sent to ${recipient.name}`);
          } else {
            const errText = await twilioRes.text();
            console.error(`SMS failed for ${recipient.name}:`, errText);
            failed++;
          }
          await new Promise(r => setTimeout(r, 300));
        } catch (e: any) {
          failed++;
          console.error(`SMS error for ${recipient.name}:`, e.message);
        }
      }

      // Update last_sent_at
      await supabase
        .from('sbo_sms_recipients')
        .update({ last_sent_at: new Date().toISOString() })
        .eq('active', true)
        .eq('auto_send', true);

      // Log send
      const { error: logErr } = await supabase.from('sbo_sms_sends_log').insert({
        recipient_count: recipients.length,
        message_preview: msg.slice(0, 200),
        picks_included: topProps.length + stealsProps.length + blocksProps.length + (gamePicks?.length || 0),
        send_type: 'auto',
        status: failed === 0 ? 'sent' : sent > 0 ? 'partial' : 'failed',
      });
      if (logErr) console.error('SMS log insert error:', logErr);

      log.steps.sms = { status: 'success', sent, failed, recipients: recipients.length };
      console.log(`Step 4 done: ${sent} sent, ${failed} failed`);
    }
  } catch (e: any) {
    log.steps.sms = { status: 'failed', error: e.message };
    log.errors.push('sms: ' + e.message);
    console.error('Step 4 failed:', e.message);
  }

  log.completed_at = new Date().toISOString();
  log.status = log.errors.length === 0 ? 'success' : log.errors.length < 4 ? 'partial' : 'failed';

  // Save automation log
  const { error: logInsertErr } = await supabase.from('sbo_automation_log').insert({
    run_at: log.started_at,
    completed_at: log.completed_at,
    steps: log.steps,
    errors: log.errors,
    status: log.status,
  });
  if (logInsertErr) console.error('Automation log insert error:', logInsertErr);

  // Send alert to test recipients if errors
  if (log.errors.length > 0) {
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
        const alertMsg = `⚠️ CHINGWORLD AUTOMATION ALERT\n${log.errors.length} step(s) failed:\n${log.errors.slice(0, 3).join('\n')}\nManual run may be needed today.`;

        for (const r of testRecipients) {
          const res = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
            {
              method: 'POST',
              headers: {
                'Authorization': 'Basic ' + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`),
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({ From: FROM, To: r.phone_number, Body: alertMsg }),
            }
          );
          await res.text();
        }
      }
    } catch { /* alert sending is best-effort */ }
  }

  console.log('🏁 Automation complete. Status:', log.status);

  return new Response(JSON.stringify(log), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
