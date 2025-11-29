// ═══════════════════════════════════════════════════════════════════════════════
// AI ROUTINES PAGE — Manage Scheduled Playbook Executions
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GrabbaLayout } from '@/components/grabba/GrabbaLayout';
import { usePlaybookEngine, Routine, RoutineLog } from '@/hooks/usePlaybookEngine';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Clock,
  Play,
  Pause,
  Trash2,
  Eye,
  CheckCircle2,
  XCircle,
  Loader2,
  BookOpen,
  Calendar,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

export default function AiRoutines() {
  const navigate = useNavigate();
  const {
    fetchRoutines,
    fetchRoutineLogs,
    updateRoutine,
    deleteRoutine,
    executeRoutine,
    isRunning,
  } = usePlaybookEngine();

  const [routines, setRoutines] = useState<Routine[]>([]);
  const [logs, setLogs] = useState<RoutineLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showLogsDialog, setShowLogsDialog] = useState(false);
  const [selectedRoutineId, setSelectedRoutineId] = useState<string | null>(null);
  const [runningRoutineId, setRunningRoutineId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    const [routinesData, logsData] = await Promise.all([
      fetchRoutines(),
      fetchRoutineLogs(undefined, 50),
    ]);
    setRoutines(routinesData);
    setLogs(logsData);
    setIsLoading(false);
  };

  const handleToggleActive = async (routine: Routine) => {
    await updateRoutine(routine.id, { active: !routine.active });
    loadData();
  };

  const handleRunNow = async (routineId: string) => {
    setRunningRoutineId(routineId);
    await executeRoutine(routineId);
    setRunningRoutineId(null);
    loadData();
  };

  const handleDelete = async (routineId: string) => {
    if (confirm('Are you sure you want to delete this routine?')) {
      await deleteRoutine(routineId);
      loadData();
    }
  };

  const handleViewLogs = (routineId: string) => {
    setSelectedRoutineId(routineId);
    setShowLogsDialog(true);
  };

  const getFrequencyLabel = (freq: string) => {
    switch (freq) {
      case 'daily': return 'Daily';
      case 'weekly': return 'Weekly';
      case 'monthly': return 'Monthly';
      default: return freq;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-green-500/20 text-green-400"><CheckCircle2 className="w-3 h-3 mr-1" />Success</Badge>;
      case 'error':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Error</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    }
  };

  const selectedRoutineLogs = selectedRoutineId 
    ? logs.filter(l => l.routine_id === selectedRoutineId)
    : [];

  return (
    <GrabbaLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Clock className="w-8 h-8 text-primary" />
              AI Routines
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage scheduled playbook executions
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadData}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={() => navigate('/grabba/ai-playbooks')}>
              <BookOpen className="w-4 h-4 mr-2" />
              View Playbooks
            </Button>
          </div>
        </div>

        {/* Routines Table */}
        <Card>
          <CardHeader>
            <CardTitle>Active Routines</CardTitle>
            <CardDescription>
              Automated playbook executions running on schedule
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : routines.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-medium mb-2">No routines scheduled</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Create a playbook and schedule it to run automatically
                </p>
                <Button onClick={() => navigate('/grabba/ai-playbooks')}>
                  <BookOpen className="w-4 h-4 mr-2" />
                  Go to Playbooks
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Playbook</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead>Next Run</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notify</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {routines.map((routine) => (
                    <TableRow key={routine.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{routine.playbook?.title || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">
                            {routine.playbook?.steps?.length || 0} steps
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getFrequencyLabel(routine.frequency)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm">
                            {format(new Date(routine.next_run_at), 'MMM d, h:mm a')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(routine.next_run_at), { addSuffix: true })}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={routine.active}
                            onCheckedChange={() => handleToggleActive(routine)}
                          />
                          <span className="text-sm">
                            {routine.active ? 'Active' : 'Paused'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {routine.notify_user ? (
                          <Badge variant="secondary">Yes</Badge>
                        ) : (
                          <span className="text-muted-foreground">No</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRunNow(routine.id)}
                            disabled={runningRoutineId === routine.id}
                          >
                            {runningRoutineId === routine.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Play className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewLogs(routine.id)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(routine.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Recent Logs */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Execution Logs</CardTitle>
            <CardDescription>
              History of routine executions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                No execution logs yet
              </p>
            ) : (
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {logs.slice(0, 20).map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card/50"
                    >
                      <div className="flex items-center gap-3">
                        {getStatusBadge(log.status)}
                        <div>
                          <p className="text-sm font-medium">
                            Routine executed
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(log.run_at), 'MMM d, h:mm a')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        {log.error_message && (
                          <p className="text-xs text-destructive line-clamp-1 max-w-[200px]">
                            {log.error_message}
                          </p>
                        )}
                        {Array.isArray(log.result) && (
                          <p className="text-xs text-muted-foreground">
                            {log.result.filter((r: any) => r.success).length}/{log.result.length} steps succeeded
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Logs Dialog */}
      <Dialog open={showLogsDialog} onOpenChange={setShowLogsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Execution History</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            {selectedRoutineLogs.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                No logs for this routine
              </p>
            ) : (
              <div className="space-y-3">
                {selectedRoutineLogs.map((log) => (
                  <Card key={log.id}>
                    <CardContent className="py-3">
                      <div className="flex items-center justify-between mb-2">
                        {getStatusBadge(log.status)}
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(log.run_at), 'MMM d, yyyy h:mm a')}
                        </span>
                      </div>
                      {log.error_message && (
                        <p className="text-sm text-destructive mb-2">
                          {log.error_message}
                        </p>
                      )}
                      {Array.isArray(log.result) && log.result.length > 0 && (
                        <div className="space-y-1">
                          {log.result.map((r: any, i: number) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                              {r.success ? (
                                <CheckCircle2 className="w-3 h-3 text-green-500" />
                              ) : (
                                <XCircle className="w-3 h-3 text-destructive" />
                              )}
                              <span className="truncate">{r.input}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </GrabbaLayout>
  );
}
