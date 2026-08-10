import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DataQualityBadge } from '@/components/sbo/DataQualityBadge';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { ChevronDown } from 'lucide-react';

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

const PROP_ICONS: Record<string, string> = {
  points: '🎯', rebounds: '🏀', assists: '🎽', threes: '3️⃣', blocks: '🛡️',
  steals: '⚡', pra: '📊', pts_reb_ast: '📊', pts_reb: '📊', pts_ast: '📊', reb_ast: '📊',
  pass_yards: '🏈', rush_yards: '🦵', rec_yards: '📡',
  strikeouts_p: '⚾', strikeouts_b: '⚾', hits: '💥', home_runs: '🚀',
  goals: '🥅', shots: '🎯', saves: '🧤',
  ko_win: '🥊', decision: '📋', rounds: '⏱️',
};

function todayRangeUtc() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  return { start, end, dateOnly: start.slice(0, 10) };
}

const fmtTime = (d: string) =>
  new Date(d).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  });

const formatOdds = (odds: number | null | undefined) =>
  odds == null ? '' : odds > 0 ? `+${odds}` : String(odds);

// ─── Queries ───
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
          sbo_predictions!game_id(predicted_outcome, final_confidence, confidence_tier, data_quality, stats_brain_score, market_brain_score, context_brain_score, reasoning)
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

function useBestBets(sport: SportKey) {
  const { start, end } = useMemo(todayRangeUtc, []);
  return useQuery({
    queryKey: ['nightly-best-bets', sport, start],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('sbo_predictions')
        .select(`
          id, predicted_outcome, final_confidence, confidence_tier, data_quality, prediction_type, prop_id, game_id,
          sbo_games!inner(home_team, away_team, commence_time, sport_key),
          sbo_player_props(player_name, prop_type, line)
        `)
        .eq('sport_key', sport)
        .gte('final_confidence', 65)
        .gte('sbo_games.commence_time', start)
        .lt('sbo_games.commence_time', end)
        .order('final_confidence', { ascending: false })
        .limit(8);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    refetchInterval: 60_000,
  });
}

// ─── UI primitives ───
function SportPill({
  sport, selected, count, onSelect,
}: { sport: typeof SPORTS[number]; selected: boolean; count: number; onSelect: () => void }) {
  const disabled = !sport.active;
  const base = 'relative flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-all';
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
      onMouseEnter={(e) => { if (!disabled && !selected) e.currentTarget.style.borderColor = `${GOLD}80`; }}
      onMouseLeave={(e) => { if (!disabled && !selected) e.currentTarget.style.borderColor = ''; }}
    >
      <span className="text-base leading-none">{sport.icon}</span>
      <span>{sport.label}</span>
      {!disabled && count > 0 && (
        <span className="ml-1 min-w-[20px] rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none"
          style={{ backgroundColor: GOLD, color: '#0A0A0A' }}>{count}</span>
      )}
      {!disabled && count === 0 && (
        <span className="ml-1 min-w-[20px] rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold leading-none text-muted-foreground">0</span>
      )}
    </button>
  );
}

