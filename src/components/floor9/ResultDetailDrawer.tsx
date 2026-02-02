// Floor 9 - Result Detail Drawer (Immutable Record View)
import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  User,
  FileText,
  Activity,
  Shield,
  Brain,
  Target,
  Undo2,
} from 'lucide-react';
import { useResultDetail, AIResultItem, AIResultArtifact, AIExecutionStep } from '@/hooks/useAIResults';
import { format } from 'date-fns';

interface ResultDetailDrawerProps {
  taskId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  completed: { icon: <CheckCircle className="h-4 w-4" />, color: 'bg-green-500', label: 'Completed' },
  failed: { icon: <XCircle className="h-4 w-4" />, color: 'bg-red-500', label: 'Failed' },
  escalated: { icon: <AlertTriangle className="h-4 w-4" />, color: 'bg-orange-500', label: 'Escalated' },
  blocked: { icon: <Shield className="h-4 w-4" />, color: 'bg-yellow-500', label: 'Blocked' },
  rolled_back: { icon: <Undo2 className="h-4 w-4" />, color: 'bg-purple-500', label: 'Rolled Back' },
};

const artifactStatusColors: Record<string, string> = {
  draft: 'bg-yellow-500/20 text-yellow-600',
  approved: 'bg-green-500/20 text-green-600',
  rejected: 'bg-red-500/20 text-red-600',
  applied: 'bg-blue-500/20 text-blue-600',
  rolled_back: 'bg-purple-500/20 text-purple-600',
};

