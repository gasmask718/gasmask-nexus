import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Target, DollarSign, BarChart3, Zap, Flame } from 'lucide-react';
import { GlobalMetrics } from '@/hooks/useAnalyticsData';
import { format } from 'date-fns';

interface AnalyticsKPIHeaderProps {
  metrics: GlobalMetrics;
}

export function AnalyticsKPIHeader({ metrics }: AnalyticsKPIHeaderProps) {
  const formatCurrency = (value: number) => {
    const prefix = value >= 0 ? '+' : '';
    return `${prefix}$${value.toFixed(2)}`;
  };

  const formatPercent = (value: number) => {
    const prefix = value >= 0 ? '+' : '';
    return `${prefix}${value.toFixed(1)}%`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          As of {format(new Date(), 'MMM d, yyyy h:mm a')}
        </div>
      </div>
      
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {/* Total Settled Entries */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Settled Entries</CardDescription>
            <CardTitle className="text-2xl font-bold">{metrics.totalEntries}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-green-500">{metrics.wins}W</span>
              <span className="text-red-500">{metrics.losses}L</span>
              {metrics.pushes > 0 && <span className="text-amber-500">{metrics.pushes}P</span>}
            </div>
          </CardContent>
        </Card>

        {/* Win Rate */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Win Rate</CardDescription>
            <CardTitle className="text-2xl font-bold flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              {metrics.winRate.toFixed(1)}%
            </CardTitle>
          </CardHeader>
        </Card>

        {/* Total P/L */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Total P/L</CardDescription>
            <CardTitle className={`text-2xl font-bold ${metrics.totalPL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {formatCurrency(metrics.totalPL)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <DollarSign className="h-3 w-3" />
              ${metrics.totalStaked.toFixed(2)} staked
            </div>
          </CardContent>
        </Card>

        {/* ROI */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">ROI</CardDescription>
            <CardTitle className={`text-2xl font-bold flex items-center gap-2 ${metrics.roi >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {metrics.roi >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
              {formatPercent(metrics.roi)}
            </CardTitle>
          </CardHeader>
        </Card>

        {/* Avg Profit per Entry */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Avg Profit/Entry</CardDescription>
            <CardTitle className={`text-2xl font-bold ${metrics.avgProfitPerEntry >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {formatCurrency(metrics.avgProfitPerEntry)}
            </CardTitle>
          </CardHeader>
        </Card>

        {/* Max Drawdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Max Drawdown</CardDescription>
            <CardTitle className="text-2xl font-bold text-red-500">
              -${metrics.maxDrawdown.toFixed(2)}
            </CardTitle>
          </CardHeader>
        </Card>

        {/* Current Streak */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Current Streak</CardDescription>
            <CardTitle className={`text-2xl font-bold flex items-center gap-2 ${
              metrics.currentStreak.type === 'W' ? 'text-green-500' : 
              metrics.currentStreak.type === 'L' ? 'text-red-500' : 
              'text-muted-foreground'
            }`}>
              {metrics.currentStreak.type === 'W' && <Flame className="h-5 w-5" />}
              {metrics.currentStreak.count > 0 
                ? `${metrics.currentStreak.count}${metrics.currentStreak.type}`
                : '—'
              }
            </CardTitle>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
