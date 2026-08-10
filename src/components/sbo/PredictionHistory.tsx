import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DataQualityBadge } from '@/components/sbo/DataQualityBadge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import ParlayResultsSection from './ParlayResultsSection';

type HistoryFilter = 'all' | 'games' | 'props' | 'parlays' | 'correct' | 'incorrect' | 'pending';
type DateFilter = 'today' | 'yesterday' | '7days' | '30days' | 'alltime';

export default function PredictionHistory() {
  const [typeFilter, setTypeFilter] = useState<HistoryFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('alltime');
  const [search, setSearch] = useState('');
  const [predictions, setPredictions] = useState<any[]>([]);
  const [parlays, setParlays] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, correct: 0, incorrect: 0, pending: 0, accuracy: 0 });

  const getDateRange = () => {
    const now = new Date();
    const todayET = now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayET = yesterday.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

    switch (dateFilter) {
      case 'today': return `${todayET}T00:00:00`;
      case 'yesterday': return `${yesterdayET}T00:00:00`;
      case '7days': { const d = new Date(now); d.setDate(d.getDate() - 7); return d.toISOString(); }
      case '30days': { const d = new Date(now); d.setDate(d.getDate() - 30); return d.toISOString(); }
      case 'alltime': return '2020-01-01T00:00:00';
    }
  };

  const loadHistory = async () => {
    setLoading(true);
    try {
      const fromDate = getDateRange();

      let query = (supabase as any)
        .from('sbo_predictions')
        .select(`
          *,
          sbo_games(id, home_team, away_team, game_date, home_score, away_score, status),
          sbo_player_props(player_name, team, prop_type, line, player_image_url, actual_value, verdict),
          sbo_results_verification(verdict, actual_result, final_score_home, final_score_away, verified_at)
        `)
        .gte('created_at', fromDate)
        // PHASE 3 / ITEM 8 — bounded read (history list); table exceeds the 1k PostgREST default.
        .limit(200)
        .order('created_at', { ascending: false });

      if (typeFilter === 'games') query = query.eq('prediction_type', 'moneyline');
      if (typeFilter === 'props') query = query.eq('prediction_type', 'player_prop');
      if (typeFilter === 'correct') query = query.eq('verdict', 'correct');
      if (typeFilter === 'incorrect') query = query.eq('verdict', 'incorrect');
      if (typeFilter === 'pending') query = query.is('verdict', null);

      const { data: preds, error } = await query.limit(500);
      if (error) throw error;

      // Load parlays from both tables
      const { data: parlayData } = await (supabase as any)
        .from('sbo_parlays')
        .select('*')
        .gte('created_at', fromDate)
        .order('created_at', { ascending: false });

      const { data: builderParlays } = await (supabase as any)
        .from('sbo_parlay_builder')
        .select('*')
        .gte('created_at', fromDate)
        .order('created_at', { ascending: false });

      const filtered = (preds || []).filter((p: any) => {
        if (!search) return true;
        const home = p.sbo_games?.home_team?.toLowerCase() || '';
        const away = p.sbo_games?.away_team?.toLowerCase() || '';
        const player = p.sbo_player_props?.player_name?.toLowerCase() || '';
        return home.includes(search.toLowerCase()) || away.includes(search.toLowerCase()) || player.includes(search.toLowerCase());
      });

      const settled = filtered.filter((p: any) => p.verdict !== null);
      const correct = settled.filter((p: any) => p.verdict === 'correct').length;
      const incorrect = settled.filter((p: any) => p.verdict === 'incorrect').length;
      const accuracy = settled.length > 0 ? Math.round((correct / settled.length) * 100) : 0;

      setPredictions(filtered);
      setParlays([...(parlayData || []), ...(builderParlays || [])].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ));
      setStats({ total: filtered.length, correct, incorrect, pending: filtered.filter((p: any) => !p.verdict).length, accuracy });
    } catch (e: any) {
      toast.error('History load failed: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadHistory(); }, [typeFilter, dateFilter, search]);

  // Group by date
  const grouped = predictions.reduce((groups: Record<string, any[]>, item: any) => {
    const date = new Date(item.created_at).toLocaleDateString('en-US', {
      timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });
    if (!groups[date]) groups[date] = [];
    groups[date].push(item);
    return groups;
  }, {});

  return (
    <div className="space-y-4">
      {/* Stats summary */}
      <div className="grid grid-cols-5 gap-2">
        {[
          { label: 'Total Picks', value: stats.total, cls: 'text-foreground' },
          { label: 'Correct', value: stats.correct, cls: 'text-emerald-500' },
          { label: 'Incorrect', value: stats.incorrect, cls: 'text-destructive' },
          { label: 'Pending', value: stats.pending, cls: 'text-amber-500' },
          { label: 'Accuracy', value: `${stats.accuracy}%`, cls: stats.accuracy >= 60 ? 'text-emerald-500' : stats.accuracy >= 50 ? 'text-amber-500' : 'text-destructive' },
        ].map(s => (
          <div key={s.label} className="rounded-lg bg-muted/30 border border-border p-3 text-center">
            <p className={`text-xl font-bold ${s.cls}`}>{s.value}</p>
            <p className="text-[11px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search team or player..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-[160px] text-xs h-8"
        />
        <select
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value as DateFilter)}
          className="text-xs h-8 rounded-md border border-input bg-background px-2 text-foreground"
        >
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="7days">Last 7 days</option>
          <option value="30days">Last 30 days</option>
          <option value="alltime">All time</option>
        </select>
      </div>

      {/* Type filter pills */}
      <div className="flex flex-wrap gap-1">
        {(['all', 'games', 'props', 'parlays', 'correct', 'incorrect', 'pending'] as HistoryFilter[]).map(f => (
          <button
            key={f}
            onClick={() => setTypeFilter(f)}
            className={`px-3 py-1 rounded-full text-[11px] border transition-colors ${
              typeFilter === f
                ? 'bg-foreground text-background border-foreground font-medium'
                : 'bg-transparent text-muted-foreground border-border hover:text-foreground'
            }`}
          >
            {f === 'all' ? 'All' : f === 'games' ? '🏀 Games' : f === 'props' ? '📊 Props' : f === 'parlays' ? '🎯 Parlays' : f === 'correct' ? '✅ Correct' : f === 'incorrect' ? '❌ Incorrect' : '⏳ Pending'}
          </button>
        ))}
      </div>

      {/* Content */}
      {typeFilter === 'parlays' ? (
        <ParlayResultsSection parlays={parlays} onUpdate={loadHistory} />
      ) : loading ? (
        <div className="grid gap-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        </div>
      ) : predictions.length === 0 ? (
        <div className="text-center py-12 border border-dashed rounded-lg border-border">
          <p className="text-muted-foreground font-medium">No predictions found for selected filters</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([date, items]) => (
            <div key={date}>
              <div className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider py-2 border-b border-border mb-2 flex justify-between">
                <span>📅 {date}</span>
                <span>{(items as any[]).length} pick{(items as any[]).length !== 1 ? 's' : ''}</span>
              </div>
              <div className="space-y-2">
                {(items as any[]).map((item: any) => (
                  <PredictionHistoryRow key={item.id} prediction={item} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PredictionHistoryRow({ prediction }: { prediction: any }) {
  const game = prediction.sbo_games;
  const prop = prediction.sbo_player_props;
  const isGame = prediction.prediction_type === 'moneyline';
  const isProp = prediction.prediction_type === 'player_prop';

  const predictedTeam = isGame
    ? (prediction.predicted_outcome === 'home' ? game?.home_team : game?.away_team)
    : null;

  const hasResult = game?.home_score !== null && game?.away_score !== null && game?.home_score !== undefined;
  const actualWinner = hasResult
    ? (game.home_score > game.away_score ? game.home_team : game.away_team)
    : null;

  const verdict = prediction.verdict;

  return (
    <Card className={`${verdict === 'correct' ? 'border-emerald-500/30' : verdict === 'incorrect' ? 'border-destructive/30' : ''}`}>
      <CardContent className="p-3 flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <Badge variant="outline" className="text-[9px] h-4 px-1.5">
              {isGame ? '🏀 Game' : '📊 Prop'}
            </Badge>
            <span>
              {new Date(prediction.created_at).toLocaleTimeString('en-US', {
                timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit'
              })}
            </span>
            <DataQualityBadge quality={prediction.data_quality} compact />
          </div>

          {isGame && game && (
            <p className="text-xs font-medium text-foreground truncate">{game.away_team} @ {game.home_team}</p>
          )}
          {isProp && prop && (
            <p className="text-xs font-medium text-foreground truncate">
              {prop.player_name} — {prop.prop_type} {prediction.predicted_outcome?.toUpperCase()} {prop.line}
            </p>
          )}

          <p className="text-[11px] text-muted-foreground">
            Pick: <span className="font-medium text-foreground">{isGame ? predictedTeam : `${prediction.predicted_outcome?.toUpperCase()} ${prop?.line}`}</span>
            {' · '}{prediction.final_confidence}% confidence
          </p>

          {isGame && hasResult && (
            <p className="text-[10px] text-muted-foreground">
              Final: {game.away_team} {game.away_score} — {game.home_team} {game.home_score}
              {actualWinner && <span className="text-emerald-500 ml-1">({actualWinner} won)</span>}
            </p>
          )}

          {isProp && prop?.actual_value != null && (
            <p className="text-[10px] text-muted-foreground">
              Actual: {prop.actual_value} (line: {prop.line}) — {prop.verdict?.toUpperCase()}
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-1">
          {verdict === 'correct' && <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/40 text-[10px]">✅ WIN</Badge>}
          {verdict === 'incorrect' && <Badge className="bg-destructive/15 text-destructive border-destructive/40 text-[10px]">❌ LOSS</Badge>}
          {verdict === 'push' && <Badge variant="outline" className="text-[10px]">➖ PUSH</Badge>}
          {!verdict && <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/40">⏳</Badge>}
          <Badge variant="outline" className="text-[9px] h-4">
            {prediction.confidence_tier?.toUpperCase()}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