function StatPill({ icon, value, label, loading }: { icon: string; value: number; label: string; loading: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center rounded-lg border border-border/50 bg-card/50 px-4 py-3">
      <div className="mb-1 text-lg opacity-70">{icon}</div>
      {loading ? <div className="h-7 w-10 animate-pulse rounded bg-muted" />
        : <div className="text-2xl font-bold leading-none" style={{ color: GOLD }}>{value}</div>}
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

// ─── Game card ───
function GameCard({
  game, propCount, running, expanded,
  onRunPrediction, onToggleProps, onAddToParlay,
}: {
  game: any; propCount: number; running: boolean; expanded: boolean;
  onRunPrediction: (id: string) => void;
  onToggleProps: (id: string) => void;
  onAddToParlay: (game: any, pred: any) => void;
}) {
  const odds = game.sbo_odds?.[0];
  const pred = game.sbo_predictions?.[0];
  const conf = Number(pred?.final_confidence ?? 0);

  const borderClass =
    conf >= 70 ? 'border-[#C9A84C]/50 bg-[#C9A84C]/5'
    : conf >= 55 ? 'border-amber-500/30 bg-amber-500/5'
    : 'border-border bg-card';
  const confBadgeCls =
    conf >= 80 ? 'text-[#C9A84C] bg-[#C9A84C]/10 border-[#C9A84C]/30'
    : conf >= 70 ? 'text-green-400 bg-green-500/10 border-green-500/30'
    : conf >= 55 ? 'text-blue-400 bg-blue-500/10 border-blue-500/30'
    : 'text-gray-400 bg-gray-500/10 border-gray-500/30';
  const confLabel = conf >= 80 ? '⭐ ELITE' : conf >= 70 ? '✅ STRONG' : conf >= 55 ? '📊 MOD' : '⚠️ WEAK';

  return (
    <div className={`rounded-xl border p-4 ${borderClass}`}>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{fmtTime(game.commence_time)}</span>
        {game.status === 'live' && <span className="animate-pulse text-xs font-bold text-green-400">🔴 LIVE</span>}
      </div>
      <div className="mb-3 grid grid-cols-3 gap-2">
        <div className="text-center">
          <p className="text-sm font-bold">{game.away_team}</p>
          <p className="text-xs text-muted-foreground">Away</p>
          {odds?.away_odds != null && <p className="mt-1 font-mono text-xs">{formatOdds(odds.away_odds)}</p>}
        </div>
        <div className="flex items-center justify-center text-center text-xs text-muted-foreground">VS</div>
        <div className="text-center">
          <p className="text-sm font-bold">{game.home_team}</p>
          <p className="text-xs text-muted-foreground">Home</p>
          {odds?.home_odds != null && <p className="mt-1 font-mono text-xs">{formatOdds(odds.home_odds)}</p>}
        </div>
      </div>
      {odds && (odds.spread_home != null || odds.total_line != null) && (
        <div className="mb-3 flex justify-center gap-4 text-xs text-muted-foreground">
          {odds.spread_home != null && <span>Spread: {odds.spread_home > 0 ? '+' : ''}{odds.spread_home}</span>}
          {odds.total_line != null && <span>O/U {odds.total_line}</span>}
        </div>
      )}
      {pred ? (
        <div className="mb-3 rounded-lg border border-border/50 bg-background/50 p-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-semibold">🎯 {pred.predicted_outcome?.toUpperCase()}</span>
            <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${confBadgeCls}`}>
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
          <button onClick={() => onRunPrediction(game.id)} disabled={running}
            className="rounded-lg border border-[#C9A84C]/40 bg-[#C9A84C]/15 px-3 py-1 text-xs text-[#C9A84C] hover:bg-[#C9A84C]/25 disabled:opacity-50">
            {running ? '⏳ Running...' : '🧠 Run Prediction'}
          </button>
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={() => onToggleProps(game.id)}
          className={`flex-1 rounded-lg border py-1.5 text-xs transition ${
            expanded ? 'border-[#C9A84C]/50 bg-[#C9A84C]/10 text-[#C9A84C]'
            : 'border-border text-muted-foreground hover:border-[#C9A84C]/40 hover:text-foreground'
          }`}>
          📋 Props ({propCount}) {expanded ? '▲' : '▼'}
        </button>
        <button onClick={() => onAddToParlay(game, pred)} disabled={!pred}
          className="flex-1 rounded-lg border border-border py-1.5 text-xs text-muted-foreground transition hover:border-[#C9A84C]/40 disabled:opacity-30">
          ➕ Parlay
        </button>
      </div>
    </div>
  );
}

function GameCardSkeleton() {
  return <div className="h-56 animate-pulse rounded-xl border border-border/50 bg-card/40" />;
}

// ─── Props panel (Section 3) ───
function PropsPanel({
  props, onRunPropPrediction, onRefresh,
}: {
  props: any[];
  onRunPropPrediction: (propId: string, direction: 'over' | 'under') => Promise<void>;
  onRefresh: () => void;
}) {
  const byPlayer = props.reduce((acc: Record<string, any[]>, p: any) => {
    (acc[p.player_name] ||= []).push(p);
    return acc;
  }, {});

  return (
    <div className="mt-3 space-y-4 rounded-xl border border-[#C9A84C]/30 bg-background/40 p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold" style={{ color: GOLD }}>📋 Player Props</div>
        <button onClick={onRefresh} className="text-[10px] text-muted-foreground hover:text-foreground">↻ Refresh</button>
      </div>
      {Object.entries(byPlayer).map(([playerName, playerProps]) => (
        <div key={playerName} className="rounded-lg border border-border/50 bg-card/40 p-3">
          <div className="mb-2 text-sm font-bold">{playerName}</div>
          <div className="space-y-2">
            {(playerProps as any[]).map((prop: any) => {
              const pred = prop.sbo_predictions?.[0];
              const acc = prop.sbo_prop_accuracy?.[0];
              const overAcc = acc?.over_total > 10 ? Math.round((acc.over_correct / acc.over_total) * 100) : null;
              const underAcc = acc?.under_total > 10 ? Math.round((acc.under_correct / acc.under_total) * 100) : null;
              return (
                <div key={prop.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border/30 bg-background/50 px-3 py-2 text-xs">
                  <span className="min-w-[110px] font-medium">
                    {PROP_ICONS[prop.prop_type] ?? '📊'} {prop.prop_type?.replace(/_/g, ' ')}
                  </span>
                  <span className="font-mono font-bold" style={{ color: GOLD }}>{prop.line}</span>
                  <span className="flex gap-2 font-mono text-muted-foreground">
                    {prop.over_odds != null && <span>O: {formatOdds(prop.over_odds)}</span>}
                    {prop.under_odds != null && <span>U: {formatOdds(prop.under_odds)}</span>}
                  </span>
                  <span className="ml-auto flex items-center gap-2">
                    {pred ? (
                      <span className="rounded border border-[#C9A84C]/30 bg-[#C9A84C]/10 px-2 py-0.5 text-[10px] font-bold text-[#C9A84C]">
                        AI: {pred.predicted_outcome?.toUpperCase()} {pred.final_confidence}%
                      </span>
                    ) : null}
                    {pred ? (
                      <DataQualityBadge quality={pred.data_quality} compact />
                    ) : (
                      <span className="flex gap-1">
                        <button onClick={() => onRunPropPrediction(prop.id, 'over')}
                          className="rounded border border-green-500/20 bg-green-500/10 px-2 py-0.5 text-[10px] text-green-400 hover:bg-green-500/20">
                          🧠 OVER
                        </button>
                        <button onClick={() => onRunPropPrediction(prop.id, 'under')}
                          className="rounded border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[10px] text-red-400 hover:bg-red-500/20">
                          🧠 UNDER
                        </button>
                      </span>
                    )}
                    {(overAcc != null || underAcc != null) && (
                      <span className="text-[10px]">
                        {overAcc != null && (
                          <span className={overAcc >= 60 ? 'text-green-400' : 'text-muted-foreground'}>O:{overAcc}%</span>
                        )}
                        {overAcc != null && underAcc != null && ' '}
                        {underAcc != null && (
                          <span className={underAcc >= 60 ? 'text-green-400' : 'text-muted-foreground'}>U:{underAcc}%</span>
                        )}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Best Bets panel (Section 4) ───
function BestBetsPanel({
  sport, bets, loading, onAddToParlay,
}: { sport: SportKey; bets: any[]; loading: boolean; onAddToParlay: (pred: any) => void }) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg border border-border/50 bg-card/40" />
        ))}
      </div>
    );
  }
  if (!bets.length) {
    return (
      <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
        No high-confidence picks yet.
        <br />Run predictions on tonight's games to populate best bets.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {bets.map((b) => {
        const conf = Number(b.final_confidence ?? 0);
        const tierLabel = conf >= 80 ? 'ELITE' : conf >= 70 ? 'STRONG' : 'MOD';
        const badgeCls = conf >= 80
          ? 'text-[#C9A84C] bg-[#C9A84C]/10 border-[#C9A84C]/30'
          : conf >= 70 ? 'text-green-400 bg-green-500/10 border-green-500/30'
          : 'text-blue-400 bg-blue-500/10 border-blue-500/30';
        const game = b.sbo_games;
        const prop = b.sbo_player_props;
        const isMoneyline = b.prediction_type === 'moneyline' || !prop;
        const label = isMoneyline
          ? `${b.predicted_outcome?.toUpperCase()} ML`
          : `${prop?.player_name} ${b.predicted_outcome?.toUpperCase()} ${prop?.line}`;
        return (
          <div key={b.id} className="rounded-lg border border-border/60 bg-card/60 p-3">
            <div className="mb-1 flex items-center justify-between">
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${badgeCls}`}>
                {conf >= 80 ? '⭐' : conf >= 70 ? '✅' : '📊'} {conf}%
              </span>
              <span className="flex items-center gap-1.5">
                <DataQualityBadge quality={b.data_quality} compact />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{tierLabel}</span>
              </span>
            </div>
            <div className="text-sm font-bold">{label}</div>
            <div className="text-[11px] text-muted-foreground">
              {game?.away_team} @ {game?.home_team}
            </div>
            <button onClick={() => onAddToParlay(b)}
              className="mt-1 text-[10px] text-[#C9A84C] hover:underline">
              ➕ Add to Parlay
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main tab ───
export default function NightlyBoardTab() {
  const [selectedSport, setSelectedSport] = useState<SportKey>('nba');
  const activeSport = SPORTS.find((s) => s.key === selectedSport)!;
  const queryClient = useQueryClient();

  const { data: counts = {} } = useGameCounts();
  const { data: stats, isLoading: statsLoading } = useSportStats(selectedSport);
  const { data: gamesData, isLoading: gamesLoading } = useNightlyGames(selectedSport);
  const games = useMemo(() => gamesData ?? [], [gamesData]);
  const { data: bestBets = [], isLoading: bestBetsLoading } = useBestBets(selectedSport);

  const [runningPrediction, setRunningPrediction] = useState<string | null>(null);
  const [expandedProps, setExpandedProps] = useState<Set<string>>(new Set());
  const [propsData, setPropsData] = useState<Record<string, any[]>>({});
  const [loadingProps, setLoadingProps] = useState<Set<string>>(new Set());
  const [propCounts, setPropCounts] = useState<Record<string, number>>({});
  const [mobileBestBetsOpen, setMobileBestBetsOpen] = useState(false);

  const dateLabel = format(new Date(), 'EEEE, MMMM d yyyy');

  useEffect(() => {
    if (!games.length) {
      setPropCounts((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      return;
    }
    const ids = games.map((g: any) => g.id);
    let cancelled = false;
    (async () => {
      const { data, error } = await (supabase as any)
        .from('sbo_player_props').select('game_id').in('game_id', ids);
      if (error || cancelled) return;
      const next: Record<string, number> = {};
      for (const r of data || []) next[r.game_id] = (next[r.game_id] || 0) + 1;
      setPropCounts(next);
    })();
    return () => { cancelled = true; };
  }, [games]);

  // Reset when sport changes
  useEffect(() => {
    setExpandedProps(new Set());
    setPropsData({});
  }, [selectedSport]);

  const fetchProps = async (gameId: string) => {
    const { data, error } = await (supabase as any)
      .from('sbo_player_props')
      .select(`
        *,
        sbo_predictions!prop_id(predicted_outcome, final_confidence, confidence_tier, data_quality, stats_brain_score, market_brain_score, context_brain_score),
        sbo_prop_accuracy(over_total, over_correct, under_total, under_correct)
      `)
      .eq('game_id', gameId)
      .eq('sport_key', selectedSport)
      // PHASE 3 / ITEM 8 — bounded read (nightly board); table exceeds the 1k PostgREST default.
      .limit(1000)
      .order('player_name');
    if (error) { toast.error(error.message); return []; }
    return data ?? [];
  };

  const toggleProps = async (gameId: string) => {
    const isOpen = expandedProps.has(gameId);
    setExpandedProps((prev) => {
      const next = new Set(prev);
      if (isOpen) next.delete(gameId); else next.add(gameId);
      return next;
    });
    if (!isOpen && !propsData[gameId]) {
      setLoadingProps((prev) => new Set([...prev, gameId]));
      const props = await fetchProps(gameId);
      setPropsData((prev) => ({ ...prev, [gameId]: props }));
      setLoadingProps((prev) => {
        const next = new Set(prev); next.delete(gameId); return next;
      });
    }
  };

  const refreshProps = async (gameId: string) => {
    setLoadingProps((prev) => new Set([...prev, gameId]));
    const props = await fetchProps(gameId);
    setPropsData((prev) => ({ ...prev, [gameId]: props }));
    setLoadingProps((prev) => {
      const next = new Set(prev); next.delete(gameId); return next;
    });
  };

  const runPrediction = async (gameId: string) => {
    setRunningPrediction(gameId);
    try {
      const { error } = await supabase.functions.invoke('sbo-run-predictions', {
        body: { game_id: gameId, prediction_type: 'moneyline' },
      });
      if (error) throw error;
      toast.success('Prediction generated');
      queryClient.invalidateQueries({ queryKey: ['nightly-games', selectedSport] });
      queryClient.invalidateQueries({ queryKey: ['nightly-best-bets', selectedSport] });
    } catch (e: any) {
      toast.error(e.message || 'Failed to run prediction');
    } finally {
      setRunningPrediction(null);
    }
  };

  const runPropPrediction = async (propId: string, direction: 'over' | 'under') => {
    try {
      const { error } = await supabase.functions.invoke('sbo-run-predictions', {
        body: { prop_id: propId, prediction_type: 'player_prop', predicted_outcome: direction },
      });
      if (error) throw error;
      toast.success('Prop prediction complete');
      // find which game the prop belongs to and refresh that game's props
      for (const [gid, list] of Object.entries(propsData)) {
        if ((list as any[]).some((p) => p.id === propId)) {
          await refreshProps(gid);
          break;
        }
      }
      queryClient.invalidateQueries({ queryKey: ['nightly-best-bets', selectedSport] });
    } catch (e: any) {
      toast.error(e.message || 'Failed to run prop prediction');
    }
  };

  const addToParlay = (_a: any, _b?: any) => {
    // Placeholder — parlay builder integration comes with the ParlayPage bridge.
    toast('Added to parlay builder');
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">🌙 Nightly Board</h1>
          <p className="text-xs text-muted-foreground">Unified nightly command surface</p>
        </div>
        <div className="text-sm text-muted-foreground">{dateLabel}</div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {SPORTS.map((s) => (
          <SportPill key={s.key} sport={s} selected={selectedSport === s.key}
            count={counts[s.key] ?? 0} onSelect={() => setSelectedSport(s.key)} />
        ))}
      </div>

      <div className="mb-4 flex gap-3">
        <StatPill icon="🎮" value={stats?.games ?? 0} label="Games" loading={statsLoading} />
        <StatPill icon="🧠" value={stats?.predictions ?? 0} label="Predictions" loading={statsLoading} />
        <StatPill icon="⭐" value={stats?.highConfidence ?? 0} label="High Conf" loading={statsLoading} />
        <StatPill icon="📋" value={stats?.props ?? 0} label="Props" loading={statsLoading} />
      </div>

      <div className="my-6 border-t border-border/50" />

      {/* Mobile: best-bets accordion */}
      <div className="mb-4 lg:hidden">
        <button onClick={() => setMobileBestBetsOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-lg border border-[#C9A84C]/30 bg-[#C9A84C]/5 px-4 py-2 text-sm font-semibold" style={{ color: GOLD }}>
          <span>🔥 Best Bets ({bestBets.length})</span>
          <ChevronDown className={`h-4 w-4 transition ${mobileBestBetsOpen ? 'rotate-180' : ''}`} />
        </button>
        {mobileBestBetsOpen && (
          <div className="mt-3">
            <BestBetsPanel sport={selectedSport} bets={bestBets} loading={bestBetsLoading} onAddToParlay={addToParlay} />
          </div>
        )}
      </div>

      <div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-6">
        {/* Main column — games + inline props */}
        <div>
          {gamesLoading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <GameCardSkeleton /><GameCardSkeleton /><GameCardSkeleton /><GameCardSkeleton />
            </div>
          ) : games.length === 0 ? (
            <EmptyState sport={activeSport} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {games.map((g: any) => {
                const expanded = expandedProps.has(g.id);
                return (
                  <div key={g.id} className={expanded ? 'sm:col-span-2' : undefined}>
                    <GameCard
                      game={g}
                      propCount={propCounts[g.id] ?? 0}
                      running={runningPrediction === g.id}
                      expanded={expanded}
                      onRunPrediction={runPrediction}
                      onToggleProps={toggleProps}
                      onAddToParlay={addToParlay}
                    />
                    {expanded && (
                      loadingProps.has(g.id) ? (
                        <div className="mt-3 space-y-2 rounded-xl border border-[#C9A84C]/20 bg-background/40 p-4">
                          {[1, 2, 3].map((i) => (
                            <div key={i} className="h-10 animate-pulse rounded bg-muted/50" />
                          ))}
                        </div>
                      ) : !propsData[g.id]?.length ? (
                        <div className="mt-3 rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                          No props available for this game yet. Run odds fetch to populate.
                        </div>
                      ) : (
                        <PropsPanel
                          props={propsData[g.id]}
                          onRunPropPrediction={runPropPrediction}
                          onRefresh={() => refreshProps(g.id)}
                        />
                      )
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Desktop: sticky best bets */}
        <aside className="hidden lg:block">
          <div className="sticky top-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold" style={{ color: GOLD }}>🔥 Best Bets</div>
              <span className="text-[10px] text-muted-foreground">Top 8 · Conf ≥ 65%</span>
            </div>
            <BestBetsPanel sport={selectedSport} bets={bestBets} loading={bestBetsLoading} onAddToParlay={addToParlay} />
          </div>
        </aside>
      </div>
    </div>
  );
}
