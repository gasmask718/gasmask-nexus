/**
 * SIMULATION MODE BANNER — GLOBAL VISUAL ENFORCEMENT
 * 
 * 🧠👑 MASTER GENIUS PROMPT IMPLEMENTATION
 * 
 * Displays prominent banners for simulation and live modes.
 * - Simulation: Orange warning banner with "DATA IS NOT REAL"
 * - Live: Green confirmation banner with "PERMANENT CHANGES"
 */

import { AlertTriangle, Shield, Lock, Unlock, X, Loader2 } from 'lucide-react';
import { useSimulationMode } from '@/contexts/SimulationModeContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface SimulationModeBannerProps {
  showControls?: boolean;
  showLiveBanner?: boolean;
}

export function SimulationModeBanner({ showControls = true, showLiveBanner = false }: SimulationModeBannerProps) {
  const { 
    simulationMode, 
    systemMode,
    source,
    isLoading,
    isLiveBusinessActive,
    canToggle
  } = useSimulationMode();
  const { isAdmin } = useUserRole();
  const [dismissed, setDismissed] = useState(false);

  // Show loading state
  if (isLoading) {
    return null;
  }

  // Live mode banner (optional)
  if (!simulationMode && showLiveBanner && !dismissed) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-green-600 text-white px-4 py-2 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 flex-shrink-0" />
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
              <span className="font-semibold">LIVE MODE</span>
              <span className="text-sm opacity-90">
                — REAL DATA • PERMANENT CHANGES
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDismissed(true)}
            className="h-8 w-8 p-0 text-white hover:bg-green-500"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // Don't show simulation banner if simulation is off
  if (!simulationMode || dismissed) {
    return null;
  }

  const sourceLabel = source === 'database' ? 'System Setting' : 
                      source === 'forced_live' ? 'Live Business' : 'Loading';

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-amber-950 px-4 py-2.5 shadow-lg">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
            <span className="font-bold tracking-wide">SIMULATION MODE ACTIVE</span>
            <span className="text-sm font-medium opacity-80">
              — DATA IS NOT REAL
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Role indicator */}
          {isAdmin() && (
            <span className="text-xs bg-amber-400 px-2 py-1 rounded font-medium">
              Admin View
            </span>
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
  const { simulationMode, isLoading } = useSimulationMode();

  if (isLoading) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-muted text-muted-foreground rounded-full">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Loading...</span>
      </div>
    );
  }

  if (!simulationMode) {
    return null;
  }

  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 rounded-full">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
      <span>Simulation Mode</span>
    </div>
  );
}

/**
 * Live data indicator - shows when real data is being displayed
 */
export function LiveDataIndicator() {
  const { simulationMode, isLiveBusinessActive, isLoading } = useSimulationMode();

  if (isLoading) {
    return null;
  }

  // Show if simulation is off
  if (!simulationMode) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded-full">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
        <span>Live Mode</span>
      </div>
    );
  }

  return null;
}

/**
 * Mode badge for compact display
 */
export function SystemModeBadge() {
  const { simulationMode, isLoading, systemMode } = useSimulationMode();

  if (isLoading) {
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-muted rounded-full">
        <Loader2 className="h-3 w-3 animate-spin" />
      </div>
    );
  }

  if (simulationMode) {
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-amber-500 text-amber-950 rounded-full shadow-sm">
        <span className="h-2 w-2 rounded-full bg-amber-950 animate-pulse" />
        <span>SIMULATION</span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-green-500 text-white rounded-full shadow-sm">
      <Shield className="h-3 w-3" />
      <span>LIVE</span>
    </div>
  );
}
