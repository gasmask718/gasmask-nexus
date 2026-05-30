import { useState } from 'react';
import { useOpsTaskByThread, useCreateOpsTask, useUpdateOpsTaskStatus } from '@/hooks/useOpsTasks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClipboardList, CheckCircle2, RotateCcw, Play, XCircle, AlertCircle } from 'lucide-react';
import TaskOutcomeSummary from '@/components/ops/TaskOutcomeSummary';
import { toast } from 'sonner';
import { format } from 'date-fns';

const statusColors: Record<string, string> = {
  open: 'bg-blue-500/10 text-blue-600',
  in_progress: 'bg-yellow-500/10 text-yellow-600',
  completed: 'bg-green-500/10 text-green-600',
  cancelled: 'bg-muted text-muted-foreground',
};

const priorityColors: Record<string, string> = {
  low: 'bg-muted text-muted-foreground',
  normal: 'bg-blue-500/10 text-blue-600',
  high: 'bg-orange-500/10 text-orange-600',
  critical: 'bg-destructive/10 text-destructive',
};

interface TaskPanelProps {
  threadId: string;
  threadTitle: string;
  threadPriority: string;
  isAdmin: boolean;
}

export default function TaskPanel({ threadId, threadTitle, threadPriority, isAdmin }: TaskPanelProps) {
  const { data: task, isLoading } = useOpsTaskByThread(threadId);
  const createTask = useCreateOpsTask();
  const updateStatus = useUpdateOpsTaskStatus();
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState(threadTitle);
  const [taskType, setTaskType] = useState('other');
  const [priority, setPriority] = useState(threadPriority || 'normal');

  if (isLoading) return null;

  // Task exists — show panel
  if (task) {
    return (
      <Card className="border-primary/20">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Formalized Task
            </CardTitle>
            <Badge className={statusColors[task.status] || ''}>{task.status.replace('_', ' ')}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="font-medium text-sm">{task.title}</p>
            {task.description && <p className="text-xs text-muted-foreground mt-1">{task.description}</p>}
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">{task.task_type.replace('_', ' ')}</Badge>
            <Badge className={priorityColors[task.priority] || ''}>{task.priority}</Badge>
            {task.expected_role && <Badge variant="secondary">{task.expected_role}</Badge>}
            {task.due_at && (
              <span className="text-muted-foreground">Due: {format(new Date(task.due_at), 'MMM d, yyyy, h:mm a')}</span>
            )}
          </div>

          {task.completed_at && (
            <p className="text-xs text-green-600">
              Completed {format(new Date(task.completed_at), 'MMM d, yyyy, h:mm a')}
            </p>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 flex-wrap">
            {task.status === 'open' && (
              <Button size="sm" variant="outline" className="gap-1 text-xs"
                onClick={() => updateStatus.mutate({ taskId: task.id, status: 'in_progress' }, { onSuccess: () => toast.success('Task started') })}>
                <Play className="h-3 w-3" /> Start
              </Button>
            )}
            {(task.status === 'open' || task.status === 'in_progress') && (
              <Button size="sm" variant="outline" className="gap-1 text-xs"
                onClick={() => updateStatus.mutate({ taskId: task.id, status: 'completed' }, { onSuccess: () => toast.success('Task completed') })}>
                <CheckCircle2 className="h-3 w-3" /> Complete
              </Button>
            )}
            {task.status === 'completed' && (
              <Button size="sm" variant="outline" className="gap-1 text-xs"
                onClick={() => updateStatus.mutate({ taskId: task.id, status: 'open' }, { onSuccess: () => toast.success('Task reopened') })}>
                <RotateCcw className="h-3 w-3" /> Reopen
              </Button>
            )}
            {task.status !== 'cancelled' && task.status !== 'completed' && isAdmin && (
              <Button size="sm" variant="ghost" className="gap-1 text-xs text-destructive"
                onClick={() => updateStatus.mutate({ taskId: task.id, status: 'cancelled' }, { onSuccess: () => toast.success('Task cancelled') })}>
                <XCircle className="h-3 w-3" /> Cancel
              </Button>
            )}
          </div>

          {/* Phase 10B: Outcome Summary */}
          <TaskOutcomeSummary taskId={task.id} />

          <div className="border-t border-border pt-2">
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Tasks are advisory and human-managed. Creating or completing a task does not execute system actions.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No task — show create button for admins
  if (!isAdmin) return null;

  if (!showCreate) {
    return (
      <Button size="sm" variant="outline" className="gap-2 text-xs w-full" onClick={() => setShowCreate(true)}>
        <ClipboardList className="h-3.5 w-3.5" /> Formalize as Task
      </Button>
    );
  }

  return (
    <Card className="border-dashed border-primary/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Create Task</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Task title" className="text-sm" />

        <div className="grid grid-cols-2 gap-2">
          <Select value={taskType} onValueChange={setTaskType}>
            <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {['visit', 'delivery', 'follow_up', 'call', 'audit', 'review', 'other'].map(t => (
                <SelectItem key={t} value={t}>{t.replace('_', ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {['low', 'normal', 'high', 'critical'].map(p => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button size="sm" className="flex-1" disabled={!title.trim() || createTask.isPending}
            onClick={() => createTask.mutate({ threadId, title: title.trim(), taskType, priority }, {
              onSuccess: () => { toast.success('Task created'); setShowCreate(false); },
              onError: (e) => toast.error(e.message),
            })}>
            Confirm
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}
