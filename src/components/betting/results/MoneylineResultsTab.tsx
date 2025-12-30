import { useState } from 'react';
import { format, subDays } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { CalendarIcon, Trophy, Target, Lock } from 'lucide-react';
import { useMoneylineResults } from '@/hooks/useMoneylineResults';
import { cn } from '@/lib/utils';

export function MoneylineResultsTab() {
  const [dateRange, setDateRange] = useState({
    start: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd'),
  });

  const { results, isLoading, stats } = useMoneylineResults({
    startDate: dateRange.start,
    endDate: dateRange.end,
  });

  return (
    <div className="space-y-4">
      {/* Stats Header */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-muted/30 rounded-lg p-3">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total Games</div>
          </div>
          <div className="bg-green-500/10 rounded-lg p-3">
            <div className="text-2xl font-bold text-green-500">{stats.wins}</div>
            <div className="text-sm text-muted-foreground">Wins</div>
          </div>
          <div className="bg-red-500/10 rounded-lg p-3">
            <div className="text-2xl font-bold text-red-500">{stats.losses}</div>
            <div className="text-sm text-muted-foreground">Losses</div>
          </div>
          <div className="bg-primary/10 rounded-lg p-3">
            <div className="text-2xl font-bold">{stats.winRate.toFixed(1)}%</div>
            <div className="text-sm text-muted-foreground">Win Rate</div>
          </div>
        </div>
      )}

      {/* Date Filter */}
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange.start} - {dateRange.end}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={{
                from: new Date(dateRange.start),
                to: new Date(dateRange.end),
              }}
              onSelect={(range) => {
                if (range?.from && range?.to) {
                  setDateRange({
                    start: format(range.from, 'yyyy-MM-dd'),
                    end: format(range.to, 'yyyy-MM-dd'),
                  });
                }
              }}
            />
          </PopoverContent>
        </Popover>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" />
          Read-only ledger
        </div>
      </div>

      {/* Results List */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : !results?.length ? (
        <div className="py-8 text-center text-muted-foreground">
          No moneyline results found for this date range.
        </div>
      ) : (
        <div className="space-y-2">
          {results.map((game) => (
            <div
              key={game.id}
              className={cn(
                'p-4 rounded-lg border-l-4 bg-muted/20',
                game.result === 'W' ? 'border-l-green-500' : 'border-l-red-500'
              )}
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {game.away_team} @ {game.home_team}
                    </span>
                    <Badge variant={game.result === 'W' ? 'default' : 'destructive'}>
                      {game.result}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {format(new Date(game.game_date), 'MMM d, yyyy')} •{' '}
                    {game.away_score} - {game.home_score}
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <div className="flex items-center gap-1 text-sm">
                    <Target className="h-3 w-3" />
                    AI Pick: <span className="font-medium">{game.ai_predicted_winner}</span>
                  </div>
                  <div className="flex items-center gap-1 text-sm">
                    <Trophy className="h-3 w-3" />
                    Winner: <span className="font-medium">{game.actual_winner}</span>
                  </div>
                  {game.confidence_score && (
                    <div className="text-xs text-muted-foreground">
                      Confidence: {(game.confidence_score * 100).toFixed(0)}%
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
