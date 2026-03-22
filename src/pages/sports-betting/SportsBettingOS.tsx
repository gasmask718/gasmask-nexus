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
import { Loader2, RefreshCw, Plus, Save, X, TrendingUp, Trophy, Brain, Check } from 'lucide-react';
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
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════

export default function SportsBettingOS() {
  return (
    <div className="p-4 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Trophy className="h-6 w-6 text-orange-500" />
        <div>
          <h1 className="text-xl font-bold text-foreground">Sports Betting AI OS</h1>
          <p className="text-xs text-muted-foreground">3-Brain AI Prediction Engine · NBA</p>
        </div>
      </div>

      <Tabs defaultValue="games" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="games">🏀 Tonight's Games</TabsTrigger>
          <TabsTrigger value="props">📊 Player Props</TabsTrigger>
          <TabsTrigger value="entry">📝 VA Entry</TabsTrigger>
        </TabsList>

        <TabsContent value="games" className="mt-4">
          <TonightGamesTab />
        </TabsContent>

        <TabsContent value="props" className="mt-4">
          <PlayerPropsTab />
        </TabsContent>

        <TabsContent value="entry" className="mt-4">
          <VAPropEntryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
