// ═══════════════════════════════════════════════════════════════════════════════
// TODAY'S INTELLIGENCE SUMMARY
// Phase 3.25 — Aggregated daily intelligence for calibration
// ═══════════════════════════════════════════════════════════════════════════════

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2,
  DollarSign,
  ClipboardCheck,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TodayStats {
  totalRoutes: number;
  avgCbre: number;
  totalConflicts: number;
  totalUnpaidExposure: number;
  acknowledgedCount: number;
  dispatchedCount: number;
  successRate: number;
}

interface TodayIntelligenceSummaryProps {
  stats?: TodayStats;
  isLoading?: boolean;
}

export function TodayIntelligenceSummary({ stats, isLoading }: TodayIntelligenceSummaryProps) {
  if (isLoading || !stats) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center text-muted-foreground">
          <Activity className="h-8 w-8 mx-auto mb-2 animate-pulse" />
          Loading intelligence summary...
        </CardContent>
      </Card>
    );
  }

  const acknowledgmentRate = stats.totalRoutes > 0 
    ? Math.round((stats.acknowledgedCount / stats.totalRoutes) * 100) 
    : 0;

  const efficiencyRating = stats.avgCbre < 0.7 ? 'excellent' : stats.avgCbre < 0.85 ? 'acceptable' : 'inefficient';
  const efficiencyGain = Math.round((1 - stats.avgCbre) * 100);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Today's Intelligence Summary
            </CardTitle>
            <CardDescription>
              Aggregated calibration metrics
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-muted-foreground">
            {new Date().toLocaleDateString()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* CBRE Performance */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Avg Efficiency</span>
              {efficiencyRating === 'excellent' ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : efficiencyRating === 'inefficient' ? (
                <TrendingDown className="h-4 w-4 text-destructive" />
              ) : null}
            </div>
            <div className={cn(
              'text-2xl font-bold',
              efficiencyRating === 'excellent' && 'text-green-600',
              efficiencyRating === 'acceptable' && 'text-yellow-600',
              efficiencyRating === 'inefficient' && 'text-destructive'
            )}>
              {efficiencyGain}%
            </div>
            <Badge 
              variant="outline" 
              className={cn(
                'text-xs capitalize',
                efficiencyRating === 'excellent' && 'bg-green-500/10 text-green-600 border-green-500/30',
                efficiencyRating === 'acceptable' && 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
                efficiencyRating === 'inefficient' && 'bg-red-500/10 text-destructive border-red-500/30'
              )}
            >
              {efficiencyRating}
            </Badge>
          </div>

          {/* Conflicts */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Conflicts Today</span>
              {stats.totalConflicts > 0 && (
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
              )}
            </div>
            <div className={cn(
              'text-2xl font-bold',
              stats.totalConflicts > 5 && 'text-destructive',
              stats.totalConflicts > 0 && stats.totalConflicts <= 5 && 'text-yellow-600',
              stats.totalConflicts === 0 && 'text-green-600'
            )}>
              {stats.totalConflicts}
            </div>
            <span className="text-xs text-muted-foreground">
              across {stats.totalRoutes} routes
            </span>
          </div>

          {/* Unpaid Exposure */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Unpaid Exposure</span>
              {stats.totalUnpaidExposure > 0 && (
                <DollarSign className="h-4 w-4 text-destructive" />
              )}
            </div>
            <div className={cn(
              'text-2xl font-bold',
              stats.totalUnpaidExposure > 10000 && 'text-destructive',
              stats.totalUnpaidExposure > 0 && stats.totalUnpaidExposure <= 10000 && 'text-yellow-600',
              stats.totalUnpaidExposure === 0 && 'text-green-600'
            )}>
              ${stats.totalUnpaidExposure.toLocaleString()}
            </div>
            <span className="text-xs text-muted-foreground">
              at dispatch time
            </span>
          </div>

          {/* Acknowledgment Rate */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Review Rate</span>
              {acknowledgmentRate >= 80 && (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              )}
            </div>
            <div className="text-2xl font-bold">
              {acknowledgmentRate}%
            </div>
            <Progress 
              value={acknowledgmentRate} 
              className="h-1.5"
            />
            <span className="text-xs text-muted-foreground">
              {stats.acknowledgedCount}/{stats.totalRoutes} reviewed
            </span>
          </div>
        </div>

        {/* Callout if issues detected */}
        {(stats.totalConflicts > 5 || acknowledgmentRate < 50) && (
          <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                {stats.totalConflicts > 5 && 'High conflict count detected. '}
                {acknowledgmentRate < 50 && 'Review rate below threshold.'}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
