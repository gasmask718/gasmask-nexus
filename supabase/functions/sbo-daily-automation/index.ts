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

      // Send through the canonical send-sms chokepoint
      const FROM = Deno.env.get('TWILIO_PHONE_NUMBER') || undefined;
      const today = new Date().toISOString().split('T')[0];
      const bodyHash = await smsContentHash(msg);

      let sent = 0;
      let failed = 0;

      for (const recipient of recipients) {
        try {
          const result = await sendSms({
            to: recipient.phone_number,
            body: msg,
            idempotencyKey: `sbo-auto-${today}-${bodyHash}-${recipient.phone_number}`,
            from: FROM,
            purpose: 'sbo_daily_automation',
            metadata: { recipient_name: recipient.name },
          });
          if (result.success) {
            sent++;
            console.log(`SMS sent to ${recipient.name}`);
          } else {
            console.error(
              `SMS failed for ${recipient.name} (${result.status}):`,
              result.errorMessage || result.errorCode || 'unknown',
            );
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

  await new Promise(r => setTimeout(r, 2000));

  // ── STEP 5: Auto-settle bets from verified results ──
  try {
    console.log('Step 5: Auto-settling bets...');
    
    // Get all pending bets that have a prediction_id
    const { data: pendingBets } = await supabase
      .from('sbo_actual_bets')
      .select('id, prediction_id, stake_usd, odds_american')
      .eq('outcome', 'pending')
      .not('prediction_id', 'is', null);

    if (!pendingBets?.length) {
      log.steps.settle_bets = { status: 'skipped', reason: 'No pending bets with prediction_id' };
      console.log('Step 5 skipped: no pending bets');
    } else {
      const predIds = pendingBets.map((b: any) => b.prediction_id);
      
      // Get verified predictions
      const { data: verifiedPreds } = await supabase
        .from('sbo_predictions')
        .select('id, verdict, verified')
        .in('id', predIds)
        .eq('verified', true)
        .not('verdict', 'is', null);

      let settled = 0;
      for (const pred of (verifiedPreds || [])) {
        const bet = pendingBets.find((b: any) => b.prediction_id === pred.id);
        if (!bet) continue;

        const isWin = pred.verdict === 'correct';
        const stake = bet.stake_usd || 0;
        const oddsAmerican = bet.odds_american || -110;
        
        // Calculate payout
        let payout = 0;
        if (isWin) {
          if (oddsAmerican > 0) {
            payout = stake + (stake * oddsAmerican / 100);
          } else {
            payout = stake + (stake * 100 / Math.abs(oddsAmerican));
          }
        }
        const profitLoss = isWin ? (payout - stake) : -stake;

        await supabase
          .from('sbo_actual_bets')
          .update({
            outcome: isWin ? 'win' : 'loss',
            profit_loss: profitLoss,
            actual_payout: payout,
            updated_at: new Date().toISOString(),
          })
          .eq('id', bet.id);
        
        settled++;
      }

      log.steps.settle_bets = { status: 'success', settled, total_pending: pendingBets.length };
      console.log(`Step 5 done: ${settled} bets settled`);
    }
  } catch (e: any) {
    log.steps.settle_bets = { status: 'failed', error: e.message };
    log.errors.push('settle_bets: ' + e.message);
    console.error('Step 5 failed:', e.message);
  }

  await new Promise(r => setTimeout(r, 1000));

  // ── STEP 6: Update bankroll from settled bets ──
  try {
    console.log('Step 6: Updating bankroll...');
    const todayEST = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

    // Get today's settled bets
    const { data: settledBets } = await supabase
      .from('sbo_actual_bets')
      .select('profit_loss, outcome')
      .in('outcome', ['win', 'loss'])
      .gte('updated_at', `${todayEST}T00:00:00`);

    const dailyPnl = (settledBets || []).reduce((sum: number, b: any) => sum + (b.profit_loss || 0), 0);
    const wins = (settledBets || []).filter((b: any) => b.outcome === 'win').length;
    const losses = (settledBets || []).filter((b: any) => b.outcome === 'loss').length;

    // Get latest bankroll
    const { data: latestBankroll } = await supabase
      .from('sbo_bankroll')
      .select('*')
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .single();

    if (latestBankroll) {
      const prevBalance = latestBankroll.current_balance || latestBankroll.starting_balance || 0;
      const newBalance = prevBalance + dailyPnl;
      const totalPnl = (latestBankroll.total_pnl || 0) + dailyPnl;

      await supabase.from('sbo_bankroll').upsert({
        snapshot_date: todayEST,
        starting_balance: latestBankroll.starting_balance || prevBalance,
        current_balance: newBalance,
        daily_pnl: dailyPnl,
        total_pnl: totalPnl,
        wins_today: wins,
        losses_today: losses,
        biggest_win: Math.max(latestBankroll.biggest_win || 0, ...((settledBets || []).filter((b: any) => b.profit_loss > 0).map((b: any) => b.profit_loss))),
        biggest_loss: Math.min(latestBankroll.biggest_loss || 0, ...((settledBets || []).filter((b: any) => b.profit_loss < 0).map((b: any) => b.profit_loss))),
      }, { onConflict: 'snapshot_date' });

      log.steps.bankroll = { status: 'success', daily_pnl: dailyPnl, new_balance: newBalance, wins, losses };
      console.log(`Step 6 done: P&L $${dailyPnl.toFixed(2)}, Balance $${newBalance.toFixed(2)}`);
    } else {
      log.steps.bankroll = { status: 'skipped', reason: 'No bankroll record found' };
    }
  } catch (e: any) {
    log.steps.bankroll = { status: 'failed', error: e.message };
    log.errors.push('bankroll: ' + e.message);
    console.error('Step 6 failed:', e.message);
  }

  await new Promise(r => setTimeout(r, 1000));

  // ── STEP 7: Sync Polymarket markets ──
  try {
    console.log('Step 7: Syncing Polymarket...');
    const { data, error } = await supabase.functions.invoke('sbo-sync-polymarket', { body: {} });
    if (error) throw new Error(error.message || String(error));
    log.steps.polymarket_sync = { status: 'success', markets: data?.synced || 0 };
    console.log('Step 7 done:', log.steps.polymarket_sync.markets, 'markets synced');
  } catch (e: any) {
    log.steps.polymarket_sync = { status: 'failed', error: e.message };
    log.errors.push('polymarket_sync: ' + e.message);
    console.error('Step 7 failed:', e.message);
  }

  await new Promise(r => setTimeout(r, 2000));

  // ── STEP 8: Run detailed props analysis ──
  try {
    console.log('Step 8: Running props analysis...');
    const { data, error } = await supabase.functions.invoke('sbo-run-analysis', { body: {} });
    if (error) throw new Error(error.message || String(error));
    log.steps.props_analysis = { status: 'success', analyzed: data?.analyzed || 0 };
    console.log('Step 8 done');
  } catch (e: any) {
    log.steps.props_analysis = { status: 'failed', error: e.message };
    log.errors.push('props_analysis: ' + e.message);
    console.error('Step 8 failed:', e.message);
  }

  await new Promise(r => setTimeout(r, 2000));

  // ── STEP 9: Run consensus engine ──
  try {
    console.log('Step 9: Running consensus engine...');
    const { data, error } = await supabase.functions.invoke('sbo-consensus-engine', { body: {} });
    if (error) throw new Error(error.message || String(error));
    log.steps.consensus = { status: 'success', scored: data?.scored || 0 };
    console.log('Step 9 done');
  } catch (e: any) {
    log.steps.consensus = { status: 'failed', error: e.message };
    log.errors.push('consensus: ' + e.message);
    console.error('Step 9 failed:', e.message);
  }

  await new Promise(r => setTimeout(r, 2000));

  // ── STEP 10: Build Top Plays (cross-engine consensus) ──
  try {
    console.log('Step 10: Building top plays...');
    const { data, error } = await supabase.functions.invoke('sbo-top-plays', { body: {} });
    if (error) throw new Error(error.message || String(error));
    log.steps.top_plays = { status: 'success', plays: data?.top_plays?.length || 0 };
    console.log('Step 10 done:', log.steps.top_plays.plays, 'top plays');
  } catch (e: any) {
    log.steps.top_plays = { status: 'failed', error: e.message };
    log.errors.push('top_plays: ' + e.message);
    console.error('Step 10 failed:', e.message);
  }

  await new Promise(r => setTimeout(r, 2000));

  // ── STEP 11: Compare odds (Polymarket vs books) ──
  try {
    console.log('Step 11: Comparing odds...');
    const { data, error } = await supabase.functions.invoke('sbo-compare-odds', { body: {} });
    if (error) throw new Error(error.message || String(error));
    log.steps.compare_odds = { status: 'success', comparisons: data?.compared || 0 };
    console.log('Step 11 done');
  } catch (e: any) {
    log.steps.compare_odds = { status: 'failed', error: e.message };
    log.errors.push('compare_odds: ' + e.message);
    console.error('Step 11 failed:', e.message);
  }

  await new Promise(r => setTimeout(r, 1000));

  // ── STEP 12: Auto-recalibrate model ──
  try {
    console.log('Step 12: Recalibrating model...');
    const { data, error } = await supabase.functions.invoke('sbo-recalibrate', { body: {} });
    if (error) throw new Error(error.message || String(error));
    log.steps.recalibrate = { status: 'success', buckets: data?.results?.length || 0 };
    console.log('Step 12 done:', log.steps.recalibrate.buckets, 'buckets updated');
  } catch (e: any) {
    log.steps.recalibrate = { status: 'failed', error: e.message };
    log.errors.push('recalibrate: ' + e.message);
    console.error('Step 12 failed:', e.message);
  }

  await new Promise(r => setTimeout(r, 1000));

  // ── STEP 13: Send daily email report ──
  try {
    console.log('Step 13: Sending daily email report...');
    const { data, error } = await supabase.functions.invoke('sbo-send-daily-email', { body: {} });
    if (error) throw new Error(error.message || String(error));
    log.steps.daily_email = { status: 'success', sent: data?.sent || 0 };
    console.log('Step 13 done:', data?.sent, 'emails sent');
  } catch (e: any) {
    log.steps.daily_email = { status: 'failed', error: e.message };
    log.errors.push('daily_email: ' + e.message);
    console.error('Step 13 failed:', e.message);
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
