/**
 * SCENARIO OUTPUT PANEL
 * 
 * Real-time recalculation display with comparison to baseline.
 * Informational only, no alerts or severity colors.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ArrowUp,
  ArrowDown,
  Minus,
  Clock,
  Gauge,
  Package,
  AlertTriangle,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScenarioOutput } from './types';
import { SimulatedBadge } from './ScenarioToggle';

interface ScenarioOutputPanelProps {
  baseline: ScenarioOutput;
  simulated: ScenarioOutput;
  targetBoxes: number;
  boxesCompleted: number;
  isScenarioMode: boolean;
}

function DeltaIndicator({ value, unit = '%', inverse = false }: { value: number; unit?: string; inverse?: boolean }) {
  const isPositive = inverse ? value < 0 : value > 0;
  const isNegative = inverse ? value > 0 : value < 0;
  
  if (Math.abs(value) < 0.1) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  
  return (
    <span className={cn(
      "text-xs font-medium flex items-center gap-0.5",
      isPositive ? "text-emerald-600" : isNegative ? "text-amber-600" : "text-muted-foreground"
    )}>
      {value > 0 ? <ArrowUp className="h-3 w-3" /> : value < 0 ? <ArrowDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
      {Math.abs(value).toFixed(1)}{unit}
    </span>
  );
}

export function ScenarioOutputPanel({
  baseline,
  simulated,
  targetBoxes,
  boxesCompleted,
  isScenarioMode,
}: ScenarioOutputPanelProps) {
  const output = isScenarioMode ? simulated : baseline;
  const boxesRemaining = Math.max(0, targetBoxes - boxesCompleted);
  const progressPct = Math.min(100, (boxesCompleted / targetBoxes) * 100);

  const confidenceColors = {
    high: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30',
    medium: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30',
    low: 'text-red-600 bg-red-100 dark:bg-red-900/30',
  };

  return (
    <Card className={cn(
      isScenarioMode && "border-purple-200 dark:border-purple-800 border-dashed"
    )}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {isScenarioMode ? 'Simulated Output' : 'Projected Output'}
          {isScenarioMode && <SimulatedBadge />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Metrics Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Capacity */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Package className="h-3 w-3" />
              Capacity
            </p>
            <p className="text-2xl font-bold">{output.totalCapacity.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">boxes/hour</p>
            {isScenarioMode && (
              <DeltaIndicator value={simulated.capacityDelta} />
            )}
          </div>

          {/* Time to Complete */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Time to Complete
            </p>
            <p className="text-2xl font-bold">
              {output.timeToComplete === Infinity ? '—' : (
                <>
                  {Math.floor(output.timeToComplete)}h {output.minutesToComplete}m
                </>
              )}
            </p>
            <p className="text-xs text-muted-foreground">{boxesRemaining} boxes remaining</p>
            {isScenarioMode && output.timeToComplete !== Infinity && (
              <DeltaIndicator value={simulated.timeDelta} unit="h" inverse />
            )}
          </div>
        </div>

        {/* Confidence Level */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Confidence Level</span>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger>
                <Badge variant="outline" className={confidenceColors[output.confidenceLevel]}>
                  {output.confidenceLevel}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Based on team predictability ({output.avgPredictability}% avg)</p>
              </TooltipContent>
            </Tooltip>
            {isScenarioMode && simulated.confidenceDelta !== 'same' && (
              <span className={cn(
                "text-xs",
                simulated.confidenceDelta === 'higher' ? "text-emerald-600" : "text-amber-600"
              )}>
                {simulated.confidenceDelta === 'higher' ? '▲ Higher' : '▼ Lower'}
              </span>
            )}
          </div>
        </div>

        {/* Completion Status */}
        <div className={cn(
          "flex items-center gap-3 p-3 rounded-lg",
          output.canComplete 
            ? "bg-emerald-50 dark:bg-emerald-950/20" 
            : "bg-amber-50 dark:bg-amber-950/20"
        )}>
          {output.canComplete ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
          )}
          <div>
            <p className={cn(
              "text-sm font-medium",
              output.canComplete ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"
            )}>
              {output.canComplete ? 'On Track' : 'Behind Schedule'}
            </p>
            {output.delayRiskReason && (
              <p className="text-xs text-muted-foreground">{output.delayRiskReason}</p>
            )}
          </div>
        </div>

        {/* Delay Risk (informational only) */}
        {output.delayRisk !== 'none' && (
          <div className="text-xs text-muted-foreground flex items-start gap-2 p-2 bg-muted/30 rounded-md">
            <Info className="h-3 w-3 mt-0.5 shrink-0" />
            <span>
              Delay risk: <strong>{output.delayRisk}</strong>
              {output.delayRiskReason && ` — ${output.delayRiskReason}`}
            </span>
          </div>
        )}

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span>Daily Progress</span>
            <span className="text-muted-foreground">{boxesCompleted} / {targetBoxes}</span>
          </div>
          <Progress value={progressPct} className="h-2" />
        </div>
      </CardContent>
    </Card>
  );
}
