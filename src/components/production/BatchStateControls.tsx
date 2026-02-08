/**
 * BATCH STATE CONTROLS
 * Renders state transition buttons for a single production batch.
 * Enforces valid transitions and logs every change.
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { ArrowRight, Lock, CheckCircle } from 'lucide-react';
import {
  getNextStates,
  getStateConfig,
  useTransitionBatchState,
  type InventoryState,
} from '@/hooks/useInventoryState';
import { cn } from '@/lib/utils';

interface BatchStateControlsProps {
  batchId: string;
  currentState: InventoryState;
  officeId: string;
  compact?: boolean;
}

export function BatchStateControls({
  batchId,
  currentState,
  officeId,
  compact = false,
}: BatchStateControlsProps) {
  const transition = useTransitionBatchState();
  const config = getStateConfig(currentState);
  const nextStates = getNextStates(currentState);

  const handleTransition = (toState: InventoryState) => {
    transition.mutate({
      batchId,
      fromState: currentState,
      toState,
      officeId,
    });
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Badge className={cn('text-xs border', config.color)}>
          {config.icon} {config.label}
        </Badge>
        {nextStates.length > 0 && (
          <>
            {nextStates.map(ns => {
              const nsConfig = getStateConfig(ns);
              const requiresApproval = ns === 'approved';

              if (requiresApproval) {
                return (
                  <AlertDialog key={ns}>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-xs"
                        disabled={transition.isPending}
                      >
                        <ArrowRight className="h-3 w-3 mr-1" />
                        {nsConfig.label}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Approve for Distribution?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will mark the batch as <strong>Approved</strong> and make it visible to CRM and distribution channels.
                          This action requires manager authorization.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleTransition(ns)}>
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approve
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                );
              }

              return (
                <Button
                  key={ns}
                  size="sm"
                  variant="outline"
                  className="h-6 text-xs"
                  onClick={() => handleTransition(ns)}
                  disabled={transition.isPending}
                >
                  <ArrowRight className="h-3 w-3 mr-1" />
                  {nsConfig.label}
                </Button>
              );
            })}
          </>
        )}
        {nextStates.length === 0 && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Lock className="h-3 w-3" />
            Final state
          </span>
        )}
      </div>
    );
  }

  // Full display
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">State:</span>
        <Badge className={cn('border', config.color)}>
          {config.icon} {config.label}
        </Badge>
      </div>

      {nextStates.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Next:</span>
          {nextStates.map(ns => {
            const nsConfig = getStateConfig(ns);
            const requiresApproval = ns === 'approved';

            if (requiresApproval) {
              return (
                <AlertDialog key={ns}>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="default" disabled={transition.isPending}>
                      <ArrowRight className="h-4 w-4 mr-1" />
                      Move to {nsConfig.label}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Approve for Distribution?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Approving this batch makes it visible to CRM and distribution.
                        Ensure all quality checks are complete.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleTransition(ns)}>
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Confirm Approval
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              );
            }

            return (
              <Button
                key={ns}
                size="sm"
                variant="default"
                onClick={() => handleTransition(ns)}
                disabled={transition.isPending}
              >
                <ArrowRight className="h-4 w-4 mr-1" />
                Move to {nsConfig.label}
              </Button>
            );
          })}
        </div>
      )}

      {nextStates.length === 0 && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Lock className="h-3 w-3" />
          This batch has reached its final distribution state.
        </p>
      )}
    </div>
  );
}
