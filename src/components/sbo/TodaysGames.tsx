import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, AlertCircle } from 'lucide-react';

interface GameData {
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  homeMoneyline: number | null;
  awayMoneyline: number | null;
  spread: number | null;
  spreadOdds: number | null;
  total: number | null;
  totalOverOdds: number | null;
  totalUnderOdds: number | null;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  quarter: string | null;
  clock: string | null;
}

function formatOdds(odds: number | null): string {
  if (odds == null) return '—';
  return odds > 0 ? `+${odds}` : String(odds);
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit',
    }) + ' ET';
  } catch {
    return iso;
  }
}

function isLive(status: string): boolean {
  const liveStatuses = ['InProgress', 'Halftime', 'Q1', 'Q2', 'Q3', 'Q4', 'OT'];
  return liveStatuses.some(s => status?.includes(s));
}

export default function TodaysGames() {
  const [games, setGames] = useState<GameData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<any>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadGames = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('get-todays-games', {
        body: {},
      });
      if (fnError) throw fnError;
      setGames(data?.games || []);
      setMeta(data?.meta || null);
    } catch (e: any) {
      setError(e.message || 'Failed to load games');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Auto-refresh if any game is live
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    const hasLive = games.some(g => isLive(g.status));
    if (hasLive) {
      intervalRef.current = setInterval(loadGames, 60000);
    }
  }, [games, loadGames]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Today's NBA Games
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={loadGames}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Loading...' : 'Load Games'}
        </Button>
      </div>

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="text-sm font-medium text-destructive">Failed to load games</p>
              <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {loading && games.length === 0 && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      )}

      {!loading && games.length === 0 && !error && meta && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">No NBA games scheduled today</p>
          </CardContent>
        </Card>
      )}

      {games.map((game, idx) => {
        const live = isLive(game.status);
        const final = game.status === 'Final' || game.status === 'F/OT';

        return (
          <Card key={idx} className={`rounded-xl overflow-hidden ${live ? 'border-green-500/40' : ''}`}>
            {live && (
              <div className="bg-green-500/10 px-4 py-1.5 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-medium text-green-500">
                  LIVE · {game.quarter} {game.clock}
                </span>
              </div>
            )}
            <CardContent className={`${live ? 'pt-3' : 'pt-5'} pb-4`}>
              {/* Teams + Score */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{game.awayTeam}</span>
                    {(live || final) && (
                      <span className={`text-lg font-bold tabular-nums ${
                        final && game.awayScore != null && game.homeScore != null && game.awayScore > game.homeScore
                          ? 'text-emerald-400' : ''
                      }`}>
                        {game.awayScore ?? '—'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{game.homeTeam}</span>
                    {(live || final) && (
                      <span className={`text-lg font-bold tabular-nums ${
                        final && game.homeScore != null && game.awayScore != null && game.homeScore > game.awayScore
                          ? 'text-emerald-400' : ''
                      }`}>
                        {game.homeScore ?? '—'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Odds row */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-muted/50 rounded-lg py-2 px-1">
                  <div className="text-[10px] text-muted-foreground mb-0.5">ML</div>
                  <div className="text-xs font-medium space-y-0.5">
                    <div className={game.awayMoneyline != null && game.awayMoneyline > 0 ? 'text-emerald-400' : ''}>
                      {formatOdds(game.awayMoneyline)}
                    </div>
                    <div className={game.homeMoneyline != null && game.homeMoneyline > 0 ? 'text-emerald-400' : ''}>
                      {formatOdds(game.homeMoneyline)}
                    </div>
                  </div>
                </div>
                <div className="bg-muted/50 rounded-lg py-2 px-1">
                  <div className="text-[10px] text-muted-foreground mb-0.5">Spread</div>
                  <div className="text-xs font-medium">
                    {game.spread != null ? (
                      <>
                        <div>{game.spread > 0 ? `+${game.spread}` : game.spread}</div>
                        <div className="text-muted-foreground">{formatOdds(game.spreadOdds)}</div>
                      </>
                    ) : '—'}
                  </div>
                </div>
                <div className="bg-muted/50 rounded-lg py-2 px-1">
                  <div className="text-[10px] text-muted-foreground mb-0.5">O/U</div>
                  <div className="text-xs font-medium">
                    {game.total != null ? (
                      <>
                        <div>{game.total}</div>
                        <div className="text-muted-foreground text-[10px]">
                          O{formatOdds(game.totalOverOdds)} / U{formatOdds(game.totalUnderOdds)}
                        </div>
                      </>
                    ) : '—'}
                  </div>
                </div>
              </div>

              {/* Time / Status */}
              <div className="mt-2 text-xs text-muted-foreground text-center">
                {final ? (
                  <span className="font-medium">Final</span>
                ) : live ? null : (
                  <span>{formatTime(game.commenceTime)}</span>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Meta info */}
      {meta && (
        <div className="text-[10px] text-muted-foreground text-center space-y-0.5">
          <div>Odds API: {meta.oddsApiGames} games · SportsData: {meta.sportsDataGames} games</div>
          {meta.oddsError && <div className="text-destructive">⚠️ {meta.oddsError}</div>}
          {meta.sdioError && <div className="text-destructive">⚠️ {meta.sdioError}</div>}
        </div>
      )}
    </div>
  );
}
