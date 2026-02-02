/**
 * TaskProgressBar - Visual progress indicator for AI task execution
 * Shows percentage complete with numeric breakdown
 */

import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, AlertTriangle, Clock, Loader2 } from 'lucide-react';

interface TaskProgressBarProps {
  totalItems: number;
  itemsProcessed: number;
  itemsCompleted: number;
  itemsBlocked: number;
  itemsSkipped: number;
  itemsPendingApproval: number;
  status: string;
}

export function TaskProgressBar({
  totalItems,
  itemsProcessed,
  itemsCompleted,
  itemsBlocked,
  itemsSkipped,
  itemsPendingApproval,
  status,
}: TaskProgressBarProps) {
  const percentage = totalItems > 0 
    ? Math.round((itemsProcessed / totalItems) * 100) 
    : 0;

  const isRunning = status === 'processing' || status === 'validating_inputs';
  const isComplete = status === 'completed';
  const isFailed = status === 'failed' || status === 'blocked';
  const isCancelled = status === 'cancelled';

  const getProgressColor = () => {
    if (isCancelled) return 'bg-muted';
    if (isFailed) return 'bg-destructive';
    if (isComplete) return 'bg-green-500';
    if (itemsBlocked > 0) return 'bg-amber-500';
    return 'bg-primary';
  };

  return (
    <div className="space-y-3">
      {/* Progress Bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Progress: {itemsProcessed} / {totalItems}
          </span>
          <span className={`font-bold ${
            isComplete ? 'text-green-600' : 
            isFailed ? 'text-destructive' : 
            'text-primary'
          }`}>
            {percentage}%
          </span>
        </div>
        <div className="relative">
          <Progress 
            value={percentage} 
            className={`h-3 ${getProgressColor()}`}
          />
          {isRunning && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-3 w-3 animate-spin text-primary-foreground" />
            </div>
          )}
        </div>
      </div>

      {/* Counters Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
        <div className="flex items-center gap-1 p-2 rounded bg-green-50 dark:bg-green-900/20">
          <CheckCircle2 className="h-3 w-3 text-green-600" />
          <span className="text-green-700 dark:text-green-400">
            Completed: <strong>{itemsCompleted}</strong>
          </span>
        </div>
        
        <div className="flex items-center gap-1 p-2 rounded bg-blue-50 dark:bg-blue-900/20">
          <Clock className="h-3 w-3 text-blue-600" />
          <span className="text-blue-700 dark:text-blue-400">
            Processed: <strong>{itemsProcessed}</strong>
          </span>
        </div>
        
        <div className="flex items-center gap-1 p-2 rounded bg-amber-50 dark:bg-amber-900/20">
          <AlertTriangle className="h-3 w-3 text-amber-600" />
          <span className="text-amber-700 dark:text-amber-400">
            Blocked: <strong>{itemsBlocked}</strong>
          </span>
        </div>
        
        <div className="flex items-center gap-1 p-2 rounded bg-muted">
          <XCircle className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">
            Skipped: <strong>{itemsSkipped}</strong>
          </span>
        </div>
        
        <div className="flex items-center gap-1 p-2 rounded bg-purple-50 dark:bg-purple-900/20">
          <Clock className="h-3 w-3 text-purple-600" />
          <span className="text-purple-700 dark:text-purple-400">
            Pending: <strong>{itemsPendingApproval}</strong>
          </span>
        </div>
      </div>
    </div>
  );
}