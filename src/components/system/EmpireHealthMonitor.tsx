// 🧠 EMPIRE HEALTH MONITOR - Visual Component
import { useEmpireHealthMonitor } from '@/hooks/useEmpireHealthMonitor';
import { useUserRole } from '@/hooks/useUserRole';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, RefreshCw, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function EmpireHealthMonitor() {
  const { roles, loading } = useUserRole();
  const { lastCheck, isRunning, runHealthCheck } = useEmpireHealthMonitor();

  // Only show for admins - use stable check
  const isAdminUser = roles.includes('admin');
  if (loading || !isAdminUser) return null;

  const statusIcon = {
    healthy: <CheckCircle className="h-3 w-3 text-emerald-400" />,
    degraded: <AlertTriangle className="h-3 w-3 text-amber-400" />,
    critical: <XCircle className="h-3 w-3 text-red-400" />,
  };

  const statusColor = {
    healthy: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    degraded: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
    critical: 'border-red-500/40 bg-red-500/10 text-red-300',
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={`text-[10px] px-2 py-0.5 ${lastCheck ? statusColor[lastCheck.status] : 'border-muted'}`}
            >
              <Activity className="h-3 w-3 mr-1" />
              EHM: {lastCheck?.status ?? 'initializing'}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => runHealthCheck()}
              disabled={isRunning}
            >
              <RefreshCw className={`h-3 w-3 ${isRunning ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="text-xs space-y-1">
            <p className="font-semibold flex items-center gap-1">
              {lastCheck && statusIcon[lastCheck.status]}
              Empire Health Monitor
            </p>
            {lastCheck && (
              <>
                <p className="text-muted-foreground">
                  Last scan: {lastCheck.timestamp.toLocaleTimeString()}
                </p>
                <p>
                  Modules: {lastCheck.moduleDiagnostics.totalModules} |
                  Routes: {lastCheck.moduleDiagnostics.totalRoutes}
                </p>
                <p className="text-muted-foreground">
                  {lastCheck.checks.filter(c => c.passed).length}/{lastCheck.checks.length} checks passed
                </p>
              </>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default EmpireHealthMonitor;
