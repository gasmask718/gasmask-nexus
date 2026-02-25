/**
 * BATCH STATE CONTROLS
 * Renders state transition buttons for a single production batch.
 * Enforces valid transitions, field validation, and conversion confirmation.
 */

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { ArrowRight, Lock, CheckCircle, ShieldCheck } from 'lucide-react';
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
  /** Batch data for displaying conversion summary before approval */
  batchData?: {
    tobacco_lbs?: number;
    boxes_produced?: number;
    waste_lbs?: number;
  };
}

export function BatchStateControls({
  batchId,
  currentState,
  officeId,
  compact = false,
  batchData,
}: BatchStateControlsProps) {
  const transition = useTransitionBatchState();
  const config = getStateConfig(currentState);
  const nextStates = getNextStates(currentState);
  const [confirmed, setConfirmed] = useState(false);

  const handleTransition = (toState: InventoryState) => {
    transition.mutate({
      batchId,
      fromState: currentState,
      toState,
      officeId,
      conversionConfirmed: toState === 'approved' ? confirmed : undefined,
    });
  };

  // Compute conversion preview for approval dialog
  const lbs = batchData?.tobacco_lbs || 0;
  const boxes = batchData?.boxes_produced || 0;
  const lbsPerBox = boxes > 0 ? (lbs / boxes).toFixed(3) : '—';
  const boxesPerLb = lbs > 0 ? (boxes / lbs).toFixed(3) : '—';
  const wastePct = lbs > 0 && batchData?.waste_lbs ? ((batchData.waste_lbs / lbs) * 100).toFixed(1) : null;

  const renderApprovalDialog = (ns: InventoryState) => {
    const nsConfig = getStateConfig(ns);
    return (
      <AlertDialog key={ns}>
        <AlertDialogTrigger asChild>
          <Button
            size={compact ? 'sm' : 'sm'}
            variant={compact ? 'outline' : 'default'}
            className={compact ? 'h-6 text-xs' : ''}
            disabled={transition.isPending}
          >
            {compact ? <ArrowRight className="h-3 w-3 mr-1" /> : <ArrowRight className="h-4 w-4 mr-1" />}
            {compact ? nsConfig.label : `Move to ${nsConfig.label}`}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Approve for Distribution?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Approving this batch locks all conversion fields permanently and makes it visible to CRM and distribution.
                </p>

                {/* Conversion Summary */}
                <div className="rounded-md border bg-muted/30 p-3 space-y-1.5 text-sm">
                  <p className="font-semibold text-foreground">Conversion Summary</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs">
                    <span className="text-muted-foreground">Material Input:</span>
                    <span className="font-medium text-foreground">{lbs} lbs</span>
                    <span className="text-muted-foreground">Output:</span>
                    <span className="font-medium text-foreground">{boxes} boxes</span>
                    <span className="text-muted-foreground">LBS / Box:</span>
                    <span className="font-medium text-foreground">{lbsPerBox}</span>
                    <span className="text-muted-foreground">Boxes / LB:</span>
                    <span className="font-medium text-foreground">{boxesPerLb}</span>
                    {wastePct && (
                      <>
                        <span className="text-muted-foreground">Waste:</span>
                        <span className={cn('font-medium', parseFloat(wastePct) > 5 ? 'text-destructive' : 'text-foreground')}>
                          {wastePct}%
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Manager Confirmation Checkbox */}
                <div className="flex items-start gap-2 pt-1">
                  <Checkbox
                    id="confirm-conversion"
                    checked={confirmed}
                    onCheckedChange={(v) => setConfirmed(v === true)}
                  />
                  <label htmlFor="confirm-conversion" className="text-xs leading-tight cursor-pointer text-foreground">
                    I confirm material-to-output numbers are accurate and ready for permanent lock.
                  </label>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmed(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleTransition(ns)}
              disabled={!confirmed}
              className={cn(!confirmed && 'opacity-50 cursor-not-allowed')}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Confirm Approval
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  };

  const renderButton = (ns: InventoryState) => {
    if (ns === 'approved') return renderApprovalDialog(ns);
    const nsConfig = getStateConfig(ns);
    return (
      <Button
        key={ns}
        size="sm"
        variant={compact ? 'outline' : 'default'}
        className={compact ? 'h-6 text-xs' : ''}
        onClick={() => handleTransition(ns)}
        disabled={transition.isPending}
      >
        {compact ? <ArrowRight className="h-3 w-3 mr-1" /> : <ArrowRight className="h-4 w-4 mr-1" />}
        {compact ? nsConfig.label : `Move to ${nsConfig.label}`}
      </Button>
    );
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Badge className={cn('text-xs border', config.color)}>
          {config.icon} {config.label}
        </Badge>
        {nextStates.length > 0 && nextStates.map(renderButton)}
        {nextStates.length === 0 && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Lock className="h-3 w-3" />
            Final state
          </span>
        )}
      </div>
    );
  }

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
          {nextStates.map(renderButton)}
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
