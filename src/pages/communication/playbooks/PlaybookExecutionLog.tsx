import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { usePlaybookExecutions } from '@/hooks/useCommunicationPlaybooks';
import { formatDistanceToNow } from 'date-fns';

const statusIcons: Record<string, React.ReactNode> = {
  completed: <CheckCircle2 className="h-3 w-3 text-green-600" />,
  completed_with_errors: <AlertTriangle className="h-3 w-3 text-amber-600" />,
  failed: <XCircle className="h-3 w-3 text-destructive" />,
  running: <Clock className="h-3 w-3 text-blue-600 animate-spin" />,
  cancelled: <XCircle className="h-3 w-3 text-muted-foreground" />,
  pending_approval: <Clock className="h-3 w-3 text-amber-600" />,
};

export function PlaybookExecutionLog({ playbookId }: { playbookId: string }) {
  const { data: executions, isLoading } = usePlaybookExecutions(playbookId);

  if (isLoading) {
    return <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-8 w-full" />)}</div>;
  }

  if (!executions?.length) {
    return <p className="text-xs text-muted-foreground text-center py-2">No executions yet</p>;
  }

  return (
    <div className="space-y-2 max-h-48 overflow-y-auto">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Recent Executions</p>
      {executions.map(ex => (
        <div key={ex.id} className="flex items-center gap-2 text-xs p-2 rounded bg-muted/30">
          {statusIcons[ex.status] || <Clock className="h-3 w-3" />}
          <span className="flex-1 truncate">
            {ex.triggered_by || 'manual'} — {ex.actions_executed?.length || 0} actions
            {ex.actions_failed?.length ? `, ${ex.actions_failed.length} failed` : ''}
          </span>
          <span className="text-muted-foreground text-[10px]">
            {formatDistanceToNow(new Date(ex.started_at), { addSuffix: true })}
          </span>
          <Badge variant="outline" className={`text-[9px] ${
            ex.status === 'completed' ? 'text-green-600' :
            ex.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'
          }`}>
            {ex.status}
          </Badge>
        </div>
      ))}
    </div>
  );
}
