import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, 
  AlertCircle, 
  XCircle, 
  Database, 
  Route, 
  Layers, 
  Clock,
  Shield,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface HealthMetric {
  id: string;
  label: string;
  value: string | number;
  status: 'healthy' | 'warning' | 'critical';
  icon: React.ElementType;
  tooltip?: string;
}

const healthMetrics: HealthMetric[] = [
  { id: 'modules', label: 'Modules', value: '10 active', status: 'healthy', icon: Layers, tooltip: 'All OS modules running' },
  { id: 'routes', label: 'Routes', value: '148 total', status: 'healthy', icon: Route, tooltip: 'Navigation routes configured' },
  { id: 'database', label: 'Database', value: 'Online', status: 'healthy', icon: Database, tooltip: 'Supabase connection active' },
  { id: 'checkpoint', label: 'Last Save', value: '2 min ago', status: 'healthy', icon: Clock, tooltip: 'Auto-checkpoint enabled' },
  { id: 'security', label: 'Security', value: 'Locked', status: 'healthy', icon: Shield, tooltip: 'RLS policies active' },
  { id: 'api', label: 'API Health', value: '99.9%', status: 'healthy', icon: Activity, tooltip: 'All endpoints responding' },
];

function StatusIcon({ status }: { status: 'healthy' | 'warning' | 'critical' }) {
  switch (status) {
    case 'healthy':
      return <CheckCircle2 className="h-3 w-3 text-emerald-400" />;
    case 'warning':
      return <AlertCircle className="h-3 w-3 text-amber-400" />;
    case 'critical':
      return <XCircle className="h-3 w-3 text-red-400" />;
  }
}

export function SystemHealthBar() {
  const overallHealth = healthMetrics.every(m => m.status === 'healthy') 
    ? 'healthy' 
    : healthMetrics.some(m => m.status === 'critical') 
      ? 'critical' 
      : 'warning';

  return (
    <Card className={cn(
      "rounded-xl border shadow-sm",
      overallHealth === 'healthy' && "border-emerald-500/20 bg-emerald-500/5",
      overallHealth === 'warning' && "border-amber-500/20 bg-amber-500/5",
      overallHealth === 'critical' && "border-red-500/20 bg-red-500/5"
    )}>
      <CardContent className="py-3 px-4">
        <TooltipProvider>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <StatusIcon status={overallHealth} />
              <span className="text-xs font-medium text-muted-foreground">System Health</span>
              <Badge 
                variant="outline" 
                className={cn(
                  "text-[10px] px-2 py-0",
                  overallHealth === 'healthy' && "border-emerald-500/40 text-emerald-400",
                  overallHealth === 'warning' && "border-amber-500/40 text-amber-400",
                  overallHealth === 'critical' && "border-red-500/40 text-red-400"
                )}
              >
                {overallHealth === 'healthy' ? 'All Systems Operational' : overallHealth === 'warning' ? 'Minor Issues' : 'Critical Alert'}
              </Badge>
            </div>
            
            <div className="flex items-center gap-4 flex-wrap">
              {healthMetrics.map((metric) => (
                <Tooltip key={metric.id}>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5 text-xs cursor-help">
                      <metric.icon className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">{metric.label}:</span>
                      <span className={cn(
                        "font-medium",
                        metric.status === 'healthy' && "text-emerald-400",
                        metric.status === 'warning' && "text-amber-400",
                        metric.status === 'critical' && "text-red-400"
                      )}>
                        {metric.value}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{metric.tooltip}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}

export default SystemHealthBar;
