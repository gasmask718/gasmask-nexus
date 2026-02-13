// ═══════════════════════════════════════════════════════════════════════════════
// EXEC AI DISPATCH ANALYTICS — Read-Only Executive Dashboard
// ═══════════════════════════════════════════════════════════════════════════════
// No buttons that affect dispatch. No tuning controls. Visibility only.

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  BarChart3,
  TrendingUp,
  Clock,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  Eye,
  Brain,
} from 'lucide-react';
import { useAILearningRuns } from '@/hooks/useAILearningRuns';

export function AIDispatchAnalytics() {
  const { analytics, analyticsLoading } = useAILearningRuns();

  if (analyticsLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
      </div>
    );
  }

  if (!analytics || analytics.totalFeedback === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No analytics data yet"
        description="AI suggestion feedback will appear here once dispatchers interact with suggestions"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Interactions</p>
                <p className="text-2xl font-bold">{analytics.totalFeedback}</p>
              </div>
              <Eye className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Apply Rate</p>
                <p className="text-2xl font-bold text-green-500">{analytics.applyRate}%</p>
              </div>
              <ThumbsUp className="h-8 w-8 text-green-500" />
            </div>
            <Progress value={analytics.applyRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Dismissed</p>
                <p className="text-2xl font-bold text-amber-500">{analytics.dismissedCount}</p>
              </div>
              <ThumbsDown className="h-8 w-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Decision Time</p>
                <p className="text-2xl font-bold">{analytics.avgLatencySeconds}s</p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trust Curve: Confidence vs Outcome */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Trust Curve — Confidence vs Outcome
          </CardTitle>
          <CardDescription>Apply rate by confidence bucket</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Confidence Bucket</TableHead>
                <TableHead className="text-right">Applied</TableHead>
                <TableHead className="text-right">Dismissed</TableHead>
                <TableHead className="text-right">Ignored</TableHead>
                <TableHead className="text-right">Apply Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analytics.byConfidenceBucket.map(bucket => {
                const total = bucket.applied + bucket.dismissed + bucket.ignored;
                const rate = total > 0 ? Math.round((bucket.applied / total) * 100) : 0;
                return (
                  <TableRow key={bucket.bucket}>
                    <TableCell className="font-mono">{bucket.bucket}%</TableCell>
                    <TableCell className="text-right text-green-500">{bucket.applied}</TableCell>
                    <TableCell className="text-right text-amber-500">{bucket.dismissed}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{bucket.ignored}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={rate >= 60 ? 'default' : 'outline'} className="font-mono">
                        {rate}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Risk Level vs Action */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Risk Level vs Human Action
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Risk Level</TableHead>
                  <TableHead className="text-right">Applied</TableHead>
                  <TableHead className="text-right">Dismissed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics.byRiskLevel.map(r => (
                  <TableRow key={r.risk}>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          r.risk === 'high'
                            ? 'bg-destructive/10 text-destructive'
                            : r.risk === 'medium'
                            ? 'bg-amber-500/10 text-amber-600'
                            : 'bg-green-500/10 text-green-600'
                        }
                      >
                        {r.risk}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-green-500">{r.applied}</TableCell>
                    <TableCell className="text-right text-amber-500">{r.dismissed}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Override Heatmap — Most Dismissed Stores */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ThumbsDown className="h-5 w-5" />
              Most Dismissed Stores
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.topDismissedStores.length === 0 ? (
              <p className="text-sm text-muted-foreground">No dismissals recorded</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Store</TableHead>
                    <TableHead className="text-right">Dismissed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics.topDismissedStores.map(s => (
                    <TableRow key={s.store_name}>
                      <TableCell className="truncate max-w-[200px]">{s.store_name}</TableCell>
                      <TableCell className="text-right font-mono">{s.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Frequent Dismissal Reasons */}
      {analytics.topReasons.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Frequent Feedback Reasons
            </CardTitle>
            <CardDescription>From Phase 5B human feedback</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {analytics.topReasons.map(r => (
                <Badge key={r.reason_code} variant="outline" className="text-sm px-3 py-1.5">
                  {r.reason_code.replace(/_/g, ' ')} ({r.count})
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
