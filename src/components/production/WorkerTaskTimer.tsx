/**
 * Worker Task Timer — Shop-floor UI
 * Start/finish/void task timers for sleeving & stickering per 1,000 tubes.
 * Mobile-first, frictionless design.
 */
import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import {
  useRunningTask,
  useTodayTasks,
  useStartTask,
  useFinishTask,
  useVoidTask,
  useLaborBaselines,
  getTaskVarianceLevel,
  TASK_TYPE_LABELS,
  type WorkerTaskType,
  type WorkerTask,
} from '@/hooks/useWorkerTaskTimer';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { supabase } from '@/integrations/supabase/client';
import {
  Timer,
  Play,
  Square,
  XCircle,
  CheckCircle,
  Clock,
  Trophy,
  AlertTriangle,
  Zap,
} from 'lucide-react';

function LiveTimer({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(startedAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;
  const isLong = elapsed > 6 * 3600; // 6-hour warning

  return (
    <div className="text-center">
      <p className={`text-5xl sm:text-6xl font-mono font-bold tracking-tight ${isLong ? 'text-destructive animate-pulse' : 'text-primary'}`}>
        {String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </p>
      {isLong && (
        <p className="text-sm text-destructive mt-2 flex items-center justify-center gap-1">
          <AlertTriangle className="h-4 w-4" />
          Timer running over 6 hours — are you still working?
        </p>
      )}
    </div>
  );
}

function TaskSummaryCard({ task, baseline }: { task: WorkerTask; baseline?: number }) {
  const mins = task.duration_seconds ? (task.duration_seconds / 60) : 0;
  const variance = getTaskVarianceLevel(mins, baseline);

  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-2">
        {task.status === 'completed' ? (
          <CheckCircle className="h-4 w-4 text-emerald-500" />
        ) : (
          <XCircle className="h-4 w-4 text-destructive" />
        )}
        <div>
          <p className="text-sm font-medium">{TASK_TYPE_LABELS[task.task_type]}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(task.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            {task.brand && ` · ${task.brand}`}
          </p>
        </div>
      </div>
      <div className="text-right">
        {task.status === 'completed' ? (
          <Badge variant={variance === 'red' ? 'destructive' : variance === 'amber' ? 'secondary' : 'default'} className="font-mono">
            {mins.toFixed(1)} min
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs">Voided</Badge>
        )}
      </div>
    </div>
  );
}

interface WorkerTaskTimerProps {
  officeId: string;
}

export function WorkerTaskTimer({ officeId }: WorkerTaskTimerProps) {
  const { data: profile } = useCurrentUserProfile();
  const [userId, setUserId] = useState<string | null>(null);

  // Get auth user ID
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id || null));
  }, []);

  const { data: runningTask, isLoading: runningLoading } = useRunningTask(officeId, userId || undefined);
  const { data: todayTasks = [] } = useTodayTasks(officeId, userId || undefined);
  const { data: baselines = [] } = useLaborBaselines(officeId);
  const startTask = useStartTask();
  const finishTask = useFinishTask();
  const voidTask = useVoidTask();

  // Start task form state
  const [taskType, setTaskType] = useState<WorkerTaskType>('sleeving');
  const [brand, setBrand] = useState('');
  const [notes, setNotes] = useState('');

  // Void dialog
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const profileData = profile as any;
  const displayName = profileData?.profile ? `${profileData.profile.first_name || ''} ${profileData.profile.last_name || ''}`.trim() : undefined;

  const handleStart = () => {
    if (!userId) return;
    startTask.mutate({
      office_id: officeId,
      worker_user_id: userId,
      worker_display_name: displayName,
      task_type: taskType,
      brand: brand || undefined,
      notes: notes || undefined,
    }, {
      onSuccess: () => {
        setBrand('');
        setNotes('');
      },
    });
  };

  const handleFinish = () => {
    if (!runningTask || !userId) return;
    finishTask.mutate({ taskId: runningTask.id, officeId, userId });
  };

  const handleVoid = () => {
    if (!runningTask || !userId || !voidReason.trim()) return;
    voidTask.mutate(
      { taskId: runningTask.id, officeId, userId, reason: voidReason },
      { onSuccess: () => { setVoidDialogOpen(false); setVoidReason(''); } }
    );
  };

  // Today's stats
  const completedToday = todayTasks.filter(t => t.status === 'completed');
  const avgMinutesToday = completedToday.length > 0
    ? completedToday.reduce((s, t) => s + (t.duration_seconds || 0), 0) / completedToday.length / 60
    : 0;
  const bestToday = completedToday.length > 0
    ? Math.min(...completedToday.map(t => (t.duration_seconds || Infinity) / 60))
    : 0;

  // Get baseline for current task type filter
  const getBaseline = (type: WorkerTaskType) => {
    const b = baselines.find(bl => bl.task_type === type && (bl.office_id === officeId || !bl.office_id));
    return b?.baseline_minutes_per_1000;
  };

  if (!userId) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading user session…
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Running Task Card */}
      {runningTask ? (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Timer className="h-5 w-5 text-primary animate-pulse" />
              Timer Running
            </CardTitle>
            <CardDescription>
              {TASK_TYPE_LABELS[runningTask.task_type]} · 1 Box = 1,000 Tubes
              {runningTask.brand && ` · ${runningTask.brand}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <LiveTimer startedAt={runningTask.started_at} />

            <div className="flex gap-2">
              <Button
                onClick={handleFinish}
                disabled={finishTask.isPending}
                size="lg"
                className="flex-1 h-14 text-lg touch-target"
              >
                <CheckCircle className="h-5 w-5 mr-2" />
                {finishTask.isPending ? 'Finishing…' : 'FINISH'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setVoidDialogOpen(true)}
                disabled={voidTask.isPending}
                size="lg"
                className="h-14 touch-target"
              >
                <XCircle className="h-5 w-5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Start Task Card */
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Play className="h-5 w-5" />
              Start Task
            </CardTitle>
            <CardDescription>
              Time how long it takes to complete 1 box (1,000 tubes)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Task Type</Label>
              <Select value={taskType} onValueChange={(v) => setTaskType(v as WorkerTaskType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sleeving">🧤 Sleeving</SelectItem>
                  <SelectItem value="sticker">🏷️ Stickering</SelectItem>
                  <SelectItem value="sleeving_and_sticker">🧤🏷️ Sleeving + Stickering</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Brand <span className="text-muted-foreground">(optional)</span></Label>
              <Input
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g. Grabba Leaf"
              />
            </div>

            <div className="p-3 bg-muted/50 rounded-md text-sm text-muted-foreground flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Standard Unit: <strong>1 Box = 1,000 Tubes</strong>
            </div>

            <div className="space-y-2">
              <Label>Notes <span className="text-muted-foreground">(optional)</span></Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any notes for this task…"
                rows={2}
              />
            </div>

            <Button
              onClick={handleStart}
              disabled={startTask.isPending}
              size="lg"
              className="w-full h-14 text-lg touch-target"
            >
              <Timer className="h-5 w-5 mr-2" />
              {startTask.isPending ? 'Starting…' : 'START TIMER'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Today's Tasks */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5" />
            Today's Tasks
          </CardTitle>
          <CardDescription>
            {completedToday.length} completed
            {completedToday.length > 0 && ` · Avg: ${avgMinutesToday.toFixed(1)} min`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Quick stats */}
          {completedToday.length > 0 && (
            <>
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="text-center p-2 bg-muted/50 rounded-md">
                  <p className="text-xs text-muted-foreground uppercase">Completed</p>
                  <p className="text-xl font-bold">{completedToday.length}</p>
                </div>
                <div className="text-center p-2 bg-muted/50 rounded-md">
                  <p className="text-xs text-muted-foreground uppercase">Avg Time</p>
                  <p className="text-xl font-bold">{avgMinutesToday.toFixed(1)}<span className="text-sm font-normal"> min</span></p>
                </div>
                <div className="text-center p-2 bg-emerald-500/10 rounded-md">
                  <div className="flex items-center justify-center gap-1">
                    <Trophy className="h-3 w-3 text-emerald-500" />
                    <p className="text-xs text-muted-foreground uppercase">Best</p>
                  </div>
                  <p className="text-xl font-bold text-emerald-600">{bestToday.toFixed(1)}<span className="text-sm font-normal"> min</span></p>
                </div>
              </div>
              <Separator className="mb-3" />
            </>
          )}

          {todayTasks.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-4">
              No tasks yet today. Start your first timer!
            </p>
          ) : (
            <div className="space-y-0">
              {todayTasks.map(task => (
                <TaskSummaryCard
                  key={task.id}
                  task={task}
                  baseline={getBaseline(task.task_type)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Void Dialog */}
      <Dialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Void This Task?</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason for voiding</Label>
            <Textarea
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="Why is this task being voided?"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidDialogOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleVoid}
              disabled={!voidReason.trim() || voidTask.isPending}
            >
              Void Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
