import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  CheckCircle2, AlertCircle, XCircle, Database, Brain, Target, Activity,
  RefreshCw, ChevronDown, Wrench, Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useSBOSystemHealth, type SBOSystemHealth, type FunctionHealth } from '@/hooks/useSBOSystemHealth';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

function StatusDot({ status }: { status: string }) {
  if (status === 'healthy') return <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />;
  if (status === 'warning') return <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />;
  return <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />;
}

function FnStatus({ label, fn }: { label: string; fn: FunctionHealth | null }) {
  if (!fn) return (
    <div className="flex items-center gap-1.5 text-xs">
      <Clock className="h-3 w-3 text-muted-foreground" />
      <span className="text-muted-foreground">{label}:</span>
      <span className="text-muted-foreground">Never run</span>
    </div>
  );

  const ago = getTimeAgo(fn.last_run);
  const icon = fn.status === 'completed'
    ? <CheckCircle2 className="h-3 w-3 text-emerald-500" />
    : fn.status === 'failed'
    ? <XCircle className="h-3 w-3 text-red-500" />
    : <RefreshCw className="h-3 w-3 text-amber-500 animate-spin" />;

  return (
    <div className="flex items-center gap-1.5 text-xs">
      {icon}
      <span className="text-muted-foreground">{label}:</span>
      <span className={cn('font-medium', fn.status === 'completed' ? 'text-emerald-400' : fn.status === 'failed' ? 'text-red-400' : 'text-amber-400')}>
        {ago}
      </span>
      {fn.records > 0 && <span className="text-muted-foreground">({fn.records})</span>}
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function SBOSystemStatusBar() {
  const { data: health, isLoading, refetch } = useSBOSystemHealth();
  const [isRepairing, setIsRepairing] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const queryClient = useQueryClient();

  const handleForceRepair = async () => {
    setIsRepairing(true);
    toast.info('🛠 Running full system repair: Expand → Collect → Verify...');
    try {
      // Step 1: Expand context
      const { error: e1 } = await supabase.functions.invoke('sbo-expand-stat-context');
      if (e1) throw e1;

      // Step 2: Collect stats
      const { error: e2 } = await supabase.functions.invoke('sbo-collect-stats');
      if (e2) throw e2;

      // Step 3: Verify
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['props-master'] });
      queryClient.invalidateQueries({ queryKey: ['props-master-stats'] });

      toast.success('✅ System repair complete');
    } catch (e: any) {
      toast.error(`Repair failed: ${e.message}`);
    } finally {
      setIsRepairing(false);
    }
  };

  if (isLoading || !health) {
    return (
      <Card className="border-border/30 bg-muted/5">
        <CardContent className="py-2.5 px-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <RefreshCw className="h-3 w-3 animate-spin" /> Checking system health...
          </div>
        </CardContent>
      </Card>
    );
  }

  const statusColor = {
    healthy: 'border-emerald-500/20 bg-emerald-500/5',
    warning: 'border-amber-500/20 bg-amber-500/5',
    critical: 'border-red-500/20 bg-red-500/5',
  }[health.status];

  const statusLabel = {
    healthy: 'All Systems Operational',
    warning: 'Minor Issues Detected',
    critical: 'Critical Alert',
  }[health.status];

  return (
    <Collapsible open={logsOpen} onOpenChange={setLogsOpen}>
      <Card className={cn('rounded-xl border shadow-sm', statusColor)}>
        <CardContent className="py-2.5 px-4">
          <TooltipProvider>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              {/* Left: Status */}
              <div className="flex items-center gap-2">
                <StatusDot status={health.status} />
                <span className="text-xs font-medium text-muted-foreground">SBO Engine</span>
                <Badge variant="outline" className={cn('text-[10px] px-2 py-0',
                  health.status === 'healthy' && 'border-emerald-500/40 text-emerald-400',
                  health.status === 'warning' && 'border-amber-500/40 text-amber-400',
                  health.status === 'critical' && 'border-red-500/40 text-red-400',
                )}>
                  {statusLabel}
                </Badge>
              </div>

              {/* Center: Key Metrics */}
              <div className="flex items-center gap-4 flex-wrap">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5 text-xs cursor-help">
                      <Database className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Stats:</span>
                      <span className={cn('font-bold', health.stats_coverage >= 95 ? 'text-emerald-400' : health.stats_coverage >= 80 ? 'text-amber-400' : 'text-red-400')}>
                        {health.stats_coverage}%
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent><p>{health.props_with_stats}/{health.total_props} props have stats</p></TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5 text-xs cursor-help">
                      <Target className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Results:</span>
                      <span className="font-bold text-blue-400">{health.results_coverage}%</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent><p>{health.props_with_results}/{health.total_props} props settled</p></TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5 text-xs cursor-help">
                      <Brain className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Context:</span>
                      <span className="font-bold text-purple-400">{health.context_entries.toLocaleString()}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent><p>Player/stat combos in reference library</p></TooltipContent>
                </Tooltip>
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-2">
                {health.alerts.length > 0 && (
                  <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-400 gap-1">
                    <AlertCircle className="h-2.5 w-2.5" /> {health.alerts.length}
                  </Badge>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[10px] gap-1"
                  onClick={handleForceRepair}
                  disabled={isRepairing}
                >
                  {isRepairing ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Wrench className="h-3 w-3" />}
                  {isRepairing ? 'Repairing...' : 'Repair'}
                </Button>

                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <ChevronDown className={cn('h-3 w-3 transition-transform', logsOpen && 'rotate-180')} />
                  </Button>
                </CollapsibleTrigger>
              </div>
            </div>
          </TooltipProvider>

          {/* Alerts Banner */}
          {health.alerts.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {health.alerts.map((a, i) => (
                <div key={i} className={cn('flex items-center gap-1 text-[10px] rounded px-2 py-0.5',
                  a.level === 'critical' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'
                )}>
                  {a.level === 'critical' ? <XCircle className="h-2.5 w-2.5" /> : <AlertCircle className="h-2.5 w-2.5" />}
                  {a.message}
                </div>
              ))}
            </div>
          )}
        </CardContent>

        {/* Expanded: Function Status + Logs */}
        <CollapsibleContent>
          <CardContent className="pt-0 pb-3 px-4 space-y-3">
            <div className="border-t border-border/30 pt-2">
              <p className="text-[10px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Function Health</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <FnStatus label="Collect Stats" fn={health.functions.collect_stats} />
                <FnStatus label="Expand Context" fn={health.functions.expand_context} />
                <FnStatus label="Analysis" fn={health.functions.run_analysis} />
                <FnStatus label="Settle Results" fn={health.functions.settle_results} />
              </div>
            </div>

            {health.recent_logs.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Recent Logs</p>
                <div className="space-y-1">
                  {health.recent_logs.map((log, i) => (
                    <div key={i} className="flex items-center justify-between text-[10px] bg-muted/20 rounded px-2 py-1">
                      <div className="flex items-center gap-2">
                        {log.status === 'completed' ? <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" /> :
                         log.status === 'failed' ? <XCircle className="h-2.5 w-2.5 text-red-500" /> :
                         <RefreshCw className="h-2.5 w-2.5 text-amber-500 animate-spin" />}
                        <span className="font-mono">{log.function_name}</span>
                      </div>
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <span>{log.records_processed} records</span>
                        {log.duration_ms && <span>{(log.duration_ms / 1000).toFixed(1)}s</span>}
                        <span>{getTimeAgo(log.started_at)}</span>
                      </div>
                      {log.error && <span className="text-red-400 truncate max-w-32">{log.error}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
