import React from 'react';
import { useSimulationMode } from '@/contexts/SimulationModeContext';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { FlaskConical, Eye, EyeOff } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { cn } from '@/lib/utils';

interface SimulationModeToggleProps {
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function SimulationModeToggle({ 
  className = '', 
  showLabel = true,
  size = 'md' 
}: SimulationModeToggleProps) {
  const { simulationMode, toggleSimulationMode } = useSimulationMode();
  const { isAdmin } = useUserRole();

  // Only show for admins
  if (!isAdmin) return null;

  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors",
      simulationMode 
        ? "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800" 
        : "bg-muted/50 border-border",
      className
    )}>
      <FlaskConical className={cn(
        "h-4 w-4",
        simulationMode ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
      )} />
      
      {showLabel && (
        <span className={cn(
          "text-sm font-medium",
          simulationMode ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"
        )}>
          Simulation Mode
        </span>
      )}
      
      <Switch 
        checked={simulationMode}
        onCheckedChange={toggleSimulationMode}
        className={cn(
          size === 'sm' && "scale-75",
          size === 'lg' && "scale-110"
        )}
      />
      
      {simulationMode && (
        <Badge 
          variant="outline" 
          className="text-xs bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700"
        >
          ON
        </Badge>
      )}
    </div>
  );
}

// Compact inline indicator
export function SimulationIndicator({ className = '' }: { className?: string }) {
  const { simulationMode } = useSimulationMode();
  
  if (!simulationMode) return null;
  
  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-full",
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      className
    )}>
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
      Demo Mode Active
    </div>
  );
}

// Full-width banner for pages
export function SimulationBanner() {
  const { simulationMode, toggleSimulationMode } = useSimulationMode();
  const { isAdmin } = useUserRole();
  
  if (!simulationMode) return null;
  
  return (
    <div className="w-full bg-gradient-to-r from-amber-100 via-amber-50 to-amber-100 dark:from-amber-900/30 dark:via-amber-900/20 dark:to-amber-900/30 border-b border-amber-200 dark:border-amber-800 px-4 py-2">
      <div className="flex items-center justify-between max-w-screen-2xl mx-auto">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
            Simulation Mode Active — Data shown is AI-generated for demonstration purposes only
          </span>
        </div>
        {isAdmin && (
          <button
            onClick={toggleSimulationMode}
            className="flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200 transition-colors"
          >
            <EyeOff className="h-3 w-3" />
            Exit Demo
          </button>
        )}
      </div>
    </div>
  );
}
