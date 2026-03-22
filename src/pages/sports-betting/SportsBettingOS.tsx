import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { Loader2, RefreshCw, Plus, Save, X, TrendingUp, Trophy, Brain, Check, Settings } from 'lucide-react';
import { toast } from 'sonner';

// ═══════════════════════════════════════════════════════════════
// TONIGHT'S GAMES TAB
// ═══════════════════════════════════════════════════════════════

function TonightGamesTab() {
  const [games, setGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingOdds, setFetchingOdds] = useState(false);

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
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Tonight's NBA Games</h2>
          <p className="text-xs text-muted-foreground">{games.length} games loaded</p>
        </div>
        <Button onClick={fetchOdds} disabled={fetchingOdds} size="sm">
          {fetchingOdds
            ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Fetching...</>
            : <><RefreshCw className="h-3 w-3 mr-1" /> Fetch Live Odds</>
          }
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-40 w-full rounded-lg" />)}
        </div>
      ) : !games.length ? (
        <div className="text-center py-12 border border-dashed rounded-lg border-border">
          <p className="text-muted-foreground font-medium">No games loaded for today.</p>
          <p className="text-xs text-muted-foreground mt-1">Click "Fetch Live Odds" to pull tonight's NBA schedule.</p>
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
        <div className="flex items-center justify-between">
          <div className="text-center flex-1">
            <p className="font-bold text-foreground">{game.away_team}</p>
            <p className="text-[10px] text-muted-foreground">Away</p>
            {dkOdds && (
              <p className={`text-sm font-mono font-bold mt-1 ${dkOdds.away_odds > 0 ? 'text-green-500' : 'text-foreground'}`}>
                {dkOdds.away_odds > 0 ? '+' : ''}{dkOdds.away_odds}
              </p>
            )}
          </div>

          <div className="text-center px-4">
            <Badge variant="outline" className="text-[10px]">
              {new Date(game.game_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Badge>
            <p className="text-xs text-muted-foreground mt-1">@</p>
          </div>

          <div className="text-center flex-1">
            <p className="font-bold text-foreground">{game.home_team}</p>
            <p className="text-[10px] text-muted-foreground">Home</p>
            {dkOdds && (
              <p className={`text-sm font-mono font-bold mt-1 ${dkOdds.home_odds > 0 ? 'text-green-500' : 'text-foreground'}`}>
                {dkOdds.home_odds > 0 ? '+' : ''}{dkOdds.home_odds}
              </p>
            )}
          </div>
        </div>

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
            <Button variant="ghost" size="sm" className="mt-2 w-full text-xs" onClick={() => setLocalPrediction(null)}>
              Run Different Prediction
            </Button>
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

  const filtered = props.filter(p => {
    if (filter === 'all') return true;
    const pred = p.sbo_predictions?.[0];
    if (filter === 'elite') return pred?.confidence_tier === 'elite';
    if (filter === 'strong') return ['elite', 'strong'].includes(pred?.confidence_tier);
    return true;
  });

  return (
    <div className="space-y-4">
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
      </div>

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
                    {onAddToParlay && ['elite', 'strong'].includes(existingPred.confidence_tier) && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="mt-2 w-full text-xs"
                        onClick={() => onAddToParlay(existingPred,
                          existingPred.predicted_outcome === 'over' ? prop.over_odds : prop.under_odds
                        )}
                      >
                        + Add to Parlay
                      </Button>
                    )}
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

  const { data: strongPredictions } = useQuery({
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

  const addLeg = (prediction: any) => {
    if (selectedLegs.find(l => l.prediction_id === prediction.id)) {
      toast.info('Already in parlay');
      return;
    }
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

    setSelectedLegs(prev => [...prev, {
      prediction_id: prediction.id,
      label,
      odds,
      confidence: prediction.final_confidence,
      tier: prediction.confidence_tier,
    }]);
    toast.success('Leg added to parlay');
  };

  const removeLeg = (id: string) => {
    setSelectedLegs(prev => prev.filter(l => l.prediction_id !== id));
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
            <p className="text-[10px] mt-1">Click picks on the left to build your parlay.</p>
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
          </>
        )}
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
// ACCURACY TAB
// ═══════════════════════════════════════════════════════════════

function AccuracyTab() {
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

  const markResult = async (predId: string, wasCorrect: boolean) => {
    await supabase
      .from('sbo_predictions')
      .update({ was_correct: wasCorrect, actual_outcome: wasCorrect ? 'correct' : 'incorrect' })
      .eq('id', predId);
    toast.success('Result recorded');
    refetchGraded();
    refetchPending();
  };

  return (
    <div className="space-y-4">
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
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════

export default function SportsBettingOS() {
  const { data: strongCount } = useQuery({
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

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Trophy className="h-6 w-6 text-orange-500" />
          <div>
            <h1 className="text-xl font-bold text-foreground">🏀 Sports Betting AI OS</h1>
            <p className="text-xs text-muted-foreground">NBA · 3-Brain AI Engine · Moneyline + Player Props</p>
          </div>
        </div>
        {(strongCount || 0) > 0 && (
          <Badge variant="secondary" className="text-xs">
            {strongCount} strong picks tonight
          </Badge>
        )}
      </div>

      <Tabs defaultValue="games" className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="games" className="text-xs">🏀 Tonight</TabsTrigger>
          <TabsTrigger value="props" className="text-xs">
            Props
            {(strongCount || 0) > 0 && (
              <Badge variant="secondary" className="ml-1 text-[9px] px-1 py-0 h-4">{strongCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="parlay" className="text-xs">🎯 Parlay</TabsTrigger>
          <TabsTrigger value="sim" className="text-xs">⚡ Simulate</TabsTrigger>
          <TabsTrigger value="accuracy" className="text-xs">📊 Accuracy</TabsTrigger>
          <TabsTrigger value="entry" className="text-xs">📋 VA Entry</TabsTrigger>
          <TabsTrigger value="sync" className="text-xs">⚙️ Sync</TabsTrigger>
        </TabsList>

        <TabsContent value="games" className="mt-4">
          <TonightGamesTab />
        </TabsContent>

        <TabsContent value="props" className="mt-4">
          <PlayerPropsTab />
        </TabsContent>

        <TabsContent value="parlay" className="mt-4">
          <ParlayBuilderTab />
        </TabsContent>

        <TabsContent value="sim" className="mt-4">
          <SimulationTab />
        </TabsContent>

        <TabsContent value="accuracy" className="mt-4">
          <AccuracyTab />
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
