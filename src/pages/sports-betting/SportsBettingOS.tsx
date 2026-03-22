import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { PredictionResult } from '@/components/sbo/PredictionResult';
import { SyncDashboard } from '@/components/sbo/SyncDashboard';
import { Loader2, RefreshCw, Plus, Save, X, TrendingUp, Trophy, Brain, Check, Settings, Bookmark, Shield } from 'lucide-react';
import { toast } from 'sonner';
import HedgeCenter from '@/pages/os/betting/HedgeCenter';

// ═══════════════════════════════════════════════════════════════
// SAVE PICK BUTTON — Reusable across all tabs
// ═══════════════════════════════════════════════════════════════

function SavePickButton({
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

function TonightGamesTab() {
  const [games, setGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingOdds, setFetchingOdds] = useState(false);
  const [predictingAll, setPredictingAll] = useState(false);
  const [predictProgress, setPredictProgress] = useState('');
  const [lastFetchTime, setLastFetchTime] = useState<string | null>(null);

  useEffect(() => { loadGames(); }, []);

  const fetchOdds = async () => {
    setFetchingOdds(true);
    try {
      const { data, error } = await supabase.functions.invoke('sbo-fetch-odds');
      if (error) throw error;
      toast.success(`Fetched ${data.games_processed} NBA games with live odds`);
      loadGames();
    } catch (e: any) {
      toast.error(e.message || 'Failed to fetch odds');
    } finally {
      setFetchingOdds(false);
    }
  };

  const loadGames = async () => {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('sbo_games')
      .select(`*, sbo_odds(*), sbo_predictions(*)`)
      .gte('game_date', today + 'T00:00:00')
      .lte('game_date', today + 'T23:59:59')
      .order('game_date');
    setGames((data as any[]) || []);
    if (data?.length) {
      setLastFetchTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
    }
    setLoading(false);
  };

  const [fetchingIntel, setFetchingIntel] = useState(false);

  const predictAllGames = async () => {
    setPredictingAll(true);
    let predicted = 0;
    try {
      // Fetch odds first if no games loaded
      if (!games.length) {
        setPredictProgress('Fetching tonight\'s games...');
        const { data, error } = await supabase.functions.invoke('sbo-fetch-odds');
        if (error) throw error;
        await loadGames();
      }

      // Fetch intelligence
      setPredictProgress('Gathering game intelligence (injuries, pace, B2B)...');
      setFetchingIntel(true);
      try {
        await supabase.functions.invoke('sbo-fetch-intelligence');
      } catch { /* continue without intel */ }
      setFetchingIntel(false);

      // Re-fetch games to get fresh list
      const today = new Date().toISOString().split('T')[0];
      const { data: freshGames } = await supabase
        .from('sbo_games')
        .select(`*, sbo_odds(*), sbo_predictions(*)`)
        .gte('game_date', today + 'T00:00:00')
        .lte('game_date', today + 'T23:59:59')
        .order('game_date');

      const gamesToPredict = (freshGames || []).filter(
        (g: any) => !g.sbo_predictions?.length
      );

      if (!gamesToPredict.length && freshGames?.length) {
        toast.info('All games already have predictions');
        await loadGames();
        return;
      }

      for (const game of gamesToPredict) {
        setPredictProgress(`Running prediction ${predicted + 1}/${gamesToPredict.length}...`);

        // Determine favorite based on odds
        const dkOdds = game.sbo_odds?.find((o: any) =>
          o.sportsbook === 'draftkings' && o.market_type === 'moneyline'
        );
        const pickHome = dkOdds ? Math.abs(dkOdds.home_odds) < Math.abs(dkOdds.away_odds) : true;

        const { data, error } = await supabase.functions.invoke('sbo-run-predictions', {
          body: {
            game_id: game.id,
            prediction_type: 'moneyline',
            predicted_outcome: pickHome ? 'home' : 'away',
          },
        });
        if (error) console.error(`Prediction failed for ${game.home_team}:`, error);
        else {
          // Auto-calculate Kelly stake
          if (data?.final_confidence && dkOdds) {
            const odds = pickHome ? dkOdds.home_odds : dkOdds.away_odds;
            const dec = odds > 0 ? 1 + odds / 100 : 1 + 100 / Math.abs(odds);
            const conf = data.final_confidence / 100;
            const kelly = ((conf * (dec - 1)) - (1 - conf)) / (dec - 1);
            const quarterKelly = Math.max(0, kelly * 0.25);
            await supabase.from('sbo_predictions').update({
              kelly_stake: Math.round(kelly * 10000) / 10000,
              recommended_units: Math.round(quarterKelly * 100) / 100,
              recommended_stake: Math.round(quarterKelly * 500 * 100) / 100, // $500 default bankroll
            }).eq('id', data.id);
          }
          predicted++;
        }
      }

      toast.success(`Tonight's predictions saved — ${predicted} games analyzed with intelligence`);
      await loadGames();
    } catch (e: any) {
      toast.error(e.message || 'Prediction run failed');
    } finally {
      setPredictingAll(false);
      setPredictProgress('');
      setFetchingIntel(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Date Banner */}
      <div className="flex items-center justify-between flex-wrap gap-2 rounded-lg border border-border bg-muted/30 px-4 py-2.5 mb-1">
        <span className="text-sm font-medium text-foreground">
          📅 {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </span>
        <div className="flex gap-4 items-center">
          <span className="text-[11px] text-muted-foreground">
            Last pulled: {lastFetchTime || 'Not yet fetched today'}
          </span>
          <span className="text-[11px] text-muted-foreground">{games.length} games loaded</span>
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold text-foreground">Tonight's NBA Games</h2>
          <p className="text-xs text-muted-foreground">{games.length} games loaded</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchOdds} disabled={fetchingOdds || predictingAll} size="sm" variant="outline">
            {fetchingOdds
              ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Fetching...</>
              : <><RefreshCw className="h-3 w-3 mr-1" /> Fetch Odds</>
            }
          </Button>
          <Button onClick={predictAllGames} disabled={predictingAll || fetchingOdds} size="sm">
            {predictingAll
              ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> {predictProgress || 'Running...'}</>
              : <><Brain className="h-3 w-3 mr-1" /> 🏀 Tonight's Games</>
            }
          </Button>
        </div>
      </div>

      {predictingAll && (
        <Alert>
          <AlertDescription className="text-xs flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            {predictProgress}
          </AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="grid gap-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-40 w-full rounded-lg" />)}
        </div>
      ) : !games.length ? (
        <div className="text-center py-12 border border-dashed rounded-lg border-border">
          <p className="text-muted-foreground font-medium">No games loaded for today.</p>
          <p className="text-xs text-muted-foreground mt-1">Click "🏀 Tonight's Games" to fetch and predict all NBA games.</p>
        </div>
      ) : (
        games.map(game => <GameCard key={game.id} game={game} onUpdate={loadGames} />)
      )}
    </div>
  );
}

function GameCard({ game, onUpdate }: { game: any; onUpdate: () => void }) {
  const [running, setRunning] = useState(false);
  const [localPrediction, setLocalPrediction] = useState<any>(
    game.sbo_predictions?.[0] || null
  );

  // Fetch game intelligence
  const { data: intel } = useQuery({
    queryKey: ['game-intel', game.game_id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('sbo_game_intelligence')
        .select('*')
        .eq('game_id', game.game_id)
        .maybeSingle();
      return data;
    },
    staleTime: 60000,
  });

  // Fetch sharp money indicators
  const { data: lineMove } = useQuery({
    queryKey: ['line-move', game.game_id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('sbo_line_movement')
        .select('*')
        .eq('game_id', game.game_id)
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
            🏀 {new Date(game.game_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · Tip {new Date(game.game_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}
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
              {new Date(game.game_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
            <PredictionResult prediction={localPrediction} />
            {/* Prediction timestamp */}
            {localPrediction.created_at && (
              <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground mt-1.5">
                <span>🧠 AI ran: {new Date(localPrediction.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at {new Date(localPrediction.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                <span>📊 {localPrediction.data_quality === 'full' ? 'Full Stats' : localPrediction.data_quality === 'partial' ? 'Partial Stats' : 'Odds Only'}</span>
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
            <div className="flex gap-2 mt-2">
              <SavePickButton
                pickType="game"
                label={`${localPrediction.predicted_outcome === 'home' ? game.home_team : game.away_team} ML`}
                detail={`${game.away_team} @ ${game.home_team}`}
                odds={dkOdds ? String(localPrediction.predicted_outcome === 'home' ? dkOdds.home_odds : dkOdds.away_odds) : ''}
                aiAnalysis={localPrediction.stats_brain_reasoning || localPrediction.market_brain_reasoning || ''}
                confidence={localPrediction.final_confidence}
                sourceTable="sbo_predictions"
                sourceId={localPrediction.id || game.id}
              />
              <Button variant="ghost" size="sm" className="text-xs flex-1" onClick={() => setLocalPrediction(null)}>
                Run Different Prediction
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

function PlayerPropsTab({ onAddToParlay }: { onAddToParlay?: (pred: any, odds: number) => void }) {
  const [props, setProps] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'strong' | 'elite'>('all');
  const [runningId, setRunningId] = useState<string | null>(null);
  const [runningAll, setRunningAll] = useState(false);
  const [allProgress, setAllProgress] = useState('');

  useEffect(() => { loadProps(); }, []);

  const loadProps = async () => {
    const { data } = await supabase
      .from('sbo_player_props')
      .select('*, sbo_games(home_team, away_team, game_date), sbo_predictions(*)')
      .order('created_at', { ascending: false });
    setProps((data as any[]) || []);
  };

  const runPropPrediction = async (prop: any, outcome: 'over' | 'under') => {
    setRunningId(prop.id);
    try {
      const { data, error } = await supabase.functions.invoke('sbo-run-predictions', {
        body: { prop_id: prop.id, prediction_type: 'player_prop', predicted_outcome: outcome },
      });
      if (error) throw error;
      toast.success(`${prop.player_name} ${outcome.toUpperCase()} — ${data.final_confidence}% (${data.confidence_tier})`);
      loadProps();
    } catch (e: any) {
      toast.error(e.message || 'Prediction failed');
    } finally {
      setRunningId(null);
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
            body: { prop_id: prop.id, prediction_type: 'player_prop', predicted_outcome: 'over' },
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

  const filtered = props.filter(p => {
    if (filter === 'all') return true;
    const pred = p.sbo_predictions?.[0];
    if (filter === 'elite') return pred?.confidence_tier === 'elite';
    if (filter === 'strong') return ['elite', 'strong'].includes(pred?.confidence_tier);
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Date Banner */}
      <div className="flex items-center justify-between flex-wrap gap-2 rounded-lg border border-border bg-muted/30 px-4 py-2.5">
        <span className="text-sm font-medium text-foreground">
          📅 {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </span>
        <span className="text-[11px] text-muted-foreground">{filtered.length} props loaded</span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {(['all', 'strong', 'elite'] as const).map(f => (
          <Button
            key={f}
            variant={filter === f ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(f)}
          >
            {f === 'elite' ? '⭐ Elite 85%+' : f === 'strong' ? '💪 Strong 70%+' : 'All Props'}
          </Button>
        ))}
        <Badge variant="secondary" className="text-xs">{filtered.length} props</Badge>
        <Button onClick={runAllProps} disabled={runningAll || !!runningId} size="sm" className="ml-auto">
          {runningAll
            ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> {allProgress || 'Running...'}</>
            : <>📊 Run Props Analysis</>
          }
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

      {!filtered.length ? (
        <div className="text-center py-12 border border-dashed rounded-lg border-border">
          <p className="text-muted-foreground font-medium">No props yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Use the VA Entry tab to add tonight's PrizePicks props.</p>
        </div>
      ) : (
        filtered.map(prop => {
          const existingPred = prop.sbo_predictions?.[0];
          const game = prop.sbo_games;
          const isRunning = runningId === prop.id;

          return (
            <Card key={prop.id}>
              <CardContent className="p-4">
                {/* Prop date & analysis timestamp */}
                <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground mb-2">
                  <span>📅 {new Date(prop.game_date || prop.created_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                  {existingPred ? (
                    <span>🧠 Analyzed: {new Date(existingPred.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                  ) : (
                    <span className="text-amber-500">⏳ Not yet analyzed</span>
                  )}
                </div>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-foreground">{prop.player_name}</p>
                    <p className="text-xs text-muted-foreground">{prop.team} · {game?.away_team} @ {game?.home_team}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-foreground">{prop.prop_type} {prop.line}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">
                      O: {prop.over_odds > 0 ? '+' : ''}{prop.over_odds} / U: {prop.under_odds > 0 ? '+' : ''}{prop.under_odds}
                    </p>
                  </div>
                </div>

                {!existingPred ? (
                  <div className="flex gap-2 mt-3">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => runPropPrediction(prop, 'over')} disabled={isRunning}>
                      {isRunning ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <span className="mr-1">🧠</span>} OVER
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => runPropPrediction(prop, 'under')} disabled={isRunning}>
                      {isRunning ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <span className="mr-1">🧠</span>} UNDER
                    </Button>
                  </div>
                ) : (
                  <>
                    <PredictionResult prediction={existingPred} />
                    <div className="flex gap-2 mt-2">
                      <SavePickButton
                        pickType="prop"
                        label={`${prop.player_name} ${existingPred.predicted_outcome?.toUpperCase()} ${prop.line} ${prop.prop_type}`}
                        detail={`${game?.away_team} @ ${game?.home_team}`}
                        odds={String(existingPred.predicted_outcome === 'over' ? prop.over_odds : prop.under_odds)}
                        aiAnalysis={existingPred.stats_brain_reasoning || existingPred.context_brain_reasoning || ''}
                        confidence={existingPred.final_confidence}
                        sourceTable="sbo_predictions"
                        sourceId={existingPred.id}
                      />
                      {onAddToParlay && ['elite', 'strong'].includes(existingPred.confidence_tier) && (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="flex-1 text-xs"
                          onClick={() => onAddToParlay(existingPred,
                            existingPred.predicted_outcome === 'over' ? prop.over_odds : prop.under_odds
                          )}
                        >
                          + Add to Parlay
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// VA PROP ENTRY TAB
// ═══════════════════════════════════════════════════════════════

function AutoPopulatedPropsNotice({ date }: { date: string }) {
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

function VAPropEntryTab() {
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
// PARLAY BUILDER TAB
// ═══════════════════════════════════════════════════════════════

function ParlayBuilderTab() {
  const [selectedLegs, setSelectedLegs] = useState<any[]>([]);
  const [stake, setStake] = useState<number>(10);
  const [parlayName, setParlayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [autoBuilding, setAutoBuilding] = useState(false);

  const { data: strongPredictions, refetch: refetchStrong } = useQuery({
    queryKey: ['strong-predictions'],
    queryFn: async () => {
      const { data } = await supabase
        .from('sbo_predictions')
        .select(`
          *,
          sbo_games(home_team, away_team, game_date),
          sbo_player_props(player_name, prop_type, line, over_odds, under_odds)
        `)
        .in('confidence_tier', ['elite', 'strong'])
        .gte('created_at', new Date(Date.now() - 24 * 3600000).toISOString())
        .order('final_confidence', { ascending: false });
      return (data as any[]) || [];
    },
    refetchInterval: 30000,
  });

  const buildLegFromPred = (prediction: any) => {
    const odds = prediction.prediction_type === 'moneyline'
      ? -110
      : (prediction.predicted_outcome === 'over'
          ? prediction.sbo_player_props?.over_odds
          : prediction.sbo_player_props?.under_odds) || -120;

    const label = prediction.prediction_type === 'moneyline'
      ? `${prediction.predicted_outcome === 'home'
          ? prediction.sbo_games?.home_team
          : prediction.sbo_games?.away_team} ML`
      : `${prediction.sbo_player_props?.player_name} ${prediction.predicted_outcome?.toUpperCase()} ${prediction.sbo_player_props?.line} ${prediction.sbo_player_props?.prop_type}`;

    return {
      prediction_id: prediction.id,
      label,
      odds,
      confidence: prediction.final_confidence,
      tier: prediction.confidence_tier,
    };
  };

  const addLeg = (prediction: any) => {
    if (selectedLegs.find(l => l.prediction_id === prediction.id)) {
      toast.info('Already in parlay');
      return;
    }
    setSelectedLegs(prev => [...prev, buildLegFromPred(prediction)]);
    toast.success('Leg added to parlay');
  };

  const removeLeg = (id: string) => {
    setSelectedLegs(prev => prev.filter(l => l.prediction_id !== id));
  };

  // AI Auto-Build: pick top 3 non-correlated legs
  const autoBuildParlay = async () => {
    setAutoBuilding(true);
    try {
      if (!strongPredictions?.length) {
        toast.error('No strong predictions available. Run predictions first.');
        return;
      }

      // Pick top 3 predictions from different games for non-correlation
      const usedGameIds = new Set<string>();
      const bestLegs: any[] = [];

      for (const pred of strongPredictions) {
        const gameId = pred.game_id;
        if (usedGameIds.has(gameId) && bestLegs.length < 5) continue; // allow some from same game after 3
        if (bestLegs.length >= 3) break;

        bestLegs.push(buildLegFromPred(pred));
        if (gameId) usedGameIds.add(gameId);
      }

      if (bestLegs.length < 2) {
        toast.error('Not enough diverse predictions for a parlay');
        return;
      }

      setSelectedLegs(bestLegs);
      setParlayName(`AI Best ${bestLegs.length}-Leg Parlay — ${new Date().toLocaleDateString()}`);
      toast.success(`AI built ${bestLegs.length}-leg parlay from top picks`);
    } finally {
      setAutoBuilding(false);
    }
  };

  // Save parlay to DB
  const saveParlay = async () => {
    if (selectedLegs.length < 2) {
      toast.error('Add at least 2 legs to save');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('sbo_parlays').insert({
        name: parlayName || `${selectedLegs.length}-Leg Parlay`,
        legs: selectedLegs as any,
        total_legs: selectedLegs.length,
        suggested_stake: stake,
        combined_confidence: combinedProb,
        expected_value: potentialPayout - stake,
        status: 'pending',
      });
      if (error) throw error;
      toast.success('Parlay saved successfully!');
    } catch (e: any) {
      toast.error(e.message || 'Failed to save parlay');
    } finally {
      setSaving(false);
    }
  };

  const combinedProb = selectedLegs.length > 0
    ? selectedLegs.reduce((p, leg) => p * (leg.confidence / 100), 1) * 100
    : 0;

  const parlayMultiplier = selectedLegs.reduce((m, leg) => {
    const decimal = leg.odds > 0
      ? (leg.odds / 100) + 1
      : (100 / Math.abs(leg.odds)) + 1;
    return m * decimal;
  }, 1);

  const potentialPayout = parseFloat((stake * parlayMultiplier).toFixed(2));

  return (
    <div className="space-y-4">
      {/* Date Banner */}
      <div className="flex items-center justify-between flex-wrap gap-2 rounded-lg border border-border bg-muted/30 px-4 py-2.5 mb-1">
        <span className="text-sm font-medium text-foreground">
          📅 {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </span>
      </div>

      {/* AI Build button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">🎯 Parlay Builder</h2>
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
        {/* LEFT — Available strong predictions */}
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
                    isAdded
                      ? 'border-primary/60 bg-primary/5'
                      : 'hover:border-primary/30 hover:bg-muted/30'
                  }`}
                  onClick={() => !isAdded && addLeg(pred)}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium flex-1 truncate">{label}</p>
                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                        pred.confidence_tier === 'elite'
                          ? 'bg-green-500/20 text-green-600'
                          : 'bg-blue-500/20 text-blue-600'
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

        {/* RIGHT — Parlay legs + controls */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Your Parlay ({selectedLegs.length} legs)
          </p>

          <div>
            <Label className="text-xs">Parlay Name (optional)</Label>
            <Input
              value={parlayName}
              onChange={e => setParlayName(e.target.value)}
              placeholder="Tonight's 3-leg NBA parlay"
              className="h-7 text-xs mt-1"
            />
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
                  </div>
                  <Button
                    size="icon" variant="ghost" className="w-6 h-6 flex-shrink-0"
                    onClick={() => removeLeg(leg.prediction_id)}
                  >
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
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Label className="text-xs flex-shrink-0">Stake $</Label>
                <Input
                  type="number"
                  value={stake}
                  onChange={e => setStake(Number(e.target.value))}
                  className="h-7 text-xs w-24"
                  min={1}
                />
                {[5, 10, 25, 50, 100].map(s => (
                  <button
                    key={s}
                    onClick={() => setStake(s)}
                    className={`text-[10px] px-1.5 py-1 rounded border transition-all ${
                      stake === s ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/30'
                    }`}
                  >
                    ${s}
                  </button>
                ))}
              </div>

              {/* Save Parlay Button */}
              <Button onClick={saveParlay} disabled={saving} size="sm" className="w-full">
                {saving
                  ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Saving...</>
                  : <><Save className="h-3 w-3 mr-1" /> Save Parlay</>
                }
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SIMULATION TAB
// ═══════════════════════════════════════════════════════════════

function SimulationTab() {
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

function AccuracyHistoryWidget() {
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

function AccuracyTab() {
  const [verifying, setVerifying] = useState(false);
  const [verifyProgress, setVerifyProgress] = useState('');
  const queryClient = useQueryClient();

  const { data: predictions, refetch: refetchGraded } = useQuery({
    queryKey: ['all-predictions-accuracy'],
    queryFn: async () => {
      const { data } = await supabase
        .from('sbo_predictions')
        .select('*')
        .not('was_correct', 'is', null)
        .order('created_at', { ascending: false })
        .limit(200);
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
        .is('was_correct', null)
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

  const total = predictions?.length || 0;
  const correct = predictions?.filter(p => p.was_correct).length || 0;
  const accuracy = total > 0 ? ((correct / total) * 100).toFixed(1) : '0';

  const byTier = ['elite', 'strong', 'moderate', 'weak'].map(tier => {
    const tierPreds = predictions?.filter(p => p.confidence_tier === tier) || [];
    const tierCorrect = tierPreds.filter(p => p.was_correct).length;
    return {
      tier,
      total: tierPreds.length,
      correct: tierCorrect,
      accuracy: tierPreds.length > 0
        ? ((tierCorrect / tierPreds.length) * 100).toFixed(1)
        : 'N/A',
    };
  });

  // Accuracy by confidence band
  const byConfidenceBand = [
    { label: '55-65%', min: 55, max: 65 },
    { label: '65-75%', min: 65, max: 75 },
    { label: '75-90%', min: 75, max: 90 },
    { label: '90%+', min: 90, max: 100 },
  ].map(band => {
    const inBand = predictions?.filter(p => {
      const conf = p.final_confidence || 0;
      return conf >= band.min && conf < (band.max === 100 ? 101 : band.max);
    }) || [];
    const wins = inBand.filter(p => p.was_correct).length;
    return {
      ...band,
      total: inBand.length,
      wins,
      accuracy: inBand.length > 0 ? ((wins / inBand.length) * 100).toFixed(1) : 'N/A',
    };
  });

  const markResult = async (predId: string, wasCorrect: boolean) => {
    await supabase
      .from('sbo_predictions')
      .update({ was_correct: wasCorrect, actual_outcome: wasCorrect ? 'correct' : 'incorrect' })
      .eq('id', predId);
    toast.success('Result recorded');
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
        `${data.verified} predictions verified — ${data.accuracy}% accuracy today`
      );
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
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Graded', value: total, color: 'text-foreground' },
          { label: 'Correct', value: correct, color: 'text-green-500' },
          { label: 'Accuracy', value: `${accuracy}%`, color: parseFloat(accuracy) >= 55 ? 'text-green-500' : 'text-amber-500' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-3 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

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

      {/* Recent verifications */}
      {(verifications?.length || 0) > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-sm font-semibold text-foreground">Recent Verifications</p>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {verifications?.map((v: any) => {
                const game = v.sbo_predictions?.sbo_games;
                const verdictBadge = v.verdict === 'correct'
                  ? { label: '✅ Correct', color: 'bg-green-500/10 text-green-600' }
                  : v.verdict === 'push'
                  ? { label: '➖ Push', color: 'bg-amber-500/10 text-amber-600' }
                  : { label: '❌ Incorrect', color: 'bg-red-500/10 text-red-600' };

                return (
                  <div key={v.id} className="flex items-center justify-between p-2 rounded bg-muted/20 text-xs">
                    <div className="flex-1 min-w-0">
                      <span className="text-foreground truncate">
                        {game ? `${game.away_team} @ ${game.home_team}` : 'Game'}
                      </span>
                      <span className="text-muted-foreground ml-2">
                        {v.final_score_away}-{v.final_score_home}
                      </span>
                    </div>
                    <span className="text-muted-foreground mx-2">{v.our_confidence}%</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${verdictBadge.color}`}>
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

function ValueSpotsTab() {
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

function ModelIntelligenceTab() {
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

function MyBetsTab() {
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

function TodaysGuaranteeWidget() {
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
  const [runAllPhase, setRunAllPhase] = useState('');

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
      // PHASE 0 — Verify last night's results first
      setRunAllPhase('Phase 0/6: Verifying last night\'s results...');
      try {
        const { data: verifyData } = await supabase.functions.invoke('sbo-verify-results', { body: {} });
        if (verifyData?.verified > 0) {
          toast.info(`${verifyData.verified} results verified — ${verifyData.accuracy}% accuracy`);
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

      // PHASE 3 — Run predictions (skips games already predicted today)
      setRunAllPhase('Phase 3/6: Running AI predictions...');
      const today = new Date().toISOString().split('T')[0];

      const { data: allGames } = await supabase
        .from('sbo_games')
        .select('*, sbo_odds(*)')
        .gte('game_date', today + 'T00:00:00')
        .lte('game_date', today + 'T23:59:59');

      // Check which games already have predictions today
      const { data: existingPreds } = await supabase
        .from('sbo_predictions')
        .select('game_id')
        .eq('prediction_type', 'moneyline')
        .gte('created_at', `${today}T00:00:00`);

      const predictedGameIds = new Set((existingPreds || []).map((p: any) => p.game_id));
      const unpredictedGames = (allGames || []).filter((g: any) => !predictedGameIds.has(g.id));

      if (unpredictedGames.length === 0) {
        toast.info('All games already predicted today — loading existing results');
      } else {
        for (let i = 0; i < unpredictedGames.length; i++) {
          setRunAllPhase(`Phase 3/6: Predicting game ${i + 1}/${unpredictedGames.length}...`);
          const g = unpredictedGames[i];
          const dkOdds = g.sbo_odds?.find((o: any) => o.sportsbook === 'draftkings' && o.market_type === 'moneyline');
          const pickHome = dkOdds ? Math.abs(dkOdds.home_odds) < Math.abs(dkOdds.away_odds) : true;

          await supabase.functions.invoke('sbo-run-predictions', {
            body: { game_id: g.id, prediction_type: 'moneyline', predicted_outcome: pickHome ? 'home' : 'away' },
          }).catch(() => {});
          predictionsCount++;
          await new Promise(resolve => setTimeout(resolve, 400));
        }
      }

      // PHASE 4 — Run props (skips props already analyzed today)
      setRunAllPhase('Phase 4/6: Analyzing player props...');
      const { data: unanalyzedProps } = await supabase
        .from('sbo_player_props')
        .select('id')
        .gte('created_at', `${today}T00:00:00`);

      // Check which props already have predictions
      const propIds = (unanalyzedProps || []).map((p: any) => p.id);
      const { data: existingPropPreds } = await supabase
        .from('sbo_predictions')
        .select('prop_id')
        .in('prop_id', propIds.length ? propIds : ['none'])
        .gte('created_at', `${today}T00:00:00`);

      const analyzedPropIds = new Set((existingPropPreds || []).map((p: any) => p.prop_id));
      const propsToAnalyze = (unanalyzedProps || []).filter((p: any) => !analyzedPropIds.has(p.id));

      if (!propsToAnalyze.length) {
        toast.info('All props already analyzed today');
      } else {
        for (let i = 0; i < propsToAnalyze.length; i++) {
          setRunAllPhase(`Phase 4/6: Analyzing prop ${i + 1}/${propsToAnalyze.length}...`);
          await supabase.functions.invoke('sbo-run-predictions', {
            body: { prop_id: propsToAnalyze[i].id, prediction_type: 'player_prop', predicted_outcome: 'over' },
          }).catch(() => {});
          propsCount++;
          await new Promise(resolve => setTimeout(resolve, 400));
        }
      }

      // PHASE 5 — Build best parlay from today's top picks
      setRunAllPhase('Phase 5/6: Building best parlay...');
      try {
        const { data: existingParlay } = await supabase
          .from('sbo_parlays')
          .select('id')
          .gte('created_at', `${today}T00:00:00`)
          .maybeSingle();

        if (!existingParlay) {
          const { data: strongPreds } = await supabase
            .from('sbo_predictions')
            .select('*, sbo_games(home_team, away_team), sbo_player_props(player_name, prop_type, line, over_odds, under_odds)')
            .in('confidence_tier', ['elite', 'strong'])
            .gte('created_at', `${today}T00:00:00`)
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
            <h1 className="text-xl font-bold text-foreground">🏀 Sports Betting AI OS</h1>
            <p className="text-xs text-muted-foreground">NBA · 4-Brain AI Engine · Moneyline + Player Props</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(strongCount || 0) > 0 && (
            <Badge variant="secondary" className="text-xs">
              {strongCount} strong picks
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={verifyingResults}
            onClick={async () => {
              setVerifyingResults(true);
              try {
                const { data, error } = await supabase.functions.invoke('sbo-verify-results', { body: {} });
                if (error) throw error;
                toast.success(`${data.verified} verified — ${data.accuracy}% accuracy`);
              } catch (e: any) {
                toast.error(e.message || 'Verification failed');
              } finally {
                setVerifyingResults(false);
              }
            }}
          >
            {verifyingResults
              ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Verifying...</>
              : <><Check className="h-3 w-3 mr-1" /> Verify Results</>
            }
          </Button>
          <Button onClick={runAllEngines} disabled={runningAll} size="sm">
            {runningAll
              ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> {runAllPhase || 'Running...'}</>
              : <>🚀 Run All Engines</>
            }
          </Button>
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

      {/* Today's Guarantee Widget */}
      <TodaysGuaranteeWidget />

      <Tabs defaultValue="games" className="w-full">
        <TabsList className="grid w-full grid-cols-11">
          <TabsTrigger value="games" className="text-xs">🏀 Tonight</TabsTrigger>
          <TabsTrigger value="props" className="text-xs">
            Props
            {(strongCount || 0) > 0 && (
              <Badge variant="secondary" className="ml-1 text-[9px] px-1 py-0 h-4">{strongCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="value" className="text-xs">
            💎 Value
            {(valueCount || 0) > 0 && (
              <Badge variant="secondary" className="ml-1 text-[9px] px-1 py-0 h-4">{valueCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="parlay" className="text-xs">🎯 Parlay</TabsTrigger>
          <TabsTrigger value="hedge" className="text-xs">🔒 Hedge</TabsTrigger>
          <TabsTrigger value="sim" className="text-xs">⚡ Sim</TabsTrigger>
          <TabsTrigger value="accuracy" className="text-xs">📊 Accuracy</TabsTrigger>
          <TabsTrigger value="model" className="text-xs">🧬 Model</TabsTrigger>
          <TabsTrigger value="mybets" className="text-xs">📱 My Bets</TabsTrigger>
          <TabsTrigger value="entry" className="text-xs">📋 VA Entry</TabsTrigger>
          <TabsTrigger value="sync" className="text-xs">⚙️ Sync</TabsTrigger>
        </TabsList>

        <TabsContent value="games" className="mt-4">
          <TonightGamesTab />
        </TabsContent>

        <TabsContent value="props" className="mt-4">
          <PlayerPropsTab />
        </TabsContent>

        <TabsContent value="value" className="mt-4">
          <ValueSpotsTab />
        </TabsContent>

        <TabsContent value="parlay" className="mt-4">
          <ParlayBuilderTab />
        </TabsContent>

        <TabsContent value="hedge" className="mt-4">
          <HedgeCenter />
        </TabsContent>

        <TabsContent value="sim" className="mt-4">
          <SimulationTab />
        </TabsContent>

        <TabsContent value="accuracy" className="mt-4">
          <AccuracyTab />
        </TabsContent>

        <TabsContent value="model" className="mt-4">
          <ModelIntelligenceTab />
        </TabsContent>

        <TabsContent value="mybets" className="mt-4">
          <MyBetsTab />
        </TabsContent>

        <TabsContent value="entry" className="mt-4">
          <VAPropEntryTab />
        </TabsContent>

        <TabsContent value="sync" className="mt-4">
          <SyncDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
