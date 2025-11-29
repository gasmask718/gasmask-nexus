// ═══════════════════════════════════════════════════════════════════════════════
// ACTION QUEUE PAGE — Scheduled Tasks Management
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GrabbaLayout } from '@/components/grabba/GrabbaLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useScheduler, TaskStatus, TaskType, ScheduledTask } from '@/hooks/useScheduler';
import { usePermissions } from '@/hooks/usePermissions';
import { 
  Play, 
  X, 
  Clock, 
  Calendar,
  Loader2,
  RefreshCw,
  Eye,
  ExternalLink,
  Filter
} from 'lucide-react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const statusColors: Record<TaskStatus, string> = {
  pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  scheduled: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  in_progress: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  completed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  failed: 'bg-red-500/20 text-red-400 border-red-500/30',
  cancelled: 'bg-muted text-muted-foreground border-muted',
};

const typeLabels: Record<TaskType, string> = {
  visit_stores: 'Store Visit',
  collect_payment: 'Payment Collection',
  delivery_run: 'Delivery Run',
  follow_up: 'Follow Up',
  inventory_check: 'Inventory Check',
  route_delivery: 'Route Delivery',
  contact_store: 'Contact Store',
};

export default function ActionQueuePage() {
  const navigate = useNavigate();
  const { tasks, loading, listTasks, runTaskNow, cancelTask } = useScheduler();
  const { canUpdate } = usePermissions();
  
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [detailTask, setDetailTask] = useState<ScheduledTask | null>(null);

  const isReadOnly = !canUpdate('deliveries');

  useEffect(() => {
    listTasks();
  }, [listTasks]);

  const filteredTasks = tasks.filter(task => {
    if (statusFilter !== 'all' && task.status !== statusFilter) return false;
    if (typeFilter !== 'all' && task.type !== typeFilter) return false;
    if (searchQuery) {
      const payload = task.payload;
      const searchLower = searchQuery.toLowerCase();
      return (
        task.type.toLowerCase().includes(searchLower) ||
        JSON.stringify(payload).toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  const toggleTask = (taskId: string) => {
    setSelectedTasks(prev => 
      prev.includes(taskId) 
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  const toggleAll = () => {
    if (selectedTasks.length === filteredTasks.length) {
      setSelectedTasks([]);
    } else {
      setSelectedTasks(filteredTasks.map(t => t.id));
    }
  };

  const handleBatchRun = async () => {
    for (const taskId of selectedTasks) {
      await runTaskNow(taskId);
    }
    setSelectedTasks([]);
  };

  const handleBatchCancel = async () => {
    for (const taskId of selectedTasks) {
      await cancelTask(taskId);
    }
    setSelectedTasks([]);
  };

  const getEntitySummary = (task: ScheduledTask) => {
    const payload = task.payload;
    const storeIds = payload.store_ids as string[] | undefined;
    const deliveryIds = payload.delivery_ids as string[] | undefined;
    
    if (storeIds?.length) return `${storeIds.length} stores`;
    if (deliveryIds?.length) return `${deliveryIds.length} deliveries`;
    return '-';
  };

  const openRelatedPanel = (task: ScheduledTask) => {
    const payload = task.payload;
    const storeIds = payload.store_ids as string[] | undefined;
    
    if (storeIds?.length) {
      navigate(`/grabba/results?panel=stores&query=task-stores`);
    }
  };

  return (
    <GrabbaLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Action Queue</h1>
            <p className="text-muted-foreground">Manage scheduled tasks and operations</p>
          </div>
          <Button onClick={() => listTasks()} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Filters:</span>
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="visit_stores">Store Visit</SelectItem>
                  <SelectItem value="collect_payment">Payment</SelectItem>
                  <SelectItem value="delivery_run">Delivery</SelectItem>
                  <SelectItem value="follow_up">Follow Up</SelectItem>
                  <SelectItem value="inventory_check">Inventory</SelectItem>
                </SelectContent>
              </Select>

              <Input
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-[200px]"
              />
            </div>
          </CardContent>
        </Card>

        {/* Batch Actions */}
        {selectedTasks.length > 0 && !isReadOnly && (
          <Card className="bg-primary/10 border-primary/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {selectedTasks.length} task(s) selected
                </span>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleBatchRun}>
                    <Play className="h-4 w-4 mr-1" />
                    Run Now
                  </Button>
                  <Button size="sm" variant="destructive" onClick={handleBatchCancel}>
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tasks Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Scheduled Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No tasks found
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/50">
                      {!isReadOnly && (
                        <th className="p-3 text-left">
                          <Checkbox
                            checked={selectedTasks.length === filteredTasks.length}
                            onCheckedChange={toggleAll}
                          />
                        </th>
                      )}
                      <th className="p-3 text-left text-sm font-medium text-muted-foreground">Type</th>
                      <th className="p-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                      <th className="p-3 text-left text-sm font-medium text-muted-foreground">Run At</th>
                      <th className="p-3 text-left text-sm font-medium text-muted-foreground">Entities</th>
                      <th className="p-3 text-left text-sm font-medium text-muted-foreground">Brand</th>
                      <th className="p-3 text-right text-sm font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTasks.map(task => (
                      <tr key={task.id} className="border-b border-border/30 hover:bg-muted/30">
                        {!isReadOnly && (
                          <td className="p-3">
                            <Checkbox
                              checked={selectedTasks.includes(task.id)}
                              onCheckedChange={() => toggleTask(task.id)}
                            />
                          </td>
                        )}
                        <td className="p-3">
                          <span className="font-medium">{typeLabels[task.type] || task.type}</span>
                        </td>
                        <td className="p-3">
                          <Badge className={statusColors[task.status]}>
                            {task.status}
                          </Badge>
                        </td>
                        <td className="p-3 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(task.run_at), 'MMM d, yyyy')}
                          </div>
                          <div className="flex items-center gap-1 text-xs">
                            <Clock className="h-3 w-3" />
                            {format(new Date(task.run_at), 'h:mm a')}
                          </div>
                        </td>
                        <td className="p-3 text-sm">
                          {getEntitySummary(task)}
                        </td>
                        <td className="p-3 text-sm">
                          {String(task.payload?.brand || '-')}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setDetailTask(task)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {!isReadOnly && task.status === 'pending' && (
                              <>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => runTaskNow(task.id)}
                                >
                                  <Play className="h-4 w-4 text-emerald-400" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => cancelTask(task.id)}
                                >
                                  <X className="h-4 w-4 text-red-400" />
                                </Button>
                              </>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => openRelatedPanel(task)}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Task Detail Dialog */}
        <Dialog open={!!detailTask} onOpenChange={() => setDetailTask(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Task Details</DialogTitle>
            </DialogHeader>
            {detailTask && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground">Type</label>
                    <p className="font-medium">{typeLabels[detailTask.type]}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Status</label>
                    <Badge className={statusColors[detailTask.status]}>
                      {detailTask.status}
                    </Badge>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Run At</label>
                    <p className="text-sm">{format(new Date(detailTask.run_at), 'PPp')}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Created</label>
                    <p className="text-sm">{format(new Date(detailTask.created_at), 'PPp')}</p>
                  </div>
                </div>
                
                <div>
                  <label className="text-xs text-muted-foreground">Payload</label>
                  <pre className="mt-1 p-3 bg-muted/50 rounded-lg text-xs overflow-auto max-h-48">
                    {JSON.stringify(detailTask.payload, null, 2)}
                  </pre>
                </div>

                {detailTask.error_message && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <p className="text-sm">{detailTask.error_message}</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </GrabbaLayout>
  );
}
