import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target, TrendingUp, BarChart3, Percent, Gauge, Flame, Calendar } from 'lucide-react';
import { AccuracyMetrics } from '@/hooks/useAccuracyMetrics';
import { format } from 'date-fns';

interface AccuracyKPICardsProps {
  metrics: AccuracyMetrics;
  last7Days: { total: number; wins: number; losses: number; winRate: number } | null;
}

export function AccuracyKPICards({ metrics, last7Days }: AccuracyKPICardsProps) {
  const getWinRateColor = (rate: number) => {
    if (rate >= 60) return 'text-green-500';
    if (rate >= 55) return 'text-emerald-500';
    if (rate >= 50) return 'text-amber-500';
    return 'text-red-500';
  };

  const getBrierScoreQuality = (score: number) => {
    if (score < 0.2) return { label: 'Excellent', color: 'default' };
    if (score < 0.25) return { label: 'Good', color: 'secondary' };
    if (score < 0.3) return { label: 'Fair', color: 'outline' };
    return { label: 'Poor', color: 'destructive' };
  };

  const brierQuality = getBrierScoreQuality(metrics.brierScore);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          Last updated: {format(new Date(), 'MMM d, yyyy h:mm a')}
        </div>
      </div>
      
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {/* Total Settled */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Total Settled</CardDescription>
            <CardTitle className="text-2xl font-bold">{metrics.totalSettled}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{metrics.totalWithPredictions} with predictions</span>
            </div>
          </CardContent>
        </Card>

        {/* Win Rate */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Win Rate (All-Time)</CardDescription>
            <CardTitle className={`text-2xl font-bold flex items-center gap-2 ${getWinRateColor(metrics.winRate)}`}>
              <Target className="h-5 w-5" />
              {metrics.winRate.toFixed(1)}%
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-green-500">{metrics.wins}W</span>
              <span className="text-red-500">{metrics.losses}L</span>
            </div>
          </CardContent>
        </Card>

        {/* Last 7 Days */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Last 7 Days
            </CardDescription>
            <CardTitle className={`text-2xl font-bold ${last7Days && last7Days.winRate > 0 ? getWinRateColor(last7Days.winRate) : 'text-muted-foreground'}`}>
              {last7Days ? `${last7Days.winRate.toFixed(1)}%` : '—'}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {last7Days && last7Days.total > 0 ? (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-green-500">{last7Days.wins}W</span>
                <span className="text-red-500">{last7Days.losses}L</span>
                <span className="text-muted-foreground">({last7Days.total} picks)</span>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">No recent picks</span>
            )}
          </CardContent>
        </Card>

        {/* Avg Confidence */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Avg Confidence</CardDescription>
            <CardTitle className="text-2xl font-bold flex items-center gap-2">
              <Gauge className="h-5 w-5 text-primary" />
              {metrics.avgConfidence.toFixed(1)}%
            </CardTitle>
          </CardHeader>
        </Card>

        {/* Avg Probability */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Avg Probability</CardDescription>
            <CardTitle className="text-2xl font-bold flex items-center gap-2">
              <Percent className="h-5 w-5 text-primary" />
              {metrics.avgProbability.toFixed(1)}%
            </CardTitle>
          </CardHeader>
        </Card>

        {/* Brier Score */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Brier Score</CardDescription>
            <CardTitle className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              {metrics.brierScore.toFixed(3)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Badge variant={brierQuality.color as any} className="text-[10px] px-1.5 py-0">
              {brierQuality.label}
            </Badge>
          </CardContent>
        </Card>

        {/* No Prediction */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">No Prediction</CardDescription>
            <CardTitle className="text-2xl font-bold text-muted-foreground">
              {metrics.noPrediction}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <span className="text-xs text-muted-foreground">
              Games without AI picks
            </span>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
