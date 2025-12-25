import React from 'react';
import { useSimulationMode } from '@/contexts/SimulationModeContext';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FlaskConical, EyeOff, AlertTriangle, TrendingDown, Activity } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { cn } from '@/lib/utils';
import { SimScenario } from '@/lib/simulation/scenarioData';

interface SimulationModeToggleProps {
  className?: string;
  showLabel?: boolean;
  showScenarioSelector?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const scenarioLabels: Record<SimScenario, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  normal: { label: 'Normal Day', icon: Activity, color: 'text-green-600' },
  heavy_issue: { label: 'Heavy Issue Day', icon: AlertTriangle, color: 'text-red-600' },
  low_volume: { label: 'Low Volume Day', icon: TrendingDown, color: 'text-slate-500' },
};

export function SimulationModeToggle({ 
  className = '', 
  showLabel = true,
  showScenarioSelector = true,
  size = 'md' 
}: SimulationModeToggleProps) {
  const { simulationMode, toggleSimulationMode, scenario, setScenario } = useSimulationMode();
  const { isAdmin } = useUserRole();

  // Only show for admins
  if (!isAdmin) return null;

  return (
    <div className={cn(
      "flex flex-col gap-2 px-3 py-2 rounded-lg border transition-colors",
      simulationMode 
        ? "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800" 
        : "bg-muted/50 border-border",
      className
    )}>
      <div className="flex items-center gap-2">
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

      {/* Scenario Selector - only visible when simulation is ON */}
      {simulationMode && showScenarioSelector && (
        <Select value={scenario} onValueChange={(v) => setScenario(v as SimScenario)}>
          <SelectTrigger className="h-8 text-xs bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(scenarioLabels) as SimScenario[]).map((key) => {
              const { label, icon: Icon, color } = scenarioLabels[key];
              return (
                <SelectItem key={key} value={key}>
                  <div className="flex items-center gap-2">
                    <Icon className={cn("h-3 w-3", color)} />
                    <span>{label}</span>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

// Compact inline indicator
export function SimulationIndicator({ className = '' }: { className?: string }) {
  const { simulationMode, scenario } = useSimulationMode();
  
  if (!simulationMode) return null;

  const { label, icon: Icon, color } = scenarioLabels[scenario];
  
  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-full",
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      className
    )}>
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
      Demo: {label}
    </div>
  );
}

// Full-width banner for pages
export function SimulationBanner() {
  const { simulationMode, toggleSimulationMode, scenario } = useSimulationMode();
  const { isAdmin } = useUserRole();
  
  if (!simulationMode) return null;

  const { label, icon: Icon } = scenarioLabels[scenario];
  
  return (
    <div className="w-full bg-gradient-to-r from-amber-100 via-amber-50 to-amber-100 dark:from-amber-900/30 dark:via-amber-900/20 dark:to-amber-900/30 border-b border-amber-200 dark:border-amber-800 px-4 py-2">
      <div className="flex items-center justify-between max-w-screen-2xl mx-auto">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
            Simulation Mode: <strong>{label}</strong> — Data shown is AI-generated for demonstration only
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

// Scenario-specific empty states
export function ScenarioEmptyState({ entity }: { entity: 'routes' | 'issues' | 'payouts' | 'debts' | 'bikers' | 'drivers' }) {
  const { scenario } = useSimulationMode();
  
  if (scenario !== 'low_volume') return null;

  const messages: Record<string, { title: string; description: string }> = {
    routes: {
      title: 'No Routes Scheduled',
      description: 'This is a low-volume day. No deliveries have been scheduled yet. Drivers are on standby and ready to be assigned.',
    },
    issues: {
      title: 'No Open Issues',
      description: 'All stores are operating normally today. No issues have been reported by field staff.',
    },
    payouts: {
      title: 'No Pending Payouts',
      description: 'All worker payouts have been processed. New payouts will appear after the current pay period closes.',
    },
    debts: {
      title: 'No Outstanding Debts',
      description: 'All driver debts have been settled. Great job maintaining clean financial records!',
    },
    bikers: {
      title: 'Limited Biker Activity',
      description: 'Only one biker is on standby today. Task assignments will appear when scheduled.',
    },
    drivers: {
      title: 'Limited Driver Activity',
      description: 'Only one driver is available today. Routes will be assigned as orders come in.',
    },
  };

  const msg = messages[entity];
  if (!msg) return null;

  return (
    <div className="text-center py-8 px-4 bg-muted/30 rounded-lg border border-dashed">
      <h4 className="font-medium mb-1">{msg.title}</h4>
      <p className="text-sm text-muted-foreground">{msg.description}</p>
    </div>
  );
}
