/**
 * ProfileActivityPanel - Read-only inbox + task participation panel
 * Shows ops inbox threads and formalized tasks linked to a user
 * Enforces Portal-to-Profile Parity Law
 */
import { useQuery } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { Inbox, ClipboardList, Clock, CheckCircle2, AlertTriangle, Shield, Bell } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ProfileActivityPanelProps {
  /** The user_id to look up inbox/task participation */
  userId: string | null | undefined;
  /** Display name for empty states */
  entityName: string;
}

const priorityColors: Record<string, string> = {
  urgent: 'text-red-600 border-red-600/30 bg-red-500/10',
  high: 'text-orange-600 border-orange-600/30 bg-orange-500/10',
  normal: 'text-blue-600 border-blue-600/30 bg-blue-500/10',
  low: 'text-muted-foreground border-muted bg-muted/30',
};

const statusIcons: Record<string, React.ReactNode> = {
  open: <Clock className="h-3 w-3" />,
  acknowledged: <Bell className="h-3 w-3" />,
  in_progress: <Clock className="h-3 w-3" />,
  resolved: <CheckCircle2 className="h-3 w-3" />,
  completed: <CheckCircle2 className="h-3 w-3" />,
  closed: <CheckCircle2 className="h-3 w-3" />,
};

export function ProfileActivityPanel({ userId, entityName }: ProfileActivityPanelProps) {
  // Fetch inbox threads this user is a recipient of
  const { data: inboxThreads = [], isLoading: inboxLoading } = useQuery({
    queryKey: ['profile-inbox-participation', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data: recipientRows, error: recErr } = await supabase
        .from('ops_inbox_recipients')
        .select('thread_id, read_at, acknowledged_at, resolved_at')
        .eq('user_id', userId)
        .order('delivered_at', { ascending: false })
        .limit(25);
      if (recErr || !recipientRows?.length) return [];

      const threadIds = recipientRows.map(r => r.thread_id);
      const { data: threads, error: thErr } = await supabase
        .from('ops_inbox_threads')
        .select('id, title, type, priority, status, created_at')
        .in('id', threadIds)
        .order('created_at', { ascending: false });
      if (thErr) return [];

      // Merge recipient state
      const recipientMap = new Map(recipientRows.map(r => [r.thread_id, r]));
      return (threads || []).map(t => ({
        ...t,
        read_at: recipientMap.get(t.id)?.read_at,
        acknowledged_at: recipientMap.get(t.id)?.acknowledged_at,
        resolved_at: recipientMap.get(t.id)?.resolved_at,
      }));
    },
    enabled: !!userId,
    staleTime: 60_000,
  });

  // Fetch ops tasks expected for this user
  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['profile-task-participation', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('ops_tasks')
        .select('id, title, task_type, priority, status, due_at, created_at, completed_at')
        .eq('expected_actor_id', userId)
        .order('created_at', { ascending: false })
        .limit(25);
      if (error) return [];
      return data || [];
    },
    enabled: !!userId,
    staleTime: 60_000,
  });

  const isLoading = inboxLoading || tasksLoading;
  const unreadCount = inboxThreads.filter(t => !t.read_at).length;
  const openTaskCount = tasks.filter(t => t.status === 'open' || t.status === 'in_progress').length;

  if (!userId) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <p>No linked user account — inbox and task data unavailable.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Governance Banner */}
      <Alert className="border-blue-500/30 bg-blue-500/5">
        <Shield className="h-4 w-4 text-blue-500" />
        <AlertDescription className="text-sm text-muted-foreground">
          This panel is a read-only mirror of {entityName}'s inbox and task participation.
          It does not modify, score, or influence system behavior.
        </AlertDescription>
      </Alert>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Inbox className="h-5 w-5 mx-auto text-primary mb-1" />
            <div className="text-xl font-bold">{inboxThreads.length}</div>
            <p className="text-xs text-muted-foreground">Inbox Threads</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Bell className="h-5 w-5 mx-auto text-amber-500 mb-1" />
            <div className="text-xl font-bold">{unreadCount}</div>
            <p className="text-xs text-muted-foreground">Unread</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <ClipboardList className="h-5 w-5 mx-auto text-primary mb-1" />
            <div className="text-xl font-bold">{tasks.length}</div>
            <p className="text-xs text-muted-foreground">Tasks</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <AlertTriangle className="h-5 w-5 mx-auto text-orange-500 mb-1" />
            <div className="text-xl font-bold">{openTaskCount}</div>
            <p className="text-xs text-muted-foreground">Open Tasks</p>
          </CardContent>
        </Card>
      </div>

      {/* Inbox Threads */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Inbox className="h-5 w-5 text-primary" />
            Inbox Participation
          </CardTitle>
          <CardDescription>Recent ops inbox threads delivered to {entityName}</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            {isLoading ? (
              <p className="text-center text-muted-foreground py-6">Loading...</p>
            ) : inboxThreads.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Inbox className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No inbox threads</p>
              </div>
            ) : (
              <div className="space-y-2">
                {inboxThreads.map((thread: any) => (
                  <div key={thread.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {!thread.read_at && <div className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{thread.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {thread.type} • {formatDistanceToNow(new Date(thread.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className={`text-xs ${priorityColors[thread.priority] || ''}`}>
                        {thread.priority}
                      </Badge>
                      <Badge variant="secondary" className="text-xs gap-1">
                        {statusIcons[thread.status]}
                        {thread.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Tasks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Formalized Tasks
          </CardTitle>
          <CardDescription>Ops tasks assigned to {entityName}</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            {isLoading ? (
              <p className="text-center text-muted-foreground py-6">Loading...</p>
            ) : tasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No formalized tasks</p>
              </div>
            ) : (
              <div className="space-y-2">
                {tasks.map((task: any) => (
                  <div key={task.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{task.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {task.task_type} • {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
                        {task.due_at && ` • Due ${format(new Date(task.due_at), 'MMM d, yyyy')}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className={`text-xs ${priorityColors[task.priority] || ''}`}>
                        {task.priority}
                      </Badge>
                      <Badge variant={task.status === 'completed' ? 'default' : 'secondary'} className="text-xs gap-1">
                        {statusIcons[task.status]}
                        {task.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

export default ProfileActivityPanel;
