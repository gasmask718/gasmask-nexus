/**
 * SCENARIO MODE TOGGLE
 * 
 * Toggle for entering/exiting simulation mode.
 * Clear visual indicator when simulation is active.
 */

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { FlaskConical, X, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScenarioToggleProps {
  isActive: boolean;
  onEnter: () => void;
  onExit: () => void;
}

export function ScenarioToggle({ isActive, onEnter, onExit }: ScenarioToggleProps) {
  if (isActive) {
    return (
      <div className="flex items-center gap-2">
        <Badge 
          variant="outline" 
          className="bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700 animate-pulse"
        >
          <FlaskConical className="h-3 w-3 mr-1" />
          Simulation Active
        </Badge>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="outline" 
              size="sm"
              onClick={onExit}
              className="text-purple-600 hover:text-purple-700 border-purple-300"
            >
              <X className="h-4 w-4 mr-1" />
              Exit Simulation
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Return to live operational view</p>
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          onClick={onEnter}
          className="text-muted-foreground hover:text-purple-600"
        >
          <FlaskConical className="h-4 w-4 mr-1" />
          Scenario Planning
        </Button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <div className="space-y-1">
          <p className="font-medium">What-If Simulation</p>
          <p className="text-xs text-muted-foreground">
            Explore staffing changes and performance assumptions without affecting real data.
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export function ScenarioBanner({ onExit }: { onExit: () => void }) {
  return (
    <div className="bg-purple-100 dark:bg-purple-900/30 border border-purple-300 dark:border-purple-700 rounded-lg p-3 border-dashed">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-purple-200 dark:bg-purple-800 flex items-center justify-center">
            <FlaskConical className="h-5 w-5 text-purple-600 dark:text-purple-300" />
          </div>
          <div>
            <p className="font-medium text-purple-900 dark:text-purple-100 flex items-center gap-2">
              Scenario Planning Mode
              <Badge variant="outline" className="text-xs bg-purple-200 dark:bg-purple-800 border-purple-400">
                SIMULATION
              </Badge>
            </p>
            <p className="text-sm text-purple-700 dark:text-purple-300">
              This is a simulation. No data is saved or executed.
            </p>
          </div>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={onExit}
          className="border-purple-400 text-purple-700 hover:bg-purple-200 dark:border-purple-600 dark:text-purple-300"
        >
          <X className="h-4 w-4 mr-1" />
          Exit
        </Button>
      </div>
    </div>
  );
}

export function SimulatedBadge() {
  return (
    <Tooltip>
      <TooltipTrigger>
        <Badge 
          variant="outline" 
          className="text-xs bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-700"
        >
          Simulated
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">This value is calculated from scenario inputs, not live data</p>
      </TooltipContent>
    </Tooltip>
  );
}
