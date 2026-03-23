import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ChevronDown, ChevronUp, Loader2, RefreshCw, Search } from 'lucide-react';

// ═══ ODDS HELPERS ═══
const toDecimal = (american: number): number => {
  if (american > 0) return (american / 100) + 1;
  return (100 / Math.abs(american)) + 1;
};

// ═══ DATE HELPERS ═══
const formatParlayDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const formatParlayTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
  }) + ' ET';
};

const formatParlayDateTime = (dateStr: string): string => {
  return formatParlayDate(dateStr) + ' at ' + formatParlayTime(dateStr);
};

const getDateGroupKey = (dateStr: string): string => {
  return formatParlayDate(dateStr);
};

// ═══ STATUS COMPUTATION ═══
const computeParlayStatus = (legs: any[]): string => {
  if (!legs?.length) return 'pending';
  const results = legs.map(l => l.result || 'pending');
  if (results.some(r => r === 'lost')) return 'lost';
  if (results.every(r => r === 'won')) return 'won';
  return 'pending';
};

interface ParlayResultsSectionProps {
  parlays: any[];
  onUpdate?: () => void;
}

export default function ParlayResultsSection({ parlays, onUpdate }: ParlayResultsSectionProps) {
  const [updating, setUpdating] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyProgress, setVerifyProgress] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [legsByParlay, setLegsByParlay] = useState<Record<string, any[]>>({});
  const [loadingLegs, setLoadingLegs] = useState<string | null>(null);
  const [fullParlays, setFullParlays] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Load all parlays with legs on mount — handles both JSONB and normalized
  const loadFullHistory = useCallback(async () => {
    setLoading(true);
    try {
      // Load all parlays
      const { data: allParlays, error } = await (supabase as any)
        .from('sbo_parlays')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Parlay history query failed:', error);
        toast.error('Failed to load parlay history');
        setFullParlays(parlays || []);
        return;
      }

      // Load all legs in one query
      const parlayIds = (allParlays || []).map((p: any) => p.id);
      let allLegs: any[] = [];
      if (parlayIds.length > 0) {
        const { data: legsData } = await (supabase as any)
          .from('sbo_parlay_legs')
          .select('*')
          .in('parlay_id', parlayIds)
          .order('created_at', { ascending: true });
        allLegs = legsData || [];
      }

      // Also load sbo_parlay_builder entries
      const { data: builderParlays } = await (supabase as any)
        .from('sbo_parlay_builder')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      // Merge normalized legs into parlays
      const merged = (allParlays || []).map((p: any) => {
        const normalizedLegs = allLegs.filter((l: any) => l.parlay_id === p.id);
        return { ...p, _normalizedLegs: normalizedLegs, _source: 'sbo_parlays' };
      });

      // Add builder parlays
      const builderMerged = (builderParlays || []).map((p: any) => ({
        ...p, _normalizedLegs: [], _source: 'sbo_parlay_builder',
      }));

      const combined = [...merged, ...builderMerged].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setFullParlays(combined);

      // Pre-populate legsByParlay cache
      const legsCache: Record<string, any[]> = {};
      allLegs.forEach((l: any) => {
        if (!legsCache[l.parlay_id]) legsCache[l.parlay_id] = [];
        legsCache[l.parlay_id].push(l);
      });
      setLegsByParlay(legsCache);
    } catch (e: any) {
      console.error('loadFullHistory error:', e);
      setFullParlays(parlays || []);
    } finally {
      setLoading(false);
    }
  }, [parlays]);

  useEffect(() => { loadFullHistory(); }, [loadFullHistory]);

  // Get display legs for a parlay — normalized legs first, fallback to JSONB
  const getDisplayLegs = (parlay: any): any[] => {
    const normalized = parlay._normalizedLegs || legsByParlay[parlay.id] || [];
    if (normalized.length > 0) return normalized;
    return (parlay.legs as any[]) || [];
  };

  // Load legs for a specific parlay from sbo_parlay_legs
  const loadLegsForParlay = async (parlayId: string) => {
    if (legsByParlay[parlayId]?.length) return;
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
      loadFullHistory();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUpdating(null);
    }
  };

  // ═══ REAL VERIFICATION ENGINE ═══
  const verifyParlayLegs = async (parlayId: string, legs: any[]): Promise<string> => {
    let allVerified = true;
    let anyLost = false;
    let legsWon = 0;
    let legsLost = 0;

    for (const leg of legs) {
      let legResult: string = leg.result || 'pending';
      let verdictNote = leg.verdict_note || '';

      if (legResult !== 'pending') {
        if (legResult === 'won') legsWon++;
        if (legResult === 'lost') { legsLost++; anyLost = true; }
        continue;
      }

      // MONEYLINE LEG VERIFICATION
      if (leg.leg_type === 'moneyline' && leg.game_id) {
        const { data: game } = await (supabase as any)
          .from('sbo_games')
          .select('home_team, away_team, home_score, away_score, status')
          .eq('id', leg.game_id)
          .maybeSingle();

        if (game && game.home_score !== null && game.away_score !== null) {
          const homeWon = game.home_score > game.away_score;
          const awayWon = game.away_score > game.home_score;

          if (leg.pick === 'home') {
            legResult = homeWon ? 'won' : 'lost';
            verdictNote = homeWon
              ? `${game.home_team} won ${game.home_score}-${game.away_score} ✅`
              : `${game.home_team} lost ${game.home_score}-${game.away_score} ❌`;
          } else if (leg.pick === 'away') {
            legResult = awayWon ? 'won' : 'lost';
            verdictNote = awayWon
              ? `${game.away_team} won ${game.away_score}-${game.home_score} ✅`
              : `${game.away_team} lost ${game.away_score}-${game.home_score} ❌`;
          }
        } else {
          allVerified = false;
        }
      }

      // PROP/PREDICTION LEG VERIFICATION
      if (leg.prediction_id) {
        // Check sbo_results_verification first
        const { data: rv } = await (supabase as any)
          .from('sbo_results_verification')
          .select('verdict, actual_result, final_score_home, final_score_away')
          .eq('prediction_id', leg.prediction_id)
          .maybeSingle();

        if (rv?.verdict) {
          legResult = rv.verdict === 'correct' ? 'won' : 'lost';
          verdictNote = rv.actual_result || (legResult === 'won' ? '✅ Correct' : '❌ Incorrect');
        } else {
          // Fallback: check prediction verdict
          const { data: pred } = await supabase
            .from('sbo_predictions')
            .select('verdict, verified, predicted_outcome, sbo_games(home_team, away_team, home_score, away_score)')
            .eq('id', leg.prediction_id)
            .maybeSingle();

          if (pred?.verified && pred?.verdict) {
            const game = (pred as any)?.sbo_games;
            if (leg.leg_type === 'moneyline' && game) {
              const homeScore = game.home_score ?? '?';
              const awayScore = game.away_score ?? '?';
              const winner = (homeScore > awayScore) ? game.home_team : game.away_team;
              legResult = pred.verdict === 'correct' ? 'won' : 'lost';
              verdictNote = pred.verdict === 'correct'
                ? `${winner} won ${Math.max(homeScore, awayScore)}-${Math.min(homeScore, awayScore)} ✅`
                : `${winner} won ${Math.max(homeScore, awayScore)}-${Math.min(homeScore, awayScore)} ❌`;
            } else {
              legResult = pred.verdict === 'correct' ? 'won' : 'lost';
              verdictNote = pred.verdict === 'correct' ? 'Hit ✅' : 'Missed ❌';
            }
          } else {
            allVerified = false;
          }
        }
      }

      // If still pending and has no prediction_id, check by label in JSONB legs
      if (legResult === 'pending' && leg.id && !leg.parlay_id) {
        // This is a JSONB leg — try matching by prediction ID stored in the id field
        const { data: pred } = await supabase
          .from('sbo_predictions')
          .select('verdict, verified')
          .eq('id', leg.id)
          .maybeSingle();
        if (pred?.verified && pred?.verdict) {
          legResult = pred.verdict === 'correct' ? 'won' : 'lost';
          verdictNote = pred.verdict === 'correct' ? 'Hit ✅' : 'Missed ❌';
        } else {
          allVerified = false;
        }
      }

      if (legResult === 'pending') allVerified = false;
      if (legResult === 'lost') { anyLost = true; legsLost++; }
      if (legResult === 'won') legsWon++;

      // Update normalized leg in DB if it has a parlay_id
      if (leg.parlay_id && legResult !== 'pending') {
        await (supabase as any)
          .from('sbo_parlay_legs')
          .update({
            result: legResult,
            verdict_note: verdictNote,
            verified_at: new Date().toISOString(),
          })
          .eq('id', leg.id);
      }
    }

    // Compute parlay status
    const parlayStatus = anyLost ? 'lost' : (allVerified ? 'won' : 'pending');

    // Update parlay record
    await (supabase as any)
      .from('sbo_parlays')
      .update({
        result: parlayStatus,
        status: parlayStatus,
        legs_won: legsWon,
        legs_lost: legsLost,
        verified_at: allVerified ? new Date().toISOString() : null,
      })
      .eq('id', parlayId);

    return parlayStatus;
  };

  const verifyAllParlays = async () => {
    setVerifying(true);
    try {
      // First run the edge function to verify predictions
      setVerifyProgress('Grading predictions...');
      const { data: verifyData } = await supabase.functions.invoke('sbo-verify-results', { body: {} });
      if (verifyData?.verified > 0) {
        toast.success(`${verifyData.correct}W - ${verifyData.incorrect}L predictions graded`);
      }

      // Get all pending parlays
      const { data: pendingParlays } = await (supabase as any)
        .from('sbo_parlays')
        .select('*')
        .or('result.eq.pending,result.is.null,status.eq.pending');

      if (!pendingParlays?.length) {
        toast.info('No pending parlays to verify');
        setVerifying(false);
        setVerifyProgress('');
        return;
      }

      let verified = 0;
      let won = 0;
      let lost = 0;

      for (let i = 0; i < pendingParlays.length; i++) {
        const p = pendingParlays[i];
        setVerifyProgress(`Verifying parlay ${i + 1} of ${pendingParlays.length}...`);

        // Get legs — normalized or JSONB
        const { data: normalizedLegs } = await (supabase as any)
          .from('sbo_parlay_legs')
          .select('*')
          .eq('parlay_id', p.id);

        const legs = normalizedLegs?.length ? normalizedLegs : (p.legs as any[]) || [];
        if (!legs.length) continue;

        const status = await verifyParlayLegs(p.id, legs);
        if (status !== 'pending') {
          verified++;
          if (status === 'won') won++;
          if (status === 'lost') lost++;
        }
      }

      // Also verify sbo_parlay_builder
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
          lost++; verified++;
        } else if (bAllResolved && bAllWon && bLegs.length > 0) {
          await (supabase as any).from('sbo_parlay_builder').update({ result: 'won' }).eq('id', bp.id);
          won++; verified++;
        }
      }

      if (verified > 0) {
        toast.success(`${verified} parlays updated — ${won} WON, ${lost} LOST`);
      } else {
        toast.info('No new results to verify — games may still be in progress');
      }

      setLegsByParlay({});
      await loadFullHistory();
      onUpdate?.();
    } catch (e: any) {
      toast.error('Verification failed: ' + e.message);
    } finally {
      setVerifying(false);
      setVerifyProgress('');
    }
  };

  // ═══ KPI CALCULATIONS — computed from leg results ═══
  const allDisplayParlays = fullParlays.length > 0 ? fullParlays : parlays;

  const computedStatuses = allDisplayParlays.map(p => {
    const legs = getDisplayLegs(p);
    return { ...p, _computedStatus: computeParlayStatus(legs), _displayLegs: legs };
  });

  const wonParlays = computedStatuses.filter(p => (p.result === 'won' || p._computedStatus === 'won'));
  const lostParlays = computedStatuses.filter(p => (p.result === 'lost' || p._computedStatus === 'lost'));
  const pendingParlaysCount = computedStatuses.filter(p => {
    const s = p.result || p._computedStatus;
    return !s || s === 'pending';
  });
  const decidedCount = wonParlays.length + lostParlays.length;
  const winRate = decidedCount > 0 ? Math.round((wonParlays.length / decidedCount) * 100) : 0;

  // Leg-level stats
  const allLegs = computedStatuses.flatMap(p => p._displayLegs || []);
  const wonLegs = allLegs.filter(l => l.result === 'won').length;
  const lostLegs = allLegs.filter(l => l.result === 'lost').length;
  const totalLegsDecided = wonLegs + lostLegs;
  const legHitRate = totalLegsDecided > 0 ? Math.round((wonLegs / totalLegsDecided) * 100) : 0;

  // Average legs per parlay
  const avgLegs = computedStatuses.length > 0
    ? (computedStatuses.reduce((s, p) => s + (p.total_legs || p._displayLegs?.length || 0), 0) / computedStatuses.length).toFixed(1)
    : '0';

  // Most common killer leg type
  const killerTypes: string[] = [];
  computedStatuses.forEach(p => {
    if (p.result !== 'lost' && p._computedStatus !== 'lost') return;
    const legs = p._displayLegs || [];
    const firstLoss = legs.find((l: any) => l.result === 'lost');
    if (firstLoss) killerTypes.push(firstLoss.leg_type || firstLoss.type || 'unknown');
  });
  const killerCounts: Record<string, number> = {};
  killerTypes.forEach(t => { killerCounts[t] = (killerCounts[t] || 0) + 1; });
  const topKiller = Object.entries(killerCounts).sort((a, b) => b[1] - a[1])[0];

  // Group parlays by date
  const groupedByDate: Record<string, any[]> = {};
  computedStatuses.forEach(p => {
    const dateKey = getDateGroupKey(p.parlay_date || p.created_at);
    if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
    groupedByDate[dateKey].push(p);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading parlay history...
      </div>
    );
  }

  if (!computedStatuses.length) {
    return (
      <div className="text-center py-12 border border-dashed rounded-lg border-border">
        <p className="text-4xl mb-2">🎯</p>
        <p className="text-sm text-muted-foreground font-medium">No parlays saved yet</p>
        <p className="text-xs text-muted-foreground mt-1">Build parlays and save them to see history here</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Verify All button */}
      <button
        onClick={verifyAllParlays}
        disabled={verifying}
        className="w-full py-3 rounded-lg text-xs font-medium bg-foreground text-background disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
      >
        {verifying ? (
          <><Loader2 className="h-3 w-3 animate-spin" /> {verifyProgress || 'Verifying...'}</>
        ) : (
          <><Search className="h-3 w-3" /> Verify All Pending Parlays ({pendingParlaysCount.length} pending)</>
        )}
      </button>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
        {[
          { label: 'Total', value: computedStatuses.length, cls: 'text-foreground' },
          { label: 'Won', value: `${wonParlays.length} ✅`, cls: 'text-emerald-500' },
          { label: 'Lost', value: `${lostParlays.length} ❌`, cls: 'text-destructive' },
          { label: 'Pending', value: `${pendingParlaysCount.length} ⏳`, cls: 'text-amber-500' },
          { label: 'Win %', value: `${winRate}%`, cls: winRate >= 30 ? 'text-emerald-500' : 'text-amber-500' },
          { label: 'Leg Hit %', value: `${legHitRate}%`, cls: legHitRate >= 60 ? 'text-emerald-500' : 'text-amber-500' },
          { label: 'Top Killer', value: topKiller ? `${topKiller[0]} (${topKiller[1]}×)` : '—', cls: 'text-destructive' },
        ].map((s, i) => (
          <div key={i} className="rounded-lg bg-muted/30 border border-border p-2 text-center">
            <p className={`text-xs font-bold ${s.cls}`}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* History grouped by date */}
      <div className="space-y-5">
        {Object.entries(groupedByDate).map(([dateStr, dateParlays]) => {
          const dateWon = dateParlays.filter(p => p.result === 'won' || p._computedStatus === 'won').length;
          const dateLost = dateParlays.filter(p => p.result === 'lost' || p._computedStatus === 'lost').length;
          return (
            <div key={dateStr} className="space-y-2">
              <div className="flex items-center justify-between border-b border-border pb-1">
                <p className="text-xs font-semibold text-foreground">📅 {dateStr}</p>
                <p className="text-[10px] text-muted-foreground">
                  {dateParlays.length} parlay{dateParlays.length > 1 ? 's' : ''}
                  {(dateWon + dateLost) > 0 && ` · ${dateWon}W ${dateLost}L`}
                </p>
              </div>

              {dateParlays.map((parlay: any) => {
                const displayLegs = getDisplayLegs(parlay);
                const legCount = parlay.total_legs || displayLegs.length;
                const storedResult = parlay.result;
                const computedResult = computeParlayStatus(displayLegs);
                const effectiveResult = storedResult && storedResult !== 'pending' ? storedResult : computedResult;
                const isWon = effectiveResult === 'won';
                const isLost = effectiveResult === 'lost';
                const isPending = effectiveResult === 'pending';
                const statusMismatch = storedResult && storedResult !== 'pending' && storedResult !== computedResult && computedResult !== 'pending';
                const table = parlay._source === 'sbo_parlay_builder' ? 'sbo_parlay_builder' : 'sbo_parlays';
                const isExpanded = expandedId === parlay.id;

                const stakeVal = parlay.stake || parlay.suggested_stake || 0;
                const oddsAmerican = parlay.odds || parlay.combined_odds_american || 'N/A';
                const decimalOdds = parlay.combined_odds_decimal || 1;
                const profitVal = parlay.profit_if_win || parlay.potential_payout || Math.round((stakeVal * (decimalOdds - 1)) * 100) / 100;

                // Find first losing leg (the killer)
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
                      className="w-full p-3 text-left flex items-center justify-between"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
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
                          <p className="text-sm font-medium text-foreground truncate">
                            {parlay.parlay_name || parlay.name || `${legCount}-Leg Parlay`}
                          </p>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {legCount} legs · {typeof oddsAmerican === 'number' && oddsAmerican > 0 ? '+' : ''}{oddsAmerican}
                          {stakeVal > 0 && ` · $${stakeVal} → $${profitVal}`}
                          {isLost && killerLegIdx >= 0 && ` · Leg ${killerLegIdx + 1} killed it`}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Created: {formatParlayTime(parlay.created_at)}
                          {parlay.verified_at && ` · Verified: ${formatParlayDateTime(parlay.verified_at)}`}
                          {!parlay.verified_at && isPending && ' · Not yet verified'}
                        </p>
                        {statusMismatch && (
                          <p className="text-[10px] text-amber-500 mt-0.5">⚠️ Status mismatch — click Verify</p>
                        )}
                      </div>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                    </button>

                    {/* Expanded leg-by-leg */}
                    {isExpanded && (
                      <div className="px-3 pb-3 space-y-2">
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
                              const afterKiller = isLost && killerLegIdx >= 0 && i > killerLegIdx && legWon;

                              return (
                                <div
                                  key={leg.id || i}
                                  className={`rounded-lg p-2.5 border transition-all ${
                                    isKiller ? 'border-destructive/60 bg-destructive/10 border-l-4 border-l-destructive' :
                                    legWon ? 'border-emerald-500/30 bg-emerald-500/5 border-l-4 border-l-emerald-500' :
                                    legLost ? 'border-destructive/30 bg-destructive/5 border-l-4 border-l-destructive' :
                                    'border-border/50 bg-muted/20 border-l-4 border-l-muted-foreground/30'
                                  }`}
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] text-muted-foreground font-semibold">LEG {i + 1}</span>
                                        <Badge variant="outline" className={`text-[9px] px-1 py-0 ${
                                          legWon ? 'text-emerald-500 border-emerald-500/40' :
                                          legLost ? 'text-destructive border-destructive/40' :
                                          'text-amber-500 border-amber-500/40'
                                        }`}>
                                          {legWon ? '✅ WON' : legLost ? '❌ LOST' : '⏳ PENDING'}
                                        </Badge>
                                        {isKiller && (
                                          <Badge variant="outline" className="text-[9px] px-1 py-0 text-destructive border-destructive/60 bg-destructive/10">
                                            ⚠️ PARLAY KILLER
                                          </Badge>
                                        )}
                                      </div>
                                      <p className="text-xs font-medium text-foreground mt-0.5">{leg.label}</p>
                                      <p className="text-[10px] text-muted-foreground mt-0.5">
                                        Pick: {leg.pick || '—'} · Odds: {leg.odds && leg.odds > 0 ? '+' : ''}{leg.odds || '—'}
                                        {leg.confidence && ` · Confidence: ${leg.confidence}%`}
                                      </p>
                                      {/* Verdict note */}
                                      {leg.verdict_note && (
                                        <p className={`text-[11px] font-medium mt-1 ${legWon ? 'text-emerald-600' : 'text-destructive'}`}>
                                          Result: {leg.verdict_note}
                                        </p>
                                      )}
                                      {!leg.verdict_note && !legPending && (
                                        <p className={`text-[11px] font-medium mt-1 ${legWon ? 'text-emerald-600' : 'text-destructive'}`}>
                                          Result: {legWon ? '✅ WON' : '❌ LOST'}
                                        </p>
                                      )}
                                      {legPending && (
                                        <p className="text-[11px] text-amber-500 mt-1">⏳ Awaiting verification</p>
                                      )}
                                      {isKiller && (
                                        <p className="text-[10px] text-destructive font-semibold mt-0.5">
                                          ⚠️ This leg ended the parlay
                                        </p>
                                      )}
                                      {afterKiller && (
                                        <p className="text-[10px] text-muted-foreground italic mt-0.5">
                                          (didn't matter — parlay already lost)
                                        </p>
                                      )}
                                    </div>
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
