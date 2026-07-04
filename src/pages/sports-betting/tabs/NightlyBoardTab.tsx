import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

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

// ─── Main tab ───
export default function NightlyBoardTab() {
  const [selectedSport, setSelectedSport] = useState<SportKey>('nba');
  const activeSport = SPORTS.find((s) => s.key === selectedSport)!;

  const { data: counts = {} } = useGameCounts();
  const { data: stats, isLoading: statsLoading } = useSportStats(selectedSport);

  const dateLabel = format(new Date(), 'EEEE, MMMM d yyyy');
  const gamesToday = stats?.games ?? 0;

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

      {/* SECTION 2: GAMES LIST — Coming next */}
      {!statsLoading && gamesToday === 0 ? (
        <EmptyState sport={activeSport} />
      ) : (
        <div className="text-center text-sm text-muted-foreground">
          {/* SECTION 2: GAMES LIST — Coming next */}
          Games list renders here (STEP 4).
        </div>
      )}
    </div>
  );
}
