/**
 * GovernedButton Component
 * Phase A: Button Integrity Enforcement
 * 
 * Wraps action buttons with governance:
 * - Creates governed task instead of direct mutation
 * - Shows risk level badge
 * - Enforces dry-run for high-risk operations
 * - Displays approval requirements
 */

import { useState } from 'react';
import { Button, ButtonProps } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
import { Loader2, Shield, ShieldAlert, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useGovernedAction, GovernedActionConfig } from '@/hooks/useGovernedAction';
import { getActionMapping } from '@/services/taskGovernance/actionRegistry';
import { getRiskPolicy } from '@/services/taskGovernance/governanceConfig';
import { TaskRiskLevel } from '@/services/taskGovernance/types';
import { cn } from '@/lib/utils';

// ============= TYPES =============

interface GovernedButtonProps extends Omit<ButtonProps, 'onClick' | 'onError'> {
  /** Action ID from the action registry */
  actionId: string;
  /** Entity IDs being acted upon */
  entityIds?: string[];
  /** Override task title */
  taskTitle?: string;
  /** Additional context data */
  contextData?: Record<string, any>;
  /** The actual mutation to perform */
  onExecute: () => Promise<any>;
  /** Show risk badge */
  showRiskBadge?: boolean;
  /** Require confirmation for high-risk */
  requireConfirmation?: boolean;
  /** Callback after successful execution */
  onActionSuccess?: (taskId: string) => void;
  /** Callback on error */
  onActionError?: (error: string) => void;
}

// ============= RISK ICONS =============

const RiskIcon = ({ level }: { level: TaskRiskLevel }) => {
  switch (level) {
    case 'critical':
      return <ShieldAlert className="h-3.5 w-3.5 text-destructive" />;
    case 'high':
      return <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />;
    case 'medium':
      return <Shield className="h-3.5 w-3.5 text-yellow-500" />;
    case 'low':
    default:
      return <ShieldCheck className="h-3.5 w-3.5 text-green-500" />;
  }
};

const getRiskBadgeVariant = (level: TaskRiskLevel): 'destructive' | 'outline' | 'secondary' => {
  switch (level) {
    case 'critical':
    case 'high':
      return 'destructive';
    case 'medium':
      return 'secondary';
    default:
      return 'outline';
  }
};

// ============= COMPONENT =============

export function GovernedButton({
  actionId,
  entityIds,
  taskTitle,
  contextData,
  onExecute,
  showRiskBadge = true,
  requireConfirmation = true,
  onActionSuccess,
  onActionError,
  children,
  disabled,
  className,
  ...buttonProps
}: GovernedButtonProps) {
  const { execute, isExecuting } = useGovernedAction();
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Get action mapping
  const actionMapping = getActionMapping(actionId);
  if (!actionMapping) {
    console.error(`[GovernedButton] Unknown action ID: ${actionId}`);
    return (
      <Button disabled {...buttonProps} className={className}>
        {children}
      </Button>
    );
  }

  const riskPolicy = getRiskPolicy(actionMapping.risk_level);
  const needsConfirmation = requireConfirmation && 
    (actionMapping.risk_level === 'high' || actionMapping.risk_level === 'critical');

  const handleClick = async () => {
    if (needsConfirmation) {
      setShowConfirmation(true);
      return;
    }
    await executeAction();
  };

  const executeAction = async () => {
    setShowConfirmation(false);

    const config: GovernedActionConfig = {
      floor_id: actionMapping.floor_id,
      task_type: actionMapping.task_type,
      task_title: taskTitle || actionMapping.task_title,
      risk_level: actionMapping.risk_level,
      requires_approval: actionMapping.requires_approval,
      entity_ids: entityIds,
      entity_type: actionMapping.entity_type,
      context_data: contextData,
    };

    const result = await execute(config, onExecute);

    if (result.success && result.task_id) {
      onActionSuccess?.(result.task_id);
    } else if (!result.success) {
      onActionError?.(result.message);
    }
  };

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={handleClick}
              disabled={disabled || isExecuting}
              className={cn('gap-2', className)}
              {...buttonProps}
            >
              {isExecuting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : showRiskBadge ? (
                <RiskIcon level={actionMapping.risk_level} />
              ) : null}
              {children}
              {showRiskBadge && actionMapping.requires_approval && (
                <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0">
                  Approval
                </Badge>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <div className="space-y-1">
              <p className="font-medium">{actionMapping.action_name}</p>
              <p className="text-xs text-muted-foreground">{actionMapping.description}</p>
              <div className="flex items-center gap-2 text-xs">
                <Badge variant={getRiskBadgeVariant(actionMapping.risk_level)} className="text-[10px]">
                  {actionMapping.risk_level.toUpperCase()} RISK
                </Badge>
                {actionMapping.requires_approval && (
                  <span className="text-yellow-500">Requires approval</span>
                )}
                {riskPolicy.require_dry_run && (
                  <span className="text-blue-500">Dry-run recommended</span>
                )}
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* High-Risk Confirmation Dialog */}
      <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RiskIcon level={actionMapping.risk_level} />
              Confirm {actionMapping.risk_level.charAt(0).toUpperCase() + actionMapping.risk_level.slice(1)}-Risk Action
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>You are about to execute: <strong>{actionMapping.action_name}</strong></p>
              <p className="text-sm">{actionMapping.description}</p>
              {actionMapping.requires_approval && (
                <p className="text-yellow-600 dark:text-yellow-400">
                  ⚠️ This action will be queued for human approval before execution.
                </p>
              )}
              {riskPolicy.require_dry_run && (
                <p className="text-blue-600 dark:text-blue-400">
                  💡 Consider running a dry-run first to preview the outcome.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeAction} className="gap-2">
              <RiskIcon level={actionMapping.risk_level} />
              Proceed
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ============= SIMPLE GOVERNED WRAPPER =============

interface SimpleGovernedButtonProps extends Omit<ButtonProps, 'onClick'> {
  floorId: string;
  taskType: string;
  taskTitle: string;
  riskLevel?: TaskRiskLevel;
  entityIds?: string[];
  onExecute: () => Promise<any>;
  onSuccess?: (taskId: string) => void;
}

/**
 * Simplified governed button for actions not in the registry
 */
export function SimpleGovernedButton({
  floorId,
  taskType,
  taskTitle,
  riskLevel = 'medium',
  entityIds,
  onExecute,
  onSuccess,
  children,
  ...buttonProps
}: SimpleGovernedButtonProps) {
  const { execute, isExecuting } = useGovernedAction();

  const handleClick = async () => {
    const result = await execute(
      {
        floor_id: floorId as any,
        task_type: taskType,
        task_title: taskTitle,
        risk_level: riskLevel,
        entity_ids: entityIds,
      },
      onExecute
    );

    if (result.success && result.task_id) {
      onSuccess?.(result.task_id);
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={isExecuting}
      {...buttonProps}
    >
      {isExecuting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
      {children}
    </Button>
  );
}
