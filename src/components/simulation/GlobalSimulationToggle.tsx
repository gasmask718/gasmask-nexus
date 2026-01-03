/**
 * GLOBAL SIMULATION TOGGLE — ADMIN CONTROL COMPONENT
 * 
 * 🧠👑 MASTER GENIUS PROMPT IMPLEMENTATION
 * 
 * This is the master ON/OFF switch for simulation mode.
 * - Visible to all users
 * - Editable ONLY by owner/admin roles
 * - Requires confirmation modal for switching to Live Mode
 * - Supports admin lock to prevent non-admin re-entry
 */

import { useState } from 'react';
import { 
  FlaskConical, 
  Shield, 
  Lock, 
  Unlock, 
  AlertTriangle,
  CheckCircle,
  Loader2 
} from 'lucide-react';
import { useSimulationMode, SystemMode } from '@/contexts/SimulationModeContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';

interface GlobalSimulationToggleProps {
  variant?: 'full' | 'compact' | 'minimal';
  className?: string;
}

export function GlobalSimulationToggle({ variant = 'compact', className = '' }: GlobalSimulationToggleProps) {
  const {
    simulationMode,
    systemMode,
    isLoading,
    canToggle,
    lockedForNonAdmins,
    setSystemMode,
    setLockedForNonAdmins,
    isLiveBusinessActive
  } = useSimulationMode();
  const { isAdmin, role } = useUserRole();
  
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingMode, setPendingMode] = useState<SystemMode | null>(null);
  const [lockAfterSwitch, setLockAfterSwitch] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Handle toggle click
  const handleToggleClick = async (newMode: SystemMode) => {
    if (!canToggle) {
      if (isLiveBusinessActive) {
        toast.error('Cannot change mode for a live business');
      } else if (!isAdmin()) {
        toast.error('Only admins can change simulation mode');
      }
      return;
    }

    // If switching to live mode, require confirmation
    if (newMode === 'live') {
      setPendingMode('live');
      setShowConfirmation(true);
      return;
    }

    // Switching to simulation - do it directly
    setIsUpdating(true);
    const success = await setSystemMode('simulation');
    setIsUpdating(false);
    
    if (success) {
      toast.success('Simulation mode activated', {
        description: 'You are now viewing and creating demo data only.'
      });
    } else {
      toast.error('Failed to switch mode');
    }
  };

  // Confirm switch to live mode
  const handleConfirmLive = async () => {
    if (!pendingMode) return;
    
    setIsUpdating(true);
    
    // First, set the mode
    const modeSuccess = await setSystemMode(pendingMode);
    
    // If requested, lock for non-admins
    if (modeSuccess && lockAfterSwitch) {
      await setLockedForNonAdmins(true);
    }
    
    setIsUpdating(false);
    setShowConfirmation(false);
    setPendingMode(null);
    setLockAfterSwitch(false);
    
    if (modeSuccess) {
      toast.success('Live mode activated', {
        description: 'All changes will now affect real data permanently.',
        icon: <Shield className="h-4 w-4 text-green-500" />
      });
    } else {
      toast.error('Failed to switch to live mode');
    }
  };

  // Minimal variant - just an icon button
  if (variant === 'minimal') {
    return (
      <>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleToggleClick(simulationMode ? 'live' : 'simulation')}
              disabled={isLoading || !canToggle || isUpdating}
              className={`relative ${className}`}
            >
              {isLoading || isUpdating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : simulationMode ? (
                <FlaskConical className="h-4 w-4 text-amber-500" />
              ) : (
                <Shield className="h-4 w-4 text-green-500" />
              )}
              {simulationMode && (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-amber-500 rounded-full animate-pulse" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isLoading ? 'Loading...' : 
             simulationMode ? 'Simulation Mode (Click to switch to Live)' : 
             'Live Mode (Click to switch to Simulation)'}
            {!canToggle && !isLoading && ' - Admin only'}
          </TooltipContent>
        </Tooltip>

        <ConfirmationDialog
          open={showConfirmation}
          onOpenChange={setShowConfirmation}
          isUpdating={isUpdating}
          lockAfterSwitch={lockAfterSwitch}
          setLockAfterSwitch={setLockAfterSwitch}
          onConfirm={handleConfirmLive}
        />
      </>
    );
  }

  // Compact variant - icon + switch
  if (variant === 'compact') {
    return (
      <>
        <div className={`flex items-center gap-2 ${className}`}>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
            simulationMode 
              ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800' 
              : 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800'
          }`}>
            {isLoading || isUpdating ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : simulationMode ? (
              <FlaskConical className="h-4 w-4 text-amber-600" />
            ) : (
              <Shield className="h-4 w-4 text-green-600" />
            )}
            
            <span className={`text-xs font-semibold ${
              simulationMode ? 'text-amber-700 dark:text-amber-400' : 'text-green-700 dark:text-green-400'
            }`}>
              {isLoading ? 'Loading...' : simulationMode ? 'SIMULATION' : 'LIVE'}
            </span>
            
            <Switch
              checked={simulationMode}
              onCheckedChange={(checked) => handleToggleClick(checked ? 'simulation' : 'live')}
              disabled={isLoading || !canToggle || isUpdating}
              className="data-[state=checked]:bg-amber-500 data-[state=unchecked]:bg-green-500"
            />
            
            {lockedForNonAdmins && !isAdmin() && (
              <Lock className="h-3 w-3 text-muted-foreground" />
            )}
          </div>
        </div>

        <ConfirmationDialog
          open={showConfirmation}
          onOpenChange={setShowConfirmation}
          isUpdating={isUpdating}
          lockAfterSwitch={lockAfterSwitch}
          setLockAfterSwitch={setLockAfterSwitch}
          onConfirm={handleConfirmLive}
        />
      </>
    );
  }

  // Full variant - complete control panel
  return (
    <>
      <div className={`rounded-xl border p-4 ${
        simulationMode 
          ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800' 
          : 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800'
      } ${className}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {isLoading || isUpdating ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mt-0.5" />
            ) : simulationMode ? (
              <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                <FlaskConical className="h-5 w-5 text-amber-600" />
              </div>
            ) : (
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                <Shield className="h-5 w-5 text-green-600" />
              </div>
            )}
            
            <div>
              <h3 className={`font-bold text-base ${
                simulationMode ? 'text-amber-800 dark:text-amber-300' : 'text-green-800 dark:text-green-300'
              }`}>
                {isLoading ? 'Loading Mode...' : simulationMode ? 'Simulation Mode' : 'Live Mode'}
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                {isLoading ? 'Fetching system settings...' :
                 simulationMode 
                  ? 'Demo data only. No real records affected.' 
                  : 'Real data. All changes are permanent.'}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <Switch
              checked={simulationMode}
              onCheckedChange={(checked) => handleToggleClick(checked ? 'simulation' : 'live')}
              disabled={isLoading || !canToggle || isUpdating}
              className="data-[state=checked]:bg-amber-500 data-[state=unchecked]:bg-green-500 scale-125"
            />
            
            {!canToggle && !isLoading && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Lock className="h-3 w-3" />
                {isLiveBusinessActive ? 'Live Business' : 'Admin Only'}
              </span>
            )}
          </div>
        </div>

        {/* Admin-only lock control */}
        {isAdmin() && !isLoading && (
          <div className="mt-4 pt-4 border-t border-current/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {lockedForNonAdmins ? (
                  <Lock className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Unlock className="h-4 w-4 text-muted-foreground" />
                )}
                <Label htmlFor="lock-toggle" className="text-sm font-medium">
                  Lock mode for non-admins
                </Label>
              </div>
              <Switch
                id="lock-toggle"
                checked={lockedForNonAdmins}
                onCheckedChange={setLockedForNonAdmins}
                disabled={isUpdating}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1 ml-6">
              When locked, only admins can switch between modes.
            </p>
          </div>
        )}
      </div>

      <ConfirmationDialog
        open={showConfirmation}
        onOpenChange={setShowConfirmation}
        isUpdating={isUpdating}
        lockAfterSwitch={lockAfterSwitch}
        setLockAfterSwitch={setLockAfterSwitch}
        onConfirm={handleConfirmLive}
      />
    </>
  );
}

