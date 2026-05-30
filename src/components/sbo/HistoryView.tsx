import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronLeft, ChevronRight, CalendarDays, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format, addDays, subDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isAfter, isBefore } from 'date-fns';

// Helper: get start/end of an ET day as UTC ISO strings
const getETDayBounds = (dateStr: string) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, day, 5, 0, 0));
  const end = new Date(Date.UTC(year, month - 1, day + 1, 5, 0, 0));
  return { start: start.toISOString(), end: end.toISOString() };
};

const getETDateStr = (date: Date) =>
  date.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

const getTodayET = () => getETDateStr(new Date());

export default function HistoryView() {
  const todayET = getTodayET();
  const yesterdayET = getETDateStr(subDays(new Date(), 1));

  const [selectedDate, setSelectedDate] = useState(yesterdayET);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [games, setGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [gameDatesMap, setGameDatesMap] = useState<Record<string, { total: number; correct: number; incorrect: number }>>({});

  // Parse selectedDate to Date object for calendar
  const selectedDateObj = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    return new Date(y, m - 1, d);
  }, [selectedDate]);

  const isToday = selectedDate === todayET;
  const isFuture = isAfter(selectedDateObj, new Date());

  const displayDate = format(selectedDateObj, 'EEEE, MMMM d, yyyy');

  // Load games for selected date
  const loadHistory = async (dateStr: string) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const { start, end } = getETDayBounds(dateStr);
      const { data, error } = await (supabase as any)
        .from('sbo_games')
        .select(`
          id, home_team, away_team, game_date, status,
          home_score, away_score,
          sbo_predictions(
            id, predicted_outcome, final_confidence,
            confidence_tier, prediction_type, data_quality,
            stats_brain_score, market_brain_score, context_brain_score,
            sbo_results_verification(verdict, actual_result, final_score_home, final_score_away)
          ),
          sbo_odds(sportsbook, market_type, home_odds, away_odds, home_spread, total_line)
        `)
        .gte('game_date', start)
        .lt('game_date', end)
        .order('game_date', { ascending: true });

      if (error) throw error;
      setGames(data || []);
    } catch (e: any) {
      setErrorMsg(e?.message || 'Failed to load games');
    } finally {
      setLoading(false);
    }
  };

  // Load calendar dots — dates with games and their results
  const loadCalendarDots = async () => {
    try {
      const { data } = await (supabase as any)
        .from('sbo_games')
        .select('game_date, sbo_predictions(sbo_results_verification(verdict))')
        .gte('game_date', '2026-01-01T00:00:00+00:00')
        .order('game_date', { ascending: false })
        .limit(1000);

      const map: Record<string, { total: number; correct: number; incorrect: number }> = {};
      (data || []).forEach((g: any) => {
        const dateKey = getETDateStr(new Date(g.game_date));
        if (!map[dateKey]) map[dateKey] = { total: 0, correct: 0, incorrect: 0 };
        map[dateKey].total++;
        const verdict = g.sbo_predictions?.[0]?.sbo_results_verification?.[0]?.verdict;
        if (verdict === 'correct') map[dateKey].correct++;
        else if (verdict === 'incorrect') map[dateKey].incorrect++;
      });
      setGameDatesMap(map);
    } catch (_) { /* silent */ }
  };

  const verifyDate = async () => {
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('sbo-verify-results', {
        body: { date: selectedDate },
      });
      if (error) throw error;
      toast.success(data?.message || 'Verification complete');
      await loadHistory(selectedDate);
      await loadCalendarDots();
    } catch (e: any) {
      toast.error(e?.message || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    loadHistory(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    loadCalendarDots();
  }, []);

  // Navigate date
  const goBack = () => {
    const prev = subDays(selectedDateObj, 1);
    setSelectedDate(getETDateStr(prev));
  };
  const goForward = () => {
    if (!isToday && !isFuture) {
      const next = addDays(selectedDateObj, 1);
      setSelectedDate(getETDateStr(next));
    }
  };

  // Stats for selected date
  const stats = useMemo(() => {
    let correct = 0, incorrect = 0, pending = 0, totalConf = 0, confCount = 0;
    games.forEach((g: any) => {
      const pred = g.sbo_predictions?.[0];
      const ver = pred?.sbo_results_verification?.[0];
      if (ver?.verdict === 'correct') correct++;
      else if (ver?.verdict === 'incorrect') incorrect++;
      else pending++;
      if (pred?.final_confidence) { totalConf += pred.final_confidence; confCount++; }
    });
    const total = correct + incorrect;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    const avgConf = confCount > 0 ? Math.round(totalConf / confCount) : 0;
    return { correct, incorrect, pending, total, accuracy, avgConf, gameCount: games.length };
  }, [games]);

  const accuracyColor = stats.accuracy >= 60 ? 'text-emerald-500' : stats.accuracy >= 50 ? 'text-amber-500' : 'text-destructive';

  // Calendar modifiers for dots
  const calendarModifiers = useMemo(() => {
    const winning: Date[] = [];
    const losing: Date[] = [];
    const neutral: Date[] = [];

    Object.entries(gameDatesMap).forEach(([dateStr, info]) => {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      if (info.correct > info.incorrect) winning.push(dateObj);
      else if (info.incorrect > info.correct) losing.push(dateObj);
      else neutral.push(dateObj);
    });
    return { winning, losing, neutral };
  }, [gameDatesMap]);

  // Monthly summary for calendar header
  const monthSummary = useMemo(() => {
    let correct = 0, incorrect = 0;
    Object.entries(gameDatesMap).forEach(([dateStr, info]) => {
      const [y, m] = dateStr.split('-').map(Number);
      const calMonth = selectedDateObj.getMonth() + 1;
      const calYear = selectedDateObj.getFullYear();
      if (y === calYear && m === calMonth) {
        correct += info.correct;
        incorrect += info.incorrect;
      }
    });
    const total = correct + incorrect;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    return { correct, incorrect, total, accuracy };
  }, [gameDatesMap, selectedDateObj]);

  return (
    <div className="space-y-4">
      {/* Date Navigation Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" size="icon" onClick={goBack}>
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="min-w-[260px] justify-center gap-2 text-sm font-semibold">
                  <CalendarDays className="h-4 w-4" />
                  {displayDate}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <div className="p-3 border-b border-border text-center text-xs font-medium text-muted-foreground">
                  {format(selectedDateObj, 'MMMM yyyy')} — {monthSummary.correct}W {monthSummary.incorrect}L
                  {monthSummary.total > 0 && ` — ${monthSummary.accuracy}%`}
                </div>
                <Calendar
                  mode="single"
                  selected={selectedDateObj}
                  onSelect={(d) => {
                    if (d) {
                      setSelectedDate(getETDateStr(d));
                      setCalendarOpen(false);
                    }
                  }}
                  disabled={(date) => isAfter(date, new Date())}
                  className="p-3 pointer-events-auto"
                  modifiers={calendarModifiers}
                  modifiersClassNames={{
                    winning: 'bg-emerald-500/15 text-emerald-500 font-bold',
                    losing: 'bg-destructive/15 text-destructive font-bold',
                    neutral: 'ring-1 ring-muted-foreground/30',
                  }}
                />
                {/* Quick Jump Buttons */}
                <div className="p-3 border-t border-border flex flex-wrap gap-2 justify-center">
                  <Button variant="outline" size="sm" onClick={() => { setSelectedDate(yesterdayET); setCalendarOpen(false); }}>Yesterday</Button>
                  <Button variant="outline" size="sm" onClick={() => { setSelectedDate(getETDateStr(subDays(new Date(), 7))); setCalendarOpen(false); }}>7 Days Ago</Button>
                  <Button variant="outline" size="sm" onClick={() => { setSelectedDate(getETDateStr(subDays(new Date(), 14))); setCalendarOpen(false); }}>14 Days Ago</Button>
                </div>
              </PopoverContent>
            </Popover>

            <Button variant="outline" size="icon" onClick={goForward} disabled={isToday || isFuture}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <Badge variant="outline">{stats.gameCount} games</Badge>
        {stats.total > 0 ? (
          <>
            <Badge variant="outline" className="text-emerald-500 border-emerald-500/40">✅ {stats.correct}W</Badge>
            <Badge variant="outline" className="text-destructive border-destructive/40">❌ {stats.incorrect}L</Badge>
            <Badge variant="outline" className={accuracyColor}>{stats.accuracy}% accuracy</Badge>
            <Badge variant="outline">Avg {stats.avgConf}% confidence</Badge>
          </>
        ) : stats.gameCount > 0 ? (
          <Badge variant="outline" className="text-muted-foreground">⏳ {stats.pending} pending verification</Badge>
        ) : null}

        <div className="ml-auto">
          <Button size="sm" onClick={verifyDate} disabled={verifying || loading}>
            {verifying ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verifying...</> : `⚡ Backfill & Verify ${format(selectedDateObj, 'MMM d, yyyy')}`}
          </Button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full rounded-lg" />)}
        </div>
      )}

      {/* Error */}
      {errorMsg && (
        <Alert variant="destructive">
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {/* No games */}
      {!loading && !errorMsg && games.length === 0 && (
        <div className="text-center py-10 border border-dashed rounded-lg border-border">
          <p className="text-sm text-muted-foreground">No games found for {displayDate}.</p>
          <p className="text-xs text-muted-foreground mt-1">Try another date or click Backfill to pull data.</p>
        </div>
      )}

      {/* Game Cards */}
      {!loading && games.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {games.map((game: any) => {
            const pred = game.sbo_predictions?.[0];
            const ver = pred?.sbo_results_verification?.[0];
            const verdict = ver?.verdict || 'pending';
            const homeScore = ver?.final_score_home ?? game.home_score;
            const awayScore = ver?.final_score_away ?? game.away_score;
            const hasScore = homeScore != null && awayScore != null;
            const homeWon = hasScore && homeScore > awayScore;

            const borderColor = verdict === 'correct' ? 'border-emerald-500' : verdict === 'incorrect' ? 'border-destructive' : 'border-border';

            // Odds
            const mlOdds = game.sbo_odds?.find((o: any) => o.market_type === 'h2h' || o.market_type === 'moneyline');
            const spreadOdds = game.sbo_odds?.find((o: any) => o.market_type === 'spreads' || o.market_type === 'spread');
            const totalOdds = game.sbo_odds?.find((o: any) => o.market_type === 'totals' || o.market_type === 'total');

            return (
              <Card key={game.id} className={`border-l-4 ${borderColor}`}>
                <CardContent className="p-4 space-y-3">
                  {/* Top: Teams + Score + Verdict */}
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-sm text-foreground">{game.away_team} @ {game.home_team}</p>
                      {hasScore && (
                        <p className="text-xs font-medium mt-1 text-muted-foreground">Final: {awayScore} - {homeScore}</p>
                      )}
                    </div>
                    <Badge variant="outline" className={
                      verdict === 'correct' ? 'text-emerald-500 border-emerald-500/40' :
                      verdict === 'incorrect' ? 'text-destructive border-destructive/40' :
                      'text-muted-foreground'
                    }>
                      {verdict === 'correct' ? '✅ CORRECT' : verdict === 'incorrect' ? '❌ INCORRECT' : '⏳ PENDING'}
                    </Badge>
                  </div>

                  {/* AI Prediction */}
                  {pred && (
                    <div className="rounded-lg bg-muted/30 p-3 text-xs space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">AI Predicted</span>
                        <span className="font-medium text-foreground">
                          {pred.predicted_outcome === 'home' ? game.home_team : game.away_team} ML
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Confidence</span>
                        <span className="font-medium">
                          {pred.final_confidence}% — <span className="uppercase">{pred.confidence_tier || 'N/A'}</span>
                        </span>
                      </div>

                      {/* Brain Scores */}
                      {(pred.stats_brain_score || pred.market_brain_score || pred.context_brain_score) && (
                        <div className="flex gap-3 pt-1 border-t border-border/40 mt-1">
                          {pred.stats_brain_score != null && <span>Stats: {pred.stats_brain_score}%</span>}
                          {pred.market_brain_score != null && <span>Market: {pred.market_brain_score}%</span>}
                          {pred.context_brain_score != null && <span>Context: {pred.context_brain_score}%</span>}
                        </div>
                      )}

                      {/* Actual winner */}
                      {hasScore && (
                        <div className="flex justify-between pt-1 border-t border-border/40">
                          <span className="text-muted-foreground">Actual winner</span>
                          <span className="font-medium text-emerald-500">
                            {homeWon ? game.home_team : game.away_team} won ({awayScore}-{homeScore})
                          </span>
                        </div>
                      )}

                      {/* Verdict banner */}
                      {ver && (
                        <div className={`mt-2 p-2 rounded-md text-center font-medium text-[12px] ${
                          verdict === 'correct' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-destructive/10 text-destructive'
                        }`}>
                          {verdict === 'correct'
                            ? `✅ CORRECT — Picked ${pred.predicted_outcome === 'home' ? game.home_team : game.away_team}`
                            : `❌ INCORRECT — Picked ${pred.predicted_outcome === 'home' ? game.home_team : game.away_team} but ${homeWon ? game.home_team : game.away_team} won`
                          }
                        </div>
                      )}
                    </div>
                  )}

                  {/* Odds row */}
                  {(mlOdds || spreadOdds || totalOdds) && (
                    <div className="text-xs text-muted-foreground border-t border-border/60 pt-2 flex flex-wrap gap-3">
                      {mlOdds && <span>ML: {mlOdds.away_odds}/{mlOdds.home_odds}</span>}
                      {spreadOdds && <span>Spread: {spreadOdds.home_spread}</span>}
                      {totalOdds && <span>O/U: {totalOdds.total_line}</span>}
                    </div>
                  )}

                  {!pred && (
                    <p className="text-xs text-muted-foreground text-center py-2">No prediction made</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
