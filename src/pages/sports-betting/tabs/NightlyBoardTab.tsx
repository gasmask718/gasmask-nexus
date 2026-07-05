import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';


const SPORTS = [
  { key: 'nba', label: 'NBA', icon: '🏀', active: true },
  { key: 'nfl', label: 'NFL', icon: '🏈', active: true },
  { key: 'mlb', label: 'MLB', icon: '⚾', active: true },
  { key: 'nhl', label: 'NHL', icon: '🏒', active: true },
  { key: 'mma', label: 'MMA', icon: '🥊', active: true },
  { key: 'soccer_epl', label: 'EPL', icon: '⚽', active: false },
] as const;

type SportKey = typeof SPORTS[number]['key'];

const GOLD = '#C9A84C';

function todayRangeUtc() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  return { start, end, dateOnly: start.slice(0, 10) };
}

// ─── Game counts per sport (badge on selector) ───
function useGameCounts() {
  const { start, end } = useMemo(todayRangeUtc, []);
  return useQuery({
    queryKey: ['nightly-board', 'game-counts', start],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('sbo_games')
        .select('sport_key')
        .gte('commence_time', start)
        .lt('commence_time', end)
        .neq('status', 'final');
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const g of data || []) counts[g.sport_key] = (counts[g.sport_key] || 0) + 1;
      return counts;
    },
    refetchInterval: 60_000,
  });
}

// ─── Stats bar for selected sport ───
function useSportStats(sport: SportKey) {
  const { start, end, dateOnly } = useMemo(todayRangeUtc, []);
  return useQuery({
    queryKey: ['nightly-board', 'stats', sport, dateOnly],
    queryFn: async () => {
      const client = supabase as any;
      const [games, preds, highConf, props] = await Promise.all([
        client.from('sbo_games').select('*', { count: 'exact', head: true })
          .eq('sport_key', sport).gte('commence_time', start).lt('commence_time', end),
        client.from('sbo_predictions').select('*', { count: 'exact', head: true })
          .eq('sport_key', sport).gte('created_at', start).lt('created_at', end),
        client.from('sbo_predictions').select('*', { count: 'exact', head: true })
          .eq('sport_key', sport).gte('created_at', start).lt('created_at', end)
          .gte('final_confidence', 70),
        client.from('sbo_player_props').select('*', { count: 'exact', head: true })
          .eq('sport_key', sport).gte('created_at', start).lt('created_at', end),
      ]);
      return {
        games: games.count ?? 0,
        predictions: preds.count ?? 0,
        highConfidence: highConf.count ?? 0,
        props: props.count ?? 0,
      };
    },
    refetchInterval: 60_000,
  });
}

// ─── Components ───
function SportPill({
  sport, selected, count, onSelect,
}: { sport: typeof SPORTS[number]; selected: boolean; count: number; onSelect: () => void }) {
  const disabled = !sport.active;
  const base =
    'relative flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-all';
  let cls = '';
  if (disabled) cls = 'border-border/30 text-muted-foreground/30 cursor-not-allowed opacity-40';
  else if (selected) cls = 'font-semibold cursor-pointer';
  else cls = 'border-border text-muted-foreground hover:text-foreground cursor-pointer';
  const style = selected && !disabled
    ? { borderColor: GOLD, color: GOLD, backgroundColor: `${GOLD}1A` }
    : undefined;

  return (
    <button
      type="button" disabled={disabled} onClick={onSelect}
      className={`${base} ${cls}`} style={style}
      onMouseEnter={(e) => {
        if (!disabled && !selected) e.currentTarget.style.borderColor = `${GOLD}80`;
      }}
      onMouseLeave={(e) => {
        if (!disabled && !selected) e.currentTarget.style.borderColor = '';
      }}
    >
      <span className="text-base leading-none">{sport.icon}</span>
      <span>{sport.label}</span>
      {!disabled && count > 0 && (
        <span
          className="ml-1 min-w-[20px] rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none"
          style={{ backgroundColor: GOLD, color: '#0A0A0A' }}
        >
          {count}
        </span>
      )}
      {!disabled && count === 0 && (
        <span className="ml-1 min-w-[20px] rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold leading-none text-muted-foreground">
          0
        </span>
      )}
    </button>
  );
}

function StatPill({ icon, value, label, loading }: { icon: string; value: number; label: string; loading: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center rounded-lg border border-border/50 bg-card/50 px-4 py-3">
      <div className="mb-1 text-lg opacity-70">{icon}</div>
      {loading ? (
        <div className="h-7 w-10 animate-pulse rounded bg-muted" />
      ) : (
        <div className="text-2xl font-bold leading-none" style={{ color: GOLD }}>{value}</div>
      )}
      <div className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function EmptyState({ sport }: { sport: typeof SPORTS[number] }) {
  return (
    <div className="mx-auto mt-12 flex max-w-md flex-col items-center rounded-xl border border-border/50 bg-card/30 px-6 py-10 text-center">
      <div className="mb-4 text-5xl">{sport.icon}</div>
      <div className="mb-1 text-lg font-semibold">No {sport.label} games tonight</div>
      <div className="text-sm text-muted-foreground">Next games available when the schedule updates.</div>
    </div>
  );
}

// ─── Helpers ───
const fmtTime = (d: string) =>
  new Date(d).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });

