import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const priorityColor: Record<string, string> = {
  high: 'bg-destructive text-destructive-foreground',
  medium: 'bg-amber-500 text-white',
  low: 'bg-muted text-muted-foreground',
};

const statusColor: Record<string, string> = {
  open: 'border-blue-500 text-blue-500',
  in_progress: 'border-amber-500 text-amber-500',
  completed: 'border-green-500 text-green-500',
  blocked: 'border-destructive text-destructive',
};

export default function TerritoryTasks() {
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['territory-tasks', statusFilter, typeFilter],
    queryFn: async () => {
      let query = supabase
        .from('territory_tasks')
        .select('*, territory_addresses(full_address, city)')
        .order('created_at', { ascending: false });

      if (statusFilter === 'active') {
        query = query.in('status', ['open', 'in_progress']);
      } else if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (typeFilter !== 'all') {
        query = query.eq('task_type', typeFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Territory Tasks</h1>
        <p className="text-muted-foreground text-sm">Read-only view of all territory execution tasks</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="blocked">Blocked</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="scout">Scout</SelectItem>
            <SelectItem value="call">Call</SelectItem>
            <SelectItem value="visit">Visit</SelectItem>
            <SelectItem value="verify">Verify</SelectItem>
            <SelectItem value="follow_up">Follow Up</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : tasks && tasks.length > 0 ? (
        <Card>
          <CardContent className="pt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 px-3">Type</th>
                    <th className="text-left py-2 px-3">Address</th>
                    <th className="text-center py-2 px-3">Assigned To</th>
                    <th className="text-center py-2 px-3">Priority</th>
                    <th className="text-center py-2 px-3">Status</th>
                    <th className="text-left py-2 px-3">Required Outcome</th>
                    <th className="text-left py-2 px-3">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task: any) => (
                    <tr key={task.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2 px-3">
                        <Badge variant="outline" className="text-xs capitalize">{task.task_type.replace('_', ' ')}</Badge>
                      </td>
                      <td className="py-2 px-3 font-medium max-w-[200px] truncate">
                        {task.territory_addresses?.full_address || '—'}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <Badge variant={task.assigned_to_type === 'ai' ? 'secondary' : 'outline'} className="text-xs">
                          {task.assigned_to_type === 'ai' ? '🤖 AI' : '👤 Human'}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <Badge className={`${priorityColor[task.priority]} text-xs`}>{task.priority}</Badge>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <Badge variant="outline" className={`${statusColor[task.status]} text-xs`}>{task.status}</Badge>
                      </td>
                      <td className="py-2 px-3 text-xs text-muted-foreground capitalize">
                        {task.required_outcome?.replace('_', ' ')}
                      </td>
                      <td className="py-2 px-3 text-xs text-muted-foreground">
                        {new Date(task.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No tasks found. Generate tasks from the execution engine to populate this view.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
