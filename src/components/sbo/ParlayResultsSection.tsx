import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

// ═══ ODDS HELPERS ═══
const toDecimal = (american: number): number => {
  if (american > 0) return (american / 100) + 1;
  return (100 / Math.abs(american)) + 1;
};
const calcParlayOdds = (legs: { odds: number }[]): number => {
  const decimal = legs.reduce((acc, leg) => acc * toDecimal(leg.odds), 1);
  if (decimal >= 2) return Math.round((decimal - 1) * 100);
  return Math.round(-100 / (decimal - 1));
};
const calcPayout = (stake: number, legs: { odds: number }[]): number => {
  const decimal = legs.reduce((acc, leg) => acc * toDecimal(leg.odds), 1);
  return Math.round(stake * decimal * 100) / 100;
};

interface ParlayResultsSectionProps {
  parlays: any[];
  onUpdate?: () => void;
}

export default function ParlayResultsSection({ parlays, onUpdate }: ParlayResultsSectionProps) {
  const [updating, setUpdating] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [legsByParlay, setLegsByParlay] = useState<Record<string, any[]>>({});
  const [loadingLegs, setLoadingLegs] = useState<string | null>(null);

  // Load legs for a specific parlay from sbo_parlay_legs
  const loadLegsForParlay = async (parlayId: string) => {
    if (legsByParlay[parlayId]) return; // already loaded
    setLoadingLegs(parlayId);
    try {
      const { data } = await (supabase as any)
        .from('sbo_parlay_legs')
        .select('*')
        .eq('parlay_id', parlayId)
        .order('created_at', { ascending: true });
      setLegsByParlay(prev => ({ ...prev, [parlayId]: data || [] }));
    } catch (e) {
      console.error('Failed to load legs:', e);
    } finally {
      setLoadingLegs(null);
    }
  };

  const toggleExpand = async (parlayId: string) => {
    if (expandedId === parlayId) {
      setExpandedId(null);
    } else {
      setExpandedId(parlayId);
      await loadLegsForParlay(parlayId);
    }
  };

  const updateResult = async (parlayId: string, result: string, table: string) => {
    setUpdating(parlayId);
    try {
      await (supabase as any).from(table).update({ result }).eq('id', parlayId);
      toast.success(`Parlay marked as ${result}`);
      onUpdate?.();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUpdating(null);
    }
  };

  // Verify parlay legs against real results
  const verifyParlayResults = async () => {
    setVerifying(true);
    toast.info('Verifying parlay legs against real results...');
    try {
      // First verify underlying predictions
      const { data: verifyData } = await supabase.functions.invoke('sbo-verify-results', { body: {} });
      if (verifyData?.verified > 0) {
        toast.success(`${verifyData.correct}W - ${verifyData.incorrect}L graded`);
      }

      // Now verify parlay legs in sbo_parlay_legs
      const { data: pendingLegs } = await (supabase as any)
        .from('sbo_parlay_legs')
        .select('*')
        .eq('result', 'pending');

      let legsVerified = 0;
      for (const leg of (pendingLegs || [])) {
        if (leg.prediction_id) {
          // Check prediction verification
          const { data: pred } = await supabase
            .from('sbo_predictions')
            .select('verdict, verified, predicted_outcome, sbo_games(home_team, away_team, home_score, away_score)')
            .eq('id', leg.prediction_id)
            .maybeSingle();

          if (pred?.verified && pred?.verdict) {
            const game = (pred as any)?.sbo_games;
            let verdictNote = '';
            if (leg.leg_type === 'moneyline' && game) {
              const homeScore = game.home_score ?? '?';
              const awayScore = game.away_score ?? '?';
              const winner = (homeScore > awayScore) ? game.home_team : game.away_team;
              verdictNote = pred.verdict === 'correct'
                ? `${winner} won ${Math.max(homeScore, awayScore)}-${Math.min(homeScore, awayScore)} ✅`
                : `${winner} won ${Math.max(homeScore, awayScore)}-${Math.min(homeScore, awayScore)} ❌`;
            } else {
              verdictNote = pred.verdict === 'correct' ? 'Hit ✅' : 'Missed ❌';
            }

            // Also check sbo_results_verification for prop detail
            if (leg.leg_type !== 'moneyline' && leg.prediction_id) {
              const { data: rv } = await (supabase as any)
                .from('sbo_results_verification')
                .select('actual_result, final_score_home, final_score_away')
                .eq('prediction_id', leg.prediction_id)
                .maybeSingle();
              if (rv?.actual_result) {
                verdictNote = `${rv.actual_result} — ${pred.verdict === 'correct' ? '✅' : '❌'}`;
              }
            }

            await (supabase as any)
              .from('sbo_parlay_legs')
              .update({
                result: pred.verdict === 'correct' ? 'won' : 'lost',
                verdict_note: verdictNote,
                verified_at: new Date().toISOString(),
              })
              .eq('id', leg.id);
            legsVerified++;
          }
        }
      }

      // Now update parlay-level status based on legs
      const { data: allParlays } = await (supabase as any)
        .from('sbo_parlays')
        .select('id')
        .or('result.eq.pending,result.is.null');

      let parlaysVerified = 0, pWon = 0, pLost = 0;
      for (const p of (allParlays || [])) {
        const { data: pLegs } = await (supabase as any)
          .from('sbo_parlay_legs')
          .select('result')
          .eq('parlay_id', p.id);

        if (!pLegs?.length) {
          // Fallback: check JSONB legs in sbo_parlays
          const { data: parlayRow } = await (supabase as any)
            .from('sbo_parlays')
            .select('legs')
            .eq('id', p.id)
            .maybeSingle();
          const jsonLegs = (parlayRow?.legs as any[]) || [];
          if (!jsonLegs.length) continue;
          let allWon = true, anyLost = false, allResolved = true;
          for (const jl of jsonLegs) {
            if (!jl.id) continue;
            const { data: pr } = await supabase.from('sbo_predictions').select('verdict, verified').eq('id', jl.id).maybeSingle();
            if (!pr?.verified || !pr?.verdict) { allResolved = false; continue; }
            if (pr.verdict !== 'correct') { allWon = false; anyLost = true; }
          }
          if (anyLost) {
            await (supabase as any).from('sbo_parlays').update({ result: 'lost' }).eq('id', p.id);
            pLost++; parlaysVerified++;
          } else if (allResolved && allWon && jsonLegs.length > 0) {
            await (supabase as any).from('sbo_parlays').update({ result: 'won' }).eq('id', p.id);
            pWon++; parlaysVerified++;
          }
          continue;
        }

        const allWon = pLegs.every((l: any) => l.result === 'won');
        const anyLost = pLegs.some((l: any) => l.result === 'lost');
        const allResolved = pLegs.every((l: any) => l.result !== 'pending');
        const legsWon = pLegs.filter((l: any) => l.result === 'won').length;
        const legsLost = pLegs.filter((l: any) => l.result === 'lost').length;

        if (anyLost) {
          await (supabase as any).from('sbo_parlays').update({ result: 'lost', legs_won: legsWon, legs_lost: legsLost }).eq('id', p.id);
          pLost++; parlaysVerified++;
        } else if (allResolved && allWon) {
          await (supabase as any).from('sbo_parlays').update({ result: 'won', legs_won: legsWon, legs_lost: legsLost }).eq('id', p.id);
          pWon++; parlaysVerified++;
        }
      }

      // Also verify sbo_parlay_builder entries
      const { data: builderPending } = await (supabase as any)
        .from('sbo_parlay_builder')
        .select('*')
        .eq('result', 'pending');
      for (const bp of (builderPending || [])) {
        const bLegs = (bp.legs as any[]) || [];
        if (!bLegs.length) continue;
        let bAllWon = true, bAnyLost = false, bAllResolved = true;
        for (const bl of bLegs) {
          if (!bl.id) continue;
          const { data: pr } = await supabase.from('sbo_predictions').select('verdict, verified').eq('id', bl.id).maybeSingle();
          if (!pr?.verified || !pr?.verdict) { bAllResolved = false; continue; }
          if (pr.verdict !== 'correct') { bAllWon = false; bAnyLost = true; }
        }
        if (bAnyLost) {
          await (supabase as any).from('sbo_parlay_builder').update({ result: 'lost' }).eq('id', bp.id);
          pLost++; parlaysVerified++;
        } else if (bAllResolved && bAllWon && bLegs.length > 0) {
          await (supabase as any).from('sbo_parlay_builder').update({ result: 'won' }).eq('id', bp.id);
          pWon++; parlaysVerified++;
        }
      }

      if (parlaysVerified > 0 || legsVerified > 0) {
        toast.success(`${parlaysVerified} parlays verified (${pWon}W ${pLost}L) · ${legsVerified} legs graded`);
      } else {
        toast.info('No new results to verify — games may still be in progress');
      }
      setLegsByParlay({}); // Clear cache to reload
      onUpdate?.();
    } catch (e: any) {
      toast.error('Verification failed: ' + e.message);
    } finally {
      setVerifying(false);
    }
  };

  // ═══ KPI CALCULATIONS ═══
  const wonParlays = parlays.filter(p => p.result === 'won');
  const lostParlays = parlays.filter(p => p.result === 'lost');
  const pendingParlays = parlays.filter(p => !p.result || p.result === 'pending');
  const decidedCount = wonParlays.length + lostParlays.length;
  const winRate = decidedCount > 0 ? Math.round((wonParlays.length / decidedCount) * 100) : 0;

  // Count total legs won/lost across all parlays
  const totalLegsWon = parlays.reduce((s, p) => s + (p.legs_won || 0), 0);
  const totalLegsLost = parlays.reduce((s, p) => s + (p.legs_lost || 0), 0);
  const totalLegsDecided = totalLegsWon + totalLegsLost;
  const legHitRate = totalLegsDecided > 0 ? Math.round((totalLegsWon / totalLegsDecided) * 100) : 0;

  // Average legs per parlay
  const avgLegs = parlays.length > 0
    ? (parlays.reduce((s, p) => s + (p.total_legs || (p.legs as any[])?.length || 0), 0) / parlays.length).toFixed(1)
    : '0';

  // Most common killer leg type
  const killerTypes: Record<string, number> = {};
  parlays.forEach(p => {
    const legs = (p.legs as any[]) || [];
    legs.forEach((l: any) => {
      // This will only work for JSONB legs — normalized legs checked separately
    });
  });

  // Group parlays by date for history
  const groupedByDate: Record<string, any[]> = {};
  parlays.forEach(p => {
    const dateStr = new Date(p.created_at).toLocaleDateString('en-US', {
      timeZone: 'America/New_York', weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
    });
    if (!groupedByDate[dateStr]) groupedByDate[dateStr] = [];
    groupedByDate[dateStr].push(p);
  });

  if (!parlays.length) {
    return (
      <div className="text-center py-12 border border-dashed rounded-lg border-border">
        <p className="text-4xl mb-2">🎯</p>
        <p className="text-sm text-muted-foreground font-medium">No parlays saved yet</p>
        <p className="text-xs text-muted-foreground mt-1">Build parlays and save them to My Bets</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Verify button */}
      <button
        onClick={verifyParlayResults}
        disabled={verifying}
        className="w-full py-3 rounded-lg text-xs font-medium bg-foreground text-background disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
      >
        {verifying ? <><Loader2 className="h-3 w-3 animate-spin" /> Verifying legs...</> : '⚡ Verify All Parlay Results (Picks + Legs)'}
      </button>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {[
          { label: 'Total', value: parlays.length, cls: 'text-foreground' },
          { label: 'Won', value: wonParlays.length, cls: 'text-emerald-500' },
          { label: 'Lost', value: lostParlays.length, cls: 'text-destructive' },
          { label: 'Win %', value: `${winRate}%`, cls: winRate >= 30 ? 'text-emerald-500' : 'text-amber-500' },
          { label: 'Avg Legs', value: avgLegs, cls: 'text-foreground' },
          { label: 'Leg Hit %', value: `${legHitRate}%`, cls: legHitRate >= 60 ? 'text-emerald-500' : 'text-amber-500' },
        ].map((s, i) => (
          <div key={i} className="rounded-lg bg-muted/30 border border-border p-2 text-center">
            <p className={`text-sm font-bold ${s.cls}`}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* History grouped by date */}
      <div className="space-y-4">
        {Object.entries(groupedByDate).map(([dateStr, dateParlays]) => {
          const dateWon = dateParlays.filter(p => p.result === 'won').length;
          const dateLost = dateParlays.filter(p => p.result === 'lost').length;
          return (
            <div key={dateStr} className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-foreground">📅 {dateStr}</p>
                <p className="text-[10px] text-muted-foreground">
                  {dateParlays.length} parlay{dateParlays.length > 1 ? 's' : ''}
                  {(dateWon + dateLost) > 0 && ` · ${dateWon}W ${dateLost}L`}
                </p>
              </div>

              {dateParlays.map((parlay: any) => {
                const jsonLegs = (parlay.legs as any[]) || [];
                const legCount = parlay.total_legs || jsonLegs.length;
                const isWon = parlay.result === 'won';
                const isLost = parlay.result === 'lost';
                const isPending = !parlay.result || parlay.result === 'pending';
                const table = parlay.variation_number !== undefined ? 'sbo_parlay_builder' : 'sbo_parlays';
                const isExpanded = expandedId === parlay.id;
                const normalizedLegs = legsByParlay[parlay.id] || [];
                const displayLegs = normalizedLegs.length > 0 ? normalizedLegs : jsonLegs;

                const stakeVal = parlay.stake || parlay.suggested_stake || 0;
                const oddsAmerican = parlay.odds || parlay.combined_odds_american || 'N/A';
                const decimalOdds = parlay.combined_odds_decimal || 1;
                const profitVal = parlay.profit_if_win || Math.round((stakeVal * (decimalOdds - 1)) * 100) / 100;

                // Find which leg killed the parlay
                const killerLegIdx = isLost
                  ? displayLegs.findIndex((l: any) => l.result === 'lost' || l.verdict === 'incorrect')
                  : -1;

                return (
                  <div
                    key={parlay.id}
                    className={`rounded-xl border overflow-hidden transition-all ${
                      isWon ? 'border-emerald-500/30 bg-emerald-500/5' :
                      isLost ? 'border-destructive/30 bg-destructive/5' :
                      'border-border bg-card'
                    }`}
                  >
                    {/* Header — clickable to expand */}
                    <button
                      onClick={() => toggleExpand(parlay.id)}
                      className="w-full p-4 text-left flex items-center justify-between"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-foreground">
                            {parlay.parlay_name || parlay.name || `${legCount}-Leg Parlay`}
                          </p>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              isWon ? 'text-emerald-500 border-emerald-500/40' :
                              isLost ? 'text-destructive border-destructive/40' :
                              'text-amber-500 border-amber-500/40'
                            }`}
                          >
                            {isWon ? '✅ WON' : isLost ? '❌ LOST' : '⏳ PENDING'}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {legCount} legs · {oddsAmerican}
                          {stakeVal > 0 && ` · $${stakeVal} → $${profitVal}`}
                          {isLost && killerLegIdx >= 0 && ` · Leg ${killerLegIdx + 1} failed`}
                        </p>
                      </div>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                    </button>

                    {/* Expanded leg-by-leg */}
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-2">
                        {/* Payout info */}
                        <div className="grid grid-cols-3 gap-2 mb-2">
                          {[
                            { label: 'Stake', value: `$${stakeVal}` },
                            { label: isWon ? 'Won' : 'Profit if win', value: `$${profitVal}` },
                            { label: 'Win prob', value: `${(parlay.win_probability || parlay.combined_confidence || 0)?.toFixed?.(1) || '?'}%` },
                          ].map((m, i) => (
                            <div key={i} className="text-center rounded-lg bg-muted/30 p-2">
                              <p className={`text-xs font-bold ${i === 1 && isWon ? 'text-emerald-500' : 'text-foreground'}`}>{m.value}</p>
                              <p className="text-[10px] text-muted-foreground">{m.label}</p>
                            </div>
                          ))}
                        </div>

                        {loadingLegs === parlay.id ? (
                          <div className="flex items-center justify-center py-4 gap-2 text-muted-foreground text-xs">
                            <Loader2 className="h-3 w-3 animate-spin" /> Loading legs...
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {displayLegs.map((leg: any, i: number) => {
                              const legWon = leg.result === 'won';
                              const legLost = leg.result === 'lost';
                              const legPending = !leg.result || leg.result === 'pending';
                              const isKiller = isLost && i === killerLegIdx;

                              return (
                                <div
                                  key={leg.id || i}
                                  className={`rounded-lg p-2.5 border transition-all ${
                                    isKiller ? 'border-destructive/60 bg-destructive/10' :
                                    legWon ? 'border-emerald-500/30 bg-emerald-500/5' :
                                    legLost ? 'border-destructive/30 bg-destructive/5' :
                                    'border-border/50 bg-muted/20'
                                  }`}
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] text-muted-foreground">Leg {i + 1}</span>
                                        <span className="text-xs font-medium text-foreground truncate">{leg.label}</span>
                                      </div>
                                      <p className="text-[10px] text-muted-foreground mt-0.5">
                                        Odds: {leg.odds > 0 ? '+' : ''}{leg.odds}
                                        {leg.confidence && ` · Conf: ${leg.confidence}%`}
                                      </p>
                                      {/* Verdict note */}
                                      {leg.verdict_note && (
                                        <p className={`text-[11px] font-medium mt-1 ${legWon ? 'text-emerald-600' : 'text-destructive'}`}>
                                          {legWon ? '✅' : '❌'} {leg.verdict_note}
                                        </p>
                                      )}
                                      {!leg.verdict_note && !legPending && (
                                        <p className={`text-[11px] font-medium mt-1 ${legWon ? 'text-emerald-600' : 'text-destructive'}`}>
                                          {legWon ? '✅ WON' : '❌ LOST'}
                                        </p>
                                      )}
                                      {legPending && (
                                        <p className="text-[11px] text-amber-500 mt-1">⏳ Pending verification</p>
                                      )}
                                      {isKiller && (
                                        <p className="text-[10px] text-destructive font-semibold mt-0.5">
                                          ← This leg ended the parlay
                                        </p>
                                      )}
                                    </div>
                                    <Badge variant="outline" className={`text-[10px] flex-shrink-0 ${
                                      legWon ? 'text-emerald-500 border-emerald-500/40' :
                                      legLost ? 'text-destructive border-destructive/40' :
                                      'text-amber-500 border-amber-500/40'
                                    }`}>
                                      {legWon ? 'WON' : legLost ? 'LOST' : 'PENDING'}
                                    </Badge>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* AI verdict */}
                        {parlay.ai_verdict && (
                          <p className="text-[11px] text-muted-foreground italic mt-2">
                            AI: {parlay.ai_verdict}{parlay.ai_analysis ? ` · ${parlay.ai_analysis}` : ''}
                          </p>
                        )}

                        {/* Mark result buttons */}
                        {isPending && (
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => updateResult(parlay.id, 'won', table)}
                              disabled={updating === parlay.id}
                              className="flex-1 py-2 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                            >
                              ✅ Mark Won
                            </button>
                            <button
                              onClick={() => updateResult(parlay.id, 'lost', table)}
                              disabled={updating === parlay.id}
                              className="flex-1 py-2 rounded-lg text-xs font-medium bg-destructive/10 text-destructive border border-destructive/30 hover:bg-destructive/20 transition-colors disabled:opacity-50"
                            >
                              ❌ Mark Lost
                            </button>
                          </div>
                        )}

                        {/* Settled result */}
                        {!isPending && (
                          <div className={`text-center py-2 rounded-lg text-sm font-medium mt-2 ${
                            isWon ? 'bg-emerald-500/10 text-emerald-500' : 'bg-destructive/10 text-destructive'
                          }`}>
                            {isWon ? `✅ WON — $${profitVal} profit` : `❌ LOST — $${stakeVal} lost`}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
