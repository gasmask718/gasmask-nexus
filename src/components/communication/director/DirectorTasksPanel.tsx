import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Zap, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Play, 
  Pause,
  RefreshCw,
  XCircle
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';

const taskTypeLabels: Record<string, string> = {
  create_campaign: 'Create Campaign',
  optimize_campaign: 'Optimize Campaign',
  pause_campaign: 'Pause Campaign',
  adjust_pacing: 'Adjust Pacing',
  change_voice: 'Change Voice',
  update_script: 'Update Script',
};

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="h-4 w-4 text-orange-500" />,
  running: <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />,
  completed: <CheckCircle className="h-4 w-4 text-green-500" />,
  failed: <XCircle className="h-4 w-4 text-red-500" />,
};

const statusColors: Record<string, string> = {
  pending: 'bg-orange-500/10 text-orange-500',
  running: 'bg-blue-500/10 text-blue-500',
  completed: 'bg-green-500/10 text-green-500',
  failed: 'bg-red-500/10 text-red-500',
};

export default function DirectorTasksPanel() {
  const { data: tasks, isLoading, refetch } = useQuery({
    queryKey: ['director-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_outbound_director_tasks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    refetchInterval: 5000,
  });

  const pendingTasks = tasks?.filter(t => t.status === 'pending') || [];
  const runningTasks = tasks?.filter(t => t.status === 'running') || [];
  const completedTasks = tasks?.filter(t => t.status === 'completed') || [];
  const failedTasks = tasks?.filter(t => t.status === 'failed') || [];

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Task Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingTasks.length}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <RefreshCw className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{runningTasks.length}</p>
                <p className="text-xs text-muted-foreground">Running</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{completedTasks.length}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{failedTasks.length}</p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Tasks */}
      {(runningTasks.length > 0 || pendingTasks.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Active Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[...runningTasks, ...pendingTasks].map((task) => (
                <div key={task.id} className="flex items-center gap-4 p-3 border rounded-lg">
                  {statusIcons[task.status]}
                  <div className="flex-1">
                    <p className="font-medium">
                      {taskTypeLabels[task.task_type] || task.task_type}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Created {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <Badge className={statusColors[task.status]}>
                    {task.status}
                  </Badge>
                  <Badge variant="outline">{task.priority || 'normal'}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Task History */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Task History</CardTitle>
            <CardDescription>Recent autonomous actions</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {tasks?.map((task) => (
                <div 
                  key={task.id} 
                  className="flex items-center gap-4 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  {statusIcons[task.status]}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {taskTypeLabels[task.task_type] || task.task_type}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
                      {task.completed_at && (
                        <> • Completed in {Math.round((new Date(task.completed_at).getTime() - new Date(task.started_at || task.created_at).getTime()) / 1000)}s</>
                      )}
                    </p>
                  </div>
                  <Badge className={statusColors[task.status]}>
                    {task.status}
                  </Badge>
                </div>
              ))}

              {(!tasks || tasks.length === 0) && (
                <div className="text-center py-12 text-muted-foreground">
                  <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No tasks yet</p>
                  <p className="text-sm">Tasks will appear as the director runs</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
