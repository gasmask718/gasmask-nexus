/**
 * WORKER IMPACT PANEL
 * 
 * Per-worker contribution changes under simulation.
 * Descriptive, not judgmental.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ArrowUp,
  ArrowDown,
  Minus,
  User,
  UserMinus,
  AlertCircle,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { WorkerImpact } from './types';
import { SimulatedBadge } from './ScenarioToggle';

interface WorkerImpactPanelProps {
  impacts: WorkerImpact[];
}

export function WorkerImpactPanel({ impacts }: WorkerImpactPanelProps) {
  if (impacts.length === 0) {
    return null;
  }

  const loadChangeIcons = {
    increased: <ArrowUp className="h-3 w-3 text-amber-600" />,
    decreased: <ArrowDown className="h-3 w-3 text-emerald-600" />,
    same: <Minus className="h-3 w-3 text-muted-foreground" />,
    removed: <UserMinus className="h-3 w-3 text-red-600" />,
  };

  const loadChangeLabels = {
    increased: 'Increased load',
    decreased: 'Decreased load',
    same: 'No change',
    removed: 'Removed',
  };

  return (
    <Card className="border-purple-200 dark:border-purple-800 border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          Worker Impact Preview
          <SimulatedBadge />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {impacts.map(impact => (
            <div 
              key={impact.workerId}
              className={cn(
                "flex items-center justify-between p-2 rounded-lg",
                impact.loadChange === 'removed' 
                  ? "bg-red-50/50 dark:bg-red-950/20" 
                  : impact.loadChange === 'increased'
                    ? "bg-amber-50/50 dark:bg-amber-950/20"
                    : "bg-muted/30"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center",
                  impact.loadChange === 'removed' 
                    ? "bg-red-100 dark:bg-red-900/30" 
                    : "bg-muted"
                )}>
                  {impact.loadChange === 'removed' 
                    ? <UserMinus className="h-4 w-4 text-red-600" />
                    : <User className="h-4 w-4 text-muted-foreground" />
                  }
                </div>
                <div>
                  <p className={cn(
                    "text-sm font-medium",
                    impact.loadChange === 'removed' && "line-through text-muted-foreground"
                  )}>
                    {impact.workerName}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{impact.simulatedBoxesPerHour.toFixed(1)} boxes/hr</span>
                    {impact.loadChange !== 'same' && impact.loadChange !== 'removed' && (
                      <span className="flex items-center gap-0.5">
                        {loadChangeIcons[impact.loadChange]}
                        {loadChangeLabels[impact.loadChange]}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Contribution change */}
                <div className="text-right">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">
                      {impact.baselineContribution}%
                    </span>
                    <span className="text-xs text-muted-foreground">→</span>
                    <span className={cn(
                      "text-sm font-medium",
                      impact.contributionDelta > 0 ? "text-amber-600" : 
                      impact.contributionDelta < 0 ? "text-emerald-600" : ""
                    )}>
                      {impact.simulatedContribution}%
                    </span>
                  </div>
                  {impact.contributionDelta !== 0 && (
                    <span className={cn(
                      "text-xs",
                      impact.contributionDelta > 0 ? "text-amber-600" : "text-emerald-600"
                    )}>
                      {impact.contributionDelta > 0 ? '+' : ''}{impact.contributionDelta}%
                    </span>
                  )}
                </div>

                {/* Risk note */}
                {impact.riskNote && (
                  <Tooltip>
                    <TooltipTrigger>
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-xs">{impact.riskNote}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Disclaimer */}
        <div className="text-xs text-muted-foreground mt-3 flex items-start gap-2">
          <Info className="h-3 w-3 mt-0.5 shrink-0" />
          <span>
            Impact previews show relative changes under simulation assumptions, not predictions.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