export function ResultDetailDrawer({ taskId, open, onOpenChange }: ResultDetailDrawerProps) {
  const { data: result, isLoading } = useResultDetail(taskId);

  const statusInfo = result?.status ? statusConfig[result.status] || statusConfig.completed : statusConfig.completed;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-hidden flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Result Detail
          </SheetTitle>
          <SheetDescription>
            Immutable record of AI task execution
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {isLoading ? (
            <div className="space-y-4 py-4">
              <Skeleton className="h-24" />
              <Skeleton className="h-48" />
              <Skeleton className="h-32" />
            </div>
          ) : result ? (
            <div className="space-y-6 py-4">
              {/* Task Summary */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>Task Summary</span>
                    <Badge className={`${statusInfo.color} text-white flex items-center gap-1`}>
                      {statusInfo.icon}
                      {statusInfo.label}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <span className="font-medium">{result.task_title}</span>
                    {result.task_details && (
                      <p className="text-muted-foreground mt-1">{result.task_details}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-muted-foreground text-xs">Task Type</p>
                      <p className="font-medium">{result.task_type || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Execution Mode</p>
                      <Badge variant="outline">{result.execution_mode || 'recommendation_only'}</Badge>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Risk Level</p>
                      <Badge variant={result.risk_level === 'high' ? 'destructive' : 'secondary'}>
                        {result.risk_level || 'low'}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Priority</p>
                      <Badge variant="outline">{result.priority}</Badge>
                    </div>
                  </div>

                  {result.instructions && (
                    <div>
                      <p className="text-muted-foreground text-xs">Instructions</p>
                      <p className="bg-muted p-2 rounded text-sm">{result.instructions}</p>
                    </div>
                  )}

                  {result.target_entity_type && (
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Target:</span>
                      <Badge variant="secondary">{result.target_entity_type}</Badge>
                    </div>
                  )}

                  {result.worker && (
                    <div className="flex items-center gap-2">
                      <Brain className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">AI Worker:</span>
                      <span>{result.worker.worker_name} ({result.worker.worker_role})</span>
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Created: {format(new Date(result.created_at), 'MMM d, yyyy HH:mm')}
                    </span>
                    {result.completed_at && (
                      <span className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Completed: {format(new Date(result.completed_at), 'MMM d, yyyy HH:mm')}
                      </span>
                    )}
                  </div>

                  {result.time_saved_minutes && result.time_saved_minutes > 0 && (
                    <div className="bg-green-500/10 p-2 rounded flex items-center gap-2">
                      <Clock className="h-4 w-4 text-green-600" />
                      <span className="text-green-600 font-medium">
                        Time Saved: {Math.floor(result.time_saved_minutes / 60)}h {result.time_saved_minutes % 60}m
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Execution Trace */}
              {result.execution_steps && result.execution_steps.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      Execution Trace
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {result.execution_steps.map((step, idx) => (
                        <ExecutionStepItem key={step.id} step={step} isLast={idx === result.execution_steps!.length - 1} />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Artifacts */}
              {result.artifacts && result.artifacts.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Artifacts Produced ({result.artifacts.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {result.artifacts.map(artifact => (
                        <ArtifactItem key={artifact.id} artifact={artifact} />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Human Oversight */}
              {(result.approval_status || result.approved_by) && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Human Oversight
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Decision</span>
                      <Badge
                        variant={result.approval_status === 'approved' ? 'default' : 'destructive'}
                      >
                        {result.approval_status || 'Pending'}
                      </Badge>
                    </div>
                    {result.approved_at && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Decision Time</span>
                        <span>{format(new Date(result.approved_at), 'MMM d, yyyy HH:mm')}</span>
                      </div>
                    )}
                    {result.approval_notes && (
                      <div>
                        <p className="text-muted-foreground text-xs mb-1">Notes</p>
                        <p className="bg-muted p-2 rounded">{result.approval_notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Error Information */}
              {result.error_message && (
                <Card className="border-red-500/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2 text-red-600">
                      <XCircle className="h-4 w-4" />
                      Error Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-red-600 bg-red-500/10 p-2 rounded">
                      {result.error_message}
                    </p>
                    {result.validation_errors && result.validation_errors.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-muted-foreground mb-1">Validation Errors:</p>
                        <ul className="list-disc list-inside text-sm text-muted-foreground">
                          {result.validation_errors.map((err, i) => (
                            <li key={i}>{typeof err === 'string' ? err : JSON.stringify(err)}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Confidence Score */}
              {result.confidence_score != null && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Brain className="h-4 w-4" />
                      AI Confidence
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4">
                      <div className="text-3xl font-bold">{result.confidence_score}%</div>
                      <div className="flex-1">
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              result.confidence_score >= 80
                                ? 'bg-green-500'
                                : result.confidence_score >= 60
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${result.confidence_score}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Rollback Notice */}
              {result.rollback_until && new Date(result.rollback_until) > new Date() && (
                <Card className="border-purple-500/30 bg-purple-500/5">
                  <CardContent className="py-3 flex items-center gap-2">
                    <Undo2 className="h-4 w-4 text-purple-600" />
                    <span className="text-sm text-purple-600">
                      Rollback available until {format(new Date(result.rollback_until), 'MMM d, yyyy HH:mm')}
                    </span>
                  </CardContent>
                </Card>
              )}

              {/* Immutable Notice */}
              <div className="bg-muted/50 p-3 rounded text-xs text-muted-foreground flex items-center gap-2">
                <Shield className="h-4 w-4" />
                This record is immutable and represents the authoritative state at execution time.
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              No result found
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function ExecutionStepItem({ step, isLast }: { step: AIExecutionStep; isLast: boolean }) {
  const statusIcon = step.step_status === 'completed' ? (
    <CheckCircle className="h-3 w-3 text-green-500" />
  ) : step.step_status === 'failed' ? (
    <XCircle className="h-3 w-3 text-red-500" />
  ) : (
    <Clock className="h-3 w-3 text-yellow-500" />
  );

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
          {step.step_number}
        </div>
        {!isLast && <div className="w-px h-full bg-border" />}
      </div>
      <div className="flex-1 pb-3">
        <div className="flex items-center gap-2">
          {statusIcon}
          <span className="font-medium text-sm">{step.step_action}</span>
          {step.duration_ms && (
            <span className="text-xs text-muted-foreground">({step.duration_ms}ms)</span>
          )}
        </div>
        {step.error_message && (
          <p className="text-xs text-red-500 mt-1">{step.error_message}</p>
        )}
      </div>
    </div>
  );
}

function ArtifactItem({ artifact }: { artifact: AIResultArtifact }) {
  const statusClass = artifactStatusColors[artifact.status] || 'bg-muted text-muted-foreground';

  return (
    <div className="border rounded p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm">{artifact.artifact_title}</span>
        <Badge className={statusClass}>{artifact.status}</Badge>
      </div>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>Type: {artifact.artifact_type}</span>
        {artifact.target_entity_type && (
          <span>Entity: {artifact.target_entity_type}</span>
        )}
      </div>
      {artifact.approved_at && (
        <p className="text-xs text-muted-foreground">
          Approved: {format(new Date(artifact.approved_at), 'MMM d, yyyy HH:mm')}
        </p>
      )}
      {artifact.rolled_back_at && (
        <p className="text-xs text-purple-600">
          Rolled back: {format(new Date(artifact.rolled_back_at), 'MMM d, yyyy HH:mm')}
        </p>
      )}
    </div>
  );
}
