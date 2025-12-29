import { useState, useEffect } from "react";
import { format, subDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalendarIcon, CheckCircle, XCircle, Clock, RefreshCw, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePredictionSnapshots, useAutoGenerateSnapshots } from "@/hooks/usePredictionSnapshots";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function HistoricalPredictions() {
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState({
    start: format(subDays(new Date(), 7), "yyyy-MM-dd"),
    end: format(new Date(), "yyyy-MM-dd"),
  });
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 7));
  const [endDate, setEndDate] = useState<Date>(new Date());

  const { snapshots, isLoading, refetch, stats } = usePredictionSnapshots(dateRange);
  const { autoGenerate, isGenerating } = useAutoGenerateSnapshots();

  useEffect(() => {
    setDateRange({
      start: format(startDate, "yyyy-MM-dd"),
      end: format(endDate, "yyyy-MM-dd"),
    });
  }, [startDate, endDate]);

  const handleBackfill = async () => {
    try {
      // Fetch games from nba_games_today for the last 7 days
      const { data: games, error } = await supabase
        .from("nba_games_today")
        .select("*")
        .gte("game_date", format(subDays(new Date(), 7), "yyyy-MM-dd"))
        .lte("game_date", format(new Date(), "yyyy-MM-dd"));

      if (error) throw error;

      if (!games || games.length === 0) {
        toast({
          title: "No games found",
          description: "No NBA games found in the last 7 days to backfill.",
          variant: "destructive",
        });
        return;
      }

      // Transform to expected format
      const formattedGames = games.map(g => ({
        GameID: g.game_id,
        HomeTeam: g.home_team,
        AwayTeam: g.away_team,
        HomeTeamScore: g.home_score,
        AwayTeamScore: g.away_score,
        Status: g.status,
        Day: g.game_date,
      }));

      await autoGenerate(formattedGames);
      await refetch();

      toast({
        title: "Backfill complete",
        description: `Generated snapshots for ${games.length} games.`,
      });
    } catch (error) {
      console.error("Backfill error:", error);
      toast({
        title: "Backfill failed",
        description: "Failed to generate historical snapshots.",
        variant: "destructive",
      });
    }
  };

  // Group snapshots by date
  const groupedSnapshots = snapshots?.reduce((acc, snapshot) => {
    const date = snapshot.snapshot_date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(snapshot);
    return acc;
  }, {} as Record<string, typeof snapshots>) || {};

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Historical Predictions</h3>
          <p className="text-sm text-muted-foreground">
            AI prediction accuracy over time
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Date Range Pickers */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                {format(startDate, "MMM d")} - {format(endDate, "MMM d")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <div className="flex">
                <div className="border-r p-2">
                  <p className="text-xs font-medium mb-2 px-2">Start Date</p>
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => date && setStartDate(date)}
                    initialFocus
                  />
                </div>
                <div className="p-2">
                  <p className="text-xs font-medium mb-2 px-2">End Date</p>
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => date && setEndDate(date)}
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Button
            variant="outline"
            size="sm"
            onClick={handleBackfill}
            disabled={isGenerating}
            className="gap-2"
          >
            <RefreshCw className={cn("h-4 w-4", isGenerating && "animate-spin")} />
            Backfill
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">Total Predictions</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-500">{stats.correct}</div>
              <p className="text-xs text-muted-foreground">Correct</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-red-500">{stats.incorrect}</div>
              <p className="text-xs text-muted-foreground">Incorrect</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{stats.accuracy.toFixed(1)}%</span>
              </div>
              <p className="text-xs text-muted-foreground">Accuracy</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Predictions List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Prediction History</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !snapshots || snapshots.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">No prediction snapshots found.</p>
              <Button onClick={handleBackfill} disabled={isGenerating}>
                Generate Historical Snapshots
              </Button>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-6">
                {Object.entries(groupedSnapshots)
                  .sort(([a], [b]) => b.localeCompare(a))
                  .map(([date, dateSnapshots]) => (
                    <div key={date}>
                      <h4 className="text-sm font-medium mb-3 sticky top-0 bg-background py-2">
                        {format(new Date(date), "EEEE, MMMM d, yyyy")}
                      </h4>
                      <div className="space-y-2">
                        {dateSnapshots?.map((snapshot) => (
                          <div
                            key={snapshot.id}
                            className={cn(
                              "flex items-center justify-between p-3 rounded-lg border",
                              snapshot.success === true && "border-green-500/30 bg-green-500/5",
                              snapshot.success === false && "border-red-500/30 bg-red-500/5",
                              snapshot.success === null && "border-border"
                            )}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">
                                  {snapshot.away_team} @ {snapshot.home_team}
                                </span>
                                {snapshot.is_backfilled && (
                                  <Badge variant="outline" className="text-xs">
                                    Backfilled
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                                <span>
                                  Predicted: <span className="text-foreground font-medium">{snapshot.predicted_winner}</span>
                                </span>
                                {snapshot.confidence_score && (
                                  <span>
                                    Confidence: {(snapshot.confidence_score * 100).toFixed(0)}%
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-4">
                              {snapshot.game_status === "Final" && snapshot.home_score !== null && snapshot.away_score !== null ? (
                                <div className="text-right">
                                  <div className="font-mono text-sm">
                                    {snapshot.away_score} - {snapshot.home_score}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    Winner: {snapshot.actual_winner}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-sm text-muted-foreground">
                                  {snapshot.game_status || "Scheduled"}
                                </div>
                              )}

                              {snapshot.success === true && (
                                <CheckCircle className="h-5 w-5 text-green-500" />
                              )}
                              {snapshot.success === false && (
                                <XCircle className="h-5 w-5 text-red-500" />
                              )}
                              {snapshot.success === null && (
                                <Clock className="h-5 w-5 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
