/**
 * SCENARIO COMPARISON
 * 
 * Save, name, and compare temporary scenarios.
 * Session-only memory, no persistence.
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Save,
  Trash2,
  RotateCcw,
  Layers,
  Clock,
  Package,
  Gauge,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { NamedScenario, ScenarioOutput } from './types';
import { format } from 'date-fns';

interface ScenarioComparisonProps {
  savedScenarios: NamedScenario[];
  baseline: ScenarioOutput;
  currentSimulated: ScenarioOutput;
  onSave: (name: string) => void;
  onDelete: (id: string) => void;
  onLoad: (scenario: NamedScenario) => void;
}

const PRESET_NAMES = [
  'Baseline',
  'Short Staff',
  'Aggressive Target',
  'Quality Focus',
  'Overtime Scenario',
];

export function ScenarioComparison({
  savedScenarios,
  baseline,
  currentSimulated,
  onSave,
  onDelete,
  onLoad,
}: ScenarioComparisonProps) {
  const [scenarioName, setScenarioName] = useState('');
  const [showComparison, setShowComparison] = useState(false);

  const handleSave = () => {
    if (scenarioName.trim()) {
      onSave(scenarioName.trim());
      setScenarioName('');
    }
  };

  const confidenceColors = {
    high: 'text-emerald-600',
    medium: 'text-amber-600',
    low: 'text-red-600',
  };

  return (
    <Card className="border-purple-200 dark:border-purple-800 border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Layers className="h-5 w-5 text-purple-600" />
          Scenario Comparison
          <Badge variant="outline" className="text-xs">
            {savedScenarios.length} saved
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Save Current */}
        <div className="flex gap-2">
          <Input
            placeholder="Name this scenario..."
            value={scenarioName}
            onChange={(e) => setScenarioName(e.target.value)}
            className="flex-1"
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
          <Button onClick={handleSave} disabled={!scenarioName.trim()}>
            <Save className="h-4 w-4 mr-1" />
            Save
          </Button>
        </div>

        {/* Preset Names */}
        <div className="flex flex-wrap gap-1">
          {PRESET_NAMES.filter(n => !savedScenarios.some(s => s.name === n)).slice(0, 3).map(name => (
            <Button
              key={name}
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => {
                setScenarioName(name);
              }}
            >
              {name}
            </Button>
          ))}
        </div>

        {/* Saved Scenarios List */}
        {savedScenarios.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Saved Scenarios (this session)</p>
            <div className="space-y-1">
              {savedScenarios.map(scenario => (
                <div 
                  key={scenario.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div>
                      <p className="text-sm font-medium">{scenario.name}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Package className="h-3 w-3" />
                          {scenario.output.totalCapacity.toFixed(1)}/hr
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {Math.floor(scenario.output.timeToComplete)}h {scenario.output.minutesToComplete}m
                        </span>
                        <span className={cn("flex items-center gap-1", confidenceColors[scenario.output.confidenceLevel])}>
                          <Gauge className="h-3 w-3" />
                          {scenario.output.confidenceLevel}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="sm" onClick={() => onLoad(scenario)}>
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Load this scenario</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="sm" onClick={() => onDelete(scenario.id)}>
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Compare Dialog */}
        {savedScenarios.length >= 2 && (
          <Dialog open={showComparison} onOpenChange={setShowComparison}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full">
                <Layers className="h-4 w-4 mr-2" />
                Compare All Scenarios
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Layers className="h-5 w-5" />
                  Scenario Comparison
                </DialogTitle>
              </DialogHeader>
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Scenario</TableHead>
                      <TableHead className="text-right">Capacity</TableHead>
                      <TableHead className="text-right">Time</TableHead>
                      <TableHead className="text-right">Confidence</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Baseline */}
                    <TableRow className="bg-muted/30">
                      <TableCell className="font-medium">
                        Current Reality
                        <Badge variant="secondary" className="ml-2 text-xs">Baseline</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">{baseline.totalCapacity.toFixed(1)}/hr</TableCell>
                      <TableCell className="text-right font-mono">
                        {Math.floor(baseline.timeToComplete)}h {baseline.minutesToComplete}m
                      </TableCell>
                      <TableCell className={cn("text-right", confidenceColors[baseline.confidenceLevel])}>
                        {baseline.confidenceLevel}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={baseline.canComplete ? "default" : "destructive"}>
                          {baseline.canComplete ? 'On Track' : 'Behind'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                    {/* Saved Scenarios */}
                    {savedScenarios.map(scenario => (
                      <TableRow key={scenario.id}>
                        <TableCell className="font-medium">{scenario.name}</TableCell>
                        <TableCell className="text-right font-mono">
                          {scenario.output.totalCapacity.toFixed(1)}/hr
                          {scenario.output.capacityDelta !== 0 && (
                            <span className={cn(
                              "text-xs ml-1",
                              scenario.output.capacityDelta > 0 ? "text-emerald-600" : "text-red-600"
                            )}>
                              ({scenario.output.capacityDelta > 0 ? '+' : ''}{scenario.output.capacityDelta}%)
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {Math.floor(scenario.output.timeToComplete)}h {scenario.output.minutesToComplete}m
                        </TableCell>
                        <TableCell className={cn("text-right", confidenceColors[scenario.output.confidenceLevel])}>
                          {scenario.output.confidenceLevel}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={scenario.output.canComplete ? "default" : "destructive"}>
                            {scenario.output.canComplete ? 'On Track' : 'Behind'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="text-xs text-muted-foreground flex items-start gap-2 mt-2">
                <Info className="h-3 w-3 mt-0.5 shrink-0" />
                <span>
                  Scenarios are stored in session memory only. They will be lost on page refresh.
                </span>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Disclaimer */}
        <div className="text-xs text-muted-foreground flex items-start gap-2">
          <Info className="h-3 w-3 mt-0.5 shrink-0" />
          <span>
            Scenarios are not persisted. Refreshing the page will clear all saved scenarios.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
