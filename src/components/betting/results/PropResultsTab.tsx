import { useState } from 'react';
import { format, subDays } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, TrendingUp, TrendingDown, User, Lock } from 'lucide-react';
import { usePropResults } from '@/hooks/usePropResults';
import { cn } from '@/lib/utils';

const STAT_TYPES = ['All', 'PTS', 'REB', 'AST', 'PRA', '3PM', 'STL', 'BLK'];

export function PropResultsTab() {
  const [dateRange, setDateRange] = useState({
    start: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd'),
  });
  const [statFilter, setStatFilter] = useState<string>('All');

  const { results, isLoading, stats } = usePropResults({
    startDate: dateRange.start,
    endDate: dateRange.end,
    statType: statFilter === 'All' ? undefined : statFilter,
  });

  return (
    <div className="space-y-4">
      {/* Stats Header */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-muted/30 rounded-lg p-3">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total Props</div>
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
          <div className="bg-amber-500/10 rounded-lg p-3">
            <div className="text-2xl font-bold text-amber-600">{stats.dnpCount}</div>
            <div className="text-sm text-muted-foreground">DNP</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
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

        <Select value={statFilter} onValueChange={setStatFilter}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Stat Type" />
          </SelectTrigger>
          <SelectContent>
            {STAT_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
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
          No prop results found for this date range.
        </div>
      ) : (
        <div className="space-y-2">
          {results.map((prop) => (
            <div
              key={prop.id}
              className={cn(
                'p-4 rounded-lg border-l-4 bg-muted/20',
                prop.result === 'W'
                  ? 'border-l-green-500'
                  : prop.result === 'L'
                  ? 'border-l-red-500'
                  : 'border-l-yellow-500'
              )}
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span className="font-medium">{prop.player_name}</span>
                    <Badge variant="outline">{prop.stat_type}</Badge>
                    <Badge variant={prop.result === 'W' ? 'default' : prop.result === 'L' ? 'destructive' : 'secondary'}>
                      {prop.result || 'Pending'}
                    </Badge>
                    {prop.dnp && <Badge variant="outline" className="text-amber-600 border-amber-600">DNP</Badge>}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {format(new Date(prop.game_date), 'MMM d, yyyy')}
                    {prop.team && prop.opponent && ` • ${prop.team} vs ${prop.opponent}`}
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-sm">Line: {prop.line_value}</span>
                    {prop.ai_predicted_side === 'MORE' || prop.ai_predicted_side === 'OVER' ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                    <span className="font-medium">{prop.ai_predicted_side}</span>
                  </div>
                  <div className="text-sm">
                    Actual: <span className="font-bold">{prop.final_stat_value ?? '-'}</span>
                  </div>
                  {prop.confidence_score && (
                    <div className="text-xs text-muted-foreground">
                      Confidence: {(prop.confidence_score * 100).toFixed(0)}%
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
