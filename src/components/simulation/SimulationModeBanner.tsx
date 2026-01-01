/**
 * SIMULATION MODE BANNER
 * 
 * Displays a prominent banner when simulation mode is active.
 * This prevents confusion - users always know if they're seeing demo data.
 */

import { AlertTriangle, X, Settings } from 'lucide-react';
import { useSimulationMode, SimulationModeState } from '@/contexts/SimulationModeContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { useState } from 'react';

interface SimulationModeBannerProps {
  showControls?: boolean;
}

export function SimulationModeBanner({ showControls = true }: SimulationModeBannerProps) {
  const { 
    simulationMode, 
    modeState, 
    source, 
    setModeState, 
    isLiveBusinessActive,
    currentBusinessSlug 
  } = useSimulationMode();
  const { isAdmin } = useUserRole();
  const [dismissed, setDismissed] = useState(false);

  // Don't show if simulation is off
  if (!simulationMode || dismissed) {
    return null;
  }

  const sourceLabel = source === 'env' ? 'Environment' : source === 'admin' ? 'Admin Toggle' : 'Forced Off';

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-amber-950 px-4 py-2 shadow-lg">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
            <span className="font-semibold">SIMULATION MODE ACTIVE</span>
            <span className="text-sm opacity-80">
              — Live data is hidden. Source: {sourceLabel}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Admin controls */}
          {showControls && isAdmin() && (
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 opacity-70" />
              <Select 
                value={modeState} 
                onValueChange={(value) => setModeState(value as SimulationModeState)}
              >
                <SelectTrigger className="h-8 w-24 bg-amber-400 border-amber-600 text-amber-950">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto</SelectItem>
                  <SelectItem value="on">On</SelectItem>
                  <SelectItem value="off">Off</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Dismiss button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDismissed(true)}
            className="h-8 w-8 p-0 text-amber-950 hover:bg-amber-400"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact simulation indicator for use in headers/toolbars
 */
export function SimulationIndicator() {
  const { simulationMode, source, isLiveBusinessActive } = useSimulationMode();

  if (!simulationMode) {
    return null;
  }

  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 rounded-full">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
      <span>Demo Mode</span>
    </div>
  );
}

/**
 * Live data indicator - shows when real data is being displayed
 */
export function LiveDataIndicator() {
  const { simulationMode, isLiveBusinessActive } = useSimulationMode();

  // Only show if simulation is off AND on a live business
  if (simulationMode || !isLiveBusinessActive) {
    return null;
  }

  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded-full">
      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
      <span>Live Data</span>
    </div>
  );
}
