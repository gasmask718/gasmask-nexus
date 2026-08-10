import { useState, useEffect } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DataQualityBadge } from '@/components/sbo/DataQualityBadge';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { PredictionResult } from '@/components/sbo/PredictionResult';
import { SyncDashboard } from '@/components/sbo/SyncDashboard';
import { Loader2, RefreshCw, Plus, Save, X, TrendingUp, Trophy, Brain, Check, Settings, Bookmark, Shield } from 'lucide-react';
import { toast } from 'sonner';
import HedgeCenter from '@/pages/os/betting/HedgeCenter';
import PredictionHistory from '@/components/sbo/PredictionHistory';
import ParlayResultsSection from '@/components/sbo/ParlayResultsSection';
import HistoryView from '@/components/sbo/HistoryView';
import { ChingWorldPicksSMS } from '@/components/sbo/ChingWorldPicksSMS';
import { PrizePicksAnalyzer } from '@/components/sbo/PrizePicksAnalyzer';
import BookPropsComparison from '@/components/sbo/BookPropsComparison';
import { SBOHealthDashboard } from '@/components/sbo/SBOHealthDashboard';
import { ActionTooltip } from '@/components/sbo/ActionTooltip';

// Helper: get start/end of an ET day as UTC ISO strings
// Uses 05:00 UTC as the ET day boundary (covers both EDT and EST)
export const getETDayBounds = (date: Date) => {
  const etDateStr = date.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const [year, month, day] = etDateStr.split('-').map(Number);
  // ET day boundary at 05:00 UTC (midnight EST / 1am EDT — safely before any NBA game)
  const start = new Date(Date.UTC(year, month - 1, day, 5, 0, 0));
  const end = new Date(Date.UTC(year, month - 1, day + 1, 5, 0, 0));
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
};

export const getTodayETBounds = () => getETDayBounds(new Date());

// ═══════════════════════════════════════════════════════════════
// SAVE PICK BUTTON — Reusable across all tabs
// ═══════════════════════════════════════════════════════════════

export function SavePickButton({
  pickType,
  label,
  detail,
  odds,
  aiAnalysis,
  confidence,
  sourceTable,
  sourceId,
}: {
  pickType: 'game' | 'prop' | 'parlay';
  label: string;
  detail?: string;
  odds?: string;
  aiAnalysis?: string;
  confidence?: number;
  sourceTable: string;
  sourceId: string;
}) {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await (supabase as any).from('sbo_saved_picks').insert({
        pick_type: pickType,
        label,
        detail: detail || '',
        odds: odds || '',
        ai_analysis: aiAnalysis || '',
        confidence: confidence || 0,
        source_table: sourceTable,
        source_id: sourceId,
        result: 'pending',
      });
      if (error) throw error;
      setSaved(true);
      toast.success('Pick saved');
      queryClient.invalidateQueries({ queryKey: ['saved-picks'] });
    } catch (e: any) {
      toast.error(e.message || 'Failed to save pick');
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <Button variant="ghost" size="sm" className="text-xs text-green-600 pointer-events-none" disabled>
        <Check className="h-3 w-3 mr-1" /> Saved ✓
      </Button>
    );
  }

  return (
    <Button variant="outline" size="sm" className="text-xs" onClick={handleSave} disabled={saving}>
      {saving
        ? <Loader2 className="h-3 w-3 mr-1 animate-spin" />
        : <Bookmark className="h-3 w-3 mr-1" />
      }
      Save Pick
    </Button>
  );
}

// ═══════════════════════════════════════════════════════════════
// TONIGHT'S GAMES TAB
// ═══════════════════════════════════════════════════════════════


