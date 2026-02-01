/**
 * SCENARIO CONTROLS PANEL
 * 
 * Staffing toggles, performance sliders, time constraints.
 * All adjustments live only in memory.
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Users,
  Clock,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SimulationWorker, ScenarioInputs } from './types';

interface ScenarioControlsPanelProps {
  workers: SimulationWorker[];
  inputs: ScenarioInputs;
  onUpdateWorkerPresence: (workerId: string, isPresent: boolean) => void;
  onUpdateWorkerRate: (workerId: string, rate: number | null) => void;
  onUpdateGlobalModifiers: (speedMod: number, defectMod: number) => void;
  onUpdateTimeConstraints: (hours: number, overtime: boolean) => void;
  onReset: () => void;
}

export function ScenarioControlsPanel({
  workers,
  inputs,
  onUpdateWorkerPresence,
  onUpdateWorkerRate,
  onUpdateGlobalModifiers,
  onUpdateTimeConstraints,
  onReset,
}: ScenarioControlsPanelProps) {
  const [staffingOpen, setStaffingOpen] = useState(true);
  const [performanceOpen, setPerformanceOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);

  const presentCount = Array.from(inputs.workerAdjustments.values()).filter(a => a.isPresent).length;
  const totalWorkers = workers.length;

  return (
    <Card className="border-purple-200 dark:border-purple-800 border-dashed">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            Scenario Controls
            <Badge variant="outline" className="text-xs">
              Session Only
            </Badge>
          </CardTitle>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={onReset}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reset to current reality</TooltipContent>
          </Tooltip>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Staffing Section */}
        <Collapsible open={staffingOpen} onOpenChange={setStaffingOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-md hover:bg-muted/50">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-purple-600" />
              <span className="font-medium">Staffing</span>
              <Badge variant="secondary" className="text-xs">
                {presentCount}/{totalWorkers}
              </Badge>
            </div>
            {staffingOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-2">
            <p className="text-xs text-muted-foreground px-2 mb-2">
              Toggle workers on/off to simulate absences or additions.
            </p>
            <div className="max-h-48 overflow-y-auto space-y-1 pr-2">
              {workers.map(sw => {
                const adj = inputs.workerAdjustments.get(sw.profile.worker_id);
                const isPresent = adj?.isPresent !== false;
                
                return (
                  <div 
                    key={sw.profile.worker_id}
                    className={cn(
                      "flex items-center justify-between p-2 rounded-md",
                      isPresent ? "bg-muted/30" : "bg-red-50/50 dark:bg-red-950/20"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={isPresent}
                        onCheckedChange={(checked) => onUpdateWorkerPresence(sw.profile.worker_id, checked)}
                      />
                      <div>
                        <p className={cn("text-sm font-medium", !isPresent && "text-muted-foreground line-through")}>
                          {sw.worker.full_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {sw.profile.boxes_per_hour?.toFixed(1) || '—'} boxes/hr
                        </p>
                      </div>
                    </div>
                    <Badge 
                      variant={sw.predictability >= 70 ? "default" : sw.predictability >= 50 ? "secondary" : "destructive"}
                      className="text-xs"
                    >
                      {sw.predictability}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        {/* Performance Assumptions Section */}
        <Collapsible open={performanceOpen} onOpenChange={setPerformanceOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-md hover:bg-muted/50">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-purple-600" />
              <span className="font-medium">Performance Assumptions</span>
              {(inputs.globalSpeedModifier !== 0 || inputs.globalDefectModifier !== 0) && (
                <Badge variant="outline" className="text-xs text-purple-600">Modified</Badge>
              )}
            </div>
            {performanceOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-4 px-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Speed Modifier</Label>
                <span className={cn(
                  "text-sm font-mono",
                  inputs.globalSpeedModifier > 0 ? "text-emerald-600" : 
                  inputs.globalSpeedModifier < 0 ? "text-red-600" : "text-muted-foreground"
                )}>
                  {inputs.globalSpeedModifier > 0 ? '+' : ''}{inputs.globalSpeedModifier}%
                </span>
              </div>
              <Slider
                value={[inputs.globalSpeedModifier]}
                onValueChange={([val]) => onUpdateGlobalModifiers(val, inputs.globalDefectModifier)}
                min={-50}
                max={50}
                step={5}
                className="py-2"
              />
              <p className="text-xs text-muted-foreground">
                Adjust expected output rate for all workers
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Defect Rate Modifier</Label>
                <span className={cn(
                  "text-sm font-mono",
                  inputs.globalDefectModifier < 0 ? "text-emerald-600" : 
                  inputs.globalDefectModifier > 0 ? "text-red-600" : "text-muted-foreground"
                )}>
                  {inputs.globalDefectModifier > 0 ? '+' : ''}{inputs.globalDefectModifier}%
                </span>
              </div>
              <Slider
                value={[inputs.globalDefectModifier]}
                onValueChange={([val]) => onUpdateGlobalModifiers(inputs.globalSpeedModifier, val)}
                min={-50}
                max={50}
                step={5}
                className="py-2"
              />
              <p className="text-xs text-muted-foreground">
                Adjust expected defect rate for all workers
              </p>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        {/* Time Constraints Section */}
        <Collapsible open={timeOpen} onOpenChange={setTimeOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-md hover:bg-muted/50">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-purple-600" />
              <span className="font-medium">Time Constraints</span>
              {inputs.includeOvertime && (
                <Badge variant="outline" className="text-xs text-amber-600">+OT</Badge>
              )}
            </div>
            {timeOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-4 px-2">
            <div className="space-y-2">
              <Label className="text-sm">Hours Remaining Today</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={inputs.hoursRemaining}
                  onChange={(e) => onUpdateTimeConstraints(parseFloat(e.target.value) || 0, inputs.includeOvertime)}
                  min={0}
                  max={16}
                  step={0.5}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">hours</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm">Include Overtime</Label>
                <p className="text-xs text-muted-foreground">+2 hours available</p>
              </div>
              <Switch
                checked={inputs.includeOvertime}
                onCheckedChange={(checked) => onUpdateTimeConstraints(inputs.hoursRemaining, checked)}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Disclaimer */}
        <div className="text-xs text-muted-foreground bg-muted/30 rounded-md p-2 flex items-start gap-2">
          <Info className="h-3 w-3 mt-0.5 shrink-0" />
          <span>
            Scenario planning explores possibilities based on current trends. 
            It does not predict outcomes or recommend actions.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
