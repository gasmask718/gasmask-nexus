/**
 * TaskExecutionCard - Enhanced Task Card for Phase 9.2
 * 
 * Shows execution state, artifacts, approval gates, and audit log
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Brain,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  FileText,
  Play,
  Pause,
  RotateCcw,
  Shield,
  Loader2,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  getTaskArtifacts,
  getTaskExecutionLog,
  approveTask,
  rejectTask,
  executeTask,
  rollbackTask,
  TaskArtifact,
  TaskExecutionLogEntry,
} from '@/services/floor9/executionEngine';
import { AIWorkTask } from '@/services/floor9/types';

interface TaskExecutionCardProps {
  task: AIWorkTask & {
    task_type?: string;
    execution_mode?: string;
    approval_status?: string;
    confidence_score?: number;
    risk_level?: string;
    time_saved_minutes?: number;
    rollback_until?: string;
    target_entity_type?: string;
    instructions?: string;
  };
}

export function TaskExecutionCard({ task }: TaskExecutionCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Fetch artifacts and execution log
  const { data: artifacts = [] } = useQuery({
    queryKey: ['floor9', 'artifacts', task.id],
    queryFn: () => getTaskArtifacts(task.id),
    enabled: isExpanded,
  });

  const { data: executionLog = [] } = useQuery({
    queryKey: ['floor9', 'execution-log', task.id],
    queryFn: () => getTaskExecutionLog(task.id),
    enabled: isExpanded,
  });

  // Mutations
  const approveMutation = useMutation({
    mutationFn: () => approveTask(task.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['floor9', 'tasks'] });
      toast({ title: 'Task Approved', description: 'Execution will proceed.' });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => rejectTask(task.id, undefined, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['floor9', 'tasks'] });
      setShowRejectDialog(false);
      toast({ title: 'Task Rejected' });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const executeMutation = useMutation({
    mutationFn: () => executeTask(task.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['floor9', 'tasks'] });
      toast({ title: 'Task Executed' });
    },
    onError: (err: Error) => {
      toast({ title: 'Execution Failed', description: err.message, variant: 'destructive' });
    },
  });

  const rollbackMutation = useMutation({
    mutationFn: () => rollbackTask(task.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['floor9', 'tasks'] });
      toast({ title: 'Task Rolled Back' });
    },
  });

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'completed':
        return { icon: CheckCircle2, color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' };
      case 'processing':
      case 'validating_inputs':
        return { icon: Loader2, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', animate: true };
      case 'awaiting_approval':
        return { icon: Shield, color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' };
      case 'failed':
      case 'blocked':
        return { icon: XCircle, color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' };
      case 'escalated':
        return { icon: AlertTriangle, color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' };
      case 'rolled_back':
        return { icon: RotateCcw, color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400' };
      default:
        return { icon: Clock, color: 'bg-muted text-muted-foreground' };
    }
  };

  const statusConfig = getStatusConfig(task.status);
  const StatusIcon = statusConfig.icon;

  const canRollback = task.rollback_until && new Date(task.rollback_until) > new Date();
  const needsApproval = task.approval_status === 'pending' || (task.status as string) === 'awaiting_approval';

  return (
    <>
      <Card className={`border-l-4 ${
        task.status === 'completed' ? 'border-l-green-500' :
        task.status === 'failed' ? 'border-l-red-500' :
        needsApproval ? 'border-l-amber-500' :
        'border-l-primary/50'
      }`}>
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
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
                    {task.status.replace('_', ' ')}
                  </span>
                </Badge>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm">
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
              </div>
            </div>

            {/* Quick Info Row */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
              {task.task_type && (
                <Badge variant="outline" className="text-xs">
                  {task.task_type.replace(/_/g, ' ')}
                </Badge>
              )}
              {task.execution_mode && (
                <Badge variant="secondary" className="text-xs">
                  {task.execution_mode.replace(/_/g, ' ')}
                </Badge>
              )}
              {task.priority && (
                <Badge variant="outline" className={`text-xs ${
                  task.priority === 'critical' ? 'border-red-500 text-red-500' :
                  task.priority === 'high' ? 'border-orange-500 text-orange-500' :
                  ''
                }`}>
                  {task.priority}
                </Badge>
              )}
              {task.department && (
                <span>{task.department}</span>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {/* Description */}
            {task.task_details && (
              <p className="text-sm text-muted-foreground">{task.task_details}</p>
            )}

            {/* Approval Actions */}
            {needsApproval && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <Shield className="h-5 w-5 text-amber-600" />
                <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  Awaiting Human Approval
                </span>
                <div className="ml-auto flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowRejectDialog(true)}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => approveMutation.mutate()}
                    disabled={approveMutation.isPending}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Approve
                  </Button>
                </div>
              </div>
            )}

            {/* Quick Stats */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(task.created_at).toLocaleString()}
              </div>
              {task.time_saved_minutes && task.time_saved_minutes > 0 && (
                <Badge variant="secondary" className="text-xs">
                  ⏱️ {task.time_saved_minutes} min saved
                </Badge>
              )}
              {task.confidence_score && (
                <Badge variant="outline" className="text-xs">
                  Confidence: {task.confidence_score}%
                </Badge>
              )}
              {canRollback && (
                <Badge variant="outline" className="text-xs border-blue-500 text-blue-500">
                  Rollback available
                </Badge>
              )}
            </div>

            {/* Expandable Details */}
            <CollapsibleContent className="space-y-4 pt-2">
              {/* Instructions */}
              {task.instructions && (
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs font-medium mb-1">Instructions</p>
                  <p className="text-sm">{task.instructions}</p>
                </div>
              )}

              {/* Artifacts */}
              {artifacts.length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-2 flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    Artifacts ({artifacts.length})
                  </p>
                  <div className="space-y-2">
                    {artifacts.map((artifact: TaskArtifact) => (
                      <div
                        key={artifact.id}
                        className="p-2 rounded border bg-card flex items-center justify-between"
                      >
                        <div>
                          <p className="text-sm font-medium">{artifact.artifact_title}</p>
                          <p className="text-xs text-muted-foreground">
                            {artifact.artifact_type.replace(/_/g, ' ')} • {artifact.status}
                          </p>
                        </div>
                        <Badge variant={artifact.status === 'draft' ? 'secondary' : 'outline'}>
                          {artifact.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Execution Log */}
              {executionLog.length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-2">Execution Log</p>
                  <div className="space-y-1">
                    {executionLog.map((entry: TaskExecutionLogEntry) => (
                      <div
                        key={entry.id}
                        className={`text-xs p-2 rounded flex items-center gap-2 ${
                          entry.step_status === 'completed' ? 'bg-green-50 dark:bg-green-900/20' :
                          entry.step_status === 'failed' ? 'bg-red-50 dark:bg-red-900/20' :
                          'bg-muted/50'
                        }`}
                      >
                        <span className="font-mono text-muted-foreground">
                          #{entry.step_number}
                        </span>
                        <span>{entry.step_action.replace(/_/g, ' ')}</span>
                        <Badge
                          variant="outline"
                          className={`ml-auto ${
                            entry.step_status === 'completed' ? 'border-green-500 text-green-600' :
                            entry.step_status === 'failed' ? 'border-red-500 text-red-600' :
                            ''
                          }`}
                        >
                          {entry.step_status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2 border-t">
                {(task.status as string) === 'assigned' && (
                  <Button
                    size="sm"
                    onClick={() => executeMutation.mutate()}
                    disabled={executeMutation.isPending}
                  >
                    <Play className="h-4 w-4 mr-1" />
                    Execute
                  </Button>
                )}
                {canRollback && (task.status as string) === 'completed' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => rollbackMutation.mutate()}
                    disabled={rollbackMutation.isPending}
                  >
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Rollback
                  </Button>
                )}
              </div>
            </CollapsibleContent>
          </CardContent>
        </Collapsible>
      </Card>

      {/* Reject Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Task</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a reason for rejection (minimum 10 characters).
              This feedback trains the AI to improve.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Explain why this task should be rejected..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="min-h-[100px]"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => rejectMutation.mutate(rejectReason)}
              disabled={rejectReason.length < 10 || rejectMutation.isPending}
            >
              Reject Task
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
