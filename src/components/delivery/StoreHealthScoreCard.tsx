// ═══════════════════════════════════════════════════════════════
// Store Health Score Card — Full breakdown for Store Profile
// Dimensions, explanations, weighted scores — all transparent
// ═══════════════════════════════════════════════════════════════

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useStoreHealthScore } from '@/hooks/useStoreHealth';
import { getHealthStatusConfig } from '@/lib/delivery/storeHealthEngine';
import { Activity, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StoreHealthScoreCardProps {
  storeId: string;
}

export function StoreHealthScoreCard({ storeId }: StoreHealthScoreCardProps) {
  const { data: health, isLoading } = useStoreHealthScore(storeId);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-6 bg-muted rounded w-1/2" />
            <div className="h-4 bg-muted rounded w-full" />
            <div className="h-20 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!health) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            Store Health Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No delivery data yet. Health score will appear after the first completed visit.
          </p>
        </CardContent>
      </Card>
    );
  }

  const config = getHealthStatusConfig(health.healthStatus);

  return (
    <Card className={cn('border', config.bg)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Store Health Score
          </CardTitle>
          <Badge variant="outline" className={cn(config.bg, 'gap-1')}>
            <span>{config.emoji}</span>
            <span className={config.color}>{config.label}</span>
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Score */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Overall Score</span>
            <span className="font-bold text-lg">{health.overallScore}/100</span>
          </div>
          <Progress 
            value={health.overallScore} 
            className="h-3"
          />
        </div>

        {/* Dimension Breakdown */}
        {health.dimensions && health.dimensions.length > 0 && (
          <div className="space-y-2.5 pt-2 border-t">
            {health.dimensions.map((dim: any) => (
              <div key={dim.dimension} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{dim.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {Math.round(dim.weight * 100)}%
                    </span>
                    <span className={cn(
                      'font-mono text-xs font-bold px-1.5 py-0.5 rounded',
                      dim.score >= 70 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                      dim.score >= 40 ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                      'bg-red-500/10 text-red-600 dark:text-red-400'
                    )}>
                      {dim.score}
                    </span>
                  </div>
                </div>
                <Progress value={dim.score} className="h-1.5" />
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Info className="h-3 w-3 shrink-0" />
                  {dim.explanation}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="pt-2 border-t flex justify-between text-xs text-muted-foreground">
          <span>{health.totalVisits30d} visit(s) in last 30 days</span>
          {health.lastCalculated && (
            <span>
              Updated {new Date(health.lastCalculated).toLocaleDateString()}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
