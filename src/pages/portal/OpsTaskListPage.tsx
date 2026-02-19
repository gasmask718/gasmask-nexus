import { useState } from 'react';
import { useOpsTasks, useUpdateOpsTaskStatus } from '@/hooks/useOpsTasks';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { ClipboardList, CheckCircle2, Play, RotateCcw, Search, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  open: 'bg-blue-500/10 text-blue-600',
  in_progress: 'bg-yellow-500/10 text-yellow-600',
  completed: 'bg-green-500/10 text-green-600',
  cancelled: 'bg-muted text-muted-foreground',
};

const priorityColors: Record<string, string> = {
  low: 'border-muted-foreground/30',
  normal: 'border-blue-500/30',
  high: 'border-orange-500/50',
  critical: 'border-destructive/50',
};

export default function OpsTaskListPage() {
  const [tab, setTab] = useState('open');
  const [search, setSearch] = useState('');

  const statusFilter = tab === 'all' ? undefined : tab === 'active' ? undefined : tab;
  const { data: tasks = [], isLoading } = useOpsTasks(statusFilter ? { status: statusFilter } : undefined);
  const updateStatus = useUpdateOpsTaskStatus();

  const filtered = tasks.filter(t => {
    if (tab === 'active' && t.status !== 'open' && t.status !== 'in_progress') return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-2 space-y-3">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <ClipboardList className="h-5 w-5" /> Tasks
        </h1>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search tasks..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="active" className="flex-1">Active</TabsTrigger>
            <TabsTrigger value="open" className="flex-1">Open</TabsTrigger>
            <TabsTrigger value="completed" className="flex-1">Done</TabsTrigger>
            <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Governance banner */}
      <div className="mx-4 mb-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
        <p className="text-[10px] text-amber-700 dark:text-amber-400 flex items-center gap-1">
          <AlertCircle className="h-3 w-3 flex-shrink-0" />
          Tasks are advisory and human-managed. Creating or completing a task does not execute system actions.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <ClipboardList className="h-12 w-12 mb-3 opacity-30" />
            <p className="font-medium">No tasks</p>
            <p className="text-sm">Nothing here yet</p>
          </div>
        ) : (
          filtered.map(task => (
            <div
              key={task.id}
              className={cn(
                'px-4 py-3 border-b border-border space-y-2',
                priorityColors[task.priority] && `border-l-2 ${priorityColors[task.priority]}`
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{task.title}</p>
                  {task.description && <p className="text-xs text-muted-foreground line-clamp-1">{task.description}</p>}
                </div>
                <Badge className={statusColors[task.status] || ''} variant="secondary">
                  {task.status.replace('_', ' ')}
                </Badge>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-[10px]">{task.task_type.replace('_', ' ')}</Badge>
                <Badge variant="outline" className="text-[10px]">{task.priority}</Badge>
                {task.expected_role && <Badge variant="secondary" className="text-[10px]">{task.expected_role}</Badge>}
                <span className="text-[10px] text-muted-foreground ml-auto">
                  {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
                </span>
              </div>

              {/* Quick actions */}
              <div className="flex gap-1.5">
                {task.status === 'open' && (
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 px-2"
                    onClick={() => updateStatus.mutate({ taskId: task.id, status: 'in_progress' }, { onSuccess: () => toast.success('Started') })}>
                    <Play className="h-3 w-3" /> Start
                  </Button>
                )}
                {(task.status === 'open' || task.status === 'in_progress') && (
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 px-2"
                    onClick={() => updateStatus.mutate({ taskId: task.id, status: 'completed' }, { onSuccess: () => toast.success('Completed') })}>
                    <CheckCircle2 className="h-3 w-3" /> Complete
                  </Button>
                )}
                {task.status === 'completed' && (
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 px-2"
                    onClick={() => updateStatus.mutate({ taskId: task.id, status: 'open' }, { onSuccess: () => toast.success('Reopened') })}>
                    <RotateCcw className="h-3 w-3" /> Reopen
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
