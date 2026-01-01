/**
 * SIMULATION MODE ADMIN TOGGLE
 * 
 * Admin-only component for controlling simulation mode.
 * Visible only to Owner / Super Admin roles.
 */

import { useSimulationMode, SimulationModeState } from '@/contexts/SimulationModeContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { AlertCircle, Shield, Zap } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LIVE_BUSINESSES } from '@/config/liveBusinesses';

interface SimulationModeToggleProps {
  variant?: 'full' | 'compact';
}

export function SimulationModeToggle({ variant = 'full' }: SimulationModeToggleProps) {
  const { 
    simulationMode, 
    modeState, 
    source, 
    setModeState,
    isLiveBusinessActive,
    currentBusinessSlug,
    scenario,
    setScenario
  } = useSimulationMode();
  const { isAdmin, roles } = useUserRole();

  // Only show to admin/owner
  if (!isAdmin()) {
    return null;
  }

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
        <div className="flex items-center gap-2">
          <Switch
            id="sim-mode-compact"
            checked={modeState === 'on'}
            onCheckedChange={(checked) => setModeState(checked ? 'on' : 'off')}
            disabled={isLiveBusinessActive}
          />
          <Label htmlFor="sim-mode-compact" className="text-sm">
            Simulation Mode
          </Label>
        </div>
        {isLiveBusinessActive && (
          <Badge variant="outline" className="text-xs">
            <Shield className="h-3 w-3 mr-1" />
            Protected
          </Badge>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              Simulation Mode
            </CardTitle>
            <CardDescription>
              Control demo data display for development and testing
            </CardDescription>
          </div>
          <Badge variant={simulationMode ? 'default' : 'secondary'}>
            {simulationMode ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Live business warning */}
        {isLiveBusinessActive && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-red-800 dark:text-red-200">
                Protected Business Active
              </p>
              <p className="text-red-600 dark:text-red-400">
                "{currentBusinessSlug}" is a live production business. 
                Simulation mode is automatically disabled.
              </p>
            </div>
          </div>
        )}

        {/* Mode selector */}
        <div className="flex items-center justify-between">
          <div>
            <Label>Mode State</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Current source: {source}
            </p>
          </div>
          <Select 
            value={modeState} 
            onValueChange={(value) => setModeState(value as SimulationModeState)}
            disabled={isLiveBusinessActive}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto</SelectItem>
              <SelectItem value="on">On</SelectItem>
              <SelectItem value="off">Off</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Scenario selector */}
        {simulationMode && (
          <div className="flex items-center justify-between">
            <div>
              <Label>Scenario</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Demo data scenario to display
              </p>
            </div>
            <Select 
              value={scenario} 
              onValueChange={(value) => setScenario(value as any)}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="heavy_issue">Heavy Issues</SelectItem>
                <SelectItem value="low_volume">Low Volume</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Protected businesses list */}
        <div className="pt-2 border-t">
          <Label className="text-xs text-muted-foreground">Protected Businesses</Label>
          <div className="flex flex-wrap gap-1 mt-2">
            {LIVE_BUSINESSES.map((slug) => (
              <Badge 
                key={slug} 
                variant="outline" 
                className={`text-xs ${currentBusinessSlug === slug ? 'bg-red-100 border-red-300 dark:bg-red-950 dark:border-red-800' : ''}`}
              >
                {slug}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
