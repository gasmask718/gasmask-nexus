/**
 * GovernedTaskCard - Unified task card with progress, activity, and controls
 * Reusable across all floors (1-9)
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Brain,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Loader2,
  Trash2,
  Play,
  Pause,
  Activity,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  GovernedTask,
  getTaskActivities,
  cancelTask,
  deleteTask,
  restartTask,
  startTask,
} from '@/services/taskGovernance';
import { TaskProgressBar } from '@/components/floor9/TaskProgressBar';
import { TaskActivityFeed } from '@/components/floor9/TaskActivityFeed';
import { DeleteTaskModal } from '@/components/floor9/DeleteTaskModal';
import { TaskCompletionReport } from '@/components/floor9/TaskCompletionReport';

interface GovernedTaskCardProps {
  task: GovernedTask;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onRefresh?: () => void;
  compact?: boolean;
}

export function GovernedTaskCard({
  task,
  isExpanded: controlledExpanded,
  onToggleExpand,
  onRefresh,
  compact = false,
}: GovernedTaskCardProps) {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const isExpanded = controlledExpanded ?? internalExpanded;
  const handleToggle = onToggleExpand ?? (() => setInternalExpanded(!internalExpanded));
  const handleRefresh = onRefresh ?? (() => {});
  const queryClient = useQueryClient();
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Calculate progress
  const totalItems = task.total_items || 0;
  const itemsProcessed = task.items_processed || 0;
  const percentage = totalItems > 0 ? Math.round((itemsProcessed / totalItems) * 100) : 0;
  const hasProgress = totalItems > 0;

  // Status configuration
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'completed':
        return { icon: CheckCircle2, color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', borderColor: 'border-l-green-500' };
      case 'running':
        return { icon: Loader2, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', borderColor: 'border-l-blue-500', animate: true };
      case 'paused_for_approval':
        return { icon: Pause, color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400', borderColor: 'border-l-amber-500' };
      case 'failed':
        return { icon: XCircle, color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', borderColor: 'border-l-red-500' };
      case 'cancelled':
        return { icon: XCircle, color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400', borderColor: 'border-l-gray-500' };
      default:
        return { icon: Clock, color: 'bg-muted text-muted-foreground', borderColor: 'border-l-primary/30' };
    }
  };

  const statusConfig = getStatusConfig(task.status);
  const StatusIcon = statusConfig.icon;

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: async () => {
      return cancelTask(task.id, 'User requested cancellation');
    },
    onSuccess: (result) => {
      setShowDeleteModal(false);
      if (result.success) {
        toast.success('Task cancelled', {
          description: `${result.cancelled_actions} actions cancelled, ${result.preserved_records} records preserved`,
        });
        queryClient.invalidateQueries({ queryKey: ['global-active-tasks'] });
        handleRefresh();
      } else {
        toast.error('Cancellation failed', { description: result.error });
      }
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      return deleteTask(task.id, 'User requested deletion');
    },
    onSuccess: (result) => {
      setShowDeleteModal(false);
      if (result.success) {
        toast.success('Task deleted', {
          description: 'Task removed from active views',
        });
        queryClient.invalidateQueries({ queryKey: ['global-active-tasks'] });
        handleRefresh();
      } else {
        toast.error('Delete failed', { description: result.error });
      }
    },
  });

  // Restart mutation
  const restartMutation = useMutation({
    mutationFn: async () => {
      return restartTask(task.id);
    },
    onSuccess: (result) => {
      setShowDeleteModal(false);
      if (result.success) {
        toast.success('Task restarted', {
          description: `New task created: ${result.newTaskId?.slice(0, 8)}...`,
        });
        queryClient.invalidateQueries({ queryKey: ['global-active-tasks'] });
        handleRefresh();
      } else {
        toast.error('Restart failed', { description: result.error });
      }
    },
  });

  // Start task mutation
  const startMutation = useMutation({
    mutationFn: () => startTask(task.id),
    onSuccess: () => {
      toast.success('Task started');
      queryClient.invalidateQueries({ queryKey: ['global-active-tasks'] });
      handleRefresh();
    },
  });

  const isRunning = task.status === 'running';
  const isFinished = ['completed', 'failed', 'cancelled'].includes(task.status);
  const canCancel = !isFinished && task.status !== 'cancelled';
  const canStart = task.status === 'queued';

  return (
    <>
      <Card className={`border-l-4 ${statusConfig.borderColor}`}>
        <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Brain className="h-4 w-4 text-primary" />
                {task.task_title}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge className={statusConfig.color}>
                  <span className="flex items-center gap-1">
                    <StatusIcon className={`h-3 w-3 ${statusConfig.animate ? 'animate-spin' : ''}`} />
                    {task.status.replace(/_/g, ' ')}
                  </span>
                </Badge>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm">
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
              </div>
            </div>

            {/* Quick info */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
              <Badge variant="outline" className="text-xs">
                {task.task_type.replace(/_/g, ' ')}
              </Badge>
              {task.risk_level !== 'low' && (
                <Badge 
                  variant={task.risk_level === 'critical' ? 'destructive' : 'secondary'}
                  className="text-xs"
                >
                  {task.risk_level} risk
                </Badge>
              )}
              {task.requires_approval && (
                <Badge variant="outline" className="text-xs border-amber-500 text-amber-500">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Approval
                </Badge>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {/* Progress bar (always show if has items) */}
            {hasProgress && (
              <TaskProgressBar
                totalItems={totalItems}
                itemsProcessed={itemsProcessed}
                itemsCompleted={task.items_completed}
                itemsBlocked={task.items_blocked}
                itemsSkipped={task.items_skipped}
                itemsPendingApproval={task.items_pending_approval}
                status={task.status === 'running' ? 'processing' : task.status}
              />
            )}

            {/* Quick stats row */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(task.created_at).toLocaleString()}
              </div>
              {task.time_saved_minutes > 0 && (
                <Badge variant="secondary" className="text-xs">
                  ⏱️ {task.time_saved_minutes} min saved
                </Badge>
              )}
              {task.confidence_score && (
                <Badge variant="outline" className="text-xs">
                  Confidence: {task.confidence_score}%
                </Badge>
              )}
            </div>

            {/* Expanded content */}
            <CollapsibleContent className="space-y-4 pt-2">
              {/* Task details */}
              {task.task_details && (
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs font-medium mb-1">Details</p>
                  <p className="text-sm">{task.task_details}</p>
                </div>
              )}

              {/* Activity Feed */}
              <Separator />
              <TaskActivityFeed taskId={task.id} maxHeight="200px" />

              {/* Completion Report (for finished tasks) */}
              {isFinished && hasProgress && (
                <>
                  <Separator />
                  <TaskCompletionReport
                    taskTitle={task.task_title}
                    taskType={task.task_type}
                    status={task.status}
                    totalItems={totalItems}
                    itemsCompleted={task.items_completed}
                    itemsBlocked={task.items_blocked}
                    itemsSkipped={task.items_skipped}
                    blockedItems={[]}
                    startedAt={task.started_at}
                    completedAt={task.completed_at}
                    timeSavedMinutes={task.time_saved_minutes}
                    confidenceScore={task.confidence_score}
                  />
                </>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-4 border-t">
                {canStart && (
                  <Button
                    size="sm"
                    onClick={() => startMutation.mutate()}
                    disabled={startMutation.isPending}
                  >
                    {startMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Play className="h-4 w-4 mr-1" />
                    )}
                    Start
                  </Button>
                )}
                
                {/* Show lifecycle control button for all non-cancelled tasks */}
                {task.status !== 'cancelled' && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setShowDeleteModal(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    {isFinished ? 'Delete Task' : 'Cancel / Delete'}
                  </Button>
                )}

                {/* Restart button for finished tasks */}
                {isFinished && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => restartMutation.mutate()}
                    disabled={restartMutation.isPending}
                  >
                    {restartMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Play className="h-4 w-4 mr-1" />
                    )}
                    Restart
                  </Button>
                )}

                {task.final_report && (
                  <Button size="sm" variant="outline">
                    <FileText className="h-4 w-4 mr-1" />
                    View Report
                  </Button>
                )}
              </div>
            </CollapsibleContent>
          </CardContent>
        </Collapsible>
      </Card>

      {/* Delete confirmation modal */}
      <DeleteTaskModal
        open={showDeleteModal}
        onOpenChange={setShowDeleteModal}
        taskTitle={task.task_title}
        taskStatus={task.status === 'running' ? 'processing' : task.status}
        onConfirmCancel={() => cancelMutation.mutate()}
        onConfirmDelete={() => deleteMutation.mutate()}
        onConfirmRestart={() => restartMutation.mutate()}
        isCancelling={cancelMutation.isPending}
        isDeleting={deleteMutation.isPending}
        isRestarting={restartMutation.isPending}
      />
    </>
  );
}
