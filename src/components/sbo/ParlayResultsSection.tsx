import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface ParlayResultsSectionProps {
  parlays: any[];
  onUpdate?: () => void;
}

export default function ParlayResultsSection({ parlays, onUpdate }: ParlayResultsSectionProps) {
  const [updating, setUpdating] = useState<string | null>(null);

  const updateResult = async (parlayId: string, result: string, table: string) => {
    setUpdating(parlayId);
    try {
      await (supabase as any)
        .from(table)
        .update({ result })
        .eq('id', parlayId);
      toast.success(`Parlay marked as ${result}`);
      onUpdate?.();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUpdating(null);
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

  const won = parlays.filter(p => p.result === 'won');
  const lost = parlays.filter(p => p.result === 'lost');
  const pending = parlays.filter(p => !p.result || p.result === 'pending');
  const winRate = (won.length + lost.length) > 0
    ? Math.round((won.length / (won.length + lost.length)) * 100)
    : 0;

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Total saved', value: parlays.length, cls: 'text-foreground' },
          { label: 'Won', value: won.length, cls: 'text-emerald-500' },
          { label: 'Lost', value: lost.length, cls: 'text-destructive' },
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
          const table = parlay.variation_number !== undefined
            ? 'sbo_parlay_builder'
            : 'sbo_parlays';

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
                    {new Date(parlay.created_at).toLocaleDateString('en-US', {
                      timeZone: 'America/New_York',
                      weekday: 'short', month: 'short', day: 'numeric',
                    })} · {legs.length} legs · {parlay.combined_odds_american || 'N/A'}
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
                  { label: 'Win prob', value: `${(parlay.win_probability || parlay.combined_confidence || 0).toFixed?.(1) || '?'}%` },
                ].map((m, i) => (
                  <div key={i} className="text-center rounded-lg bg-muted/30 p-2">
                    <p className={`text-xs font-bold ${i === 1 && isWon ? 'text-emerald-500' : 'text-foreground'}`}>{m.value}</p>
                    <p className="text-[10px] text-muted-foreground">{m.label}</p>
                  </div>
                ))}
              </div>

              {/* Legs */}
              {legs.length > 0 && (
                <div className="space-y-1">
                  {legs.slice(0, 5).map((leg: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-[11px] py-1 border-b border-border/50 last:border-0">
                      <span className="text-foreground truncate flex-1">{leg.label}</span>
                      <span className={`ml-2 ${leg.odds > 0 ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                        {leg.odds > 0 ? '+' : ''}{leg.odds}
                      </span>
                    </div>
                  ))}
                  {legs.length > 5 && (
                    <p className="text-[10px] text-muted-foreground">+ {legs.length - 5} more legs</p>
                  )}
                </div>
              )}

              {/* AI verdict */}
              {parlay.ai_verdict && (
                <p className="text-[11px] text-muted-foreground italic">
                  AI: {parlay.ai_verdict} · {parlay.ai_analysis}
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
