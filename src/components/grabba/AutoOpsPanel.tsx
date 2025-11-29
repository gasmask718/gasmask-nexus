// ═══════════════════════════════════════════════════════════════════════════════
// AUTO-OPS DASHBOARD PANEL — For Penthouse
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlaybookEngine, Routine, RoutineLog } from '@/hooks/usePlaybookEngine';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Clock,
  Play,
  Settings,
  BookOpen,
  CheckCircle2,
  XCircle,
  Loader2,
  Bot,
  Calendar,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

export function AutoOpsPanel() {
  const navigate = useNavigate();
  const {
    fetchRoutines,
    fetchRoutineLogs,
    executeRoutine,
    updateRoutine,
  } = usePlaybookEngine();

  const [routines, setRoutines] = useState<Routine[]>([]);
  const [recentLogs, setRecentLogs] = useState<RoutineLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [runningId, setRunningId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    const [routinesData, logsData] = await Promise.all([
      fetchRoutines(),
      fetchRoutineLogs(undefined, 10),
    ]);
    setRoutines(routinesData);
    setRecentLogs(logsData);
    setIsLoading(false);
  };

  const handleRunNow = async (routineId: string) => {
    setRunningId(routineId);
    await executeRoutine(routineId);
    setRunningId(null);
    loadData();
  };

  const handleToggleActive = async (routine: Routine) => {
    await updateRoutine(routine.id, { active: !routine.active });
    loadData();
  };

  const activeRoutines = routines.filter(r => r.active);
  const totalProcessed = recentLogs
    .filter(l => l.status === 'success')
    .reduce((sum, l) => {
      const results = Array.isArray(l.result) ? l.result : [];
      return sum + results.filter((r: any) => r.success).length;
    }, 0);

  const errorCount = recentLogs.filter(l => l.status === 'error').length;

  return (
    <Card className="bg-gradient-to-br from-violet-500/5 to-indigo-500/5 border-violet-500/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-violet-500" />
            <CardTitle className="text-lg">Autonomous Operators</CardTitle>
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => navigate('/grabba/routines')}>
              <Clock className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => navigate('/grabba/ai-playbooks')}>
              <BookOpen className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <CardDescription>
          AI-powered automation running your operations
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-background/50 text-center">
            <div className="text-2xl font-bold text-violet-500">{activeRoutines.length}</div>
            <div className="text-xs text-muted-foreground">Active Routines</div>
          </div>
          <div className="p-3 rounded-lg bg-background/50 text-center">
            <div className="text-2xl font-bold text-green-500">{totalProcessed}</div>
            <div className="text-xs text-muted-foreground">Steps Processed</div>
          </div>
          <div className="p-3 rounded-lg bg-background/50 text-center">
            <div className="text-2xl font-bold text-red-500">{errorCount}</div>
            <div className="text-xs text-muted-foreground">Errors (24h)</div>
          </div>
        </div>

        {/* Active Routines */}
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : routines.length === 0 ? (
          <div className="text-center py-4">
            <Bot className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground">No routines configured</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => navigate('/grabba/ai-playbooks')}
            >
              <Zap className="w-4 h-4 mr-1" />
              Create Playbook
            </Button>
          </div>
        ) : (
          <ScrollArea className="h-[200px]">
            <div className="space-y-2">
              {routines.slice(0, 5).map((routine) => (
                <div
                  key={routine.id}
                  className="flex items-center justify-between p-2 rounded-lg border bg-card/50"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Switch
                      checked={routine.active}
                      onCheckedChange={() => handleToggleActive(routine)}
                      className="scale-75"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {routine.playbook?.title || 'Unknown'}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-xs h-5">
                          {routine.frequency}
                        </Badge>
                        <span>
                          {formatDistanceToNow(new Date(routine.next_run_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRunNow(routine.id)}
                    disabled={runningId === routine.id}
                  >
                    {runningId === routine.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Recent Activity */}
        {recentLogs.length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-xs font-medium text-muted-foreground mb-2">Recent Activity</p>
            <div className="space-y-1">
              {recentLogs.slice(0, 3).map((log) => (
                <div
                  key={log.id}
                  className="flex items-center gap-2 text-xs"
                >
                  {log.status === 'success' ? (
                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                  ) : (
                    <XCircle className="w-3 h-3 text-destructive" />
                  )}
                  <span className="text-muted-foreground">
                    {format(new Date(log.run_at), 'MMM d, h:mm a')}
                  </span>
                  <span className="truncate">
                    {Array.isArray(log.result) ? `${log.result.length} steps` : 'Completed'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={() => navigate('/grabba/ai-playbooks')}
          >
            <BookOpen className="w-4 h-4 mr-1" />
            Edit Playbooks
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={() => navigate('/grabba/routines')}
          >
            <Settings className="w-4 h-4 mr-1" />
            View Logs
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