export function TonightGamesTab() {
  const [viewMode, setViewMode] = useState<'today' | 'history'>('today');
  const [state, setState] = useState({
    games: [] as any[],
    picks: [] as any[],
    gamesLoading: false,
    analyzing: false,
    refreshing: false,
    statusMsg: 'Not yet fetched today.',
    errorMsg: '',
    lastSynced: null as string | null,
  });

  const setTonightState = (patch: Partial<typeof state>) => {
    setState((prev) => ({ ...prev, ...patch }));
  };

  const getEstDateRange = () => {
    const todayEST = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const tomorrowEST = new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    return {
      todayEST,
      fromUtc: `${todayEST}T00:00:00+00:00`,
      toUtc: `${tomorrowEST}T05:00:00+00:00`,
    };
  };

  const nowET = () => new Date().toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
  });

  const normalizeDbGames = (rows: any[] = []) => rows.map((game) => {
    const dkOdds = game.sbo_odds?.find((o: any) => o.sportsbook === 'draftkings' && o.market_type === 'moneyline') || game.sbo_odds?.[0];
    return {
      id: game.id,
      externalId: game.external_id,
      awayTeam: game.away_team,
      homeTeam: game.home_team,
      gameDate: game.game_date,
      status: game.status,
      awayMoneyline: dkOdds?.away_odds ?? null,
      homeMoneyline: dkOdds?.home_odds ?? null,
      spread: dkOdds?.home_spread ?? null,
      total: dkOdds?.total_line ?? null,
    };
  });

  const normalizeApiGames = (rows: any[] = []) => rows.map((game: any) => ({
    id: null,
    externalId: `${game.awayTeam || game.away_team}-${game.homeTeam || game.home_team}-${(game.commenceTime || '').slice(0, 10)}`,
    awayTeam: game.awayTeam || game.away_team,
    homeTeam: game.homeTeam || game.home_team,
    gameDate: game.commenceTime || `${getEstDateRange().todayEST}T00:00:00+00:00`,
    status: game.status || 'scheduled',
    awayMoneyline: game.awayMoneyline ?? null,
    homeMoneyline: game.homeMoneyline ?? null,
    spread: game.spread ?? null,
    total: game.total ?? null,
  }));

  const loadGamesFromDb = async () => {
    const { fromUtc, toUtc } = getEstDateRange();
    const { data, error } = await supabase
      .from('sbo_games')
      .select('id, external_id, away_team, home_team, game_date, status, sbo_odds(*)')
      .gte('game_date', fromUtc)
      .lte('game_date', toUtc)
      .order('game_date', { ascending: true });

    if (error) throw error;

    const mapped = normalizeDbGames(data || []);
    setTonightState({
      games: mapped,
      lastSynced: nowET(),
      statusMsg: mapped.length
        ? `Loaded ${mapped.length} game${mapped.length === 1 ? '' : 's'} from database.`
        : 'No games found in database for tonight yet.',
      errorMsg: '',
    });

    return mapped;
  };

  const upsertApiGamesToDb = async (apiGames: any[]) => {
    if (!apiGames.length) return;

    const { todayEST } = getEstDateRange();
    const gamesToUpsert = apiGames.map((game: any) => {
      const homeTeam = game.homeTeam || game.home_team || '';
      const awayTeam = game.awayTeam || game.away_team || '';
      const commenceTime = game.commenceTime || game.commence_time || `${todayEST}T00:00:00+00:00`;
      const externalId = game.externalId || `${awayTeam}-${homeTeam}-${String(commenceTime).slice(0, 10)}`.toLowerCase().replace(/\s+/g, '-');

      return {
        external_id: externalId,
        home_team: homeTeam,
        away_team: awayTeam,
        game_date: commenceTime,
        sport: 'NBA',
        status: String(game.status || 'scheduled').toLowerCase().includes('final') ? 'closed' : 'scheduled',
        home_score: game.homeScore ?? null,
        away_score: game.awayScore ?? null,
      };
    });

    const { data: persistedGames, error: gamesError } = await supabase
      .from('sbo_games')
      .upsert(gamesToUpsert as any, { onConflict: 'external_id' })
      .select('id, external_id');

    if (gamesError) throw gamesError;

    const gameIdByExternal = new Map((persistedGames || []).map((g: any) => [g.external_id, g.id]));

    const oddsToUpsert = apiGames
      .map((game: any) => {
        const homeTeam = game.homeTeam || game.home_team || '';
        const awayTeam = game.awayTeam || game.away_team || '';
        const commenceTime = game.commenceTime || game.commence_time || `${todayEST}T00:00:00+00:00`;
        const externalId = game.externalId || `${awayTeam}-${homeTeam}-${String(commenceTime).slice(0, 10)}`.toLowerCase().replace(/\s+/g, '-');
        const gameId = gameIdByExternal.get(externalId);

        if (!gameId) return null;

        return {
          game_id: gameId,
          sportsbook: 'draftkings',
          market_type: 'moneyline',
          away_odds: game.awayMoneyline ?? game.away_odds ?? null,
          home_odds: game.homeMoneyline ?? game.home_odds ?? null,
          home_spread: game.spread ?? null,
          total_line: game.total ?? null,
          fetched_at: new Date().toISOString(),
        };
      })
      .filter(Boolean);

    if (!oddsToUpsert.length) return;

    const { error: oddsError } = await supabase
      .from('sbo_odds')
      .upsert(oddsToUpsert as any, { onConflict: 'game_id,sportsbook,market_type' });

    if (oddsError) throw oddsError;
  };

  const loadGames = async () => {
    setTonightState({ gamesLoading: true, errorMsg: '', statusMsg: 'Loading tonight games...' });

    try {
      const existing = await loadGamesFromDb();

      if (existing.length > 0) {
        setTonightState({ gamesLoading: false, statusMsg: `Loaded ${existing.length} game${existing.length === 1 ? '' : 's'} from database.` });
        return;
      }

      setTonightState({ statusMsg: 'No cached games found — fetching from API...' });

      const { data, error } = await supabase.functions.invoke('get-todays-games');
      console.log('[TonightGamesTab] get-todays-games response:', data);
      if (error) throw error;

      const apiGames = normalizeApiGames(data?.games || []);
      setTonightState({
        games: apiGames,
        lastSynced: nowET(),
        statusMsg: `Fetched ${apiGames.length} game${apiGames.length === 1 ? '' : 's'} from API.`,
      });

      try {
        await upsertApiGamesToDb(data?.games || []);
      } catch (persistError) {
        console.error('[TonightGamesTab] upsert failed:', persistError);
      }

      await loadGamesFromDb();
    } catch (e: any) {
      setTonightState({
        errorMsg: e?.message || 'Failed to load tonight games.',
        statusMsg: 'Failed to load games.',
      });
    } finally {
      setTonightState({ gamesLoading: false });
    }
  };

  const loadPicks = async () => {
    try {
      const { todayEST } = getEstDateRange();
      const { data, error } = await (supabase as any)
        .from('sbo_saved_picks')
        .select('*')
        .eq('pick_date', todayEST)
        .eq('pick_type', 'game')
        .order('confidence', { ascending: false });

      if (error) throw error;

      // Deduplicate by label — keep highest confidence per unique label
      const deduped: any[] = Object.values(
        (data || []).reduce((acc: Record<string, any>, pick: any) => {
          const key = pick.label;
          if (!key) return acc;
          if (!acc[key] || pick.confidence > acc[key].confidence) acc[key] = pick;
          return acc;
        }, {})
      ).sort((a: any, b: any) => (b.confidence || 0) - (a.confidence || 0));

      setTonightState({ picks: deduped, errorMsg: '' });
    } catch (e: any) {
      setTonightState({
        errorMsg: e?.message || 'Failed to load picks.',
        statusMsg: 'Failed to load picks.',
      });
    }
  };

  const runPredictions = async () => {
    if (!state.games.length) {
      setTonightState({ statusMsg: 'Load tonight\'s games before running predictions.', errorMsg: '' });
      return;
    }

    setTonightState({ analyzing: true, errorMsg: '', statusMsg: 'Running AI predictions for tonight...' });

    try {
      const { data, error } = await supabase.functions.invoke('sbo-analyze-tonight');
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      await Promise.all([loadGamesFromDb(), loadPicks()]);

      setTonightState({
        statusMsg: data?.predictions_created
          ? `AI complete — ${data.predictions_created} picks generated.`
          : data?.message || 'Analysis complete.',
        errorMsg: '',
      });
    } catch (e: any) {
      const message = e?.message || 'Failed to run predictions.';
      const timeoutLike = /timeout|timed out|504/i.test(message);

      setTonightState({
        errorMsg: timeoutLike
          ? 'Analysis timed out — predictions may still be processing. Click Refresh in 60 seconds.'
          : message,
        statusMsg: timeoutLike
          ? 'Analysis timed out — predictions may still be processing. Click Refresh in 60 seconds.'
          : 'Prediction run failed.',
      });
    } finally {
      setTonightState({ analyzing: false });
    }
  };

  const refreshFromDb = async () => {
    setTonightState({ refreshing: true, errorMsg: '', statusMsg: 'Refreshing games and picks from database...' });

    try {
      await Promise.all([loadGamesFromDb(), loadPicks()]);
      setTonightState({ statusMsg: 'Refreshed games and picks from database.' });
    } catch (e: any) {
      setTonightState({
        errorMsg: e?.message || 'Refresh failed.',
        statusMsg: 'Refresh failed.',
      });
    } finally {
      setTonightState({ refreshing: false });
    }
  };


  // Auto-load games and picks on mount
  useEffect(() => {
    loadGames();
    loadPicks();
  }, []);

  const dateTitle = new Date().toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    month: 'long',
    day: 'numeric',
  });


  const confidenceColor = (confidence: number) => {
    if (confidence >= 85) return 'text-emerald-500 border-emerald-500/40';
    if (confidence >= 70) return 'text-blue-500 border-blue-500/40';
    if (confidence >= 55) return 'text-amber-500 border-amber-500/40';
    return 'text-destructive border-destructive/40';
  };

  const confidenceTier = (confidence: number) => {
    if (confidence >= 85) return 'ELITE';
    if (confidence >= 70) return 'STRONG';
    if (confidence >= 55) return 'MODERATE';
    return 'WEAK';
  };


  return (
    <div className="space-y-4">
      {/* Today / Yesterday toggle */}
      <div className="flex gap-2">
        <Button
          variant={viewMode === 'today' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('today')}
        >📅 Today</Button>
        <Button
          variant={viewMode === 'history' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('history')}
        >📅 History</Button>
      </div>

      {viewMode === 'today' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">🏀 Tonight&apos;s NBA Games — {dateTitle}</CardTitle>
            <p className="text-xs text-muted-foreground">
              Last synced: {state.lastSynced || 'Not yet fetched today'} | {state.games.length} games loaded
            </p>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <ActionTooltip description="Checks database for today's games first. If none found, fetches live data from The Odds API and persists to database.">
                <Button onClick={loadGames} disabled={state.gamesLoading || state.analyzing || state.refreshing}>
                  {state.gamesLoading
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading...</>
                    : '🏀 Load Tonight\'s Games'}
                </Button>
              </ActionTooltip>
              <ActionTooltip description="Runs 4-Brain AI analysis (Stats, Market, Context, Polymarket) on all loaded games. Generates confidence scores, picks, and Kelly stake recommendations.">
                <Button onClick={runPredictions} disabled={state.gamesLoading || state.analyzing || state.refreshing || !state.games.length}>
                  {state.analyzing
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Running...</>
                    : '⚡ Run AI Predictions'}
                </Button>
              </ActionTooltip>
              <ActionTooltip description="Reloads games and saved picks from the database without calling external APIs. Use to see latest predictions after a background run.">
                <Button variant="outline" onClick={refreshFromDb} disabled={state.gamesLoading || state.analyzing || state.refreshing}>
                  {state.refreshing
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Refreshing...</>
                    : '🔄 Refresh'}
                </Button>
              </ActionTooltip>
            </div>

            {state.errorMsg ? (
              <Alert variant="destructive">
                <AlertDescription className="text-sm">{state.errorMsg}</AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <AlertDescription className="text-sm">{state.statusMsg}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {state.games.map((game) => {
                const isLive = /live|inprogress|in_progress|in progress|active/i.test(String(game.status || ''));
                return (
                  <Card key={game.id || game.externalId} className="border-border/70">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-sm text-foreground">{game.awayTeam || game.away_team || 'TBD'} @ {game.homeTeam || game.home_team || 'TBD'}</p>
                        {isLive && (
                          <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/40">LIVE</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(game.gameDate).toLocaleTimeString('en-US', {
                          timeZone: 'America/New_York',
                          hour: 'numeric',
                          minute: '2-digit',
                        })} ET
                      </p>
                      <div className="text-xs text-muted-foreground border-t border-border/60 pt-2">
                        ML {game.awayMoneyline ?? '-'} / {game.homeMoneyline ?? '-'} | Spread {game.spread ?? '-'} | O/U {game.total ?? '-'}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {!state.gamesLoading && !state.games.length && (
              <div className="text-center py-10 border border-dashed rounded-lg border-border">
                <p className="text-sm text-muted-foreground">No games loaded yet.</p>
              </div>
            )}

            {state.picks.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold">🎯 AI Picks ({state.picks.filter((p: any) => p.label && !String(p.label).includes('undefined')).length})</h3>
                  <RefreshCw className="h-4 w-4 text-muted-foreground cursor-pointer" onClick={loadPicks} />
                </div>
                <div className="space-y-2">
                  {state.picks.filter((p: any) => p.label && !String(p.label).includes('undefined')).map((pick) => {
                    const confidence = Number(pick.confidence || 0);
                    const result = String(pick.result || 'pending').toUpperCase();
                    const tone = confidenceColor(confidence);
                    return (
                      <div key={pick.id} className={`rounded-lg border bg-card px-4 py-3 border-l-4 ${tone}`}>
                        <div className="flex items-start justify-between gap-3">
                          <p className="font-semibold text-foreground text-sm">{pick.label}</p>
                          <p className={`text-xl font-bold leading-none ${tone.split(' ')[0]}`}>{confidence}%</p>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{confidenceTier(confidence)}</Badge>
                          <Badge variant="outline">{result}</Badge>
                          <Badge variant="outline">{pick.odds || 'No odds'}</Badge>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                          {pick.detail || pick.ai_analysis || 'No additional detail provided.'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {viewMode === 'history' && <HistoryView />}
    </div>
  );
}

export function GameCard({ game, onUpdate }: { game: any; onUpdate: () => void }) {
  const [running, setRunning] = useState(false);
  const [localPrediction, setLocalPrediction] = useState<any>(
    game.sbo_predictions?.[0] || null
  );

  // Fetch game intelligence — use game.id (DB UUID), not game.game_id
  const { data: intel } = useQuery({
    queryKey: ['game-intel', game.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('sbo_game_intelligence')
        .select('*')
        .eq('game_id', game.id)
        .maybeSingle();
      return data;
    },
    staleTime: 60000,
  });

  // Fetch sharp money indicators
  const { data: lineMove } = useQuery({
    queryKey: ['line-move', game.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('sbo_line_movement')
        .select('*')
        .eq('game_id', game.id)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    staleTime: 60000,
  });

  const dkOdds = game.sbo_odds?.find((o: any) =>
    o.sportsbook === 'draftkings' && o.market_type === 'moneyline'
  );

  const runPrediction = async (outcome: 'home' | 'away') => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('sbo-run-predictions', {
        body: { game_id: game.id, prediction_type: 'moneyline', predicted_outcome: outcome },
      });
      if (error) throw error;
      setLocalPrediction({ ...data, predicted_outcome: outcome });
      toast.success(`Prediction: ${data.final_confidence}% confidence (${data.confidence_tier})`);
    } catch (e: any) {
      toast.error(e.message || 'Prediction failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        {/* Game date & pull timestamp */}
        <div className="flex justify-between items-center mb-2 text-[11px] text-muted-foreground">
          <span>
            🏀 {new Date(game.game_date).toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric' })} · Tip {new Date(game.game_date).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}
          </span>
          <span>
            Pulled: {new Date(game.created_at || game.updated_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        {/* Sharp money / line movement badges */}
        <div className="flex flex-wrap gap-1 mb-2">
          {lineMove?.steam_move && (
            <Badge className="text-[9px] bg-destructive/20 text-destructive border-destructive/30">🔥 STEAM MOVE</Badge>
          )}
          {lineMove?.reverse_line_move && (
            <Badge className="text-[9px] bg-amber-500/20 text-amber-600 border-amber-500/30">⚡ REVERSE LINE</Badge>
          )}
          {lineMove?.sharp_indicator && (
            <Badge className="text-[9px] bg-blue-500/20 text-blue-500 border-blue-500/30">🎯 SHARP ACTION</Badge>
          )}
          {intel?.back_to_back_home && (
            <Badge variant="outline" className="text-[9px] text-amber-500">⚠️ {game.home_team} B2B</Badge>
          )}
          {intel?.back_to_back_away && (
            <Badge variant="outline" className="text-[9px] text-amber-500">⚠️ {game.away_team} B2B</Badge>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="text-center flex-1">
            <p className="font-bold text-foreground">{game.away_team}</p>
            <p className="text-[10px] text-muted-foreground">Away</p>
            {dkOdds && (
              <p className={`text-sm font-mono font-bold mt-1 ${dkOdds.away_odds > 0 ? 'text-emerald-500' : 'text-foreground'}`}>
                {dkOdds.away_odds > 0 ? '+' : ''}{dkOdds.away_odds}
              </p>
            )}
            {intel?.away_record_away && (
              <p className="text-[9px] text-muted-foreground">{intel.away_record_away} away</p>
            )}
          </div>

          <div className="text-center px-4">
            <Badge variant="outline" className="text-[10px]">
              {new Date(game.game_date).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit' })}
            </Badge>
            <p className="text-xs text-muted-foreground mt-1">@</p>
            {intel?.pace_home && intel?.pace_away && (
              <p className="text-[9px] text-muted-foreground mt-1">
                Pace: {((intel.pace_home + intel.pace_away) / 2).toFixed(0)}
              </p>
            )}
          </div>

          <div className="text-center flex-1">
            <p className="font-bold text-foreground">{game.home_team}</p>
            <p className="text-[10px] text-muted-foreground">Home</p>
            {dkOdds && (
              <p className={`text-sm font-mono font-bold mt-1 ${dkOdds.home_odds > 0 ? 'text-emerald-500' : 'text-foreground'}`}>
                {dkOdds.home_odds > 0 ? '+' : ''}{dkOdds.home_odds}
              </p>
            )}
            {intel?.home_record_home && (
              <p className="text-[9px] text-muted-foreground">{intel.home_record_home} home</p>
            )}
          </div>
        </div>

        {/* Intelligence bar */}
        {intel && (
          <div className="mt-2 p-2 rounded bg-muted/30 text-[9px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
            {intel.offensive_rating_home && <span>🏀 {game.home_team}: {intel.offensive_rating_home?.toFixed(1)} ORtg / {intel.defensive_rating_home?.toFixed(1)} DRtg</span>}
            {intel.offensive_rating_away && <span>🏀 {game.away_team}: {intel.offensive_rating_away?.toFixed(1)} ORtg / {intel.defensive_rating_away?.toFixed(1)} DRtg</span>}
            {intel.rest_days_home !== null && <span>💤 Rest: {game.home_team} {intel.rest_days_home}d / {game.away_team} {intel.rest_days_away}d</span>}
          </div>
        )}

        {!localPrediction ? (
          <div className="flex gap-2 mt-4">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => runPrediction('away')} disabled={running}>
              {running ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <span className="mr-1">🧠</span>}
              Predict {game.away_team}
            </Button>
            <Button variant="outline" size="sm" className="flex-1" onClick={() => runPrediction('home')} disabled={running}>
              {running ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <span className="mr-1">🧠</span>}
              Predict {game.home_team}
            </Button>
          </div>
        ) : (
          <>
            <PredictionResult prediction={localPrediction} homeTeam={game.home_team} awayTeam={game.away_team} intel={intel} />
            {/* Prediction timestamp */}
            {localPrediction.created_at && (
              <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground mt-1.5">
                <span>🧠 AI ran: {new Date(localPrediction.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at {new Date(localPrediction.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                <DataQualityBadge quality={localPrediction.data_quality} compact />
              </div>
            )}
            {/* Kelly stake recommendation */}
            {localPrediction.recommended_units > 0 && (
              <div className="mt-2 p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-xs">
                <span className="text-emerald-500 font-medium">📊 Kelly Rec:</span>
                <span className="ml-1">{localPrediction.recommended_units?.toFixed(2)} units</span>
                {localPrediction.recommended_stake > 0 && (
                  <span className="ml-1 text-muted-foreground">(${localPrediction.recommended_stake?.toFixed(2)})</span>
                )}
              </div>
            )}
            <div className="flex gap-2 mt-2 items-center">
              <span className="text-xs text-green-600 flex items-center gap-1">
                <Check className="h-3 w-3" /> Auto-saved to My Bets
              </span>
              <Button variant="ghost" size="sm" className="text-xs flex-1" onClick={async () => {
                // Rerun: delete old prediction and intelligence, re-fetch and re-predict
                setRunning(true);
                const { start: rStart } = getTodayETBounds();
                try {
                  await supabase.from('sbo_predictions').delete().eq('game_id', game.id).gte('created_at', rStart);
                  await (supabase as any).from('sbo_saved_picks').delete().eq('source_id', localPrediction?.id || localPrediction?.prediction_id || '');
                  await supabase.from('sbo_game_intelligence').delete().eq('game_id', game.id);
                  try { await supabase.functions.invoke('sbo-fetch-intelligence'); } catch {}
                  await new Promise(resolve => setTimeout(resolve, 800));
                  const pickHome = dkOdds ? Math.abs(dkOdds.home_odds) < Math.abs(dkOdds.away_odds) : true;
                  const { data, error } = await supabase.functions.invoke('sbo-run-predictions', {
                    body: { game_id: game.id, prediction_type: 'moneyline', predicted_outcome: pickHome ? 'home' : 'away', force_rerun: true },
                  });
                  if (error) throw error;
                  setLocalPrediction(data);
                  toast.success(`Rerun: ${data.final_confidence}% · ${data.data_quality === 'full' ? '📊 Full Stats' : data.data_quality === 'partial' ? '⚠️ Partial' : '🔴 Odds Only'}`);
                } catch (e: any) {
                  toast.error('Rerun failed: ' + e.message);
                  setLocalPrediction(null);
                } finally {
                  setRunning(false);
                }
              }}>
                {localPrediction?.data_quality === 'odds_only' ? '⚡ Rerun With Real Stats' : '🔄 Run Different Prediction'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// PLAYER PROPS TAB
// ═══════════════════════════════════════════════════════════════
export const PROP_TYPE_LABELS: Record<string, string> = {
  points: 'Points', pts: 'Points', player_points: 'Points', point: 'Points',
  rebounds: 'Rebounds', reb: 'Rebounds', player_rebounds: 'Rebounds', total_rebounds: 'Rebounds',
  assists: 'Assists', ast: 'Assists', player_assists: 'Assists',
  threes: '3-Pointers', three_pointers: '3-Pointers', threes_made: '3-Pointers', '3pt': '3-Pointers', three_point_field_goals_made: '3-Pointers', player_threes: '3-Pointers',
  blocks: 'Blocks', blk: 'Blocks', player_blocks: 'Blocks',
  steals: 'Steals', stl: 'Steals', player_steals: 'Steals',
  turnovers: 'Turnovers', tov: 'Turnovers', player_turnovers: 'Turnovers',
  pra: 'Pts+Reb+Ast', points_rebounds_assists: 'Pts+Reb+Ast', pts_reb_ast: 'Pts+Reb+Ast',
  pr: 'Pts+Reb', points_rebounds: 'Pts+Reb', pts_reb: 'Pts+Reb',
  pa: 'Pts+Ast', points_assists: 'Pts+Ast', pts_ast: 'Pts+Ast',
  ra: 'Reb+Ast', rebounds_assists: 'Reb+Ast', reb_ast: 'Reb+Ast',
  fantasy_points: 'Fantasy Pts', fantasy: 'Fantasy Pts',
  minutes: 'Minutes', min: 'Minutes', player_minutes: 'Minutes',
  double_double: 'Double-Double', triple_double: 'Triple-Double',
};

export const PROP_TYPE_ORDER = ['Points', 'Rebounds', 'Assists', '3-Pointers', 'Blocks', 'Steals', 'Turnovers', 'Pts+Reb+Ast', 'Pts+Reb', 'Pts+Ast', 'Reb+Ast', 'Fantasy Pts', 'Minutes', 'Double-Double', 'Triple-Double'];

export const normalizePropType = (raw: string): string => {
  if (!raw) return 'Other';
  return PROP_TYPE_LABELS[raw.toLowerCase().trim()] || raw;
};

export function PlayerPropsTab({ onAddToParlay }: { onAddToParlay?: (pred: any, odds: number) => void }) {
  const [props, setProps] = useState<any[]>([]);
  const [dateFilter, setDateFilter] = useState<string>('today');
  const [loadingProps, setLoadingProps] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [runningAll, setRunningAll] = useState(false);
  const [allProgress, setAllProgress] = useState('');
  const [verifyingProps, setVerifyingProps] = useState(false);

  // Smart filter state
  const [selectedPropType, setSelectedPropType] = useState('all');
  const [sortBy, setSortBy] = useState('confidence');
  const [bestBetsOnly, setBestBetsOnly] = useState(false);
  const [propTypeStats, setPropTypeStats] = useState<Record<string, { correct: number; incorrect: number; total: number; accuracy: number; avgConfCorrect: number; avgConfIncorrect: number }>>({});

  const getETDate = (offset = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  };

  const getDateBounds = () => {
    switch (dateFilter) {
      case 'today': return { date: getETDate(0), label: 'Today' };
      case 'yesterday': return { date: getETDate(-1), label: 'Yesterday' };
      case 'saturday': {
        const now = new Date();
        const day = now.getDay();
        const diff = day === 6 ? 0 : day + 1;
        const d = new Date(now);
        d.setDate(d.getDate() - diff);
        return { date: d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }), label: 'Saturday' };
      }
      case '7days': return { date: getETDate(-7), label: 'Last 7 Days' };
      default: return { date: null, label: 'All Time' };
    }
  };

  useEffect(() => { loadProps(); }, [dateFilter]);
  useEffect(() => { Promise.all([loadProps(), loadPropTypeStats()]); }, []);

  const loadPropTypeStats = async () => {
    try {
      const { data: verificationRows, error: verificationError } = await supabase
        .from('sbo_results_verification')
        .select('verdict, prediction_id')
        .not('prediction_id', 'is', null)
        .not('verdict', 'is', null);

      if (verificationError) throw verificationError;

      const predictionIds = Array.from(
        new Set((verificationRows || []).map((row: any) => row.prediction_id).filter(Boolean))
      ) as string[];

      if (!predictionIds.length) {
        setPropTypeStats({});
        return;
      }

      const { data: predictionRows, error: predictionError } = await supabase
        .from('sbo_predictions')
        .select('id, prediction_type, final_confidence, prop_id')
        .in('id', predictionIds)
        .eq('prediction_type', 'player_prop');

      if (predictionError) throw predictionError;

      const predictionById = new Map((predictionRows || []).map((prediction: any) => [prediction.id, prediction]));
      const propIds = Array.from(
        new Set((predictionRows || []).map((prediction: any) => prediction.prop_id).filter(Boolean))
      ) as string[];

      let propById = new Map<string, any>();
      if (propIds.length) {
        const { data: propRows, error: propError } = await supabase
          .from('sbo_player_props')
          .select('id, prop_type, player_name')
          .in('id', propIds);

        if (propError) throw propError;
        propById = new Map((propRows || []).map((prop: any) => [prop.id, prop]));
      }

      const statsMap: Record<string, { correct: number; incorrect: number; total: number; accuracy: number; confCorrectSum: number; confCorrectCount: number; confIncorrectSum: number; confIncorrectCount: number; avgConfCorrect: number; avgConfIncorrect: number }> = {};

      (verificationRows || []).forEach((row: any) => {
        const verdict = String(row.verdict || '').toLowerCase();
        if (verdict !== 'correct' && verdict !== 'incorrect') return;

        const pred = predictionById.get(row.prediction_id);
        if (!pred) return;

        const propMeta = pred.prop_id ? propById.get(pred.prop_id) : null;
        const propType = normalizePropType(propMeta?.prop_type || 'Other');

        if (!statsMap[propType]) {
          statsMap[propType] = { correct: 0, incorrect: 0, total: 0, accuracy: 0, confCorrectSum: 0, confCorrectCount: 0, confIncorrectSum: 0, confIncorrectCount: 0, avgConfCorrect: 0, avgConfIncorrect: 0 };
        }

        const s = statsMap[propType];
        s.total++;

        if (verdict === 'correct') {
          s.correct++;
          s.confCorrectSum += (pred?.final_confidence || 0);
          s.confCorrectCount++;
        } else {
          s.incorrect++;
          s.confIncorrectSum += (pred?.final_confidence || 0);
          s.confIncorrectCount++;
        }
      });

      Object.values(statsMap).forEach((s: any) => {
        const decidedTotal = s.correct + s.incorrect;
        s.total = decidedTotal;
        s.accuracy = decidedTotal > 0 ? (s.correct / decidedTotal) * 100 : 0;
        s.avgConfCorrect = s.confCorrectCount > 0 ? s.confCorrectSum / s.confCorrectCount : 0;
        s.avgConfIncorrect = s.confIncorrectCount > 0 ? s.confIncorrectSum / s.confIncorrectCount : 0;
      });

      setPropTypeStats(statsMap);
    } catch (e) {
      console.error('Failed to load prop type stats:', e);
    }
  };

  const loadProps = async () => {
    setLoadingProps(true);
    try {
      const bounds = getDateBounds();
      let query = supabase
        .from('sbo_player_props')
        .select('*, sbo_games(home_team, away_team, game_date), sbo_predictions(*), player_image_url')
        .order('created_at', { ascending: false })
        .limit(300);

      if (bounds.date && dateFilter !== '7days') {
        query = query.or(`game_date.eq.${bounds.date},and(game_date.is.null,created_at.gte.${bounds.date}T00:00:00-04:00,created_at.lte.${bounds.date}T23:59:59-04:00)`);
      } else if (dateFilter === '7days') {
        query = query.or(`game_date.gte.${bounds.date},and(game_date.is.null,created_at.gte.${bounds.date}T00:00:00-04:00)`);
      }

      const { data } = await query;
      setProps((data as any[]) || []);
    } catch (e: any) {
      console.error('Failed to load props:', e);
    } finally {
      setLoadingProps(false);
    }
  };

  const runPropPrediction = async (prop: any, outcome?: 'over' | 'under') => {
    setRunningId(prop.id);
    try {
      const { data, error } = await supabase.functions.invoke('sbo-run-predictions', {
        body: { prop_id: prop.id, prediction_type: 'player_prop', predicted_outcome: outcome || null },
      });
      if (error) throw error;
      const pick = data.predicted_outcome || outcome || 'over';
      toast.success(`${prop.player_name} ${pick.toUpperCase()} — ${data.final_confidence}% (${data.confidence_tier}) · Auto-saved`);
      loadProps();
    } catch (e: any) {
      toast.error(e.message || 'Prediction failed');
    } finally {
      setRunningId(null);
    }
  };

  const verifyPropResults = async () => {
    setVerifyingProps(true);
    toast.info('Verifying prop results against box scores...');
    try {
      const { data, error } = await supabase.functions.invoke('sbo-verify-results', {
        body: { verify_props: true },
      });
      if (error) throw error;
      if ((data.props_verified || 0) > 0) {
        toast.success(`Props verified: ${data.props_correct}W - ${data.props_incorrect}L · ${data.props_accuracy}% accuracy`);
      } else if (data.verified > 0) {
        toast.success(`${data.verified} total verified — ${data.accuracy}% accuracy`);
      } else {
        toast.info('No props to verify yet — games may not be final');
      }
      await Promise.all([loadProps(), loadPropTypeStats()]);
    } catch (e: any) {
      toast.error('Verification failed: ' + e.message);
    } finally {
      setVerifyingProps(false);
    }
  };

  const runAllProps = async () => {
    setRunningAll(true);
    let analyzed = 0;
    try {
      const unanalyzed = props.filter(p => !p.sbo_predictions?.length);
      if (!unanalyzed.length) {
        toast.info('All props already have predictions');
        return;
      }
      for (const prop of unanalyzed) {
        setAllProgress(`Analyzing ${analyzed + 1}/${unanalyzed.length} — ${prop.player_name}...`);
        try {
          await supabase.functions.invoke('sbo-run-predictions', {
            body: { prop_id: prop.id, prediction_type: 'player_prop', predicted_outcome: null },
          });
          analyzed++;
        } catch (e) {
          console.error(`Failed for ${prop.player_name}:`, e);
        }
      }
      toast.success(`Props analysis saved — ${analyzed} props analyzed`);
      await loadProps();
    } catch (e: any) {
      toast.error(e.message || 'Props analysis failed');
    } finally {
      setRunningAll(false);
      setAllProgress('');
    }
  };

  const reanalyzeAllProps = async () => {
    if (!confirm('Delete today\'s prop predictions and rerun with corrected AI logic (OVER/UNDER)?')) return;
    setRunningAll(true);
    let count = 0;
    try {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
      await supabase.from('sbo_predictions').delete().eq('prediction_type', 'player_prop').gte('created_at', `${today}T00:00:00-04:00`);
      await supabase.from('sbo_saved_picks').delete().eq('pick_type', 'prop').gte('created_at', `${today}T00:00:00-04:00`);
      toast.info('Old prop predictions cleared — rerunning with AI-determined OVER/UNDER...');
      const { data: todayProps } = await supabase.from('sbo_player_props').select('id, player_name').gte('created_at', `${today}T00:00:00-04:00`).limit(2000);
      for (const prop of (todayProps || [])) {
        setAllProgress(`Reanalyzing ${count + 1}/${todayProps?.length}: ${prop.player_name}`);
        await supabase.functions.invoke('sbo-run-predictions', { body: { prop_id: prop.id, prediction_type: 'player_prop', predicted_outcome: null } });
        count++;
        await new Promise(r => setTimeout(r, 500));
      }
      toast.success(`${count} props reanalyzed with correct OVER/UNDER picks — all auto-saved`);
      await loadProps();
    } catch (e: any) {
      toast.error('Reanalyze failed: ' + e.message);
    } finally {
      setRunningAll(false);
      setAllProgress('');
    }
  };

  // Compute totals from propTypeStats
  const totalStats = Object.values(propTypeStats).reduce(
    (acc, s) => ({ correct: acc.correct + s.correct, incorrect: acc.incorrect + s.incorrect, total: acc.total + s.total }),
    { correct: 0, incorrect: 0, total: 0 }
  );
  const overallAccuracy = totalStats.total > 0 ? (totalStats.correct / totalStats.total * 100) : 0;
  const bestType = Object.entries(propTypeStats).sort(([, a], [, b]) => b.accuracy - a.accuracy)[0];
  const worstType = Object.entries(propTypeStats).filter(([, s]) => s.total >= 3).sort(([, a], [, b]) => a.accuracy - b.accuracy)[0];

  // Smart filtering — use normalized prop types
  const filteredProps = props
    .filter(p => {
      const norm = normalizePropType(p.prop_type);
      if (selectedPropType !== 'all' && norm !== selectedPropType) return false;
      if (bestBetsOnly) {
        const pred = p.sbo_predictions?.[0];
        const conf = pred?.final_confidence || 0;
        const typeAcc = propTypeStats[norm]?.accuracy ?? 0;
        if (conf < 70 || typeAcc < 65) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const predA = a.sbo_predictions?.[0];
      const predB = b.sbo_predictions?.[0];
      if (sortBy === 'confidence') return (predB?.final_confidence || 0) - (predA?.final_confidence || 0);
      if (sortBy === 'accuracy') return (propTypeStats[normalizePropType(b.prop_type)]?.accuracy ?? 0) - (propTypeStats[normalizePropType(a.prop_type)]?.accuracy ?? 0);
      if (sortBy === 'recent') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === 'name') return (a.player_name || '').localeCompare(b.player_name || '');
      if (sortBy === 'over') return predA?.predicted_outcome === 'over' ? -1 : 1;
      if (sortBy === 'under') return predA?.predicted_outcome === 'under' ? -1 : 1;
      return 0;
    });

  const getAccuracyColor = (acc: number) => acc >= 75 ? 'text-emerald-500' : acc >= 60 ? 'text-amber-500' : 'text-destructive';
  const getPillAccuracyTone = (acc: number) => acc >= 75
    ? 'bg-emerald-500/10 border-emerald-500/30'
    : acc >= 60
      ? 'bg-amber-500/10 border-amber-500/30'
      : 'bg-destructive/10 border-destructive/30';
  const getConfColor = (c: number) => c >= 85 ? 'text-emerald-500' : c >= 70 ? 'text-blue-400' : c >= 55 ? 'text-amber-500' : 'text-destructive';
  const getConfBorder = (c: number) => c >= 85 ? 'border-l-emerald-500' : c >= 70 ? 'border-l-blue-400' : c >= 55 ? 'border-l-amber-500' : 'border-l-destructive';

  // Build prop type list from ALL loaded props + stats, ordered by PROP_TYPE_ORDER
  const allNormalizedTypes = new Set([
    ...props.map(p => normalizePropType(p.prop_type)),
    ...Object.keys(propTypeStats),
  ]);
  const propTypes = ['all', ...PROP_TYPE_ORDER.filter(t => allNormalizedTypes.has(t)), ...Array.from(allNormalizedTypes).filter(t => !PROP_TYPE_ORDER.includes(t)).sort()];
  const summaryTypes = propTypes.filter((type) => type !== 'all' && !!propTypeStats[type]);

  // Count props per type (for types without stats yet)
  const propCountByType: Record<string, number> = {};
  props.forEach(p => {
    const norm = normalizePropType(p.prop_type);
    propCountByType[norm] = (propCountByType[norm] || 0) + 1;
  });

  return (
    <div className="space-y-4">
      {/* ACCURACY SUMMARY ROW */}
      {totalStats.total > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          <div className="bg-muted/30 rounded-lg p-2.5 text-center">
            <div className="text-lg font-bold text-foreground">{props.length}</div>
            <div className="text-[10px] text-muted-foreground">Total Props</div>
          </div>
          <div className="bg-muted/30 rounded-lg p-2.5 text-center">
            <div className="text-lg font-bold text-foreground">{totalStats.total}</div>
            <div className="text-[10px] text-muted-foreground">Verified</div>
          </div>
          <div className="bg-emerald-500/10 rounded-lg p-2.5 text-center">
            <div className="text-lg font-bold text-emerald-500">{totalStats.correct}W</div>
            <div className="text-[10px] text-muted-foreground">- {totalStats.incorrect}L</div>
          </div>
          <div className="bg-primary/10 rounded-lg p-2.5 text-center">
            <div className={`text-lg font-bold ${getAccuracyColor(overallAccuracy)}`}>{overallAccuracy.toFixed(1)}%</div>
            <div className="text-[10px] text-muted-foreground">Overall</div>
          </div>
          <div className="bg-emerald-500/10 rounded-lg p-2.5 text-center">
            <div className="text-lg font-bold text-emerald-500">{bestType ? bestType[1].accuracy.toFixed(0) + '%' : '-'}</div>
            <div className="text-[10px] text-muted-foreground truncate">Best: {bestType?.[0] || '-'}</div>
          </div>
          <div className="bg-destructive/10 rounded-lg p-2.5 text-center">
            <div className="text-lg font-bold text-destructive">{worstType ? worstType[1].accuracy.toFixed(0) + '%' : '-'}</div>
            <div className="text-[10px] text-muted-foreground truncate">Worst: {worstType?.[0] || '-'}</div>
          </div>
        </div>
      )}

      {/* DATE FILTER PILLS */}
      <div className="space-y-1.5">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Filter props by game date</p>
        <div className="flex gap-1.5 flex-wrap">
          {[
            { value: 'today', label: '📅 Today' },
            { value: 'yesterday', label: '📋 Yesterday' },
            { value: 'saturday', label: '🏀 Saturday' },
            { value: '7days', label: '📆 Last 7 Days' },
            { value: 'all', label: '📚 All' },
          ].map(opt => (
            <Button key={opt.value} variant={dateFilter === opt.value ? 'default' : 'outline'} size="sm" className="text-xs h-7 rounded-full" onClick={() => setDateFilter(opt.value)}>
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* ACCURACY STRIP — quick visual reference */}
      {summaryTypes.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 rounded-lg bg-muted/20 border border-border text-xs">
          {summaryTypes.map((type, i) => {
            const s = propTypeStats[type];
            return (
              <span key={type} className="flex items-center gap-1">
                {i > 0 && <span className="text-muted-foreground/40 mr-1">|</span>}
                <span className="text-muted-foreground">{type}</span>
                <span className={`font-semibold ${getAccuracyColor(s.accuracy)}`}>{s.accuracy.toFixed(1)}%</span>
              </span>
            );
          })}
        </div>
      )}

      {/* SMART PROP TYPE FILTER BAR WITH W-L + ACCURACY */}
      <div className="space-y-1.5">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Filter by prop type — with historical accuracy</p>
        <div className="flex gap-1.5 flex-wrap">
          {propTypes.map(type => {
            const s = type === 'all' ? totalStats : propTypeStats[type];
            const acc = type === 'all' ? overallAccuracy : (s as any)?.accuracy ?? 0;
            const w = type === 'all' ? totalStats.correct : (s as any)?.correct ?? 0;
            const l = type === 'all' ? totalStats.incorrect : (s as any)?.incorrect ?? 0;
            const count = propCountByType[type] || 0;
            const hasStats = type === 'all' ? totalStats.total > 0 : (w + l) > 0;
            const isActive = selectedPropType === type;
            const idleTone = hasStats ? getPillAccuracyTone(acc) : 'bg-muted/30 border-border';
            return (
              <button
                key={type}
                onClick={() => setSelectedPropType(type)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  isActive
                    ? 'bg-primary/10 text-foreground border-primary ring-1 ring-primary/40 shadow-sm'
                    : `text-foreground ${idleTone} hover:bg-muted/60`
                }`}
              >
                <span>{type === 'all' ? 'All Props' : type}</span>
                {hasStats ? (
                  <>
                    <span className="text-muted-foreground">{w}W-{l}L</span>
                    <span className={getAccuracyColor(acc)}>{acc.toFixed(1)}%</span>
                  </>
                ) : type !== 'all' && count > 0 ? (
                  <>
                    <span className="text-muted-foreground">{count} props</span>
                    <span className="text-muted-foreground">---%</span>
                  </>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* PROP TYPE STATS DETAIL PANEL */}
      {selectedPropType !== 'all' && propTypeStats[selectedPropType] && (
        <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground">{selectedPropType} — Detailed Stats</span>
            <Badge variant="outline" className={getAccuracyColor(propTypeStats[selectedPropType].accuracy)}>
              {propTypeStats[selectedPropType].accuracy.toFixed(1)}%
            </Badge>
          </div>
          <div className="flex flex-wrap gap-4 text-muted-foreground">
            <span>Verified: {propTypeStats[selectedPropType].total}</span>
            <span className="text-emerald-500">{propTypeStats[selectedPropType].correct}W</span>
            <span className="text-destructive">{propTypeStats[selectedPropType].incorrect}L</span>
            <span>Avg Conf (✅): {propTypeStats[selectedPropType].avgConfCorrect.toFixed(1)}%</span>
            <span>Avg Conf (❌): {propTypeStats[selectedPropType].avgConfIncorrect.toFixed(1)}%</span>
          </div>
          <p className="text-muted-foreground italic">
            {propTypeStats[selectedPropType].accuracy >= 70
              ? `✅ ${selectedPropType} props are a strong edge — hitting at ${propTypeStats[selectedPropType].accuracy.toFixed(1)}%`
              : propTypeStats[selectedPropType].accuracy >= 55
              ? `⚠️ ${selectedPropType} props are moderate — ${propTypeStats[selectedPropType].accuracy.toFixed(1)}% accuracy`
              : `🔴 ${selectedPropType} props are underperforming at ${propTypeStats[selectedPropType].accuracy.toFixed(1)}% — use caution`
            }
          </p>
        </div>
      )}

      {/* SORT + BEST BETS TOGGLE */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-48 h-8 text-xs">
            <SelectValue placeholder="Sort by..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="confidence">Highest Confidence</SelectItem>
            <SelectItem value="accuracy">Highest Accuracy Type</SelectItem>
            <SelectItem value="recent">Most Recent</SelectItem>
            <SelectItem value="name">Player Name A-Z</SelectItem>
            <SelectItem value="over">OVER picks only</SelectItem>
            <SelectItem value="under">UNDER picks only</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Switch checked={bestBetsOnly} onCheckedChange={setBestBetsOnly} />
          <span className="text-xs font-medium text-foreground">⭐ Best Bets Only</span>
          <span className="text-[10px] text-muted-foreground">(70%+ conf & 65%+ type acc)</span>
        </div>

        <Badge variant="secondary" className="text-xs ml-auto">{filteredProps.length} props</Badge>
      </div>

      {/* ACTION BUTTONS */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button onClick={runAllProps} disabled={runningAll || !!runningId || verifyingProps} size="sm">
          {runningAll ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> {allProgress || 'Running...'}</> : <>📊 Run Props Analysis</>}
        </Button>
        <Button onClick={verifyPropResults} disabled={runningAll || !!runningId || verifyingProps} size="sm" variant="outline">
          {verifyingProps ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Verifying...</> : <>🔍 Verify Results</>}
        </Button>
        <Button onClick={reanalyzeAllProps} disabled={runningAll || !!runningId || verifyingProps} size="sm" variant="destructive">
          🔄 Reanalyze All Props
        </Button>
      </div>

      {runningAll && (
        <Alert>
          <AlertDescription className="text-xs flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            {allProgress}
          </AlertDescription>
        </Alert>
      )}

      {/* PROPS LIST */}
      {!filteredProps.length ? (
        <div className="text-center py-12 border border-dashed rounded-lg border-border">
          <p className="text-muted-foreground font-medium">
            {bestBetsOnly ? 'No best bets match current filters.' : 'No props found.'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {bestBetsOnly ? 'Try disabling Best Bets Only filter.' : 'Use the VA Entry tab to add tonight\'s PrizePicks props.'}
          </p>
        </div>
      ) : (
        filteredProps.map(prop => {
          const existingPred = prop.sbo_predictions?.[0];
          const game = prop.sbo_games;
          const isRunning = runningId === prop.id;
          const conf = existingPred?.final_confidence || 0;
          const normType = normalizePropType(prop.prop_type);
          const typeAcc = propTypeStats[normType]?.accuracy;

          return (
            <div
              key={prop.id}
              className={`rounded-lg border-l-4 bg-[hsl(var(--muted))]/20 p-4 ${existingPred ? getConfBorder(conf) : 'border-l-border'}`}
            >
              {/* Game date badge + matchup */}
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  📅 {prop.game_date
                    ? new Date(prop.game_date + 'T12:00:00').toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric' })
                    : game?.game_date
                    ? new Date(game.game_date).toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric' })
                    : new Date(prop.created_at).toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric' })
                  }
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {game?.away_team} @ {game?.home_team}
                </span>
              </div>

              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {/* Player image */}
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-muted flex-shrink-0">
                    {prop.player_image_url ? (
                      <img src={prop.player_image_url} alt={prop.player_name} className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(prop.player_name || '')}&background=1a1a1a&color=ffffff&size=128`; }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs font-bold text-muted-foreground">
                        {prop.player_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-foreground">{prop.player_name}</p>
                    <p className="text-xs text-muted-foreground">{prop.team} · {game?.away_team} @ {game?.home_team}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-foreground">{normType} {existingPred?.predicted_outcome?.toUpperCase() || ''} {prop.line}</p>
                  {existingPred && (
                    <div className="flex items-center justify-end gap-2 mt-0.5">
                      <span className={`text-xl font-black ${getConfColor(conf)}`}>{conf}%</span>
                      <Badge variant="outline" className="text-[10px]">{existingPred.confidence_tier}</Badge>
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground font-mono">
                    O: {prop.over_odds > 0 ? '+' : ''}{prop.over_odds} / U: {prop.under_odds > 0 ? '+' : ''}{prop.under_odds}
                  </p>
                  {typeAcc !== undefined ? (
                    <p className={`text-[10px] mt-0.5 ${getAccuracyColor(typeAcc)}`}>
                      Historical: {normType} props {typeAcc.toFixed(1)}% {typeAcc >= 70 ? '✅' : typeAcc >= 55 ? '⚠️' : '🔴'}
                    </p>
                  ) : (
                    <p className="text-[10px] mt-0.5 text-muted-foreground">Historical: No data yet</p>
                  )}
                </div>
              </div>

              {/* Verification result */}
              {prop.verified && prop.verdict && (
                <div className={`mt-2 p-2 rounded-lg text-xs ${
                  prop.verdict === 'correct' ? 'bg-green-500/10 text-green-600 border border-green-500/20' :
                  prop.verdict === 'incorrect' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                  'bg-muted text-muted-foreground border border-border'
                }`}>
                  <span className="font-semibold">{prop.verdict === 'correct' ? '✅ CORRECT' : prop.verdict === 'incorrect' ? '❌ INCORRECT' : '➖ PUSH'}</span>
                  <span className="text-[11px] opacity-80 ml-2">
                    Actual: {prop.actual_value} · Line: {prop.line} · Pick: {existingPred?.predicted_outcome?.toUpperCase()}
                  </span>
                </div>
              )}
              {!prop.verified && existingPred && <p className="text-[11px] text-muted-foreground mt-1.5">⏳ Pending verification</p>}

              {!existingPred ? (
                <div className="flex gap-2 mt-3">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => runPropPrediction(prop)} disabled={isRunning}>
                    {isRunning ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <span className="mr-1">🧠</span>} Analyze
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2 mt-2 items-center">
                  <span className="text-xs text-green-600 flex items-center gap-1">
                    <Check className="h-3 w-3" /> Auto-saved
                  </span>
                  {onAddToParlay && ['elite', 'strong'].includes(existingPred.confidence_tier) && (
                    <Button variant="secondary" size="sm" className="flex-1 text-xs"
                      onClick={() => onAddToParlay(existingPred, existingPred.predicted_outcome === 'over' ? prop.over_odds : prop.under_odds)}
                    >
                      + Add to Parlay
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// VA PROP ENTRY TAB
// ═══════════════════════════════════════════════════════════════

export function AutoPopulatedPropsNotice({ date }: { date: string }) {
  const { data: apiProps } = useQuery({
    queryKey: ['api-props-count', date],
    queryFn: async () => {
      const { count } = await (supabase as any)
        .from('sbo_player_props')
        .select('*', { count: 'exact', head: true })
        .eq('entered_by', 'api')
        .gte('created_at', date + 'T00:00:00');
      return count || 0;
    },
  });

  if (!apiProps && apiProps !== 0) return null;

  return apiProps > 0 ? (
    <Card className="border-green-500/30 bg-green-500/5">
      <CardContent className="p-3 text-xs text-green-700">
        ✓ {apiProps} props auto-pulled from DraftKings via SportsDataIO API today.
        Use VA Entry only to add PrizePicks-specific lines not covered by the API.
      </CardContent>
    </Card>
  ) : (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardContent className="p-3 text-xs text-amber-700">
        No props synced yet today. Run Pre-Game Sync in the ⚙️ Sync tab to auto-pull tonight's props.
      </CardContent>
    </Card>
  );
}

export function VAPropEntryTab() {
  const [games, setGames] = useState<any[]>([]);
  const [gameId, setGameId] = useState('');
  const [entries, setEntries] = useState([
    { player_name: '', team: '', prop_type: 'points', line: '', over_odds: '-120', under_odds: '-110' }
  ]);
  const [saving, setSaving] = useState(false);

  const PROP_TYPES = ['points','assists','rebounds','threes','steals','blocks','pts_reb_ast','pts_reb','pts_ast','reb_ast','turnovers'];

  useEffect(() => {
    supabase.from('sbo_games')
      .select('id, home_team, away_team, game_date')
      .gte('game_date', new Date().toISOString().split('T')[0] + 'T00:00:00')
      .order('game_date')
      .then(({ data }) => setGames((data as any[]) || []));
  }, []);

  const addRow = () => setEntries(prev => [...prev, { player_name: '', team: '', prop_type: 'points', line: '', over_odds: '-120', under_odds: '-110' }]);
  const removeRow = (i: number) => setEntries(prev => prev.filter((_, j) => j !== i));
  const updateRow = (i: number, field: string, value: string) => {
    setEntries(prev => prev.map((e, j) => j === i ? { ...e, [field]: value } : e));
  };

  const save = async () => {
    if (!gameId) { toast.error('Select a game first'); return; }
    const valid = entries.filter(e => e.player_name && e.line);
    if (!valid.length) { toast.error('Enter at least one player'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('sbo_player_props').insert(
        valid.map(e => ({
          game_id: gameId,
          player_name: e.player_name,
          team: e.team,
          prop_type: e.prop_type,
          line: parseFloat(e.line),
          over_odds: parseInt(e.over_odds),
          under_odds: parseInt(e.under_odds),
          source: 'prizepicks',
          entered_by: 'va',
        }))
      );
      if (error) throw error;
      toast.success(`${valid.length} props saved successfully`);
      setEntries([{ player_name: '', team: '', prop_type: 'points', line: '', over_odds: '-120', under_odds: '-110' }]);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Alert>
        <AlertDescription className="text-xs">
          VA Entry — Open PrizePicks and enter tonight's player props below. Select the game, then add each player's line and odds.
        </AlertDescription>
      </Alert>

      <AutoPopulatedPropsNotice date={new Date().toISOString().split('T')[0]} />

      <div className="space-y-1.5">
        <Label className="text-xs">Select Game</Label>
        <Select value={gameId} onValueChange={setGameId}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Select a game..." />
          </SelectTrigger>
          <SelectContent>
            {games.map(g => (
              <SelectItem key={g.id} value={g.id} className="text-xs">
                {g.away_team} @ {g.home_team} — {new Date(g.game_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {entries.map((entry, i) => (
        <Card key={i}>
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground">Player {i + 1}</p>
              {entries.length > 1 && (
                <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => removeRow(i)}>
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px]">Player Name</Label>
                <Input value={entry.player_name} onChange={e => updateRow(i, 'player_name', e.target.value)} placeholder="LeBron James" className="h-7 text-xs mt-0.5" />
              </div>
              <div>
                <Label className="text-[10px]">Team</Label>
                <Input value={entry.team} onChange={e => updateRow(i, 'team', e.target.value)} placeholder="Lakers" className="h-7 text-xs mt-0.5" />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <div>
                <Label className="text-[10px]">Prop</Label>
                <Select value={entry.prop_type} onValueChange={v => updateRow(i, 'prop_type', v)}>
                  <SelectTrigger className="h-7 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROP_TYPES.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px]">Line</Label>
                <Input value={entry.line} onChange={e => updateRow(i, 'line', e.target.value)} placeholder="27.5" className="h-7 text-xs mt-0.5" />
              </div>
              <div>
                <Label className="text-[10px]">Over</Label>
                <Input value={entry.over_odds} onChange={e => updateRow(i, 'over_odds', e.target.value)} placeholder="-120" className="h-7 text-xs mt-0.5" />
              </div>
              <div>
                <Label className="text-[10px]">Under</Label>
                <Input value={entry.under_odds} onChange={e => updateRow(i, 'under_odds', e.target.value)} placeholder="-110" className="h-7 text-xs mt-0.5" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={addRow} className="flex-1">
          <Plus className="h-3 w-3 mr-1" /> Add Player
        </Button>
        <Button size="sm" onClick={save} disabled={saving} className="flex-1">
          {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
          Save {entries.filter(e => e.player_name && e.line).length} Props
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PARLAY CARD COMPONENT (AI Builder)
// ═══════════════════════════════════════════════════════════════

export function AIParlayCard({ parlay, stake, onSave }: { parlay: any; stake: number; onSave: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [saved, setSaved] = useState(false);

  const payout = Math.round(stake * (parlay.combined_odds_decimal || 1) * 100) / 100;
  const profit = Math.round((payout - stake) * 100) / 100;

  const verdictStyles: Record<string, string> = {
    'STRONG BET': 'bg-green-500/15 text-green-600 border-green-500/30',
    'MODERATE BET': 'bg-blue-500/15 text-blue-600 border-blue-500/30',
    'RISKY': 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30',
    'PASS': 'bg-red-500/15 text-red-600 border-red-500/30',
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Badge className={verdictStyles[parlay.ai_verdict] || 'bg-muted text-muted-foreground'}>
              {parlay.ai_verdict}
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              {parlay.leg_count}-leg · V{parlay.variation_number}
            </span>
          </div>
          <span className="text-sm font-bold text-foreground">
            {parlay.combined_odds_american}
          </span>
        </div>

        {/* Payout */}
        <div className="text-center py-2 rounded-lg bg-muted/30">
          <p className="text-xl font-bold text-green-600">${profit.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground">profit on ${stake} · total: ${payout.toLocaleString()}</p>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Win prob', value: `${parlay.win_probability?.toFixed(1)}%` },
            { label: 'EV', value: `${(parlay.ev_percentage || 0) > 0 ? '+' : ''}${parlay.ev_percentage?.toFixed(1)}%`, isEv: true },
            { label: 'Corr risk', value: parlay.correlation_risk || 'low' },
          ].map((m, i) => (
            <div key={i} className="text-center">
              <p className={`text-xs font-bold ${m.isEv ? ((parlay.ev_percentage || 0) > 0 ? 'text-green-600' : 'text-red-500') : 'text-foreground'}`}>
                {m.value}
              </p>
              <p className="text-[10px] text-muted-foreground">{m.label}</p>
            </div>
          ))}
        </div>

        {/* AI analysis */}
        {parlay.ai_analysis && (
          <p className="text-[11px] text-muted-foreground italic">"{parlay.ai_analysis}"</p>
        )}

        {/* Expand legs */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-center text-[11px] text-muted-foreground py-1.5 rounded border border-border hover:bg-muted/30 transition-all"
        >
          {expanded ? '▲ Hide legs' : `▼ Show ${parlay.leg_count} legs`}
        </button>

        {expanded && (
          <div className="space-y-1.5">
            {(parlay.legs as any[] || []).map((leg: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-2 rounded bg-muted/20 border border-border/50">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{leg.label}</p>
                  <p className="text-[10px] text-muted-foreground">{leg.matchup}</p>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <p className="text-xs font-bold">{leg.odds > 0 ? '+' : ''}{leg.odds}</p>
                  <p className="text-[10px] text-muted-foreground">{leg.confidence}%</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Save button */}
        <Button
          size="sm"
          className="w-full"
          variant={saved ? 'secondary' : 'default'}
          disabled={saved}
          onClick={async () => {
            await onSave();
            setSaved(true);
          }}
        >
          {saved ? <><Check className="h-3 w-3 mr-1" /> Saved to My Bets</> : <><Bookmark className="h-3 w-3 mr-1" /> Save to My Bets</>}
        </Button>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// PARLAY BUILDER TAB
// ═══════════════════════════════════════════════════════════════

export function ParlayBuilderTab() {
  const [selectedLegs, setSelectedLegs] = useState<any[]>([]);
  const [stake, setStake] = useState<number>(10);
  const [parlayName, setParlayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [autoBuilding, setAutoBuilding] = useState(false);

  // AI Builder state
  const [aiStake, setAiStake] = useState(50);
  const [building, setBuilding] = useState(false);
  const [buildProgress, setBuildProgress] = useState('');
  const [aiParlays, setAiParlays] = useState<any[]>([]);
  const [activeLegFilter, setActiveLegFilter] = useState<string | number>('all');
  const [activeVerdictFilter, setActiveVerdictFilter] = useState('all');
  const [mode, setMode] = useState<'ai' | 'manual'>('ai');
  const [savedParlays, setSavedParlays] = useState<any[]>([]);

  const { data: strongPredictions } = useQuery({
    queryKey: ['strong-preds'],
    queryFn: async () => {
      const bounds = getTodayETBounds();
      const { data } = await supabase
        .from('sbo_predictions')
        .select(`*, sbo_games(id, home_team, away_team), sbo_player_props(player_name, prop_type, line, over_odds, under_odds)`)
        .gte('final_confidence', 60)
        .gte('created_at', bounds.start)
        .lt('created_at', bounds.end)
        // PHASE 3 / ITEM 8 — bounded read (day-bounded board); table exceeds the 1k PostgREST default.
        .limit(500)
        .order('final_confidence', { ascending: false });
      return (data as any[]) || [];
    },
  });

  // Load existing AI parlays
  const loadAiParlays = async () => {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const { data } = await (supabase as any)
      .from('sbo_parlay_builder')
      .select('*')
      .gte('created_at', `${today}T00:00:00-04:00`)
      .order('created_at', { ascending: false });
    setAiParlays(data || []);
  };

  // Load saved parlays for results tracking
  const loadSavedParlays = async () => {
    const { data: manualParlays } = await (supabase as any)
      .from('sbo_parlays')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    const { data: builtParlays } = await (supabase as any)
      .from('sbo_parlay_builder')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    const all = [
      ...(manualParlays || []),
      ...(builtParlays || []),
    ].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    setSavedParlays(all);
  };

  useEffect(() => { loadAiParlays(); loadSavedParlays(); }, []);

  // Build all AI parlays
  const buildAllParlays = async () => {
    setBuilding(true);
    setBuildProgress('Gathering predictions...');
    try {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
      await (supabase as any)
        .from('sbo_parlay_builder')
        .delete()
        .gte('created_at', `${today}T00:00:00-04:00`);

      setBuildProgress('Building 3·6·10·15·20-leg variations...');
      const { data, error } = await supabase.functions.invoke('sbo-build-parlays', {
        body: { stake: aiStake, min_confidence: 1, variations: 5 },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Build failed');

      toast.success(`${data.total_parlays_built} parlays built — ${data.summary.strong_bets} strong bets`);
      await loadAiParlays();
    } catch (e: any) {
      toast.error('Build failed: ' + e.message);
    } finally {
      setBuilding(false);
      setBuildProgress('');
    }
  };

  // Save AI parlay to sbo_parlays
  const saveAiParlay = async (parlay: any) => {
    try {
      const parlayLegs = (parlay.legs as any[]) || [];
      const todayEST = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
      const { data: inserted } = await (supabase as any).from('sbo_parlays').insert({
        name: parlay.parlay_name,
        legs: parlay.legs as any,
        total_legs: parlay.leg_count,
        suggested_stake: aiStake,
        stake: aiStake,
        odds: parseInt(parlay.combined_odds_american) || 0,
        potential_payout: Math.round(aiStake * (parlay.combined_odds_decimal || 1) * 100) / 100,
        parlay_date: todayEST,
        combined_confidence: parlay.win_probability,
        expected_value: parlay.profit_if_win,
        status: 'pending',
      }).select().single();

      // Save legs to sbo_parlay_legs
      if (inserted?.id && parlayLegs.length > 0) {
        const legRows = parlayLegs.map((leg: any) => ({
          parlay_id: inserted.id,
          prediction_id: leg.id || null,
          leg_type: leg.type === 'game' ? 'moneyline' : (leg.type || 'prop'),
          label: leg.label,
          odds: leg.odds,
          confidence: leg.confidence,
          result: 'pending',
        }));
        await (supabase as any).from('sbo_parlay_legs').insert(legRows);
      }

      toast.success('Parlay saved to My Bets with leg tracking');
      loadSavedParlays();
    } catch (e: any) {
      toast.error('Save failed: ' + e.message);
    }
  };

  // Filtered AI parlays
  const filteredParlays = aiParlays.filter((p: any) => {
    if (activeLegFilter !== 'all' && p.leg_count !== activeLegFilter) return false;
    if (activeVerdictFilter !== 'all' && p.ai_verdict !== activeVerdictFilter) return false;
    return true;
  });

  // Recalculate payouts when stake changes
  const displayParlays = filteredParlays.map((p: any) => ({
    ...p,
    potential_payout: Math.round(aiStake * (p.combined_odds_decimal || 1) * 100) / 100,
    profit_if_win: Math.round((aiStake * (p.combined_odds_decimal || 1) - aiStake) * 100) / 100,
  }));

  // Manual builder helpers (unchanged)
  const buildLegFromPred = (prediction: any) => {
    const isGame = prediction.prediction_type === 'moneyline';
    if (isGame) {
      const team = prediction.predicted_outcome === 'home'
        ? prediction.sbo_games?.home_team
        : prediction.sbo_games?.away_team;
      return {
        prediction_id: prediction.id,
        label: `${team} ML`,
        odds: -110,
        confidence: prediction.final_confidence,
        matchup: `${prediction.sbo_games?.away_team} @ ${prediction.sbo_games?.home_team}`,
      };
    }
    const prop = prediction.sbo_player_props;
    const rec = prediction.predicted_outcome || 'over';
    return {
      prediction_id: prediction.id,
      label: `${prop?.player_name} ${rec?.toUpperCase()} ${prop?.line} ${prop?.prop_type}`,
      odds: rec?.toLowerCase() === 'over' ? (prop?.over_odds || -110) : (prop?.under_odds || -110),
      confidence: prediction.final_confidence,
      matchup: `${prop?.player_name} (${prediction.sbo_games?.home_team || ''})`,
    };
  };

  const addLeg = (prediction: any) => {
    if (selectedLegs.find(l => l.prediction_id === prediction.id)) {
      toast.info('Already in parlay');
      return;
    }
    setSelectedLegs(prev => [...prev, buildLegFromPred(prediction)]);
    toast.success('Leg added');
  };

  const removeLeg = (id: string) => {
    setSelectedLegs(prev => prev.filter(l => l.prediction_id !== id));
  };

  const autoBuildParlay = async () => {
    setAutoBuilding(true);
    try {
      if (!strongPredictions?.length) { toast.error('No strong predictions available'); return; }
      const usedGameIds = new Set<string>();
      const bestLegs: any[] = [];
      for (const pred of strongPredictions) {
        const gameId = pred.game_id;
        if (usedGameIds.has(gameId) && bestLegs.length < 5) continue;
        if (bestLegs.length >= 3) break;
        bestLegs.push(buildLegFromPred(pred));
        if (gameId) usedGameIds.add(gameId);
      }
      if (bestLegs.length < 2) { toast.error('Not enough diverse predictions'); return; }
      setSelectedLegs(bestLegs);
      setParlayName(`AI Best ${bestLegs.length}-Leg — ${new Date().toLocaleDateString()}`);
      toast.success(`AI built ${bestLegs.length}-leg parlay`);
    } finally { setAutoBuilding(false); }
  };

  const saveParlay = async () => {
    if (selectedLegs.length < 2) { toast.error('Add at least 2 legs'); return; }
    setSaving(true);
    try {
      // Calculate combined american odds
      const toDecOdds = (a: number) => a > 0 ? (a / 100) + 1 : (100 / Math.abs(a)) + 1;
      const combinedDec = selectedLegs.reduce((m, l) => m * toDecOdds(l.odds), 1);
      const combinedAmerican = combinedDec >= 2 ? Math.round((combinedDec - 1) * 100) : Math.round(-100 / (combinedDec - 1));
      const todayEST = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

      const { data: inserted, error } = await (supabase as any).from('sbo_parlays').insert({
        name: parlayName || `${selectedLegs.length}-Leg Parlay`,
        legs: selectedLegs as any,
        total_legs: selectedLegs.length,
        suggested_stake: stake, 
        stake: stake,
        odds: combinedAmerican,
        potential_payout: potentialPayout,
        parlay_date: todayEST,
        combined_confidence: combinedProb,
        expected_value: potentialPayout - stake,
        status: 'pending',
      }).select().single();
      if (error) throw error;

      // Also save individual legs to sbo_parlay_legs
      if (inserted?.id) {
        const legRows = selectedLegs.map(leg => ({
          parlay_id: inserted.id,
          prediction_id: leg.prediction_id || null,
          leg_type: leg.type || (leg.label?.includes('ML') ? 'moneyline' : 'prop'),
          label: leg.label,
          odds: leg.odds,
          pick: leg.pick || null,
          confidence: leg.confidence,
          result: 'pending',
        }));
        await (supabase as any).from('sbo_parlay_legs').insert(legRows);
      }

      toast.success(`Parlay saved! Combined odds: ${combinedAmerican > 0 ? '+' : ''}${combinedAmerican}`);
      setSelectedLegs([]);
      setParlayName('');
      loadSavedParlays();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const combinedProb = selectedLegs.length > 0
    ? selectedLegs.reduce((p, leg) => p * (leg.confidence / 100), 1) * 100 : 0;
  const parlayMultiplier = selectedLegs.reduce((m, leg) => {
    const decimal = leg.odds > 0 ? (leg.odds / 100) + 1 : (100 / Math.abs(leg.odds)) + 1;
    return m * decimal;
  }, 1);
  const potentialPayout = parseFloat((stake * parlayMultiplier).toFixed(2));

  return (
    <div className="space-y-4">
      {/* Mode switcher */}
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-1">
        <button
          onClick={() => setMode('ai')}
          className={`flex-1 text-xs py-2 rounded-md font-medium transition-all ${
            mode === 'ai' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
          }`}
        >
          🎯 AI Genius Builder
        </button>
        <button
          onClick={() => setMode('manual')}
          className={`flex-1 text-xs py-2 rounded-md font-medium transition-all ${
            mode === 'manual' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
          }`}
        >
          ✏️ Manual Builder
        </button>
      </div>

      {mode === 'ai' ? (
        /* ═══ AI GENIUS BUILDER ═══ */
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-foreground">🎯 AI Parlay Builder</h2>
            <p className="text-xs text-muted-foreground">5 variations × (3·6·10·15·20 legs) from today's top predictions</p>
          </div>

          {/* Stake + Build */}
          <div className="flex items-end gap-3">
            <div>
              <Label className="text-xs">Stake ($)</Label>
              <Input
                type="number"
                value={aiStake}
                onChange={e => setAiStake(parseFloat(e.target.value) || 50)}
                className="h-8 w-20 text-xs mt-1"
              />
            </div>
            <Button
              onClick={buildAllParlays}
              disabled={building}
              className="flex-1 h-10"
            >
              {building ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {buildProgress || 'Building...'}</>
              ) : (
                '🎯 Build All Parlays'
              )}
            </Button>
          </div>

          {aiParlays.length > 0 && (
            <>
              {/* Summary stats */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'Total', value: aiParlays.length },
                  { label: 'Strong', value: aiParlays.filter((p: any) => p.ai_verdict === 'STRONG BET').length },
                  { label: 'Best payout', value: '$' + Math.max(...aiParlays.map((p: any) => Math.round(aiStake * (p.combined_odds_decimal || 1)))).toLocaleString() },
                  { label: 'Best prob', value: Math.max(...aiParlays.map((p: any) => p.win_probability || 0)).toFixed(1) + '%' },
                ].map((s, i) => (
                  <div key={i} className="text-center p-2 rounded-lg bg-muted/30 border border-border/50">
                    <p className="text-sm font-bold text-foreground">{s.value}</p>
                    <p className="text-[10px] text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Leg filter */}
              <div className="space-y-1.5">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Filter by legs</p>
                <div className="flex flex-wrap gap-1.5">
                  {(['all', 3, 6, 10, 15, 20] as const).map(count => {
                    const c = aiParlays.filter((p: any) => count === 'all' || p.leg_count === count).length;
                    return (
                      <button
                        key={String(count)}
                        onClick={() => setActiveLegFilter(count)}
                        className={`text-[11px] px-3 py-1 rounded-full border transition-all ${
                          activeLegFilter === count
                            ? 'bg-foreground text-background border-foreground'
                            : 'border-border text-muted-foreground hover:border-foreground/30'
                        }`}
                      >
                        {count === 'all' ? 'All' : `${count}-leg`} ({c})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Verdict filter */}
              <div className="space-y-1.5">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Filter by verdict</p>
                <div className="flex flex-wrap gap-1.5">
                  {['all', 'STRONG BET', 'MODERATE BET', 'RISKY', 'PASS'].map(v => (
                    <button
                      key={v}
                      onClick={() => setActiveVerdictFilter(v)}
                      className={`text-[11px] px-3 py-1 rounded-full border transition-all ${
                        activeVerdictFilter === v
                          ? 'bg-foreground text-background border-foreground'
                          : 'border-border text-muted-foreground hover:border-foreground/30'
                      }`}
                    >
                      {v === 'all' ? 'All verdicts' : v}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Showing {displayParlays.length} of {aiParlays.length} parlays
              </p>

              {/* Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {displayParlays.map((p: any) => (
                  <AIParlayCard
                    key={p.id}
                    parlay={p}
                    stake={aiStake}
                    onSave={() => saveAiParlay(p)}
                  />
                ))}
              </div>
            </>
          )}

          {aiParlays.length === 0 && !building && (
            <div className="text-center py-12 border border-dashed border-border rounded-lg text-muted-foreground">
              <p className="text-4xl mb-2">🎯</p>
              <p className="text-sm font-medium">No parlays built yet</p>
              <p className="text-xs mt-1">Set your stake and press Build All Parlays</p>
            </div>
          )}
        </div>
      ) : (
        /* ═══ MANUAL BUILDER (existing) ═══ */
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2 rounded-lg border border-border bg-muted/30 px-4 py-2.5">
            <span className="text-sm font-medium text-foreground">
              📅 {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-foreground">✏️ Manual Parlay Builder</h2>
              <p className="text-xs text-muted-foreground">Build manually or let AI pick the best 3 legs</p>
            </div>
            <Button onClick={autoBuildParlay} disabled={autoBuilding} size="sm">
              {autoBuilding
                ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Building...</>
                : <>🤖 AI Build Best Parlay</>
              }
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* LEFT — Available predictions */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Tonight's Strong Picks — click to add
              </p>
              {!strongPredictions?.length ? (
                <div className="text-center py-8 border rounded-lg border-dashed border-border text-muted-foreground">
                  <p className="text-xs">No strong predictions yet.</p>
                  <p className="text-[10px] mt-1">Run predictions on games and props first.</p>
                </div>
              ) : (
                strongPredictions.map((pred: any) => {
                  const isAdded = selectedLegs.find(l => l.prediction_id === pred.id);
                  const label = pred.prediction_type === 'moneyline'
                    ? `${pred.predicted_outcome === 'home' ? pred.sbo_games?.home_team : pred.sbo_games?.away_team} ML`
                    : `${pred.sbo_player_props?.player_name} ${pred.predicted_outcome?.toUpperCase()} ${pred.sbo_player_props?.line} ${pred.sbo_player_props?.prop_type}`;
                  return (
                    <div
                      key={pred.id}
                      className={`border rounded-lg p-3 cursor-pointer transition-all ${
                        isAdded ? 'border-primary/60 bg-primary/5' : 'hover:border-primary/30 hover:bg-muted/30'
                      }`}
                      onClick={() => !isAdded && addLeg(pred)}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium flex-1 truncate">{label}</p>
                        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                            pred.confidence_tier === 'elite' ? 'bg-green-500/20 text-green-600' : 'bg-blue-500/20 text-blue-600'
                          }`}>
                            {pred.final_confidence}%
                          </span>
                          {isAdded && <Check className="w-3 h-3 text-primary" />}
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {pred.sbo_games?.away_team} @ {pred.sbo_games?.home_team}
                      </p>
                    </div>
                  );
                })
              )}
            </div>

            {/* RIGHT — Parlay legs */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Your Parlay ({selectedLegs.length} legs)
              </p>
              <div>
                <Label className="text-xs">Parlay Name (optional)</Label>
                <Input value={parlayName} onChange={e => setParlayName(e.target.value)} placeholder="Tonight's 3-leg NBA parlay" className="h-7 text-xs mt-1" />
              </div>
              {selectedLegs.length === 0 ? (
                <div className="text-center py-8 border rounded-lg border-dashed border-border text-muted-foreground">
                  <p className="text-xs">No legs added yet.</p>
                  <p className="text-[10px] mt-1">Click picks on the left or use "AI Build Best Parlay".</p>
                </div>
              ) : (
                <>
                  {selectedLegs.map((leg, i) => (
                    <div key={leg.prediction_id} className="flex items-center gap-2 p-2.5 border rounded-lg bg-muted/20">
                      <span className="text-[10px] text-muted-foreground w-4 flex-shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{leg.label}</p>
                        <p className="text-[10px] text-muted-foreground">
                          Odds: {leg.odds > 0 ? '+' : ''}{leg.odds} · {leg.confidence}% conf
                        </p>
                        {leg.confidence < 55 && (
                          <p className="text-[10px] text-amber-500 mt-0.5">⚠️ Low confidence — weakens parlay</p>
                        )}
                      </div>
                      <Button size="icon" variant="ghost" className="w-6 h-6 flex-shrink-0" onClick={() => removeLeg(leg.prediction_id)}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                  <div className="bg-muted/40 rounded-lg p-3 space-y-2">
                    {[
                      { label: 'Combined Win Probability', value: `${combinedProb.toFixed(1)}%` },
                      { label: 'Parlay Multiplier', value: `${parlayMultiplier.toFixed(2)}x` },
                      { label: 'Potential Payout', value: `$${potentialPayout}` },
                    ].map(s => (
                      <div key={s.label} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{s.label}</span>
                        <span className="font-bold">{s.value}</span>
                      </div>
                    ))}
                    {selectedLegs.length > 5 && (
                      <p className="text-[10px] text-amber-500 mt-1">⚠️ 6+ leg parlays hit under 5% — consider trimming</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Label className="text-xs flex-shrink-0">Stake $</Label>
                    <Input type="number" value={stake} onChange={e => setStake(Number(e.target.value))} className="h-7 text-xs w-24" min={1} />
                    {[5, 10, 25, 50, 100].map(s => (
                      <button key={s} onClick={() => setStake(s)}
                        className={`text-[10px] px-1.5 py-1 rounded border transition-all ${
                          stake === s ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/30'
                        }`}
                      >${s}</button>
                    ))}
                  </div>
                  <Button onClick={saveParlay} disabled={saving} size="sm" className="w-full">
                    {saving ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Saving...</> : <><Save className="h-3 w-3 mr-1" /> Save Parlay</>}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Saved Parlay Results */}
      <div className="mt-6">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          📚 Parlay History & Results
        </p>
        <ParlayResultsSection parlays={savedParlays} onUpdate={loadSavedParlays} />
      </div>

      {/* AI Suggested Parlay */}
      {strongPredictions && strongPredictions.length >= 3 && (
        <div className="mt-6 rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground">🤖 AI Suggested Parlay Tonight</h3>
              <p className="text-[10px] text-muted-foreground">Top 3 picks by confidence (70%+)</p>
            </div>
          </div>
          {(() => {
            const eligible = (strongPredictions || []).filter((p: any) => p.final_confidence >= 70);
            const top3 = eligible.slice(0, 3);
            if (top3.length < 2) return <p className="text-xs text-muted-foreground">Not enough high-confidence picks (need 2+ at 70%+)</p>;
            const avgConf = Math.round(top3.reduce((s: number, p: any) => s + p.final_confidence, 0) / top3.length);
            const sugLegs = top3.map((pred: any) => buildLegFromPred(pred));
            const toD = (a: number) => a > 0 ? (a / 100) + 1 : (100 / Math.abs(a)) + 1;
            const combinedDec = sugLegs.reduce((m: number, l: any) => m * toD(l.odds), 1);
            const combinedAm = combinedDec >= 2 ? Math.round((combinedDec - 1) * 100) : Math.round(-100 / (combinedDec - 1));
            return (
              <div className="space-y-2">
                {sugLegs.map((leg: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/30 border border-border/50">
                    <span className="text-foreground font-medium truncate flex-1">{leg.label}</span>
                    <span className="text-muted-foreground flex-shrink-0 ml-2">{leg.confidence}% · {leg.odds > 0 ? '+' : ''}{leg.odds}</span>
                  </div>
                ))}
                <div className="text-center py-2 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground">
                    Avg confidence: <strong>{avgConf}%</strong> · Combined odds: <strong>{combinedAm > 0 ? '+' : ''}{combinedAm}</strong> · Suggested stake: 1-2 units
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedLegs(sugLegs);
                    setParlayName(`AI Top ${sugLegs.length}-Leg — ${new Date().toLocaleDateString()}`);
                    setMode('manual');
                    toast.success(`${sugLegs.length} legs loaded into builder`);
                  }}
                  className="w-full py-2.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Add All to Builder
                </button>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SIMULATION TAB
// ═══════════════════════════════════════════════════════════════

export function SimulationTab() {
  const [selectedPredictionIds, setSelectedPredictionIds] = useState<string[]>([]);
  const [stake, setStake] = useState(10);
  const [result, setResult] = useState<any>(null);
  const [running, setRunning] = useState(false);

  const { data: predictions } = useQuery({
    queryKey: ['all-today-predictions'],
    queryFn: async () => {
      const { data } = await supabase
        .from('sbo_predictions')
        .select(`
          *,
          sbo_games(home_team, away_team),
          sbo_player_props(player_name, prop_type, line, over_odds, under_odds)
        `)
        .gte('created_at', new Date(Date.now() - 24 * 3600000).toISOString())
        // PHASE 3 / ITEM 8 — bounded read (last 24h); table exceeds the 1k PostgREST default.
        .limit(500)
        .order('final_confidence', { ascending: false });
      return (data as any[]) || [];
    },
  });

  const togglePrediction = (id: string) => {
    setSelectedPredictionIds(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const runSimulation = async () => {
    if (!selectedPredictionIds.length) {
      toast.error('Select at least one prediction to simulate');
      return;
    }
    setRunning(true);
    try {
      const legs = selectedPredictionIds.map(id => {
        const pred = predictions?.find((p: any) => p.id === id);
        const odds = pred?.prediction_type === 'player_prop'
          ? (pred.predicted_outcome === 'over'
              ? pred.sbo_player_props?.over_odds
              : pred.sbo_player_props?.under_odds) || -110
          : -110;
        return { prediction_id: id, odds };
      });

      const { data, error } = await supabase.functions.invoke('sbo-simulate-parlay', {
        body: { legs, stake, simulation_count: 10000 },
      });
      if (error) throw error;
      setResult(data);
    } catch (e: any) {
      toast.error(e.message || 'Simulation failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left — pick predictions */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Select Legs to Simulate
          </p>
          {predictions?.map((pred: any) => {
            const isSelected = selectedPredictionIds.includes(pred.id);
            const label = pred.prediction_type === 'moneyline'
              ? `${pred.predicted_outcome === 'home' ? pred.sbo_games?.home_team : pred.sbo_games?.away_team} ML`
              : `${pred.sbo_player_props?.player_name} ${pred.predicted_outcome?.toUpperCase()} ${pred.sbo_player_props?.line} ${pred.sbo_player_props?.prop_type}`;

            return (
              <div
                key={pred.id}
                className={`flex items-center gap-2 p-2.5 border rounded-lg cursor-pointer transition-all ${
                  isSelected ? 'border-primary bg-primary/5' : 'hover:border-border'
                }`}
                onClick={() => togglePrediction(pred.id)}
              >
                <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${
                  isSelected ? 'bg-primary border-primary' : 'border-muted-foreground'
                }`}>
                  {isSelected && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{label}</p>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0 ${
                  pred.confidence_tier === 'elite' ? 'bg-green-500/20 text-green-600' :
                  pred.confidence_tier === 'strong' ? 'bg-blue-500/20 text-blue-600' :
                  pred.confidence_tier === 'moderate' ? 'bg-amber-500/20 text-amber-600' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {pred.final_confidence}%
                </span>
              </div>
            );
          })}
        </div>

        {/* Right — controls + results */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Simulation Controls
          </p>

          <div className="flex items-center gap-2">
            <Label className="text-xs flex-shrink-0">Stake $</Label>
            <Input
              type="number"
              value={stake}
              onChange={e => setStake(Number(e.target.value))}
              className="h-7 text-xs w-24"
              min={1}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            {selectedPredictionIds.length} leg{selectedPredictionIds.length !== 1 ? 's' : ''} selected — 10,000 Monte Carlo simulations
          </p>

          <Button
            onClick={runSimulation}
            disabled={running || !selectedPredictionIds.length}
            className="w-full gap-2"
            size="sm"
          >
            {running
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Simulating...</>
              : <>⚡ Run Simulation</>
            }
          </Button>

          {result && (
            <Card className="border-primary/30">
              <CardContent className="p-4 space-y-3">
                <p className="text-sm font-semibold">Results — {result.summary.legs} Legs</p>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Win Probability', value: `${result.summary.combined_win_probability}%`, color: result.summary.combined_win_probability >= 30 ? 'text-green-500' : 'text-amber-500' },
                    { label: 'Potential Payout', value: `$${result.summary.potential_payout}`, color: 'text-foreground' },
                    { label: 'Expected Value', value: `$${result.summary.expected_value}`, color: result.summary.expected_value > 0 ? 'text-green-500' : 'text-red-500' },
                    { label: 'Kelly Stake', value: `$${result.summary.kelly_suggested_stake}`, color: 'text-blue-500' },
                    { label: 'Sim Wins', value: result.monte_carlo.simulated_wins.toLocaleString(), color: 'text-green-500' },
                    { label: 'Sim Losses', value: result.monte_carlo.simulated_losses.toLocaleString(), color: 'text-red-500' },
                  ].map(s => (
                    <div key={s.label} className="bg-muted/40 rounded-lg p-2">
                      <p className="text-[10px] text-muted-foreground">{s.label}</p>
                      <p className={`text-sm font-bold mt-0.5 ${s.color}`}>{s.value}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Win rate: {result.monte_carlo.simulated_win_rate}%</span>
                    <span>10,000 simulations</span>
                  </div>
                  <div className="h-3 bg-red-400/30 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition-all duration-700"
                      style={{ width: `${result.monte_carlo.simulated_win_rate}%` }}
                    />
                  </div>
                </div>

                <div className={`text-xs font-medium p-2 rounded-lg ${
                  result.summary.expected_value > 0
                    ? 'bg-green-500/10 text-green-600'
                    : 'bg-red-500/10 text-red-600'
                }`}>
                  {result.summary.expected_value > 0
                    ? `✓ Positive EV — this parlay has mathematical value at $${stake}`
                    : `✗ Negative EV — consider smaller stake or better lines`
                  }
                </div>

                <p className="text-[10px] text-muted-foreground">
                  Parlay multiplier: {result.summary.parlay_multiplier}x · Type: {result.summary.parlay_tier?.replace('_', ' ')}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ACCURACY HISTORY WIDGET
// ═══════════════════════════════════════════════════════════════

export function AccuracyHistoryWidget() {
  const { data: history } = useQuery({
    queryKey: ['accuracy-history'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('sbo_accuracy_log')
        .select('*')
        .order('date', { ascending: false })
        .limit(14);
      return (data || []).reverse();
    },
  });

  if (!history?.length) return null;

  const avgAccuracy = history.reduce((sum: number, d: any) => sum + (d.accuracy_pct || 0), 0) / history.length;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">14-Day Accuracy Trend</p>
          <span className={`text-sm font-bold ${
            avgAccuracy >= 60 ? 'text-green-500' :
            avgAccuracy >= 50 ? 'text-amber-500' : 'text-red-500'
          }`}>
            {avgAccuracy.toFixed(1)}% avg
          </span>
        </div>
        <div className="flex items-end gap-1 h-16">
          {history.map((day: any, i: number) => {
            const pct = day.accuracy_pct || 0;
            const height = Math.max((pct / 100) * 64, 2);
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                <div
                  className={`w-full rounded-sm ${
                    pct >= 60 ? 'bg-green-500' :
                    pct >= 50 ? 'bg-amber-500' : 'bg-red-400'
                  }`}
                  style={{ height: `${height}px` }}
                  title={`${new Date(day.date).toLocaleDateString()}: ${pct}%`}
                />
                <span className="text-[7px] text-muted-foreground">
                  {new Date(day.date).getDate()}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-[9px] text-muted-foreground">
          <span>{history[0]?.date}</span>
          <span>{history.reduce((sum: number, d: any) => sum + (d.total_predictions || 0), 0)} total predictions graded</span>
          <span>{history[history.length - 1]?.date}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// ACCURACY TAB
// ═══════════════════════════════════════════════════════════════

export function AccuracyTab() {
  const [verifying, setVerifying] = useState(false);
  const [verifyProgress, setVerifyProgress] = useState('');
  const [showAllSports, setShowAllSports] = useState(false);
  const queryClient = useQueryClient();

  // Inline helper: sport_key -> { emoji, label }
  const SPORT_META: Record<string, { emoji: string; label: string }> = {
    nba: { emoji: '🏀', label: 'NBA' },
    wnba: { emoji: '🏀', label: 'WNBA' },
    ncaab: { emoji: '🏀', label: 'NCAAB' },
    nfl: { emoji: '🏈', label: 'NFL' },
    ncaaf: { emoji: '🏈', label: 'NCAAF' },
    mlb: { emoji: '⚾', label: 'MLB' },
    nhl: { emoji: '🏒', label: 'NHL' },
    mls: { emoji: '⚽', label: 'MLS' },
    epl: { emoji: '⚽', label: 'EPL' },
    soccer: { emoji: '⚽', label: 'Soccer' },
    ufc: { emoji: '🥊', label: 'UFC' },
    mma: { emoji: '🥊', label: 'MMA' },
    boxing: { emoji: '🥊', label: 'Boxing' },
    tennis: { emoji: '🎾', label: 'Tennis' },
    golf: { emoji: '⛳', label: 'Golf' },
  };
  const ALL_SPORT_KEYS = Object.keys(SPORT_META);
  const getSportMeta = (key: string | null | undefined) => {
    const k = (key || '').toLowerCase();
    return SPORT_META[k] || { emoji: '🎯', label: (key || 'Unknown').toUpperCase() };
  };

  const { data: allPreds, refetch: refetchAll } = useQuery({
    queryKey: ['all-predictions-accuracy-full'],
    queryFn: async () => {
      // Paginate to bypass PostgREST's default 1000-row cap
      const PAGE = 1000;
      let from = 0;
      const all: any[] = [];
      for (let i = 0; i < 50; i++) {
        const { data, error } = await supabase
          .from('sbo_predictions')
          .select('id, prediction_type, predicted_outcome, final_confidence, confidence_tier, verdict, verified, was_correct, created_at, sport_key')
          .not('verdict', 'is', null)
          .order('created_at', { ascending: false })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const batch = (data as any[]) || [];
        all.push(...batch);
        if (batch.length < PAGE) break;
        from += PAGE;
      }
      return all;
    },
  });

  const { data: predictions, refetch: refetchGraded } = useQuery({
    queryKey: ['all-predictions-accuracy'],
    queryFn: async () => {
      const { data } = await supabase
        .from('sbo_predictions')
        .select('*')
        .not('verdict', 'is', null)
        .order('created_at', { ascending: false })
        .limit(500);
      return (data as any[]) || [];
    },
  });

  const { data: pending, refetch: refetchPending } = useQuery({
    queryKey: ['pending-predictions'],
    queryFn: async () => {
      const { data } = await supabase
        .from('sbo_predictions')
        .select(`
          *,
          sbo_games(home_team, away_team, game_date, status, winner),
          sbo_player_props(player_name, prop_type, line)
        `)
        .is('verdict', null)
        .order('created_at', { ascending: false })
        .limit(50);
      return (data as any[]) || [];
    },
  });

  const { data: verifications } = useQuery({
    queryKey: ['recent-verifications'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('sbo_results_verification')
        .select('*, sbo_predictions(predicted_outcome, prediction_type, final_confidence, sbo_games(home_team, away_team))')
        .order('verified_at', { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  const { data: propVerifications } = useQuery({
    queryKey: ['prop-verifications'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('sbo_results_verification')
        .select('verdict, actual_result')
        .eq('pick_type', 'prop');
      return data || [];
    },
  });

  // Computed stats from allPreds (only verified predictions)
  const correct = allPreds?.filter(p => p.verdict === 'correct' || p.was_correct === true).length || 0;
  const incorrect = allPreds?.filter(p => p.verdict === 'incorrect' || p.was_correct === false).length || 0;
  const total = correct + incorrect;
  const pendingCount = pending?.length || 0;
  const accuracy = total > 0
    ? ((correct / total) * 100).toFixed(1) : '0';

  // Game vs prop breakdown
  const gamePreds = allPreds?.filter(p => p.prediction_type === 'moneyline') || [];
  const propPreds = allPreds?.filter(p => p.prediction_type === 'player_prop') || [];
  const gameCorrect = gamePreds.filter(p => p.verdict === 'correct' || p.was_correct === true).length;
  const gameIncorrect = gamePreds.filter(p => p.verdict === 'incorrect' || p.was_correct === false).length;
  const gameAccuracy = (gameCorrect + gameIncorrect) > 0 ? ((gameCorrect / (gameCorrect + gameIncorrect)) * 100).toFixed(1) : '0';
  const propCorrectCount = propPreds.filter(p => p.verdict === 'correct' || p.was_correct === true).length;
  const propIncorrectCount = propPreds.filter(p => p.verdict === 'incorrect' || p.was_correct === false).length;
  const propAccuracy = (propCorrectCount + propIncorrectCount) > 0 ? ((propCorrectCount / (propCorrectCount + propIncorrectCount)) * 100).toFixed(1) : '0';

  const byTier = ['elite', 'strong', 'moderate', 'weak'].map(tier => {
    const tierPreds = allPreds?.filter(p => p.confidence_tier === tier) || [];
    const tc = tierPreds.filter(p => p.verdict === 'correct' || p.was_correct === true).length;
    const ti = tierPreds.filter(p => p.verdict === 'incorrect' || p.was_correct === false).length;
    return {
      tier,
      total: tierPreds.length,
      correct: tc,
      incorrect: ti,
      accuracy: (tc + ti) > 0 ? ((tc / (tc + ti)) * 100).toFixed(1) : 'N/A',
    };
  });

  const byConfidenceBand = [
    { label: '55-65%', min: 55, max: 65 },
    { label: '65-75%', min: 65, max: 75 },
    { label: '75-90%', min: 75, max: 90 },
    { label: '90%+', min: 90, max: 100 },
  ].map(band => {
    const inBand = allPreds?.filter(p => {
      const conf = p.final_confidence || 0;
      return conf >= band.min && conf < (band.max === 100 ? 101 : band.max);
    }) || [];
    const wins = inBand.filter(p => p.verdict === 'correct' || p.was_correct === true).length;
    return {
      ...band,
      total: inBand.length,
      wins,
      accuracy: inBand.length > 0 ? ((wins / inBand.length) * 100).toFixed(1) : 'N/A',
    };
  });

  // Accuracy by Sport — grouped from allPreds.sport_key
  const sportGroups = (allPreds || []).reduce((acc: Record<string, { correct: number; incorrect: number }>, p: any) => {
    const k = (p.sport_key || 'unknown').toLowerCase();
    if (!acc[k]) acc[k] = { correct: 0, incorrect: 0 };
    if (p.verdict === 'correct' || p.was_correct === true) acc[k].correct++;
    else if (p.verdict === 'incorrect' || p.was_correct === false) acc[k].incorrect++;
    return acc;
  }, {});
  const activeSportKeys = Object.keys(sportGroups);
  const emptySportKeys = ALL_SPORT_KEYS.filter(k => !sportGroups[k]);
  const visibleSportKeys = showAllSports
    ? Array.from(new Set([...activeSportKeys, ...ALL_SPORT_KEYS]))
    : activeSportKeys;
  const bySport = visibleSportKeys.map(k => {
    const g = sportGroups[k] || { correct: 0, incorrect: 0 };
    const total = g.correct + g.incorrect;
    const meta = getSportMeta(k);
    return {
      key: k,
      emoji: meta.emoji,
      label: meta.label,
      correct: g.correct,
      incorrect: g.incorrect,
      total,
      accuracy: total > 0 ? ((g.correct / total) * 100).toFixed(1) : 'N/A',
    };
  }).sort((a, b) => b.total - a.total);


  const markResult = async (predId: string, wasCorrect: boolean) => {
    await supabase
      .from('sbo_predictions')
      .update({
        was_correct: wasCorrect,
        verdict: wasCorrect ? 'correct' : 'incorrect',
        verified: true,
        verified_at: new Date().toISOString(),
      })
      .eq('id', predId);
    toast.success('Result recorded');
    refetchAll();
    refetchGraded();
    refetchPending();
  };

  const runVerification = async () => {
    setVerifying(true);
    setVerifyProgress('Verifying completed games...');
    try {
      const { data, error } = await supabase.functions.invoke('sbo-verify-results', {
        body: {},
      });
      if (error) throw error;
      toast.success(
        data.verified > 0
          ? `${data.correct}W - ${data.incorrect}L · ${data.accuracy}% accuracy`
          : data.message || 'No new results to verify'
      );
      refetchAll();
      refetchGraded();
      refetchPending();
      queryClient.invalidateQueries({ queryKey: ['recent-verifications'] });
    } catch (e: any) {
      toast.error(e.message || 'Verification failed');
    } finally {
      setVerifying(false);
      setVerifyProgress('');
    }
  };

  // Auto-verify on mount
  useEffect(() => {
    const autoVerify = async () => {
      try {
        const { data } = await supabase.functions.invoke('sbo-verify-results', { body: {} });
        if (data?.verified > 0) {
          toast.info(`Auto-verified ${data.verified} results`);
          refetchAll();
          refetchGraded();
          refetchPending();
          queryClient.invalidateQueries({ queryKey: ['recent-verifications'] });
        }
      } catch { /* silent */ }
    };
    autoVerify();
  }, []);

  return (
    <div className="space-y-4">
      {/* Header with Verify button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">📊 Prediction Accuracy</h2>
          <p className="text-xs text-muted-foreground">Auto-verify against final scores</p>
        </div>
        <Button onClick={runVerification} disabled={verifying} size="sm">
          {verifying
            ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> {verifyProgress}</>
            : <><Check className="h-3 w-3 mr-1" /> Verify Results</>
          }
        </Button>
      </div>

      {/* Accuracy history chart */}
      <AccuracyHistoryWidget />

      {/* Overall accuracy */}
      <div className="grid grid-cols-5 gap-2">
        {[
          { label: 'Total', value: total, color: 'text-foreground' },
          { label: 'Correct', value: correct, color: 'text-emerald-500' },
          { label: 'Incorrect', value: incorrect, color: 'text-destructive' },
          { label: 'Pending', value: pendingCount, color: 'text-amber-500' },
          { label: 'Accuracy', value: `${accuracy}%`, color: parseFloat(accuracy) >= 55 ? 'text-emerald-500' : 'text-amber-500' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-3 text-center">
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Games vs Props breakdown */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className={`text-2xl font-bold ${parseFloat(gameAccuracy) >= 55 ? 'text-emerald-500' : 'text-amber-500'}`}>{gameAccuracy}%</p>
            <p className="text-[10px] text-muted-foreground">🏀 Games · {gameCorrect}W-{gameIncorrect}L</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className={`text-2xl font-bold ${parseFloat(propAccuracy) >= 55 ? 'text-emerald-500' : 'text-amber-500'}`}>{propAccuracy}%</p>
            <p className="text-[10px] text-muted-foreground">📊 Props · {propCorrectCount}W-{propIncorrectCount}L</p>
          </CardContent>
        </Card>
      </div>

      {/* Accuracy by Sport */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Accuracy by Sport</p>
            {emptySportKeys.length > 0 && (
              <button
                type="button"
                onClick={() => setShowAllSports(v => !v)}
                className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2"
              >
                {showAllSports ? 'Hide empty' : `Show all (${emptySportKeys.length})`}
              </button>
            )}
          </div>
          {bySport.length === 0 ? (
            <p className="text-xs text-muted-foreground">No verified predictions yet.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {bySport.map(s => {
                const isEmpty = s.total === 0;
                const acc = s.accuracy === 'N/A' ? 0 : parseFloat(s.accuracy);
                const color = isEmpty
                  ? 'text-muted-foreground'
                  : acc >= 55 ? 'text-emerald-500' : 'text-amber-500';
                return (
                  <div
                    key={s.key}
                    className={`rounded-md border border-border p-2 text-center ${isEmpty ? 'opacity-50' : ''}`}
                  >
                    <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                      <span>{s.emoji}</span>
                      <span>{s.label}</span>
                    </div>
                    <p className={`text-lg font-bold ${color}`}>
                      {s.accuracy === 'N/A' ? '—' : `${s.accuracy}%`}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {s.correct}W-{s.incorrect}L
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {s.total} pick{s.total === 1 ? '' : 's'}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Accuracy by confidence tier */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-semibold text-foreground">Accuracy by Confidence Tier</p>
          <div className="space-y-2">
            {byTier.map(t => (
              <div key={t.tier} className="flex items-center gap-3">
                <Badge variant="outline" className="text-[10px] w-20 justify-center capitalize">
                  {t.tier}
                </Badge>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      parseFloat(t.accuracy) >= 60 ? 'bg-green-500' :
                      parseFloat(t.accuracy) >= 50 ? 'bg-amber-500' : 'bg-red-400'
                    }`}
                    style={{ width: t.accuracy === 'N/A' ? '0%' : `${t.accuracy}%` }}
                  />
                </div>
                <span className="text-xs font-bold w-12 text-right">{t.accuracy}%</span>
                <span className="text-[10px] text-muted-foreground w-10 text-right">
                  {t.correct}/{t.total}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Accuracy by confidence band */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-semibold text-foreground">Accuracy by Confidence Band</p>
          <div className="space-y-2">
            {byConfidenceBand.map(b => (
              <div key={b.label} className="flex items-center gap-3">
                <span className="text-[10px] text-muted-foreground w-14">{b.label}</span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      b.accuracy !== 'N/A' && parseFloat(b.accuracy) >= 60 ? 'bg-green-500' :
                      b.accuracy !== 'N/A' && parseFloat(b.accuracy) >= 50 ? 'bg-amber-500' : 'bg-red-400'
                    }`}
                    style={{ width: b.accuracy === 'N/A' ? '0%' : `${b.accuracy}%` }}
                  />
                </div>
                <span className="text-xs font-bold w-12 text-right">{b.accuracy}%</span>
                <span className="text-[10px] text-muted-foreground w-10 text-right">
                  {b.wins}/{b.total}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Props vs Games breakdown */}
      {(() => {
        const gameVer = (verifications || []).filter((v: any) => v.pick_type !== 'prop');
        const propVer = propVerifications || [];
        const gameCorrect = gameVer.filter((v: any) => v.verdict === 'correct').length;
        const gameTotal = gameVer.filter((v: any) => v.verdict !== 'push').length;
        const propCorrect = propVer.filter((v: any) => v.verdict === 'correct').length;
        const propTotal = propVer.filter((v: any) => v.verdict !== 'push').length;
        const gameAcc = gameTotal > 0 ? Math.round((gameCorrect / gameTotal) * 100) : 0;
        const propAcc = propTotal > 0 ? Math.round((propCorrect / propTotal) * 100) : 0;

        const STAT_TYPES = ['points', 'rebounds', 'assists', 'threes', 'steals', 'blocks'];

        return (gameTotal > 0 || propTotal > 0) ? (
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-semibold text-foreground">Games vs Props Accuracy</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/30 text-center">
                  <p className={`text-xl font-bold ${gameAcc >= 55 ? 'text-green-500' : 'text-amber-500'}`}>{gameAcc}%</p>
                  <p className="text-[10px] text-muted-foreground">🏀 Games {gameCorrect}-{gameTotal - gameCorrect}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 text-center">
                  <p className={`text-xl font-bold ${propAcc >= 55 ? 'text-green-500' : 'text-amber-500'}`}>{propAcc}%</p>
                  <p className="text-[10px] text-muted-foreground">📊 Props {propCorrect}-{propTotal - propCorrect}</p>
                </div>
              </div>
              {propTotal > 0 && (
                <div className="space-y-1.5 mt-2">
                  <p className="text-[11px] font-medium text-muted-foreground">Props by Stat Type</p>
                  {STAT_TYPES.map(type => {
                    const typeResults = propVer.filter((p: any) =>
                      p.actual_result?.toLowerCase().includes(type)
                    );
                    const tCorrect = typeResults.filter((p: any) => p.verdict === 'correct').length;
                    const tTotal = typeResults.filter((p: any) => p.verdict !== 'push').length;
                    const pct = tTotal > 0 ? Math.round((tCorrect / tTotal) * 100) : 0;

                    if (tTotal === 0) return null;
                    return (
                      <div key={type} className="flex items-center gap-3">
                        <span className="text-[10px] text-muted-foreground w-16 capitalize">{type}</span>
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${pct >= 60 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-400'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold w-12 text-right">{pct}%</span>
                        <span className="text-[10px] text-muted-foreground w-8 text-right">{tCorrect}/{tTotal}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        ) : null;
      })()}

      {/* Recent verifications */}
      {(verifications?.length || 0) > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-sm font-semibold text-foreground">Recent Verifications</p>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {verifications?.map((v: any) => {
                const pred = v.sbo_predictions;
                const game = pred?.sbo_games;
                const isGame = pred?.prediction_type === 'moneyline';
                const verdictBadge = v.verdict === 'correct'
                  ? { label: '✅ Correct', color: 'bg-green-500/10 text-green-600' }
                  : v.verdict === 'push'
                  ? { label: '➖ Push', color: 'bg-amber-500/10 text-amber-600' }
                  : { label: '❌ Incorrect', color: 'bg-red-500/10 text-red-600' };

                const displayLabel = isGame && game
                  ? `${game.away_team} @ ${game.home_team}`
                  : v.actual_result
                  ? v.actual_result.split(' (')[0]
                  : 'Unknown';

                return (
                  <div key={v.id} className="flex items-center justify-between p-2 rounded bg-muted/20 text-xs">
                    <div className="flex-1 min-w-0">
                      <span className="text-foreground truncate block">
                        {isGame ? '🏀' : '📊'} {displayLabel}
                      </span>
                      {isGame && v.final_score_away != null && (
                        <span className="text-muted-foreground">
                          {v.final_score_away}-{v.final_score_home}
                        </span>
                      )}
                    </div>
                    <span className="text-muted-foreground mx-2">{pred?.final_confidence || '—'}%</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap ${verdictBadge.color}`}>
                      {verdictBadge.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending predictions — mark results */}
      {(pending?.length || 0) > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Mark Results ({pending?.length} pending)
          </p>
          {pending?.map((pred: any) => {
            const label = pred.prediction_type === 'moneyline'
              ? `${pred.predicted_outcome === 'home' ? pred.sbo_games?.home_team : pred.sbo_games?.away_team} ML`
              : `${pred.sbo_player_props?.player_name} ${pred.predicted_outcome?.toUpperCase()} ${pred.sbo_player_props?.line} ${pred.sbo_player_props?.prop_type}`;

            return (
              <Card key={pred.id}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{label}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {pred.sbo_games?.away_team} @ {pred.sbo_games?.home_team} ·{' '}
                        <span className="font-bold">{pred.final_confidence}%</span>
                      </p>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0 ml-2">
                      <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 text-green-600 hover:bg-green-500/10"
                        onClick={() => markResult(pred.id, true)}
                      >
                        ✓ Win
                      </Button>
                      <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 text-red-500 hover:bg-red-500/10"
                        onClick={() => markResult(pred.id, false)}
                      >
                        ✗ Loss
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// VALUE SPOTS TAB
// ═══════════════════════════════════════════════════════════════

export function ValueSpotsTab() {
  const [comparing, setComparing] = useState(false);

  const { data: valueSpots, refetch: refetchValue } = useQuery({
    queryKey: ['value-spots'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await (supabase as any)
        .from('sbo_odds_comparison')
        .select(`*, sbo_games(home_team, away_team, game_date), sbo_player_props(player_name, prop_type, line)`)
        .eq('comparison_date', today)
        .eq('has_value', true)
        .order('edge_pct', { ascending: false });
      return data || [];
    },
    refetchInterval: 60000,
  });

  const { data: allComparisons } = useQuery({
    queryKey: ['all-comparisons-today'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await (supabase as any)
        .from('sbo_odds_comparison')
        .select('*')
        .eq('comparison_date', today)
        .order('max_divergence', { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  const runComparison = async () => {
    setComparing(true);
    try {
      const { error } = await supabase.functions.invoke('sbo-compare-odds');
      if (error) throw error;
      toast.success('Odds comparison complete');
      refetchValue();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setComparing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">💎 Value Spots</h2>
          <p className="text-xs text-muted-foreground">Where Polymarket and sportsbooks disagree by 5%+ — potential edge</p>
        </div>
        <Button size="sm" onClick={runComparison} disabled={comparing}>
          {comparing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
          Run Comparison
        </Button>
      </div>

      {!valueSpots?.length ? (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground">No value spots found yet today.</p>
            <p className="text-xs text-muted-foreground mt-1">Run Pre-Game Sync + Polymarket Sync, then click Run Comparison.</p>
          </CardContent>
        </Card>
      ) : (
        valueSpots.map((spot: any) => {
          const game = spot.sbo_games;
          const prop = spot.sbo_player_props;
          const isPolymarketHigher = spot.value_direction === 'polymarket_higher';

          return (
            <Card key={spot.id} className="border-amber-500/30">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-foreground">
                      {spot.market_type === 'player_prop' && prop
                        ? `${prop.player_name} ${spot.outcome?.toUpperCase()} ${prop.line} ${prop.prop_type}`
                        : `${game?.away_team} @ ${game?.home_team} — ${spot.outcome?.toUpperCase()} ML`}
                    </p>
                    <p className="text-xs text-muted-foreground">{game?.away_team} @ {game?.home_team}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-amber-500">+{spot.edge_pct?.toFixed(1)}%</p>
                    <p className="text-[10px] text-muted-foreground">edge</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-violet-500/10 rounded-lg p-2">
                    <p className="text-[10px] text-muted-foreground">🔮 Polymarket</p>
                    <p className="text-sm font-bold text-foreground">{spot.polymarket_prob?.toFixed(1)}%</p>
                    <p className="text-[10px] text-muted-foreground">${((spot.polymarket_volume || 0) / 1000).toFixed(0)}k vol</p>
                  </div>
                  <div className="flex items-center justify-center">
                    <div className="text-center">
                      <Badge variant={isPolymarketHigher ? 'default' : 'secondary'} className="text-[10px]">
                        {isPolymarketHigher ? 'PM ↑' : 'Books ↑'}
                      </Badge>
                      <p className="text-[10px] text-muted-foreground mt-1">{spot.edge_pct?.toFixed(1)}% gap</p>
                    </div>
                  </div>
                  <div className="bg-muted rounded-lg p-2">
                    <p className="text-[10px] text-muted-foreground">📊 Avg Books</p>
                    <p className="text-sm font-bold text-foreground">{spot.avg_sportsbook_prob?.toFixed(1)}%</p>
                    <p className="text-[10px] text-muted-foreground">DK/FD/BM/C</p>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { label: 'DK', value: spot.draftkings_prob },
                    { label: 'FD', value: spot.fanduel_prob },
                    { label: 'BetMGM', value: spot.betmgm_prob },
                    { label: 'Caesars', value: spot.caesars_prob },
                  ].map(book => (
                    <div key={book.label} className="bg-muted/50 rounded p-1.5">
                      <p className="text-[10px] text-muted-foreground">{book.label}</p>
                      <p className="text-xs font-medium text-foreground">{book.value ? `${book.value.toFixed(0)}%` : 'N/A'}</p>
                    </div>
                  ))}
                </div>

                {spot.notes && <p className="text-xs text-amber-600">{spot.notes}</p>}
              </CardContent>
            </Card>
          );
        })
      )}

      {(allComparisons?.length || 0) > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">All Markets Compared Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {allComparisons?.map((comp: any) => (
                <div key={comp.id} className="flex items-center gap-2 text-xs py-1 border-b border-border last:border-0">
                  <div className={`w-2 h-2 rounded-full ${
                    (comp.edge_pct || 0) >= 5 ? 'bg-amber-500' : (comp.edge_pct || 0) >= 2 ? 'bg-blue-500' : 'bg-muted-foreground/30'
                  }`} />
                  <span className="flex-1 text-muted-foreground">{comp.market_type} · {comp.outcome}</span>
                  <span className="text-foreground">PM: {comp.polymarket_prob?.toFixed(0) || '—'}%</span>
                  <span className="text-foreground">Books: {comp.avg_sportsbook_prob?.toFixed(0) || '—'}%</span>
                  <span className={`font-medium ${(comp.edge_pct || 0) >= 5 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                    {comp.edge_pct?.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MODEL INTELLIGENCE TAB
// ═══════════════════════════════════════════════════════════════

export function ModelIntelligenceTab() {
  const [analyzing, setAnalyzing] = useState(false);

  const { data: activeConfig, refetch: refetchConfig } = useQuery({
    queryKey: ['active-model-config'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('sbo_model_performance')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();
      return data;
    },
    refetchInterval: 60000,
  });

  const { data: weightHistory } = useQuery({
    queryKey: ['weight-history'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('sbo_weight_history')
        .select('*')
        .order('adjusted_at', { ascending: false })
        .limit(10);
      return data || [];
    },
  });

  const { data: modelHistory } = useQuery({
    queryKey: ['model-history'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('sbo_model_performance')
        .select('*')
        .order('evaluation_date', { ascending: false })
        .limit(14);
      return (data || []).reverse();
    },
  });

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sbo-analyze-model');
      if (error) throw error;

      if (data.analysis?.adjustment_applied) {
        toast.success(`Model updated — weights shifted. Accuracy: ${data.analysis.overall_accuracy.toFixed(1)}%`);
      } else if (data.success === false) {
        toast.info(data.reason || 'Need more graded predictions');
      } else {
        toast.info(`Analysis complete — weights stable. Accuracy: ${data.analysis.overall_accuracy.toFixed(1)}%`);
      }
      refetchConfig();
    } catch (e: any) {
      toast.error(e.message || 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const brainLabels: Record<string, { label: string; icon: string; color: string }> = {
    stats: { label: 'Stats Brain', icon: '📊', color: 'text-blue-500' },
    market: { label: 'Market Brain', icon: '💰', color: 'text-green-500' },
    context: { label: 'Context Brain', icon: '🧠', color: 'text-amber-500' },
    polymarket: { label: 'Polymarket Brain', icon: '🔮', color: 'text-violet-500' },
  };

  const currentWeights: Record<string, number> = {
    stats: activeConfig?.stats_weight || 0.40,
    market: activeConfig?.market_weight || 0.35,
    context: activeConfig?.context_weight || 0.25,
    polymarket: activeConfig?.polymarket_weight || 0.00,
  };

  const brainConfig = (activeConfig?.brain_config as any) || {};

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">🧬 Model Intelligence</h2>
          <p className="text-xs text-muted-foreground">Self-learning system — analyzes results and adjusts brain weights</p>
        </div>
        <Button onClick={runAnalysis} disabled={analyzing} size="sm">
          {analyzing
            ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Analyzing...</>
            : <><Brain className="h-3 w-3 mr-1" /> Run Analysis</>
          }
        </Button>
      </div>

      {/* Performance cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: 'Overall Accuracy',
            value: `${activeConfig?.accuracy_pct?.toFixed(1) || '—'}%`,
            sub: `${activeConfig?.total_predictions || 0} predictions`,
            color: (activeConfig?.accuracy_pct || 0) >= 60 ? 'text-green-500' : (activeConfig?.accuracy_pct || 0) >= 50 ? 'text-amber-500' : 'text-red-500',
          },
          {
            label: 'Calibration',
            value: `${activeConfig?.calibration_score?.toFixed(0) || '—'}`,
            sub: 'confidence vs accuracy',
            color: (activeConfig?.calibration_score || 0) >= 80 ? 'text-green-500' : 'text-amber-500',
          },
          {
            label: 'Last Analysis',
            value: activeConfig?.evaluation_date ? new Date(activeConfig.evaluation_date).toLocaleDateString() : 'Never',
            sub: 'model evaluated',
            color: 'text-foreground',
          },
        ].map(stat => (
          <Card key={stat.label}>
            <CardContent className="p-3 text-center">
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs font-medium text-foreground">{stat.label}</p>
              <p className="text-[10px] text-muted-foreground">{stat.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Current brain weights */}
      <Card>
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-sm">Current Brain Weights</CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0 space-y-3">
          {Object.entries(currentWeights).map(([brainName, weight]) => {
            const info = brainLabels[brainName];
            const pct = (weight * 100).toFixed(1);
            const analysis = brainConfig[brainName];

            return (
              <div key={brainName} className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className={`font-medium ${info.color}`}>{info.icon} {info.label}</span>
                  <div className="flex items-center gap-2">
                    {analysis?.precision && (
                      <Badge variant="outline" className="text-[9px] h-4">{analysis.precision.toFixed(0)}% precision</Badge>
                    )}
                    <span className="font-bold text-foreground">{pct}%</span>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${parseFloat(pct)}%` }} />
                </div>
                {analysis?.predictive_power !== undefined && (
                  <p className="text-[10px] text-muted-foreground">
                    Power: {analysis.predictive_power.toFixed(0)}/100 · Avg correct: {analysis.avg_score_correct?.toFixed(0)} vs wrong: {analysis.avg_score_wrong?.toFixed(0)}
                  </p>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Accuracy trend */}
      {(modelHistory?.length || 0) > 1 && (
        <Card>
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-sm">Model Accuracy Trend</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="flex items-end gap-1 h-24">
              {modelHistory?.map((config: any, i: number) => {
                const pct = config.accuracy_pct || 0;
                const height = Math.max((pct / 100) * 80, 2);
                return (
                  <div key={i} className="flex flex-col items-center flex-1 gap-0.5">
                    <span className="text-[8px] text-muted-foreground">{pct.toFixed(0)}%</span>
                    <div
                      className={`w-full rounded-t ${pct >= 60 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-400'}`}
                      style={{ height: `${height}px` }}
                      title={`${config.evaluation_date}: ${pct.toFixed(1)}%`}
                    />
                    <span className="text-[8px] text-muted-foreground">{new Date(config.evaluation_date).getDate()}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Weight adjustment history */}
      {(weightHistory?.length || 0) > 0 && (
        <Card>
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-sm">Weight Adjustment History</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 space-y-2">
            {weightHistory?.map((adj: any) => (
              <div key={adj.id} className="border border-border rounded-lg p-2 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">{new Date(adj.adjusted_at).toLocaleDateString()}</span>
                  <Badge variant="outline" className="text-[9px] h-4">{adj.auto_adjusted ? 'Auto' : 'Manual'}</Badge>
                </div>
                <div className="grid grid-cols-4 gap-1 text-center">
                  {['stats', 'market', 'context', 'polymarket'].map(brain => {
                    const before = adj[`${brain}_weight_before`] || 0;
                    const after = adj[`${brain}_weight_after`] || 0;
                    const changed = Math.abs(after - before) >= 0.005;
                    return (
                      <div key={brain}>
                        <p className="text-[9px] text-muted-foreground">{brain.slice(0, 4)}</p>
                        <p className={`text-[10px] font-medium ${changed ? 'text-amber-500' : 'text-muted-foreground'}`}>
                          {(before * 100).toFixed(0)}→{(after * 100).toFixed(0)}%
                        </p>
                      </div>
                    );
                  })}
                </div>
                {adj.reason && <p className="text-[10px] text-muted-foreground line-clamp-2">{adj.reason}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* How it works */}
      <Card className="border-muted">
        <CardContent className="p-3 space-y-1.5">
          <p className="text-xs font-medium text-foreground">How Self-Learning Works</p>
          <p className="text-[10px] text-muted-foreground">
            Run Analysis reviews all graded predictions and measures which brain was most predictive. Brains that score higher on correct predictions get more weight.
          </p>
          <p className="text-[10px] text-muted-foreground">
            Shifts are small (max 8% per cycle) so the model improves gradually. After 200+ predictions the weights will be optimized for your prediction style.
          </p>
          <p className="text-[10px] text-muted-foreground font-medium">Minimum 50 graded predictions required before weights adjust.</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MY BETS TAB — SMS Bet Tracking + P&L
// ═══════════════════════════════════════════════════════════════

export function MyBetsTab() {
  const [activeView, setActiveView] = useState<'today' | 'history' | 'bankroll' | 'saved'>('today');
  const [sendingBriefing, setSendingBriefing] = useState(false);
  const [selectedStake, setSelectedStake] = useState(10);

  const { data: todayBets } = useQuery({
    queryKey: ['my-bets-today'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await (supabase as any)
        .from('sbo_actual_bets')
        .select('*')
        .eq('bet_date', today)
        .order('created_at', { ascending: false });
      return data || [];
    },
    refetchInterval: 30000,
  });

  const { data: bankroll } = useQuery({
    queryKey: ['bankroll-latest'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('sbo_bankroll')
        .select('*')
        .order('snapshot_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    refetchInterval: 60000,
  });

  const { data: betHistory } = useQuery({
    queryKey: ['bet-history'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('sbo_actual_bets')
        .select('*')
        .not('outcome', 'eq', 'pending')
        .order('created_at', { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  const { data: briefing } = useQuery({
    queryKey: ['todays-briefing'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await (supabase as any)
        .from('sbo_daily_briefings')
        .select('*, sbo_parlay_payouts(*)')
        .eq('briefing_date', today)
        .maybeSingle();
      return data;
    },
  });

  const { data: savedPicks, refetch: refetchSaved } = useQuery({
    queryKey: ['saved-picks'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('sbo_saved_picks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      return data || [];
    },
    refetchInterval: 30000,
  });

  const updatePickResult = async (pickId: string, result: string) => {
    const { error } = await (supabase as any)
      .from('sbo_saved_picks')
      .update({ result })
      .eq('id', pickId);
    if (error) {
      toast.error('Failed to update result');
    } else {
      toast.success(`Result updated to ${result}`);
      refetchSaved();
    }
  };

  const sendBriefingNow = async () => {
    setSendingBriefing(true);
    try {
      await supabase.functions.invoke('sbo-send-daily-sms', {
        body: { date: new Date().toISOString().split('T')[0] },
      });
      toast.success('Briefing sent to your phone!');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSendingBriefing(false);
    }
  };

  const todayWagered = todayBets?.reduce((s: number, b: any) => s + (b.stake_usd || 0), 0) || 0;
  const todayWon = todayBets?.filter((b: any) => b.outcome === 'win').reduce((s: number, b: any) => s + (b.actual_payout || 0), 0) || 0;
  const todayNet = todayWon - todayWagered;
  const todayPending = todayBets?.filter((b: any) => b.outcome === 'pending').length || 0;

  const outcomeEmoji = (outcome: string) =>
    outcome === 'win' ? '🟢' : outcome === 'loss' ? '🔴' : outcome === 'push' ? '🟡' : '⏳';

  return (
    <div className="space-y-4">
      {/* SMS Briefing control */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-foreground">📱 Daily SMS Briefing</p>
              <p className="text-xs text-muted-foreground">
                {briefing?.status === 'sent'
                  ? `Sent at ${briefing.sent_at ? new Date(briefing.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}`
                  : 'Not yet sent today'}
              </p>
            </div>
            <Button size="sm" onClick={sendBriefingNow} disabled={sendingBriefing}>
              {sendingBriefing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : '📱'} Send Now
            </Button>
          </div>
          {briefing?.full_message && (
            <pre className="text-[10px] text-muted-foreground bg-muted/30 p-3 rounded-lg max-h-48 overflow-auto whitespace-pre-wrap font-mono">
              {briefing.full_message}
            </pre>
          )}
        </CardContent>
      </Card>

      {/* Today's P&L summary */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Wagered', value: `$${todayWagered.toFixed(2)}`, color: 'text-foreground' },
          { label: 'Won', value: `$${todayWon.toFixed(2)}`, color: 'text-green-500' },
          { label: 'Net', value: `${todayNet >= 0 ? '+' : ''}$${todayNet.toFixed(2)}`, color: todayNet >= 0 ? 'text-green-500' : 'text-red-500' },
          { label: 'Pending', value: String(todayPending), color: 'text-amber-500' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-3 text-center">
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* View tabs */}
      <div className="flex gap-1">
        {(['today', 'history', 'bankroll', 'saved'] as const).map(view => (
          <button
            key={view}
            onClick={() => setActiveView(view)}
            className={`text-xs px-3 py-1.5 rounded-md transition-all ${
              activeView === view
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {view === 'today' ? "📅 Today's Bets" : view === 'history' ? '📋 History' : view === 'saved' ? '⭐ Saved Picks' : '💰 Bankroll'}
          </button>
        ))}
      </div>

      {/* Today's bets */}
      {activeView === 'today' && (
        <div className="space-y-2">
          {!todayBets?.length ? (
            <div className="text-center py-8 border border-dashed rounded-lg border-border">
              <p className="text-muted-foreground font-medium">No bets recorded today.</p>
              <p className="text-xs text-muted-foreground mt-1">Text BET [amount] [pick] to your Twilio number.</p>
            </div>
          ) : (
            todayBets.map((bet: any) => (
              <Card key={bet.id}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {outcomeEmoji(bet.outcome)} {bet.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Stake: ${bet.stake_usd} · To win: ${bet.potential_payout?.toFixed(2) || '?'}
                        {bet.parlay_legs_count && ` · ${bet.parlay_legs_count}-leg parlay`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${
                        bet.outcome === 'win' ? 'text-green-500' :
                        bet.outcome === 'loss' ? 'text-red-500' :
                        bet.outcome === 'push' ? 'text-amber-500' : 'text-muted-foreground'
                      }`}>
                        {bet.outcome === 'win' ? `+$${(bet.actual_payout - bet.stake_usd).toFixed(2)}` :
                         bet.outcome === 'loss' ? `-$${bet.stake_usd.toFixed(2)}` :
                         bet.outcome === 'push' ? '$0' : 'Pending'}
                      </p>
                      {bet.outcome === 'pending' && (
                        <p className="text-[9px] text-muted-foreground">
                          Text WIN/LOSS/PUSH {bet.id.slice(-4).toUpperCase()}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Parlay payout lookup */}
      {activeView === 'today' && briefing?.sbo_parlay_payouts && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">🎯 Parlay Payouts — Today's Top Picks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">Stake $</span>
              {[5, 10, 25, 50, 100].map(s => (
                <button
                  key={s}
                  onClick={() => setSelectedStake(s)}
                  className={`text-[10px] px-2 py-1 rounded border transition-all ${
                    selectedStake === s
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/30'
                  }`}
                >
                  ${s}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {((briefing.sbo_parlay_payouts as any[]) || [])
                .sort((a: any, b: any) => a.legs_count - b.legs_count)
                .map((pp: any) => {
                  const stakeKey = `payout_${selectedStake}`;
                  const payout = pp[stakeKey] || parseFloat((selectedStake * (pp.parlay_multiplier || 1)).toFixed(2));
                  const profit = (payout - selectedStake).toFixed(0);
                  return (
                    <div key={pp.legs_count} className="text-center p-2 bg-muted/30 rounded-lg">
                      <p className="text-xs font-semibold text-foreground">{pp.legs_count}-Leg</p>
                      <p className="text-[10px] text-muted-foreground">{pp.win_probability_pct?.toFixed(1)}% win</p>
                      <p className="text-sm font-bold text-green-500 mt-1">${payout}</p>
                      <p className="text-[9px] text-muted-foreground">+${profit} profit</p>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bet history */}
      {activeView === 'history' && (
        <div className="space-y-1">
          {!betHistory?.length ? (
            <div className="text-center py-8 border border-dashed rounded-lg border-border">
              <p className="text-muted-foreground">No bet history yet.</p>
            </div>
          ) : (
            betHistory.map((bet: any) => (
              <div key={bet.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/20 text-xs">
                <span>{outcomeEmoji(bet.outcome)} {bet.description}</span>
                <span className="text-muted-foreground">${bet.stake_usd}</span>
                <span className={
                  bet.outcome === 'win' ? 'text-green-500 font-semibold' :
                  bet.outcome === 'loss' ? 'text-red-500' : 'text-amber-500'
                }>
                  {bet.outcome === 'win' ? `+$${(bet.actual_payout - bet.stake_usd).toFixed(2)}` :
                   bet.outcome === 'loss' ? `-$${bet.stake_usd.toFixed(2)}` : '$0'}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Bankroll view */}
      {activeView === 'bankroll' && (
        <div className="space-y-3">
          {!bankroll ? (
            <div className="text-center py-8 border border-dashed rounded-lg border-border">
              <p className="text-muted-foreground">No bankroll data yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Record bets and mark results to build history.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Total Wagered', value: `$${bankroll.total_wagered?.toFixed(2)}` },
                { label: 'Net P&L', value: `${(bankroll.net_profit_loss || 0) >= 0 ? '+' : ''}$${bankroll.net_profit_loss?.toFixed(2)}`, color: (bankroll.net_profit_loss || 0) >= 0 ? 'text-green-500' : 'text-red-500' },
                { label: 'ROI', value: `${(bankroll.roi_pct || 0) >= 0 ? '+' : ''}${bankroll.roi_pct?.toFixed(1)}%`, color: (bankroll.roi_pct || 0) >= 0 ? 'text-green-500' : 'text-red-500' },
                { label: 'Win Rate', value: `${bankroll.win_rate_pct?.toFixed(1)}%` },
                { label: 'Record', value: `${bankroll.win_count}W-${bankroll.loss_count}L` },
                { label: 'Biggest Win', value: `+$${bankroll.biggest_win?.toFixed(2)}`, color: 'text-green-500' },
              ].map(s => (
                <Card key={s.label}>
                  <CardContent className="p-3 text-center">
                    <p className={`text-sm font-bold ${(s as any).color || 'text-foreground'}`}>{s.value}</p>
                    <p className="text-[9px] text-muted-foreground">{s.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Saved picks view */}
      {activeView === 'saved' && (
        <div className="space-y-2">
          {/* Running P&L total */}
          {savedPicks && savedPicks.length > 0 && (() => {
            const wonPicks = savedPicks.filter((p: any) => p.result === 'won');
            const lostPicks = savedPicks.filter((p: any) => p.result === 'lost');
            const totalStaked = savedPicks.reduce((s: number, p: any) => s + (p.stake || 0), 0);
            const totalWon = wonPicks.reduce((s: number, p: any) => s + (p.potential_payout || p.stake || 0), 0);
            const totalLost = lostPicks.reduce((s: number, p: any) => s + (p.stake || 0), 0);
            const netPL = totalWon - totalLost;
            return (
              <div className="grid grid-cols-4 gap-2 mb-2">
                {[
                  { label: 'Picks', value: String(savedPicks.length), color: 'text-foreground' },
                  { label: 'Won', value: String(wonPicks.length), color: 'text-green-500' },
                  { label: 'Lost', value: String(lostPicks.length), color: 'text-red-500' },
                  { label: 'Net P&L', value: `${netPL >= 0 ? '+' : ''}$${netPL.toFixed(2)}`, color: netPL >= 0 ? 'text-green-500' : 'text-red-500' },
                ].map(s => (
                  <Card key={s.label}>
                    <CardContent className="p-2 text-center">
                      <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
                      <p className="text-[9px] text-muted-foreground">{s.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            );
          })()}

          {!savedPicks?.length ? (
            <div className="text-center py-8 border border-dashed rounded-lg border-border">
              <p className="text-muted-foreground font-medium">No saved picks yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Use the Save Pick button on any prediction to save it here.</p>
            </div>
          ) : (
            (() => {
              const grouped = savedPicks.reduce((groups: Record<string, any[]>, pick: any) => {
                const date = new Date(pick.created_at).toLocaleDateString('en-US', {
                  weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
                });
                if (!groups[date]) groups[date] = [];
                groups[date].push(pick);
                return groups;
              }, {});
              return Object.entries(grouped).map(([date, picks]: [string, any[]]) => (
                <div key={date}>
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide py-2 border-b border-border mb-2 mt-4 first:mt-0">
                    📅 {date} · {picks.length} pick{picks.length !== 1 ? 's' : ''}
                  </div>
                  {picks.map((pick: any) => {
              const resultColors: Record<string, string> = {
                pending: 'text-muted-foreground',
                won: 'text-green-500',
                lost: 'text-red-500',
                push: 'text-amber-500',
              };
              const resultEmoji: Record<string, string> = {
                pending: '🕐', won: '✅', lost: '❌', push: '➖',
              };
              const plDisplay = pick.result === 'won'
                ? `+$${(pick.potential_payout || pick.stake || 0).toFixed(2)}`
                : pick.result === 'lost'
                ? `-$${(pick.stake || 0).toFixed(2)}`
                : pick.result === 'push' ? '$0' : '';
              return (
                <Card key={pick.id}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {resultEmoji[pick.result] || '🕐'} {pick.label}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{pick.detail}</p>
                        {pick.ai_analysis && (
                          <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1">{pick.ai_analysis}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[9px] h-4">{pick.pick_type}</Badge>
                          {pick.confidence > 0 && (
                            <span className="text-[10px] text-muted-foreground">{pick.confidence}% conf</span>
                          )}
                          {pick.odds && <span className="text-[10px] font-mono text-muted-foreground">{pick.odds}</span>}
                          {plDisplay && (
                            <span className={`text-[10px] font-bold ${resultColors[pick.result] || ''}`}>{plDisplay}</span>
                          )}
                        </div>
                      </div>
                      <Select value={pick.result || 'pending'} onValueChange={(v) => updatePickResult(pick.id, v)}>
                        <SelectTrigger className={`h-7 w-24 text-xs ${resultColors[pick.result] || ''}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending" className="text-xs">🕐 Pending</SelectItem>
                          <SelectItem value="won" className="text-xs">✅ Won</SelectItem>
                          <SelectItem value="lost" className="text-xs">❌ Lost</SelectItem>
                          <SelectItem value="push" className="text-xs">➖ Push</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
                </div>
              ));
            })()
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TODAY'S GUARANTEE WIDGET
// ═══════════════════════════════════════════════════════════════

export function TodaysGuaranteeWidget() {
  const { data: plan } = useQuery({
    queryKey: ['guarantee-widget'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await (supabase as any)
        .from('sbo_daily_profit_plan')
        .select('*')
        .eq('plan_date', today)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    refetchInterval: 60000,
  });

  const { data: activeHedges } = useQuery({
    queryKey: ['active-hedges-count'],
    queryFn: async () => {
      const { count } = await (supabase as any)
        .from('sbo_hedge_engine')
        .select('*', { count: 'exact', head: true })
        .eq('result', 'pending')
        .eq('hedge_triggered', false);
      return count || 0;
    },
    refetchInterval: 30000,
  });

  if (!plan) return null;

  const status = plan.status === 'complete' ? 'PLAN COMPLETE' : (activeHedges || 0) > 0 ? 'HEDGE NEEDED' : 'ON TRACK';
  const statusColor = status === 'PLAN COMPLETE' ? 'text-emerald-500' : status === 'HEDGE NEEDED' ? 'text-destructive' : 'text-blue-500';

  return (
    <Card className="border-emerald-500/30 bg-emerald-500/5">
      <CardContent className="p-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald-500" />
            <span className="text-sm font-bold">Today's Guarantee</span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="text-center">
              <p className="font-bold text-emerald-500 text-lg">${plan.guaranteed_profit?.toFixed(2) || '0'}</p>
              <p className="text-muted-foreground">Floor</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-blue-500 text-lg">${plan.projected_profit?.toFixed(2) || '0'}</p>
              <p className="text-muted-foreground">Upside</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-foreground">{activeHedges || 0}</p>
              <p className="text-muted-foreground">Hedges Pending</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-foreground">${plan.total_capital_required?.toFixed(0) || '0'}</p>
              <p className="text-muted-foreground">Capital</p>
            </div>
            <Badge variant="outline" className={`${statusColor} border-current`}>{status}</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════

export default function SportsBettingOS() {
  const [runningAll, setRunningAll] = useState(false);
  const [verifyingResults, setVerifyingResults] = useState(false);
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [runAllPhase, setRunAllPhase] = useState('');
  const [activeTab, setActiveTab] = useState('games');

  const { data: strongCount, refetch: refetchStrong } = useQuery({
    queryKey: ['strong-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('sbo_predictions')
        .select('*', { count: 'exact', head: true })
        .in('confidence_tier', ['elite', 'strong'])
        .gte('created_at', new Date(Date.now() - 24 * 3600000).toISOString());
      return count || 0;
    },
    refetchInterval: 30000,
  });

  const { data: valueCount } = useQuery({
    queryKey: ['value-count'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { count } = await (supabase as any)
        .from('sbo_odds_comparison')
        .select('*', { count: 'exact', head: true })
        .eq('comparison_date', today)
        .eq('has_value', true);
      return count || 0;
    },
    refetchInterval: 30000,
  });

  const { data: bettorProfile } = useQuery({
    queryKey: ['bettor-profile'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('sbo_bettor_profile').select('*').limit(1).maybeSingle();
      return data;
    },
    refetchInterval: 60000,
  });

  const { data: lastRun } = useQuery({
    queryKey: ['last-engine-run'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('sbo_run_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    refetchInterval: 60000,
  });

  const runAllEngines = async () => {
    setRunningAll(true);
    const startTime = Date.now();
    let gamesCount = 0;
    let propsCount = 0;
    let predictionsCount = 0;

    try {
      // PHASE 0 — Verify yesterday's results first
      setRunAllPhase('Phase 0/6: Checking yesterday\'s results...');
      try {
        const { data: verifyData } = await supabase.functions.invoke('sbo-verify-results', { body: {} });
        if (verifyData?.verified > 0) {
          toast.success(
            `Yesterday verified: ${verifyData.correct}W - ${verifyData.incorrect}L · ${verifyData.accuracy}% accuracy`
          );
        } else if (verifyData?.message) {
          toast.info(verifyData.message);
        }
      } catch { /* continue */ }

      // PHASE 1 — Fetch tonight's games (skips if already fetched today)
      setRunAllPhase('Phase 1/6: Loading tonight\'s games...');
      const { data: oddsData } = await supabase.functions.invoke('sbo-fetch-odds');
      gamesCount = oddsData?.games_processed || 0;

      if (oddsData?.source === 'cache') {
        toast.info(`Games already loaded — using ${gamesCount} games from today`);
      } else {
        toast.success(`${gamesCount} games fetched`);
      }

      // PHASE 2 — Fetch intelligence (skips if already fetched today)
      setRunAllPhase('Phase 2/6: Loading team stats and intelligence...');
      try {
        const { data: intelData } = await supabase.functions.invoke('sbo-fetch-intelligence');
        if (intelData?.source === 'cache') {
          toast.info('Team intelligence already loaded today');
        }
      } catch { /* continue without intel */ }

      // Small wait for DB writes
      await new Promise(resolve => setTimeout(resolve, 800));

      // PHASE 3 — predict ALL games, skip none that already have predictions today
      setRunAllPhase('Phase 3/6: Running AI predictions on all games...');
      const today = new Date().toLocaleDateString('en-CA', {
        timeZone: 'America/New_York'
      });
      const raStart = `${today}T00:00:00-04:00`;
      const raEnd = `${today}T23:59:59-04:00`;

      // Get ALL today's games
      const { data: allTodayGames } = await supabase
        .from('sbo_games')
        .select('*, sbo_odds(*)')
        .gte('game_date', raStart)
        .lte('game_date', raEnd);

      console.log('Total games to process:', allTodayGames?.length);

      // Check which ones already have predictions
      const { data: existingToday } = await supabase
        .from('sbo_predictions')
        .select('game_id')
        .eq('prediction_type', 'moneyline')
        // PHASE 3 / ITEM 8 — bounded read (today's moneylines); table exceeds the 1k PostgREST default.
        .limit(2000)
        .gte('created_at', `${today}T00:00:00-04:00`);

      const predictedIds = new Set((existingToday || []).map((p: any) => p.game_id));
      const needsPrediction = (allTodayGames || []).filter((g: any) => !predictedIds.has(g.id));

      console.log('Already predicted:', predictedIds.size, 'Need prediction:', needsPrediction.length);

      if (needsPrediction.length === 0) {
        toast.info(`All ${allTodayGames?.length || 0} games already predicted today`);
      } else {
        for (let i = 0; i < needsPrediction.length; i++) {
          const g = needsPrediction[i];
          setRunAllPhase(`Phase 3/6: Predicting game ${i + 1}/${needsPrediction.length}: ${g.away_team} @ ${g.home_team}`);

          const dkOdds = g.sbo_odds?.find((o: any) =>
            o.sportsbook === 'draftkings' && o.market_type === 'moneyline'
          );
          // If no DraftKings odds try any book
          const anyOdds = dkOdds || g.sbo_odds?.[0];
          const pickHome = anyOdds
            ? Math.abs(anyOdds.home_odds) < Math.abs(anyOdds.away_odds)
            : true;

          const { error } = await supabase.functions.invoke('sbo-run-predictions', {
            body: {
              game_id: g.id,
              prediction_type: 'moneyline',
              predicted_outcome: pickHome ? 'home' : 'away',
            },
          });

          if (error) {
            console.error(`Prediction failed for ${g.home_team}:`, error);
          }

          predictionsCount++;
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        toast.success(`${predictionsCount} predictions complete`);
      }

      // PHASE 4 — props — get ALL props with no analysis today
      setRunAllPhase('Phase 4/6: Analyzing all player props...');

      const { data: allProps } = await supabase
        .from('sbo_player_props')
        .select('id, player_name')
        // PHASE 3 / ITEM 8 — bounded read (today's props); table exceeds the 1k PostgREST default.
        .limit(2000)
        .gte('created_at', `${today}T00:00:00-04:00`);

      // Check which props already have predictions
      const propIds = (allProps || []).map((p: any) => p.id);

      const { data: existingPropPreds } = await supabase
        .from('sbo_predictions')
        .select('prop_id')
        .in('prop_id', propIds.length ? propIds : ['none'])
        .gte('created_at', `${today}T00:00:00-04:00`);

      const analyzedPropIds = new Set((existingPropPreds || []).map((p: any) => p.prop_id));
      const propsNeedingAnalysis = (allProps || []).filter((p: any) => !analyzedPropIds.has(p.id));

      console.log('Props to analyze:', propsNeedingAnalysis.length);

      if (propsNeedingAnalysis.length === 0) {
        toast.info('All props already analyzed today');
      } else {
        for (let i = 0; i < propsNeedingAnalysis.length; i++) {
          setRunAllPhase(`Phase 4/6: Analyzing prop ${i + 1}/${propsNeedingAnalysis.length}: ${propsNeedingAnalysis[i].player_name}`);

          await supabase.functions.invoke('sbo-run-predictions', {
            body: {
              prop_id: propsNeedingAnalysis[i].id,
              prediction_type: 'player_prop',
              predicted_outcome: null,
            },
          });

          propsCount++;
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        toast.success(`${propsCount} props analyzed`);
      }

      // Cache player images
      try {
        await supabase.functions.invoke('sbo-cache-player-images');
      } catch { /* continue */ }

      // PHASE 5 — Build best parlay from today's top picks
      setRunAllPhase('Phase 5/6: Building best parlay...');
      try {
        const { data: existingParlay } = await supabase
          .from('sbo_parlays')
          .select('id')
          .gte('created_at', raStart)
          .maybeSingle();

        if (!existingParlay) {
          const { data: strongPreds } = await supabase
            .from('sbo_predictions')
            .select('*, sbo_games(home_team, away_team), sbo_player_props(player_name, prop_type, line, over_odds, under_odds)')
            .in('confidence_tier', ['elite', 'strong'])
            .gte('created_at', raStart)
            .order('final_confidence', { ascending: false })
            .limit(10);

          if ((strongPreds?.length || 0) >= 2) {
            const usedGames = new Set<string>();
            const legs: any[] = [];
            for (const p of strongPreds || []) {
              if (legs.length >= 3) break;
              if (p.game_id && usedGames.has(p.game_id)) continue;
              const label = p.prediction_type === 'moneyline'
                ? `${p.predicted_outcome === 'home' ? p.sbo_games?.home_team : p.sbo_games?.away_team} ML`
                : `${p.sbo_player_props?.player_name} ${p.predicted_outcome?.toUpperCase()} ${p.sbo_player_props?.line} ${p.sbo_player_props?.prop_type}`;
              legs.push({ prediction_id: p.id, label, odds: -110, confidence: p.final_confidence });
              if (p.game_id) usedGames.add(p.game_id);
            }
            if (legs.length >= 2) {
              await supabase.from('sbo_parlays').insert({
                name: `AI Best ${legs.length}-Leg — ${new Date().toLocaleDateString()}`,
                legs: legs as any,
                total_legs: legs.length,
                combined_confidence: legs.reduce((prev: number, l: any) => prev * (l.confidence / 100), 1) * 100,
                status: 'pending',
              });
              toast.success('Best parlay built from today\'s top picks');
            }
          }
        } else {
          toast.info('Parlay already built today');
        }
      } catch { /* continue */ }

      // PHASE 6 — Recalibrate model + CLV
      setRunAllPhase('Phase 6/6: Calibrating model + tracking CLV...');
      try { await supabase.functions.invoke('sbo-recalibrate'); } catch { /* continue */ }
      try { await supabase.functions.invoke('sbo-track-clv'); } catch { /* continue */ }

      // Log the run
      const duration = Date.now() - startTime;
      await (supabase as any).from('sbo_run_log').insert({
        run_type: 'full',
        started_at: new Date(startTime).toISOString(),
        completed_at: new Date().toISOString(),
        duration_ms: duration,
        games_fetched: gamesCount,
        games_predicted: predictionsCount,
        props_analyzed: propsCount,
        parlay_built: true,
        status: 'completed',
      });

      refetchStrong();
      const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
      toast.success(
        `Engine complete in ${durationSec}s — ${gamesCount} games, ${predictionsCount} new predictions, ${propsCount} props`
      );
    } catch (e: any) {
      toast.error(e.message || 'Run All Engines failed');
    } finally {
      setRunningAll(false);
      setRunAllPhase('');
    }
  };

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4">
      {/* Bettor Profile Edge Score */}
      {bettorProfile && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-3 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{bettorProfile.overall_edge_score || 0}</p>
                <p className="text-[9px] text-muted-foreground">EDGE SCORE</p>
              </div>
              <Badge variant={bettorProfile.sharp_rating === 'Elite' ? 'default' : 'secondary'} className="text-xs">
                {bettorProfile.sharp_rating === 'Elite' ? '🏆' : bettorProfile.sharp_rating === 'Sharp' ? '🎯' : bettorProfile.sharp_rating === 'Semi-Sharp' ? '📈' : '🎲'} {bettorProfile.sharp_rating || 'Recreational'}
              </Badge>
            </div>
            <div className="flex gap-4 text-xs">
              {bettorProfile.avg_clv !== null && <div className="text-center"><p className="font-mono font-bold">{bettorProfile.avg_clv > 0 ? '+' : ''}{bettorProfile.avg_clv?.toFixed(1)}%</p><p className="text-[9px] text-muted-foreground">Avg CLV</p></div>}
              {bettorProfile.roi_all_time !== null && <div className="text-center"><p className="font-mono font-bold">{bettorProfile.roi_all_time?.toFixed(1)}%</p><p className="text-[9px] text-muted-foreground">Accuracy</p></div>}
              {bettorProfile.total_units_wagered && <div className="text-center"><p className="font-mono font-bold">{bettorProfile.total_units_wagered}</p><p className="text-[9px] text-muted-foreground">Picks</p></div>}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Trophy className="h-6 w-6 text-orange-500" />
          <div>
            <h1 className="text-xl font-bold text-foreground">🧠 SBO AI Engine</h1>
            <p className="text-xs text-muted-foreground">NBA · 4-Brain AI Engine · Moneyline + Player Props</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(strongCount || 0) > 0 && (
            <Badge variant="secondary" className="text-xs">
              {strongCount} strong picks
            </Badge>
          )}
           <ActionTooltip description="Compares AI predictions against actual game results and box scores. Updates win/loss records and accuracy metrics.">
            <Button
              variant="outline"
              size="sm"
              disabled={verifyingResults}
              onClick={async () => {
                setVerifyingResults(true);
                setVerifyResult(null);
                try {
                  const { data, error } = await supabase.functions.invoke('sbo-verify-results', { body: {} });
                  if (error) throw error;
                  setVerifyResult(data);
                  const gameRecord = `${data.correct || 0}W-${data.incorrect || 0}L`;
                  const propRecord = `${data.props_correct || 0}W-${data.props_incorrect || 0}L`;
                  toast.success(`Games: ${gameRecord} (${data.accuracy || 0}%) | Props: ${propRecord} (${data.props_accuracy || 0}%)`);
                } catch (e: any) {
                  toast.error(e.message || 'Verification failed');
                } finally {
                  setVerifyingResults(false);
                }
              }}
            >
              {verifyingResults
                ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Verifying...</>
                : <><Check className="h-3 w-3 mr-1" /> 🔍 Verify Results</>
              }
            </Button>
          </ActionTooltip>
          <ActionTooltip description="Verifies yesterday's predictions against final box scores for historical accuracy tracking.">
            <Button
              variant="ghost"
              size="sm"
              disabled={verifyingResults}
              onClick={async () => {
                setVerifyingResults(true);
                setVerifyResult(null);
                try {
                  const { data, error } = await supabase.functions.invoke('sbo-verify-results', { body: { force_yesterday: true } });
                  if (error) throw error;
                  setVerifyResult(data);
                  toast.success(`Yesterday verified: ${data.correct || 0}W-${data.incorrect || 0}L`);
                } catch (e: any) {
                  toast.error(e.message || 'Verification failed');
                } finally {
                  setVerifyingResults(false);
                }
              }}
            >
              📋 Yesterday
            </Button>
          </ActionTooltip>
          <ActionTooltip description="Runs the full 6-phase pipeline: Load Games → Fetch Intelligence → Run Predictions → Analyze Props → Build Parlay → Calibrate Model. Takes ~60-90 seconds.">
            <Button onClick={runAllEngines} disabled={runningAll} size="sm">
              {runningAll
                ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> {runAllPhase || 'Running...'}</>
                : <>🚀 Run All Engines</>
              }
            </Button>
          </ActionTooltip>
          <ActionTooltip description="Clears all cached games, predictions, and intelligence for today, then re-runs the full pipeline from scratch. Use when data looks stale or corrupted.">
            <Button
              variant="outline"
              size="sm"
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
              disabled={runningAll}
              onClick={async () => {
                if (!confirm('Clear today\'s data and re-fetch everything fresh?')) return;
                const { start: frStart, end: frEnd } = getTodayETBounds();
                setRunningAll(true);
                setRunAllPhase('Clearing cached data...');
                try {
                  await supabase.from('sbo_predictions').delete().gte('created_at', frStart);
                  await supabase.from('sbo_game_intelligence').delete().gte('created_at', frStart);
                  await supabase.from('sbo_games').delete().gte('game_date', frStart).lte('game_date', frEnd);
                  localStorage.removeItem('sbo_games_loaded_today');
                  localStorage.removeItem('sbo_predictions_ran_today');
                  localStorage.removeItem('sbo_last_run_date');
                  toast.success('Cache cleared — running fresh...');
                  await runAllEngines();
                } catch (e: any) {
                  toast.error('Force refresh failed: ' + e.message);
                  setRunningAll(false);
                  setRunAllPhase('');
                }
              }}
            >
              🔄 Force Refresh
            </Button>
          </ActionTooltip>
        </div>
      </div>

      {/* Last Engine Run Display */}
      {lastRun ? (
        <div className="text-xs text-muted-foreground px-3 py-2 rounded-lg bg-muted/30 border border-border">
          <span>⚡ Last engine run: </span>
          <span className="font-medium text-foreground">
            {new Date(lastRun.created_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at {new Date(lastRun.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span> · {lastRun.games_fetched || lastRun.games_analyzed || 0} games · {lastRun.props_analyzed || 0} props · {((lastRun.duration_ms || 0) / 1000).toFixed(1)}s</span>
        </div>
      ) : (
        <div className="text-xs text-amber-500 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
          ⚠️ Engine has not been run today — press Run All Engines to load today's slate
        </div>
      )}

      {/* Verification Results Panel */}
      {verifyResult && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="font-bold text-foreground">✅ Verification Complete</div>
            <Button variant="ghost" size="sm" onClick={() => setVerifyResult(null)} className="text-xs text-muted-foreground">✕ Close</Button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-muted/30 p-3 text-center">
              <div className="text-2xl font-bold text-emerald-500">
                {verifyResult.correct || 0}W-{verifyResult.incorrect || 0}L
              </div>
              <div className="text-xs text-muted-foreground">Game Picks</div>
              <div className="text-sm font-medium text-foreground mt-1">{verifyResult.accuracy || 0}%</div>
            </div>
            <div className="rounded-lg bg-muted/30 p-3 text-center">
              <div className="text-2xl font-bold text-blue-500">
                {verifyResult.props_correct || 0}W-{verifyResult.props_incorrect || 0}L
              </div>
              <div className="text-xs text-muted-foreground">Prop Picks</div>
              <div className="text-sm font-medium text-foreground mt-1">{verifyResult.props_accuracy || 0}%</div>
            </div>
            <div className="rounded-lg bg-muted/30 p-3 text-center">
              <div className="text-2xl font-bold text-amber-500">
                {(verifyResult.correct || 0) + (verifyResult.props_correct || 0)}W-{(verifyResult.incorrect || 0) + (verifyResult.props_incorrect || 0)}L
              </div>
              <div className="text-xs text-muted-foreground">Overall</div>
              <div className="text-sm font-medium text-foreground mt-1">
                {(() => {
                  const total = (verifyResult.correct || 0) + (verifyResult.incorrect || 0) + (verifyResult.props_correct || 0) + (verifyResult.props_incorrect || 0);
                  return total > 0 ? Math.round(((verifyResult.correct || 0) + (verifyResult.props_correct || 0)) / total * 1000) / 10 : 0;
                })()}%
              </div>
            </div>
          </div>
          {(verifyResult.scores_updated || 0) > 0 && (
            <div className="mt-3 text-xs text-muted-foreground">
              🏀 {verifyResult.scores_updated} games updated with real final scores
            </div>
          )}
        </div>
      )}

      {/* Today's Guarantee Widget */}
      <TodaysGuaranteeWidget />

      {/* ═══ QUICK NAV GRID ═══ */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Quick Access</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { label: '🏀 Tonight', path: '/sbo-ai-engine/tonight' },
            { label: '💰 Bovada Hub', path: '/sbo-ai-engine/bovada' },
            { label: '🛡️ Hedge', path: '/sbo-ai-engine/hedge' },
            { label: '💎 Value', path: '/sbo-ai-engine/value' },
            { label: '📊 Accuracy', path: '/sbo-ai-engine/accuracy' },
            { label: '🧬 Model', path: '/sbo-ai-engine/model' },
            { label: '📱 My Bets', path: '/sbo-ai-engine/my-bets' },
            { label: '📱 ChingWorld', path: '/sbo-ai-engine/sms' },
            { label: '⚡ Simulation', path: '/sbo-ai-engine/simulation' },
            { label: '📜 History', path: '/sbo-ai-engine/history' },
            { label: '📋 VA Entry', path: '/sbo-ai-engine/va-entry' },
            { label: '🩺 Health', path: '/sbo-ai-engine/health' },
            { label: '⚙️ Sync', path: '/sbo-ai-engine/sync' },
          ].map(item => (
            <a
              key={item.path}
              href={item.path}
              onClick={(e) => { e.preventDefault(); window.history.pushState({}, '', item.path); window.dispatchEvent(new PopStateEvent('popstate')); }}
              className="px-3 py-2.5 rounded-lg text-sm font-medium bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-all text-center border border-border/50"
            >
              {item.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
