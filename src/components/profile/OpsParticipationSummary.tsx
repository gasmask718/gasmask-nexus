/**
 * OpsParticipationSummary - Read-only ops participation card
 * Shows inbox threads + task counts in a consistent format across all profiles.
 * Governance: Descriptive only. Does not score or trigger actions.
 */
import { Inbox, ClipboardList, Bell, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield } from 'lucide-react';
import type { UnifiedOpsParticipation } from '@/hooks/useUnifiedProfileView';

interface OpsParticipationSummaryProps {
  data: UnifiedOpsParticipation;
  isLoading?: boolean;
  entityName: string;
}

export function OpsParticipationSummary({ data, isLoading, entityName }: OpsParticipationSummaryProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground">Loading ops data...</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Alert className="border-blue-500/30 bg-blue-500/5">
        <Shield className="h-4 w-4 text-blue-500" />
        <AlertDescription className="text-sm text-muted-foreground">
          This data is read-only and descriptive. It does not evaluate performance or trigger actions.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Inbox className="h-5 w-5 mx-auto text-primary mb-1" />
            <div className="text-xl font-bold">{data.inboxThreadsCount}</div>
            <p className="text-xs text-muted-foreground">Inbox Threads</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Bell className="h-5 w-5 mx-auto text-amber-500 mb-1" />
            <div className="text-xl font-bold">{data.unreadThreadsCount}</div>
            <p className="text-xs text-muted-foreground">Unread</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <ClipboardList className="h-5 w-5 mx-auto text-primary mb-1" />
            <div className="text-xl font-bold">{data.tasksAssigned}</div>
            <p className="text-xs text-muted-foreground">Tasks Assigned</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="h-5 w-5 mx-auto text-green-500 mb-1" />
            <div className="text-xl font-bold">{data.tasksCompleted}</div>
            <p className="text-xs text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
