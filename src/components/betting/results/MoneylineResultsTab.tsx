import { useState } from 'react';
import { useMoneylineResults } from '@/hooks/useMoneylineResults';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarIcon, Lock } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { DateRange } from 'react-day-picker';

export function MoneylineResultsTab() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });

  const { results, isLoading, stats } = useMoneylineResults({
    startDate: dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : undefined,
    endDate: dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : undefined,
  });

  return (
    <div className="space-y-4">
      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div className="p-3 bg-muted/50 rounded-lg">
          <p className="text-muted-foreground">Total Settled</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        {Object.entries(stats.byDate).slice(0, 3).map(([date, count]) => (
          <div key={date} className="p-3 bg-muted/50 rounded-lg">
            <p className="text-muted-foreground">{date}</p>
            <p className="text-xl font-semibold">{count} games</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <CalendarIcon className="h-4 w-4" />
              {dateRange?.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, 'LLL dd')} - {format(dateRange.to, 'LLL dd')}
                  </>
                ) : (
                  format(dateRange.from, 'LLL dd, y')
                )
              ) : (
                'Select dates'
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={setDateRange}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>

        <Badge variant="outline" className="gap-1">
          <Lock className="h-3 w-3" />
          Settlement Mirror (Read-only)
        </Badge>
      </div>

      {/* Results List */}
      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))
        ) : results.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No settled games found for this date range
          </div>
        ) : (
          results.map((game) => (
            <div
              key={game.id}
              className="flex items-center justify-between p-4 rounded-lg border bg-card"
            >
              <div className="space-y-1">
                <div className="font-medium">
                  {game.away_team} @ {game.home_team}
                </div>
                <div className="text-sm text-muted-foreground">
                  {game.game_date} • {game.sport}
                </div>
              </div>

              <div className="text-right space-y-1">
                <div className="flex items-center gap-2 justify-end">
                  <span className="text-sm text-muted-foreground">
                    {game.away_score} - {game.home_score}
                  </span>
                  <Badge variant="default" className="bg-green-600">
                    {game.confirmed_winner} wins
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  Settled: {format(new Date(game.confirmed_at), 'MMM d, HH:mm')}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
