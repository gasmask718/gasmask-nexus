import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const formData = await req.formData();
  const from = formData.get('From')?.toString() || '';
  const body = formData.get('Body')?.toString() || '';
  const messageSid = formData.get('MessageSid')?.toString() || '';

  // ── SYNTHETIC PROBE SHORT-CIRCUIT ──
  // comms-health-monitor signed probe: MessageSid "SMhealth..." +
  // From=+15005550006. ACK with no side effects (no DB write, no SMS).
  if (messageSid.startsWith('SMhealth') && from === '+15005550006') {
    console.log(`[sbo-inbound-sms] synthetic probe ack sid=${messageSid}`);
    return new Response(
      JSON.stringify({ success: true, synthetic: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const today = new Date().toISOString().split('T')[0];

  // Log every inbound SMS
  await supabase.from('sbo_sms_log').insert({
    direction: 'inbound',
    phone_number: from,
    message_body: body,
    processed: false,
  });

  // Get today's briefing
  const { data: briefing } = await supabase
    .from('sbo_daily_briefings')
    .select('*, sbo_parlay_payouts(*)')
    .eq('briefing_date', today)
    .maybeSingle();

  const msgUpper = body.trim().toUpperCase();

  // ── COMMAND: DONE / PNL ───────────────────────────────────
  if (msgUpper === 'DONE' || msgUpper === 'PNL' || msgUpper === 'P&L') {
    const { data: todayBets } = await supabase
      .from('sbo_actual_bets')
      .select('*')
      .eq('bet_date', today);

    const wagered = todayBets?.reduce((s: number, b: any) => s + (b.stake_usd || 0), 0) || 0;
    const won = todayBets?.filter((b: any) => b.outcome === 'win').reduce((s: number, b: any) => s + (b.actual_payout || 0), 0) || 0;
    const pending = todayBets?.filter((b: any) => b.outcome === 'pending').length || 0;
    const netPL = won - wagered;

    const reply = `📊 TODAY'S P&L\n` +
      `Bets: ${todayBets?.length || 0} (${pending} pending)\n` +
      `Wagered: $${wagered.toFixed(2)}\n` +
      `Won: $${won.toFixed(2)}\n` +
      `Net: ${netPL >= 0 ? '+' : ''}$${netPL.toFixed(2)}\n\n` +
      `Reply TOTAL for all-time stats`;

    return twimlResponse(reply);
  }

  // ── COMMAND: TOTAL / ALL TIME ─────────────────────────────
  if (msgUpper === 'TOTAL' || msgUpper === 'ALLTIME' || msgUpper === 'ALL TIME') {
    const { data: allBets } = await supabase
      .from('sbo_actual_bets')
      .select('stake_usd, outcome, actual_payout')
      .not('outcome', 'eq', 'pending');

    const totalWagered = allBets?.reduce((s: number, b: any) => s + (b.stake_usd || 0), 0) || 0;
    const totalWon = allBets?.filter((b: any) => b.outcome === 'win').reduce((s: number, b: any) => s + (b.actual_payout || 0), 0) || 0;
    const wins = allBets?.filter((b: any) => b.outcome === 'win').length || 0;
    const losses = allBets?.filter((b: any) => b.outcome === 'loss').length || 0;
    const totalBets = wins + losses;
    const winRate = totalBets > 0 ? ((wins / totalBets) * 100).toFixed(1) : '0';
    const netPL = totalWon - totalWagered;
    const roi = totalWagered > 0 ? ((netPL / totalWagered) * 100).toFixed(1) : '0';

    const reply = `🏆 ALL-TIME RECORD\n` +
      `Record: ${wins}W-${losses}L (${winRate}%)\n` +
      `Wagered: $${totalWagered.toFixed(2)}\n` +
      `Won: $${totalWon.toFixed(2)}\n` +
      `Net P&L: ${netPL >= 0 ? '+' : ''}$${netPL.toFixed(2)}\n` +
      `ROI: ${parseFloat(roi) >= 0 ? '+' : ''}${roi}%`;

    return twimlResponse(reply);
  }

  // ── COMMAND: PARLAY [legs] ────────────────────────────────
  const parlayMatch = msgUpper.match(/^PARLAY\s+(\d+)/);
  if (parlayMatch) {
    const legCount = parseInt(parlayMatch[1]);
    const parlayData = (briefing as any)?.sbo_parlay_payouts?.find(
      (p: any) => p.legs_count === legCount
    );

    if (!parlayData) {
      return twimlResponse(`No ${legCount}-leg parlay available today. Available: ${(briefing as any)?.sbo_parlay_payouts?.map((p: any) => p.legs_count).join(', ') || 'none'}`);
    }

    const legs = (parlayData.leg_details || []) as any[];
    let reply = `🎯 ${legCount}-LEG PARLAY\n`;
    reply += `Win prob: ${parlayData.win_probability_pct?.toFixed(1)}%\n\n`;
    for (let i = 0; i < Math.min(legs.length, 6); i++) {
      reply += `${i + 1}. ${legs[i].label} (${legs[i].odds > 0 ? '+' : ''}${legs[i].odds})\n`;
    }
    if (legs.length > 6) reply += `...+${legs.length - 6} more\n`;
    reply += `\nPayouts:\n`;
    reply += `$5 → $${parlayData.payout_5}\n`;
    reply += `$10 → $${parlayData.payout_10}\n`;
    reply += `$25 → $${parlayData.payout_25}\n`;
    reply += `$50 → $${parlayData.payout_50}\n`;
    reply += `$100 → $${parlayData.payout_100}\n\n`;
    reply += `Reply: BET 10 PARLAY ${legCount}`;

    return twimlResponse(reply);
  }

  // ── COMMAND: BET ──────────────────────────────────────────
  if (msgUpper.startsWith('BET ')) {
    const parsed = await parseBet(body, briefing, supabase);

    if (!parsed.success) {
      return twimlResponse(
        `Couldn't parse that bet. Try:\n` +
        `BET 10 Lakers ML\n` +
        `BET 25 LeBron OV 27.5 PTS\n` +
        `BET 10 PARLAY 5 (uses top 5 picks)`
      );
    }

    const { data: savedBet } = await supabase
      .from('sbo_actual_bets')
      .insert({
        briefing_id: briefing?.id || null,
        bet_date: today,
        bet_type: parsed.bet_type,
        description: parsed.description,
        legs: parsed.legs || [],
        stake_usd: parsed.stake,
        odds_american: parsed.odds,
        parlay_legs_count: parsed.parlay_legs_count,
        potential_payout: parsed.potential_payout,
        outcome: 'pending',
        raw_reply: body,
        parsed_by_ai: true,
        confirmed: false,
      })
      .select()
      .single();

    const code = (savedBet?.id || '').slice(-4).toUpperCase();
    const confirmMsg =
      `✅ BET RECORDED #${code}\n` +
      `${parsed.description}\n` +
      `Stake: $${parsed.stake}\n` +
      `Potential: $${parsed.potential_payout?.toFixed(2)}\n\n` +
      `Reply WIN ${code} or LOSS ${code} after game`;

    await supabase.from('sbo_sms_log').insert({
      direction: 'outbound',
      phone_number: from,
      message_body: confirmMsg,
      briefing_id: briefing?.id,
      related_bet_id: savedBet?.id,
    });

    return twimlResponse(confirmMsg);
  }

  // ── COMMAND: WIN/LOSS/PUSH result ─────────────────────────
  const resultMatch = msgUpper.match(/^(WIN|LOSS|PUSH)\s+([A-Z0-9]{4})/);
  if (resultMatch) {
    const outcome = resultMatch[1].toLowerCase();
    const betCode = resultMatch[2].toLowerCase();

    const { data: bets } = await supabase
      .from('sbo_actual_bets')
      .select('*')
      .eq('bet_date', today)
      .limit(50);

    const bet = bets?.find((b: any) => b.id.slice(-4).toLowerCase() === betCode);
    if (!bet) {
      return twimlResponse(`Bet ${resultMatch[2]} not found for today.`);
    }

    const actualPayout = outcome === 'win'
      ? (bet.potential_payout || bet.stake_usd)
      : outcome === 'push'
      ? bet.stake_usd
      : 0;

    const profitLoss = actualPayout - bet.stake_usd;

    await supabase
      .from('sbo_actual_bets')
      .update({
        outcome,
        actual_payout: actualPayout,
        profit_loss: profitLoss,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bet.id);

    await updateBankroll(supabase, today);

    const emoji = outcome === 'win' ? '🟢' : outcome === 'push' ? '🟡' : '🔴';
    const reply = `${emoji} ${outcome.toUpperCase()} recorded\n` +
      `${bet.description}\n` +
      `${outcome === 'win' ? `Won: $${actualPayout.toFixed(2)} (+$${profitLoss.toFixed(2)})` :
         outcome === 'push' ? `Push — $${actualPayout.toFixed(2)} returned` :
         `Lost: -$${bet.stake_usd.toFixed(2)}`}\n\n` +
      `Reply DONE for today's P&L`;

    return twimlResponse(reply);
  }

  // ── DEFAULT: Show help ────────────────────────────────────
  const helpMsg =
    `Dynasty Picks Bot 🏀\n` +
    `Commands:\n` +
    `BET [amt] [pick] — record a bet\n` +
    `PARLAY [N] — show N-leg parlay\n` +
    `WIN/LOSS/PUSH [code] — mark result\n` +
    `DONE — today's P&L\n` +
    `TOTAL — all-time record`;

  return twimlResponse(helpMsg);
});

// ─── HELPERS ──────────────────────────────────────────────────

function twimlResponse(message: string): Response {
  const escaped = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`;
  return new Response(twiml, {
    headers: { 'Content-Type': 'text/xml' },
  });
}

async function parseBet(
  rawMessage: string,
  briefing: any,
  supabase: any
): Promise<any> {
  const upper = rawMessage.trim().toUpperCase();
  const parlayPayouts = (briefing as any)?.sbo_parlay_payouts || [];
  const topMoneylines = briefing?.top_moneylines || [];

  // Simple pattern: BET [amount] PARLAY [legs]
  const parlayBetMatch = upper.match(/^BET\s+(\d+)\s+(?:PARLAY\s+)?(\d+)\s*LEG/i) ||
    upper.match(/^BET\s+(\d+)\s+PARLAY\s+(\d+)/i);
  if (parlayBetMatch) {
    const stake = parseInt(parlayBetMatch[1]);
    const legCount = parseInt(parlayBetMatch[2]);
    const parlayData = parlayPayouts.find((p: any) => p.legs_count === legCount);
    if (parlayData) {
      const stakeKey = `payout_${stake}`;
      const payout = parlayData[stakeKey] || parseFloat((stake * (parlayData.parlay_multiplier || 1)).toFixed(2));
      const legs = (parlayData.leg_details || []).slice(0, legCount).map((l: any) => l.label);
      return {
        success: true,
        bet_type: 'parlay',
        description: `${legCount}-leg parlay ($${stake})`,
        stake,
        odds: null,
        potential_payout: payout,
        legs,
        parlay_legs_count: legCount,
      };
    }
  }

  // Simple pattern: BET [amount] [team] ML
  const mlMatch = upper.match(/^BET\s+(\d+)\s+(.+?)\s+ML/i);
  if (mlMatch) {
    const stake = parseInt(mlMatch[1]);
    const team = mlMatch[2].trim();
    const matchedML = (topMoneylines as any[])?.find((m: any) =>
      m.team?.toUpperCase().includes(team)
    );
    return {
      success: true,
      bet_type: 'moneyline',
      description: `${team} ML`,
      stake,
      odds: -110,
      potential_payout: parseFloat((stake * 1.91).toFixed(2)),
      legs: [],
      parlay_legs_count: null,
    };
  }

  // Simple pattern: BET [amount] [player] OV/UN [line] [stat]
  const propMatch = upper.match(/^BET\s+(\d+)\s+(.+?)\s+(OV|UN|OVER|UNDER)\s+([\d.]+)\s*(\w+)?/i);
  if (propMatch) {
    const stake = parseInt(propMatch[1]);
    const player = propMatch[2].trim();
    const direction = propMatch[3].startsWith('OV') ? 'OVER' : 'UNDER';
    const line = propMatch[4];
    const stat = propMatch[5] || 'PTS';
    return {
      success: true,
      bet_type: 'player_prop',
      description: `${player} ${direction} ${line} ${stat}`,
      stake,
      odds: -115,
      potential_payout: parseFloat((stake * 1.87).toFixed(2)),
      legs: [],
      parlay_legs_count: null,
    };
  }

  return { success: false };
}

async function updateBankroll(supabase: any, date: string) {
  const { data: allBets } = await supabase
    .from('sbo_actual_bets')
    .select('*')
    .not('outcome', 'eq', 'pending');

  if (!allBets?.length) return;

  const totalWagered = allBets.reduce((s: number, b: any) => s + (b.stake_usd || 0), 0);
  const totalWon = allBets
    .filter((b: any) => b.outcome === 'win')
    .reduce((s: number, b: any) => s + (b.actual_payout || 0), 0);
  const wins = allBets.filter((b: any) => b.outcome === 'win').length;
  const losses = allBets.filter((b: any) => b.outcome === 'loss').length;
  const pushes = allBets.filter((b: any) => b.outcome === 'push').length;
  const netPL = totalWon - totalWagered;
  const roi = totalWagered > 0 ? (netPL / totalWagered) * 100 : 0;
  const winRate = (wins + losses) > 0 ? (wins / (wins + losses)) * 100 : 0;

  const profits = allBets
    .filter((b: any) => b.profit_loss !== null)
    .map((b: any) => b.profit_loss || 0);
  const biggestWin = profits.length > 0 ? Math.max(...profits.filter((p: number) => p > 0), 0) : 0;
  const biggestLoss = profits.length > 0 ? Math.min(...profits.filter((p: number) => p < 0), 0) : 0;

  await supabase.from('sbo_bankroll').upsert({
    snapshot_date: date,
    total_wagered: parseFloat(totalWagered.toFixed(2)),
    total_won: parseFloat(totalWon.toFixed(2)),
    total_lost: parseFloat((totalWagered - totalWon).toFixed(2)),
    net_profit_loss: parseFloat(netPL.toFixed(2)),
    roi_pct: parseFloat(roi.toFixed(2)),
    win_count: wins,
    loss_count: losses,
    push_count: pushes,
    win_rate_pct: parseFloat(winRate.toFixed(1)),
    biggest_win: parseFloat(biggestWin.toFixed(2)),
    biggest_loss: parseFloat(biggestLoss.toFixed(2)),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'snapshot_date' });
}