// Confirmation Dialog Component
function ConfirmationDialog({
  open,
  onOpenChange,
  isUpdating,
  lockAfterSwitch,
  setLockAfterSwitch,
  onConfirm
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isUpdating: boolean;
  lockAfterSwitch: boolean;
  setLockAfterSwitch: (value: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-green-700">
            <Shield className="h-5 w-5" />
            Entering LIVE MODE
          </DialogTitle>
          <DialogDescription className="text-base">
            You are about to switch to <strong>Live Mode</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-2 text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-300">
                  All changes will affect real data:
                </p>
                <ul className="list-disc list-inside text-amber-700 dark:text-amber-400 space-y-1">
                  <li>Real inventory and stock levels</li>
                  <li>Real store information</li>
                  <li>Real invoices and financial records</li>
                  <li>Real delivery schedules</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/50">
            <Checkbox
              id="lock-for-non-admins"
              checked={lockAfterSwitch}
              onCheckedChange={(checked) => setLockAfterSwitch(checked === true)}
            />
            <div className="space-y-1">
              <Label htmlFor="lock-for-non-admins" className="text-sm font-medium cursor-pointer">
                Lock simulation mode for non-admins
              </Label>
              <p className="text-xs text-muted-foreground">
                Prevents VAs and other non-admin users from switching back to simulation mode.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isUpdating}
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isUpdating}
            className="bg-green-600 hover:bg-green-700"
          >
            {isUpdating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Switching...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Enter Live Mode
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default GlobalSimulationToggle;