const formatOdds = (odds: number | null | undefined) =>
  odds == null ? '' : odds > 0 ? `+${odds}` : String(odds);

// ─── Games query ───
function useNightlyGames(sport: SportKey) {
  const { start, end } = useMemo(todayRangeUtc, []);
  return useQuery({
    queryKey: ['nightly-games', sport, start],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('sbo_games')
        .select(`
          *,
          sbo_odds!game_id(home_odds, away_odds, spread_home, spread_away, total_line, bookmaker),
          sbo_predictions!game_id(predicted_outcome, final_confidence, confidence_tier, stats_brain_score, market_brain_score, context_brain_score, reasoning)
        `)
        .eq('sport_key', sport)
        .gte('commence_time', start)
        .lt('commence_time', end)
        .neq('status', 'final')
        .order('commence_time');
      if (error) throw error;
      return (data ?? []) as any[];
    },
    refetchInterval: 60_000,
  });
}

// ─── Game card ───
function GameCard({
  game,
  propCount,
  running,
  onRunPrediction,
  onToggleProps,
  onAddToParlay,
}: {
  game: any;
  propCount: number;
  running: boolean;
  onRunPrediction: (id: string) => void;
  onToggleProps: (id: string) => void;
  onAddToParlay: (game: any, pred: any) => void;
}) {
  const odds = game.sbo_odds?.[0];
  const pred = game.sbo_predictions?.[0];
  const conf = Number(pred?.final_confidence ?? 0);

  const borderClass =
    conf >= 70
      ? 'border-[#C9A84C]/50 bg-[#C9A84C]/5'
      : conf >= 55
      ? 'border-amber-500/30 bg-amber-500/5'
      : 'border-border bg-card';

  const confBadgeCls =
    conf >= 80
      ? 'text-[#C9A84C] bg-[#C9A84C]/10 border-[#C9A84C]/30'
      : conf >= 70
      ? 'text-green-400 bg-green-500/10 border-green-500/30'
      : conf >= 55
      ? 'text-blue-400 bg-blue-500/10 border-blue-500/30'
      : 'text-gray-400 bg-gray-500/10 border-gray-500/30';

  const confLabel =
    conf >= 80 ? '⭐ ELITE' : conf >= 70 ? '✅ STRONG' : conf >= 55 ? '📊 MOD' : '⚠️ WEAK';

  return (
    <div className={`rounded-xl border p-4 ${borderClass}`}>
      {/* Header row */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{fmtTime(game.commence_time)}</span>
        {game.status === 'live' && (
          <span className="animate-pulse text-xs font-bold text-green-400">🔴 LIVE</span>
        )}
      </div>

      {/* Teams row */}
      <div className="mb-3 grid grid-cols-3 gap-2">
        <div className="text-center">
          <p className="text-sm font-bold">{game.away_team}</p>
          <p className="text-xs text-muted-foreground">Away</p>
          {odds?.away_odds != null && (
            <p className="mt-1 font-mono text-xs">{formatOdds(odds.away_odds)}</p>
          )}
        </div>
        <div className="flex items-center justify-center text-center text-xs text-muted-foreground">
          VS
        </div>
        <div className="text-center">
          <p className="text-sm font-bold">{game.home_team}</p>
          <p className="text-xs text-muted-foreground">Home</p>
          {odds?.home_odds != null && (
            <p className="mt-1 font-mono text-xs">{formatOdds(odds.home_odds)}</p>
          )}
        </div>
      </div>

      {/* Spread + Total */}
      {odds && (odds.spread_home != null || odds.total_line != null) && (
        <div className="mb-3 flex justify-center gap-4 text-xs text-muted-foreground">
          {odds.spread_home != null && (
            <span>
              Spread: {odds.spread_home > 0 ? '+' : ''}
              {odds.spread_home}
            </span>
          )}
          {odds.total_line != null && <span>O/U {odds.total_line}</span>}
        </div>
      )}

      {/* AI prediction */}
      {pred ? (
        <div className="mb-3 rounded-lg border border-border/50 bg-background/50 p-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-semibold">
              🎯 {pred.predicted_outcome?.toUpperCase()}
            </span>
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-bold ${confBadgeCls}`}
            >
              {confLabel} {conf}%
            </span>
          </div>
          <div className="flex gap-2 text-[10px] text-muted-foreground">
            <span>S:{pred.stats_brain_score ?? 0}</span>
            <span>M:{pred.market_brain_score ?? 0}</span>
            <span>C:{pred.context_brain_score ?? 0}</span>
          </div>
        </div>
      ) : (
        <div className="mb-3 rounded-lg border border-dashed border-border p-3 text-center">
          <p className="mb-2 text-xs text-muted-foreground">No prediction yet</p>
          <button
            onClick={() => onRunPrediction(game.id)}
            disabled={running}
            className="rounded-lg border border-[#C9A84C]/40 bg-[#C9A84C]/15 px-3 py-1 text-xs text-[#C9A84C] hover:bg-[#C9A84C]/25 disabled:opacity-50"
          >
            {running ? '⏳ Running...' : '🧠 Run Prediction'}
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => onToggleProps(game.id)}
          className="flex-1 rounded-lg border border-border py-1.5 text-xs text-muted-foreground transition hover:border-[#C9A84C]/40 hover:text-foreground"
        >
          📋 Props ({propCount})
        </button>
        <button
          onClick={() => onAddToParlay(game, pred)}
          disabled={!pred}
          className="flex-1 rounded-lg border border-border py-1.5 text-xs text-muted-foreground transition hover:border-[#C9A84C]/40 disabled:opacity-30"
        >
          ➕ Parlay
        </button>
      </div>
    </div>
  );
}

function GameCardSkeleton() {
  return <div className="h-56 animate-pulse rounded-xl border border-border/50 bg-card/40" />;
}

// ─── Main tab ───
export default function NightlyBoardTab() {
  const [selectedSport, setSelectedSport] = useState<SportKey>('nba');
  const activeSport = SPORTS.find((s) => s.key === selectedSport)!;
  const queryClient = useQueryClient();

  const { data: counts = {} } = useGameCounts();
  const { data: stats, isLoading: statsLoading } = useSportStats(selectedSport);
  const { data: games = [], isLoading: gamesLoading } = useNightlyGames(selectedSport);

  const [runningPrediction, setRunningPrediction] = useState<string | null>(null);
  const [expandedProps, setExpandedProps] = useState<Set<string>>(new Set());
  const [propCounts, setPropCounts] = useState<Record<string, number>>({});

  const dateLabel = format(new Date(), 'EEEE, MMMM d yyyy');

  // Load per-game prop counts once games arrive
  useEffect(() => {
    if (!games.length) {
      setPropCounts({});
      return;
    }
    const ids = games.map((g: any) => g.id);
    let cancelled = false;
    (async () => {
      const { data, error } = await (supabase as any)
        .from('sbo_player_props')
        .select('game_id')
        .in('game_id', ids);
      if (error || cancelled) return;
      const next: Record<string, number> = {};
      for (const r of data || []) next[r.game_id] = (next[r.game_id] || 0) + 1;
      setPropCounts(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [games]);

  const runPrediction = async (gameId: string) => {
    setRunningPrediction(gameId);
    try {
      const { error } = await supabase.functions.invoke('sbo-run-predictions', {
        body: { game_id: gameId, prediction_type: 'moneyline' },
      });
      if (error) throw error;
      toast.success('Prediction generated');
      queryClient.invalidateQueries({ queryKey: ['nightly-games', selectedSport] });
    } catch (e: any) {
      toast.error(e.message || 'Failed to run prediction');
    } finally {
      setRunningPrediction(null);
    }
  };

  const toggleProps = (gameId: string) => {
    setExpandedProps((prev) => {
      const next = new Set(prev);
      if (next.has(gameId)) next.delete(gameId);
      else next.add(gameId);
      return next;
    });
  };

  const addToParlay = (_game: any, _pred: any) => {
    // Section 4 wires this into the parlay builder.
    toast('Added to parlay builder (coming in Section 4)');
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Header */}
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">🌙 Nightly Board</h1>
          <p className="text-xs text-muted-foreground">Unified nightly command surface</p>
        </div>
        <div className="text-sm text-muted-foreground">{dateLabel}</div>
      </div>

      {/* Sport selector */}
      <div className="mb-4 flex flex-wrap gap-2">
        {SPORTS.map((s) => (
          <SportPill
            key={s.key}
            sport={s}
            selected={selectedSport === s.key}
            count={counts[s.key] ?? 0}
            onSelect={() => setSelectedSport(s.key)}
          />
        ))}
      </div>

      {/* Stats bar */}
      <div className="mb-4 flex gap-3">
        <StatPill icon="🎮" value={stats?.games ?? 0} label="Games" loading={statsLoading} />
        <StatPill icon="🧠" value={stats?.predictions ?? 0} label="Predictions" loading={statsLoading} />
        <StatPill icon="⭐" value={stats?.highConfidence ?? 0} label="High Conf" loading={statsLoading} />
        <StatPill icon="📋" value={stats?.props ?? 0} label="Props" loading={statsLoading} />
      </div>

      <div className="my-6 border-t border-border/50" />

      {/* SECTION 2: GAME CARDS */}
      {gamesLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <GameCardSkeleton />
          <GameCardSkeleton />
          <GameCardSkeleton />
        </div>
      ) : games.length === 0 ? (
        <EmptyState sport={activeSport} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {games.map((g: any) => (
            <GameCard
              key={g.id}
              game={g}
              propCount={propCounts[g.id] ?? 0}
              running={runningPrediction === g.id}
              onRunPrediction={runPrediction}
              onToggleProps={toggleProps}
              onAddToParlay={addToParlay}
            />
          ))}
        </div>
      )}

      {/* expandedProps state reserved for Section 3 (Props panel) */}
      {expandedProps.size > 0 && null}
    </div>
  );
}

