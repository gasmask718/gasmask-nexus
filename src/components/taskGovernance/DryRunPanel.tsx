/**
 * DryRunPanel Component
 * Phase D: Dry-Run Execution Mode
 * 
 * Displays dry-run results and controls live execution.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  RotateCcw,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Loader2,
} from 'lucide-react';
import { DryRunResult } from '@/services/taskGovernance/dryRunService';
import { cn } from '@/lib/utils';

// ============= TYPES =============

interface DryRunPanelProps {
  result: DryRunResult | null;
  isRunning?: boolean;
  onRunDryRun?: () => Promise<void>;
  onExecuteLive?: () => Promise<void>;
  onReset?: () => void;
  showLiveExecution?: boolean;
  className?: string;
}

// ============= COMPONENT =============

export function DryRunPanel({
  result,
  isRunning = false,
  onRunDryRun,
  onExecuteLive,
  onReset,
  showLiveExecution = true,
  className,
}: DryRunPanelProps) {
  const [showLiveConfirmation, setShowLiveConfirmation] = useState(false);

  if (!result && !isRunning) {
    return (
      <Card className={cn('border-dashed', className)}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-blue-500" />
            Dry-Run Mode
          </CardTitle>
          <CardDescription>
            Simulate the task to preview outcomes before making any changes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={onRunDryRun} className="w-full gap-2">
            <Play className="h-4 w-4" />
            Run Dry-Run Simulation
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isRunning) {
    return (
      <Card className={cn('border-blue-500/50', className)}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            Running Dry-Run...
          </CardTitle>
          <CardDescription>Simulating task execution</CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={50} className="animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  if (!result) return null;

  const completionPercent = result.simulated_progress.total_items > 0
    ? Math.round((result.would_complete / result.simulated_progress.total_items) * 100)
    : 0;

  return (
    <>
      <Card className={cn(
        result.passed ? 'border-green-500/50' : 'border-orange-500/50',
        className
      )}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              {result.passed ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-green-600 dark:text-green-400">Dry-Run Passed</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  <span className="text-orange-600 dark:text-orange-400">Dry-Run Has Issues</span>
                </>
              )}
            </CardTitle>
            <Badge variant={result.passed ? 'secondary' : 'outline'}>
              {completionPercent}% Would Complete
            </Badge>
          </div>
          <CardDescription className="flex items-center gap-2">
            <Clock className="h-3 w-3" />
            Estimated: {result.estimated_duration_minutes} min
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Progress Summary */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded-lg bg-green-500/10">
              <p className="text-lg font-bold text-green-600">{result.would_complete}</p>
              <p className="text-xs text-muted-foreground">Would Complete</p>
            </div>
            <div className="p-2 rounded-lg bg-red-500/10">
              <p className="text-lg font-bold text-red-600">{result.would_block}</p>
              <p className="text-xs text-muted-foreground">Would Block</p>
            </div>
            <div className="p-2 rounded-lg bg-yellow-500/10">
              <p className="text-lg font-bold text-yellow-600">{result.would_skip}</p>
              <p className="text-xs text-muted-foreground">Would Skip</p>
            </div>
          </div>

          <Progress value={completionPercent} className="h-2" />

          {/* Governance Warnings */}
          {result.governance_warnings.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium flex items-center gap-1 text-orange-600">
                <ShieldAlert className="h-3.5 w-3.5" />
                Governance Warnings
              </p>
              <ScrollArea className="h-20">
                <ul className="text-xs space-y-1">
                  {result.governance_warnings.map((warning, i) => (
                    <li key={i} className="text-orange-600 dark:text-orange-400">
                      • {warning}
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </div>
          )}

          {/* Blocking Reasons */}
          {result.blocking_reasons.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium flex items-center gap-1 text-red-600">
                <XCircle className="h-3.5 w-3.5" />
                Blocked Items ({result.blocking_reasons.length})
              </p>
              <ScrollArea className="h-24">
                <ul className="text-xs space-y-1">
                  {result.blocking_reasons.slice(0, 10).map((reason, i) => (
                    <li key={i} className="text-red-600 dark:text-red-400">
                      • {reason}
                    </li>
                  ))}
                  {result.blocking_reasons.length > 10 && (
                    <li className="text-muted-foreground">
                      ...and {result.blocking_reasons.length - 10} more
                    </li>
                  )}
                </ul>
              </ScrollArea>
            </div>
          )}

          <Separator />

          {/* Actions */}
          <div className="flex gap-2">
            {onReset && (
              <Button variant="outline" size="sm" onClick={onReset} className="gap-1.5">
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </Button>
            )}
            {onRunDryRun && (
              <Button variant="outline" size="sm" onClick={onRunDryRun} className="gap-1.5">
                <Play className="h-3.5 w-3.5" />
                Re-run
              </Button>
            )}
            {showLiveExecution && onExecuteLive && (
              <Button
                size="sm"
                onClick={() => setShowLiveConfirmation(true)}
                disabled={!result.passed && !result.governance_warnings.length}
                className="gap-1.5 ml-auto"
                variant={result.passed ? 'default' : 'destructive'}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Execute Live
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Live Execution Confirmation */}
      <AlertDialog open={showLiveConfirmation} onOpenChange={setShowLiveConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {result.passed ? (
                <ShieldCheck className="h-5 w-5 text-green-500" />
              ) : (
                <ShieldAlert className="h-5 w-5 text-orange-500" />
              )}
              Execute Task Live?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                This will execute the task with <strong>real database writes</strong>.
              </p>
              <div className="p-3 rounded-lg bg-muted/50 text-sm">
                <p>• {result.would_complete} items will be processed</p>
                <p>• {result.would_block} items will be blocked</p>
                <p>• {result.would_skip} items will be skipped</p>
              </div>
              {!result.passed && (
                <p className="text-orange-600 dark:text-orange-400">
                  ⚠️ The dry-run flagged issues. Proceed with caution.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowLiveConfirmation(false);
                onExecuteLive?.();
              }}
              className={result.passed ? '' : 'bg-orange-500 hover:bg-orange-600'}
            >
              Execute Live
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
