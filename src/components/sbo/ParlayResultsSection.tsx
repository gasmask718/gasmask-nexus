import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface ParlayResultsSectionProps {
  parlays: any[];
  onUpdate?: () => void;
}

const getParlayGameDate = (parlay: any) => {
  const legs = (parlay.legs as any[]) || [];
  const legDates = legs.map((l: any) => l.game_date).filter(Boolean).sort();
  if (legDates.length > 0) {
    return new Date(legDates[0]).toLocaleDateString('en-US', {
      timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric',
    });
  }
  return new Date(parlay.created_at).toLocaleDateString('en-US', {
    timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric',
  });
};

export default function ParlayResultsSection({ parlays, onUpdate }: ParlayResultsSectionProps) {
  const [updating, setUpdating] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

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

  const verifyParlayResults = async () => {
    setVerifying(true);
    toast.info('Checking parlay leg results...');
    try {
      const { data: pendingBuilder } = await (supabase as any)
        .from('sbo_parlay_builder')
        .select('*')
        .eq('result', 'pending')
        .order('created_at', { ascending: false });

      const { data: pendingManual } = await (supabase as any)
        .from('sbo_parlays')
        .select('*')
        .or('result.eq.pending,result.is.null')
        .order('created_at', { ascending: false });

      const allPending = [
        ...(pendingBuilder || []).map((p: any) => ({ ...p, _table: 'sbo_parlay_builder' })),
        ...(pendingManual || []).map((p: any) => ({ ...p, _table: 'sbo_parlays' })),
      ];

      let verified = 0, won = 0, lost = 0;

      for (const parlay of allPending) {
        const legs = (parlay.legs as any[]) || [];
        if (!legs.length) continue;

        let allLegsResolved = true;
        let allLegsWon = true;
        let anyLegLost = false;

        for (const leg of legs) {
          if (!leg.id) continue;
          const { data: pred } = await supabase
            .from('sbo_predictions')
            .select('verdict, verified')
            .eq('id', leg.id)
            .maybeSingle();

          if (!pred || !pred.verified || !pred.verdict) {
            allLegsResolved = false;
            continue;
          }
          if (pred.verdict !== 'correct') {
            allLegsWon = false;
            anyLegLost = true;
          }
        }

        if (anyLegLost) {
          await (supabase as any).from(parlay._table).update({ result: 'lost' }).eq('id', parlay.id);
          lost++; verified++;
        } else if (allLegsResolved && allLegsWon && legs.length > 0) {
          await (supabase as any).from(parlay._table).update({
            result: 'won',
            actual_payout: parlay.potential_payout || 0,
          }).eq('id', parlay.id);
          won++; verified++;
        }
      }

      if (verified > 0) {
        toast.success(`${verified} parlays verified — ${won} won · ${lost} lost`);
      } else {
        toast.info('No parlay results could be auto-verified — run Verify Results on the Accuracy tab first');
      }
      onUpdate?.();
    } catch (e: any) {
      toast.error('Verification failed: ' + e.message);
    } finally {
      setVerifying(false);
    }
  };

  const fullVerify = async () => {
    setVerifying(true);
    try {
      const { data } = await supabase.functions.invoke('sbo-verify-results', { body: {} });
      if (data?.verified > 0) {
        toast.success(`${data.correct}W - ${data.incorrect}L graded`);
      }
      await verifyParlayResults();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setVerifying(false);
    }
  };

  if (!parlays.length) {
    return (
      <div className="text-center py-12 border border-dashed rounded-lg border-border">
        <p className="text-4xl mb-2">🎯</p>
        <p className="text-sm text-muted-foreground font-medium">No parlays saved yet</p>
        <p className="text-xs text-muted-foreground mt-1">Build parlays and save them to My Bets</p>
      </div>
    );
  }

  const wonParlays = parlays.filter(p => p.result === 'won');
  const lostParlays = parlays.filter(p => p.result === 'lost');
  const pendingParlays = parlays.filter(p => !p.result || p.result === 'pending');
  const winRate = (wonParlays.length + lostParlays.length) > 0
    ? Math.round((wonParlays.length / (wonParlays.length + lostParlays.length)) * 100)
    : 0;

  return (
    <div className="space-y-4">
      {/* Verify buttons */}
      <div className="flex gap-2">
        <button
          onClick={verifyParlayResults}
          disabled={verifying}
          className="flex-1 py-3 rounded-lg text-xs font-medium bg-foreground text-background disabled:opacity-50 transition-colors"
        >
          {verifying ? 'Checking legs...' : '🔍 Verify All Parlay Results'}
        </button>
        <button
          onClick={fullVerify}
          disabled={verifying}
          className="flex-1 py-3 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
        >
          ⚡ Full Verify (Picks + Parlays)
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Total saved', value: parlays.length, cls: 'text-foreground' },
          { label: 'Won', value: wonParlays.length, cls: 'text-emerald-500' },
          { label: 'Lost', value: lostParlays.length, cls: 'text-destructive' },
          { label: 'Win rate', value: `${winRate}%`, cls: winRate >= 30 ? 'text-emerald-500' : 'text-amber-500' },
        ].map((s, i) => (
          <div key={i} className="rounded-lg bg-muted/30 border border-border p-3 text-center">
            <p className={`text-lg font-bold ${s.cls}`}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Parlay cards */}
      <div className="space-y-3">
        {parlays.map((parlay: any) => {
          const legs = (parlay.legs as any[]) || [];
          const isWon = parlay.result === 'won';
          const isLost = parlay.result === 'lost';
          const isPending = !parlay.result || parlay.result === 'pending';
          const table = parlay.variation_number !== undefined ? 'sbo_parlay_builder' : 'sbo_parlays';

          const stakeVal = parlay.stake || parlay.suggested_stake || 0;
          const decimalOdds = parlay.combined_odds_decimal || 1;
          const profitVal = parlay.profit_if_win || Math.round((stakeVal * (decimalOdds - 1)) * 100) / 100;

          return (
            <div
              key={parlay.id}
              className={`rounded-xl border p-4 space-y-3 ${
                isWon ? 'border-emerald-500/30 bg-emerald-500/5' :
                isLost ? 'border-destructive/30 bg-destructive/5' :
                'border-border bg-card'
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {parlay.parlay_name || parlay.name || `${legs.length}-Leg Parlay`}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    📅 Games: {getParlayGameDate(parlay)}
                    {' · Built: '}{new Date(parlay.created_at).toLocaleDateString('en-US', {
                      timeZone: 'America/New_York', month: 'short', day: 'numeric',
                    })}
                    {' · '}{legs.length} legs · {parlay.combined_odds_american || 'N/A'}
                  </p>
                </div>
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

              {/* Payout info */}
              <div className="grid grid-cols-3 gap-2">
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

              {/* Legs with confidence */}
              {legs.length > 0 && (
                <div className="space-y-0.5">
                  {legs.slice(0, 8).map((leg: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-[11px] py-1.5 border-b border-border/30 last:border-0">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <span className="text-[10px]">{leg.type === 'game' ? '🏀' : '📊'}</span>
                        <span className="text-foreground truncate font-medium">{leg.label}</span>
                      </div>
                      <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                        {leg.confidence && (
                          <span className="text-[10px] text-muted-foreground">{leg.confidence}%</span>
                        )}
                        <span className={`font-medium ${leg.odds > 0 ? 'text-emerald-500' : 'text-foreground'}`}>
                          {leg.odds > 0 ? '+' : ''}{leg.odds}
                        </span>
                      </div>
                    </div>
                  ))}
                  {legs.length > 8 && (
                    <p className="text-[10px] text-muted-foreground pt-1">+ {legs.length - 8} more legs</p>
                  )}
                </div>
              )}

              {/* AI verdict */}
              {parlay.ai_verdict && (
                <p className="text-[11px] text-muted-foreground italic">
                  AI: {parlay.ai_verdict}{parlay.ai_analysis ? ` · ${parlay.ai_analysis}` : ''}
                </p>
              )}

              {/* Mark result buttons */}
              {isPending && (
                <div className="flex gap-2">
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
                <div className={`text-center py-2 rounded-lg text-sm font-medium ${
                  isWon ? 'bg-emerald-500/10 text-emerald-500' : 'bg-destructive/10 text-destructive'
                }`}>
                  {isWon ? `✅ WON — $${profitVal} profit` : `❌ LOST — $${stakeVal} lost`}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
