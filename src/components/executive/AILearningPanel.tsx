// ═══════════════════════════════════════════════════════════════════════════════
// AI LEARNING PANEL — Phase 6: Controlled AI Learning (Opt-In, Gated)
// ═══════════════════════════════════════════════════════════════════════════════
// Learning is opt-in. All outputs require explicit Approve / Reject.
// One-click rollback. Full audit trail.

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  FlaskConical,
  Play,
  CheckCircle2,
  RotateCcw,
  Clock,
  AlertTriangle,
  Eye,
} from 'lucide-react';
import { useAILearningRuns, type LearningRun } from '@/hooks/useAILearningRuns';
import { format, subDays } from 'date-fns';

export function AILearningPanel() {
  const { runs, runsLoading, startLearningRun, approveLearningRun, rollbackLearningRun } = useAILearningRuns();
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  const handleStartRun = () => {
    const end = new Date().toISOString();
    const start = subDays(new Date(), 30).toISOString();
    startLearningRun(start, end);
  };

  const getStatusBadge = (run: LearningRun) => {
    if (run.status === 'rolled_back') {
      return <Badge variant="outline" className="bg-muted text-muted-foreground">Rolled Back</Badge>;
    }
    if (run.approved) {
      return <Badge variant="default" className="bg-green-500">Approved</Badge>;
    }
    if (run.status === 'completed') {
      return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">Pending Review</Badge>;
    }
    return <Badge variant="outline">Pending</Badge>;
  };

  if (runsLoading) {
    return <div className="space-y-4">{[1, 2].map(i => <Skeleton key={i} className="h-32" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <FlaskConical className="h-5 w-5" />
            AI Learning Runs
          </h3>
          <p className="text-sm text-muted-foreground">
            Opt-in, audited analysis of dispatch feedback — no auto-modifications
          </p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button>
              <Play className="h-4 w-4 mr-2" />
              Start Learning Run
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Start AI Learning Run</AlertDialogTitle>
              <AlertDialogDescription>
                This will analyze the last 30 days of dispatch feedback and produce a proposed diff. 
                No changes will be applied until you explicitly approve them.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleStartRun}>Start Analysis</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {runs.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title="No learning runs"
          description="Start a learning run to analyze dispatch feedback patterns"
        />
      ) : (
        <div className="space-y-3">
          {runs.map(run => (
            <Card key={run.id} className={run.status === 'rolled_back' ? 'opacity-60' : ''}>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusBadge(run)}
                    <span className="text-sm text-muted-foreground">
                      <Clock className="h-3.5 w-3.5 inline mr-1" />
                      {format(new Date(run.started_at), 'MMM d, yyyy HH:mm')}
                    </span>
                    {run.summary && (
                      <span className="text-xs text-muted-foreground">
                        {(run.summary as any).feedback_count} feedback items •{' '}
                        {(run.summary as any).apply_rate}% apply rate •{' '}
                        {(run.summary as any).observations_count} observations
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedRunId(expandedRunId === run.id ? null : run.id)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      {expandedRunId === run.id ? 'Hide' : 'Review'}
                    </Button>
                    {run.status === 'completed' && !run.approved && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => approveLearningRun(run.id)}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => rollbackLearningRun(run.id)}
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </>
                    )}
                    {run.approved && run.status !== 'rolled_back' && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <RotateCcw className="h-4 w-4 mr-1" />
                            Rollback
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Rollback Learning Run</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will revert all changes from this learning run. The audit log will be preserved.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => rollbackLearningRun(run.id)}>
                              Confirm Rollback
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>

                {/* Expanded Proposed Diff */}
                {expandedRunId === run.id && run.proposed_diff && (
                  <Card className="bg-muted/30 border-dashed">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Proposed Changes</CardTitle>
                      <CardDescription>
                        Window: {run.data_window_start ? format(new Date(run.data_window_start), 'MMM d, yyyy') : '?'} – {run.data_window_end ? format(new Date(run.data_window_end), 'MMM d, yyyy') : '?'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {(run.proposed_diff as any).observations?.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Observations</p>
                          <div className="space-y-1">
                            {((run.proposed_diff as any).observations as string[]).map((obs, i) => (
                              <div key={i} className="flex items-start gap-2 text-sm">
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                                <span>{obs}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {Object.keys((run.proposed_diff as any).proposed_weight_adjustments || {}).length > 0 && (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Proposed Adjustments</p>
                          <div className="space-y-1">
                            {Object.entries((run.proposed_diff as any).proposed_weight_adjustments).map(([key, val]) => (
                              <div key={key} className="flex items-start gap-2 text-sm">
                                <span className="font-mono text-primary">{key}:</span>
                                <span className="text-muted-foreground">{String(val)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="text-xs text-muted-foreground border-t pt-2">
                        Apply rate: {(run.proposed_diff as any).apply_rate}% •
                        Total feedback: {(run.proposed_diff as any).total_feedback}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
