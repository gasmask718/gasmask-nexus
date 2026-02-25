/**
 * DAILY EXECUTION DASHBOARD
 * "Today's Production" — boxes completed, goal progress, labor, lbs, throughput.
 * Supervisor-controlled entry + goal tracking.
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import {
  useTodayProductionSummary,
  useRecentProductionSummaries,
  useUpsertDailyProductionSummary,
} from '@/hooks/useDailyProductionSummary';
import { useDailyMaterialSummary } from '@/hooks/useProductionMaterials';
import { Target, Box, Leaf, Users, TrendingUp, Save, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface DailyExecutionDashboardProps {
  officeId: string;
  dailyGoal?: number;
}

export function DailyExecutionDashboard({ officeId, dailyGoal = 100 }: DailyExecutionDashboardProps) {
  const { data: todaySummary, isLoading } = useTodayProductionSummary(officeId);
  const { data: recent = [] } = useRecentProductionSummaries(officeId, 7);
  const { data: materialToday = [] } = useDailyMaterialSummary(officeId);
  const upsert = useUpsertDailyProductionSummary();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    workersPresent: 0,
    boxesCompleted: 0,
    tobaccoLbsUsed: 0,
    notes: '',
  });

  // Sync form with existing data
  useEffect(() => {
    if (todaySummary) {
      setForm({
        workersPresent: todaySummary.workers_present || 0,
        boxesCompleted: todaySummary.boxes_completed || 0,
        tobaccoLbsUsed: todaySummary.tobacco_lbs_used || 0,
        notes: todaySummary.notes || '',
      });
    }
  }, [todaySummary]);

  const boxes = todaySummary?.boxes_completed || form.boxesCompleted;
  const goalPct = dailyGoal > 0 ? Math.min((boxes / dailyGoal) * 100, 100) : 0;
  const throughput = (todaySummary?.workers_present || form.workersPresent) > 0
    ? boxes / (todaySummary?.workers_present || form.workersPresent)
    : 0;

  const getGoalBadge = () => {
    if (goalPct >= 100) return { label: 'Goal Met', color: 'bg-emerald-100 text-emerald-800', icon: <CheckCircle className="h-3 w-3" /> };
    if (goalPct >= 90) return { label: 'Near Goal', color: 'bg-amber-100 text-amber-800', icon: <Target className="h-3 w-3" /> };
    return { label: 'Below Goal', color: 'bg-red-100 text-red-800', icon: <Target className="h-3 w-3" /> };
  };

  const handleSave = async () => {
    await upsert.mutateAsync({
      officeId,
      workersPresent: form.workersPresent,
      boxesCompleted: form.boxesCompleted,
      tobaccoLbsUsed: form.tobaccoLbsUsed,
      notes: form.notes,
    });
    setEditing(false);
  };

  // 7-day avg
  const avg7d = recent.length > 0
    ? recent.reduce((s, r) => s + (r.boxes_completed || 0), 0) / recent.length
    : 0;

  // Today's material from views
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayMaterials = materialToday.filter(m => m.usage_date === todayStr);

  const badge = getGoalBadge();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-5 w-5 text-primary" />
              Today's Production
            </CardTitle>
            <CardDescription>{format(new Date(), 'EEEE, MMMM d, yyyy')}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={cn('text-xs', badge.color)}>
              {badge.icon}
              <span className="ml-1">{badge.label}</span>
            </Badge>
            {!editing ? (
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit</Button>
            ) : (
              <Button size="sm" onClick={handleSave} disabled={upsert.isPending}>
                <Save className="h-3 w-3 mr-1" />
                Save
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Goal Progress */}
        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-muted-foreground">Goal Progress</span>
            <span className="font-mono font-semibold">
              {boxes} / {dailyGoal} boxes
            </span>
          </div>
          <Progress value={goalPct} className="h-3" />
          <p className="text-[11px] text-muted-foreground mt-1">
            {goalPct.toFixed(0)}% — 7d avg: {avg7d.toFixed(0)} boxes/day
          </p>
        </div>

        {/* KPI Cards */}
        {editing ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label className="text-xs">Boxes Completed</Label>
              <Input
                type="number"
                value={form.boxesCompleted}
                onChange={e => setForm({ ...form, boxesCompleted: Number(e.target.value) })}
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Workers Present</Label>
              <Input
                type="number"
                value={form.workersPresent}
                onChange={e => setForm({ ...form, workersPresent: Number(e.target.value) })}
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Tobacco LBS Used</Label>
              <Input
                type="number"
                step="0.1"
                value={form.tobaccoLbsUsed}
                onChange={e => setForm({ ...form, tobaccoLbsUsed: Number(e.target.value) })}
              />
            </div>
            <div className="grid gap-1 col-span-2">
              <Label className="text-xs">Notes</Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                rows={2}
                placeholder="Production notes..."
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border bg-muted/30 p-3 text-center">
              <Box className="h-4 w-4 mx-auto mb-1 text-primary" />
              <p className="text-lg font-mono font-bold">{boxes}</p>
              <p className="text-[10px] text-muted-foreground">Boxes</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 text-center">
              <Users className="h-4 w-4 mx-auto mb-1 text-blue-600" />
              <p className="text-lg font-mono font-bold">{todaySummary?.workers_present || form.workersPresent}</p>
              <p className="text-[10px] text-muted-foreground">Workers</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 text-center">
              <Leaf className="h-4 w-4 mx-auto mb-1 text-emerald-600" />
              <p className="text-lg font-mono font-bold">{(todaySummary?.tobacco_lbs_used || form.tobaccoLbsUsed).toFixed(1)}</p>
              <p className="text-[10px] text-muted-foreground">LBS Used</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 text-center">
              <TrendingUp className="h-4 w-4 mx-auto mb-1 text-amber-600" />
              <p className="text-lg font-mono font-bold">{throughput.toFixed(1)}</p>
              <p className="text-[10px] text-muted-foreground">Boxes/Worker</p>
            </div>
          </div>
        )}

        {/* Today's Material Usage */}
        {todayMaterials.length > 0 && !editing && (
          <div className="border-t pt-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">Material Used Today</p>
            <div className="flex flex-wrap gap-2">
              {todayMaterials.map(m => (
                <Badge key={m.material_type} variant="outline" className="text-[10px] font-mono">
                  {m.material_type}: {m.total_used.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
