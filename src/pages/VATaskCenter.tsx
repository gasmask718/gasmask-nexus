import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ListTodo, Clock, CheckCircle2, XCircle, UserCheck } from 'lucide-react';
import { toast } from 'sonner';

const VATaskCenter = () => {
  const queryClient = useQueryClient();

  const { data: tasks } = useQuery({
    queryKey: ['va-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('va_tasks')
        .select(`
          *,
          vas (name, email, tier)
        `)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data;
    },
  });

  const assignTask = useMutation({
    mutationFn: async (taskId: string) => {
      const { data, error } = await supabase.functions.invoke('va-task-router-ai', {
        body: { taskId }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['va-tasks'] });
      toast.success('Task assigned to best available VA');
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'in_progress': return 'bg-blue-500';
      case 'assigned': return 'bg-yellow-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getPriorityColor = (priority: number) => {
    if (priority >= 4) return 'destructive';
    if (priority >= 3) return 'default';
    return 'secondary';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-4 w-4" />;
      case 'in_progress': return <Clock className="h-4 w-4" />;
      case 'failed': return <XCircle className="h-4 w-4" />;
      default: return <ListTodo className="h-4 w-4" />;
    }
  };

  const tasksByStatus = {
    pending: tasks?.filter(t => t.status === 'pending') || [],
    assigned: tasks?.filter(t => t.status === 'assigned') || [],
    in_progress: tasks?.filter(t => t.status === 'in_progress') || [],
    completed: tasks?.filter(t => t.status === 'completed') || [],
    failed: tasks?.filter(t => t.status === 'failed') || [],
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">VA Task Assignment Center</h1>
          <p className="text-muted-foreground">AI-powered task routing and management</p>
        </div>

        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <ListTodo className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tasksByStatus.pending.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Assigned</CardTitle>
              <UserCheck className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tasksByStatus.assigned.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <Clock className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tasksByStatus.in_progress.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tasksByStatus.completed.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Failed</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tasksByStatus.failed.length}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Tasks</CardTitle>
            <CardDescription>Recent task assignments and status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {tasks?.map(task => (
                <div 
                  key={task.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(task.status)}
                      <Badge className={getStatusColor(task.status)}>
                        {task.status}
                      </Badge>
                    </div>

                    <div className="flex-1">
                      <div className="font-semibold">{task.task_type.replace(/_/g, ' ')}</div>
                      <div className="text-sm text-muted-foreground">
                        {task.description || 'No description'}
                      </div>
                      {(task.vas as any) && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Assigned to: {(task.vas as any).name} (Tier {(task.vas as any).tier})
                        </div>
                      )}
                    </div>

                    <Badge variant={getPriorityColor(task.priority)}>
                      P{task.priority}
                    </Badge>

                    <div className="text-sm text-muted-foreground">
                      {new Date(task.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  {task.status === 'pending' && (
                    <Button
                      size="sm"
                      onClick={() => assignTask.mutate(task.id)}
                      disabled={assignTask.isPending}
                    >
                      Auto-Assign
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default VATaskCenter;
