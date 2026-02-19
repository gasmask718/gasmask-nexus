import { useOpsTaskAnalytics } from '@/hooks/useOpsTasks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ClipboardList, CheckCircle2, Clock, XCircle, AlertCircle } from 'lucide-react';

export default function OpsTaskAnalyticsPanel() {
  const { data: stats, isLoading } = useOpsTaskAnalytics();

  if (isLoading || !stats) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <ClipboardList className="h-5 w-5" /> Task Analytics
        </h3>
        <Badge variant="outline" className="text-xs">Read-only</Badge>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <MetricCard icon={<ClipboardList className="h-4 w-4 text-blue-500" />} label="Open" value={stats.open} />
        <MetricCard icon={<Clock className="h-4 w-4 text-yellow-500" />} label="In Progress" value={stats.inProgress} />
        <MetricCard icon={<CheckCircle2 className="h-4 w-4 text-green-500" />} label="Completed" value={stats.completed} />
        <MetricCard icon={<XCircle className="h-4 w-4 text-destructive" />} label="Cancelled" value={stats.cancelled} />
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Completion Rate</p>
            <p className="text-2xl font-bold">{stats.completionRate}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Avg Completion</p>
            <p className="text-2xl font-bold">{stats.avgCompletionHours}h</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Total Tasks</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
      </div>

      {/* By role */}
      {Object.keys(stats.byRole).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">By Role</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.byRole).map(([role, count]) => (
                <Badge key={role} variant="outline" className="text-xs">
                  {role}: {count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* By priority */}
      {Object.keys(stats.byPriority).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">By Priority</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.byPriority).map(([p, count]) => (
                <Badge key={p} variant="outline" className="text-xs">
                  {p}: {count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
        <p className="text-[10px] text-amber-700 dark:text-amber-400 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Tasks are advisory and human-managed. No alerts, scoring, or nudges.
        </p>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-4 flex items-center gap-3">
        {icon}
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
