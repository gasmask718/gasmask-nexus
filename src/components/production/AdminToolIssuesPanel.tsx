/**
 * HQ view of tool / equipment problems reported by offices.
 * Read + resolve only; asset records themselves are managed elsewhere.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  useToolIssues,
  useResolveToolIssue,
  ISSUE_TYPE_LABEL,
} from '@/hooks/useProductionFloorOps';
import { AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export function AdminToolIssuesPanel({ officeId }: { officeId?: string }) {
  const { data: issues = [], isLoading } = useToolIssues(officeId, 'all');
  const resolve = useResolveToolIssue();

  const open = issues.filter((i) => i.status === 'open' || i.status === 'acknowledged');

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-primary" />
          Tool &amp; equipment problems
          {open.length > 0 && <Badge variant="destructive">{open.length} open</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <div className="h-16 bg-muted animate-pulse rounded-lg" />
        ) : issues.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No problems reported.</p>
        ) : (
          issues.map((i) => (
            <div key={i.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
              <div className="min-w-0">
                <p className="font-medium truncate">
                  {i.tool_name} — {ISSUE_TYPE_LABEL[i.issue_type]}
                  {i.severity === 'high' && (
                    <Badge variant="destructive" className="ml-2 text-[10px]">stopping work</Badge>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">{i.description}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Reported {format(new Date(i.reported_at), 'MMM d, h:mm a')}
                  {i.resolved_at ? ` · resolved ${format(new Date(i.resolved_at), 'MMM d')}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge
                  variant="outline"
                  className={cn('capitalize', (i.status === 'resolved' || i.status === 'closed') && 'text-emerald-600 border-emerald-500/40')}
                >
                  {i.status}
                </Badge>
                {(i.status === 'open' || i.status === 'acknowledged') && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={resolve.isPending}
                    onClick={() => resolve.mutate({ id: i.id, status: 'resolved' })}
                  >
                    Mark fixed
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
