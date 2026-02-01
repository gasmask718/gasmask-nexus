/**
 * WORKER PROFILE DIALOG
 * 
 * Full profile view with:
 * - Detailed skill breakdown
 * - Task time model
 * - Performance history chart
 * - Worker setup/edit panel
 * - Communication history tab
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  User,
  TrendingUp,
  TrendingDown,
  Minus,
  Zap,
  Shield,
  Clock,
  Target,
  Activity,
  Gauge,
  BarChart3,
  Calendar,
  Settings,
  Package,
  Timer,
  Award,
  AlertTriangle,
  MessageSquare,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { WorkerSkillProfile, CycleBenchmark, useWorkerPerformanceHistory } from '@/hooks/useWorkerPerformance';
import { useUpdateWorker, ProductionWorker } from '@/hooks/useProductionPortal';
import { WorkerCommunicationTab } from './WorkerCommunicationTab';

interface WorkerProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: WorkerSkillProfile | null;
  worker: ProductionWorker | null;
  benchmark?: CycleBenchmark;
  officeBenchmarks?: {
    avgTubeFillSeconds: number;
    avgStickerApplySeconds: number;
    avgBoxesPerHour: number;
    avgDefectRate: number;
  };
  officeId?: string;
}

const TREND_CONFIG = {
  improving: { icon: <TrendingUp className="h-4 w-4 text-emerald-500" />, label: 'Improving', color: 'text-emerald-600' },
  stable: { icon: <Minus className="h-4 w-4 text-muted-foreground" />, label: 'Stable', color: 'text-muted-foreground' },
  declining: { icon: <TrendingDown className="h-4 w-4 text-red-500" />, label: 'Declining', color: 'text-red-600' },
};

const SKILL_LEVELS = ['trainee', 'standard', 'advanced'] as const;
const PRIMARY_ROLES = ['filler', 'sticker', 'packer', 'qc', 'supervisor', 'machine_operator'] as const;

export function WorkerProfileDialog({
  open,
  onOpenChange,
  profile,
  worker,
  benchmark,
  officeBenchmarks,
  officeId,
}: WorkerProfileDialogProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const { data: historyData = [] } = useWorkerPerformanceHistory(worker?.id, 30);
  const updateWorker = useUpdateWorker();

  // Worker setup form state
  const [skillLevel, setSkillLevel] = useState<string>('standard');
  const [primaryRole, setPrimaryRole] = useState<string>(worker?.role || 'packer');
  const [secondaryRole, setSecondaryRole] = useState<string>('');
  const [maxPace, setMaxPace] = useState<string>('');
  const [limitations, setLimitations] = useState<string>('');

  if (!profile || !worker) {
    return null;
  }

  // Calculate derived metrics
  const consistencyVariance = profile.rolling_7_day_boxes > 0 
    ? Math.abs((profile.rolling_7_day_defects || 0) / profile.rolling_7_day_boxes) 
    : 0.25;
  
  const consistencyScore = Math.round((1 - Math.min(consistencyVariance, 1)) * 100);
  
  const predictabilityScore = Math.round(
    (profile.reliability_score * 0.4) +
    (consistencyScore * 0.3) +
    ((profile.trend_speed === 'stable' ? 75 : profile.trend_speed === 'improving' ? 100 : 50) * 0.15) +
    ((profile.trend_quality === 'stable' ? 75 : profile.trend_quality === 'improving' ? 100 : 50) * 0.15)
  );

  const officeAvg = officeBenchmarks || {
    avgTubeFillSeconds: benchmark?.expected_tube_fill_seconds || 8,
    avgStickerApplySeconds: benchmark?.expected_sticker_apply_seconds || 5,
    avgBoxesPerHour: benchmark?.expected_boxes_per_hour || 10,
    avgDefectRate: 5,
  };

  const getDelta = (workerValue: number, officeValue: number): { delta: number; color: string } => {
    if (officeValue === 0) return { delta: 0, color: 'text-muted-foreground' };
    const delta = ((workerValue - officeValue) / officeValue) * 100;
    const color = delta > 10 ? 'text-emerald-600' : delta < -10 ? 'text-red-600' : 'text-amber-600';
    return { delta, color };
  };

  // Task time estimates
  const avgBoxTime = (profile.avg_tube_fill_seconds || 0) + (profile.avg_sticker_apply_seconds || 0) + 10; // 10s assembly estimate
  const expectedBoxesPerHour = avgBoxTime > 0 ? Math.round(3600 / avgBoxTime) : 0;

  const handleSaveSetup = async () => {
    if (!worker) return;
    
    // Note: In production, you'd add these fields to the worker table
    // For now, we'll just update the notes field with this metadata
    const setupMetadata = JSON.stringify({
      skillLevel,
      primaryRole,
      secondaryRole,
      maxPace,
      limitations,
    });
    
    await updateWorker.mutateAsync({
      id: worker.id,
      notes: `Setup: ${setupMetadata}`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <span className="text-xl">{worker.full_name}</span>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="capitalize text-xs">
                  {worker.role}
                </Badge>
                <Badge 
                  variant="secondary" 
                  className={cn(
                    "text-xs",
                    worker.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-muted'
                  )}
                >
                  {worker.status}
                </Badge>
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Data Governance Notice */}
        <div className="mt-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 flex items-center gap-2">
          <Info className="h-4 w-4" />
          Scores are rolling 7-day indicators, not disciplinary metrics.
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">
              <Target className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="tasks">
              <Timer className="h-4 w-4 mr-2" />
              Tasks
            </TabsTrigger>
            <TabsTrigger value="comms">
              <MessageSquare className="h-4 w-4 mr-2" />
              Comms
            </TabsTrigger>
            <TabsTrigger value="setup">
              <Settings className="h-4 w-4 mr-2" />
              Setup
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            {/* Overall Score */}
            <div className="text-center py-4 rounded-lg bg-gradient-to-r from-primary/5 to-primary/10">
              <p className="text-5xl font-bold text-primary">{profile.overall_score || 50}</p>
              <p className="text-sm text-muted-foreground mt-1">Overall Score</p>
            </div>

            {/* Core Scores Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Speed', score: profile.speed_score, icon: <Zap className="h-4 w-4 text-amber-500" />, trend: profile.trend_speed },
                { label: 'Quality', score: profile.quality_score, icon: <Shield className="h-4 w-4 text-blue-500" />, trend: profile.trend_quality },
                { label: 'Reliability', score: profile.reliability_score, icon: <Clock className="h-4 w-4 text-purple-500" />, trend: 'stable' as const },
                { label: 'Consistency', score: consistencyScore, icon: <Activity className="h-4 w-4 text-cyan-500" />, trend: 'stable' as const },
              ].map(item => (
                <Card key={item.label} className="p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-2">
                    {item.icon}
                    <span className="text-sm font-medium">{item.label}</span>
                    {TREND_CONFIG[item.trend]?.icon}
                  </div>
                  <Progress value={item.score || 50} className="h-2 mb-1" />
                  <p className="text-lg font-bold">{item.score || 50}</p>
                </Card>
              ))}
            </div>

            {/* Predictability */}
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gauge className="h-5 w-5 text-primary" />
                  <span className="font-medium">Predictability Score</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">{predictabilityScore}</span>
                  <Badge variant={predictabilityScore >= 70 ? 'default' : predictabilityScore >= 50 ? 'secondary' : 'destructive'}>
                    {predictabilityScore >= 70 ? 'Highly Predictable' : predictabilityScore >= 50 ? 'Moderate' : 'Unpredictable'}
                  </Badge>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Based on reliability, consistency, and trend stability. High predictability = accurate time estimates.
              </p>
            </Card>

            {/* Rolling Metrics */}
            <Card className="p-4">
              <CardTitle className="text-sm mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Rolling Metrics
              </CardTitle>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">7-Day Boxes</p>
                  <p className="text-lg font-bold">{profile.rolling_7_day_boxes}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">30-Day Boxes</p>
                  <p className="text-lg font-bold">{profile.rolling_30_day_boxes}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">90-Day Boxes</p>
                  <p className="text-lg font-bold">{profile.rolling_90_day_boxes}</p>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="tasks" className="space-y-4 mt-4">
            {/* Task Time Breakdown */}
            <Card className="p-4">
              <CardTitle className="text-sm mb-4 flex items-center gap-2">
                <Timer className="h-4 w-4" />
                Task Time Model
              </CardTitle>
              
              <div className="space-y-4">
                {/* Tube Fill */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="font-medium">Tube Fill</p>
                    <p className="text-xs text-muted-foreground">Time to fill a single tube</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold">
                      {profile.avg_tube_fill_seconds?.toFixed(1) || '—'}s
                    </p>
                    <p className={cn("text-xs", getDelta(profile.avg_tube_fill_seconds || 0, officeAvg.avgTubeFillSeconds).color)}>
                      vs {officeAvg.avgTubeFillSeconds}s office avg
                    </p>
                  </div>
                </div>

                {/* Sticker Apply */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="font-medium">Sticker Application</p>
                    <p className="text-xs text-muted-foreground">Time to apply sticker</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold">
                      {profile.avg_sticker_apply_seconds?.toFixed(1) || '—'}s
                    </p>
                    <p className={cn("text-xs", getDelta(profile.avg_sticker_apply_seconds || 0, officeAvg.avgStickerApplySeconds).color)}>
                      vs {officeAvg.avgStickerApplySeconds}s office avg
                    </p>
                  </div>
                </div>

                {/* Boxes per Hour */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="font-medium">Output Rate</p>
                    <p className="text-xs text-muted-foreground">Boxes completed per hour</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold">
                      {profile.boxes_per_hour?.toFixed(1) || '—'}
                    </p>
                    <p className={cn("text-xs", getDelta(profile.boxes_per_hour || 0, officeAvg.avgBoxesPerHour).color)}>
                      vs {officeAvg.avgBoxesPerHour} office avg
                    </p>
                  </div>
                </div>

                {/* Defect Rate */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="font-medium">Defect Rate</p>
                    <p className="text-xs text-muted-foreground">Defects per 1,000 units</p>
                  </div>
                  <div className="text-right">
                    <p className={cn(
                      "text-xl font-bold",
                      (profile.defect_rate_per_thousand || 0) > 10 && "text-red-600"
                    )}>
                      {profile.defect_rate_per_thousand?.toFixed(1) || '—'}‰
                    </p>
                    <p className={cn("text-xs", getDelta(profile.defect_rate_per_thousand || 0, officeAvg.avgDefectRate).color)}>
                      vs {officeAvg.avgDefectRate}‰ office avg
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Derived Estimates */}
            <Card className="p-4">
              <CardTitle className="text-sm mb-3 flex items-center gap-2">
                <Package className="h-4 w-4" />
                Derived Estimates
              </CardTitle>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 rounded-lg bg-primary/5">
                  <p className="text-xs text-muted-foreground mb-1">Avg Full Box Time</p>
                  <p className="text-2xl font-bold">{avgBoxTime.toFixed(0)}s</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-primary/5">
                  <p className="text-xs text-muted-foreground mb-1">Expected/Hour</p>
                  <p className="text-2xl font-bold">{expectedBoxesPerHour} boxes</p>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="comms" className="mt-4">
            {officeId ? (
              <WorkerCommunicationTab worker={worker} officeId={officeId} />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Communication history not available</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="setup" className="space-y-4 mt-4">
            <Card className="p-4">
              <CardTitle className="text-sm mb-4 flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Worker Setup
              </CardTitle>
              <p className="text-xs text-muted-foreground mb-4">
                This data contextualizes performance scores — it does not calculate them.
              </p>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Primary Role</Label>
                    <Select value={primaryRole} onValueChange={setPrimaryRole}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIMARY_ROLES.map(role => (
                          <SelectItem key={role} value={role} className="capitalize">
                            {role.replace('_', ' ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Secondary Role (optional)</Label>
                    <Select value={secondaryRole} onValueChange={setSecondaryRole}>
                      <SelectTrigger>
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {PRIMARY_ROLES.map(role => (
                          <SelectItem key={role} value={role} className="capitalize">
                            {role.replace('_', ' ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Skill Level</Label>
                    <Select value={skillLevel} onValueChange={setSkillLevel}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SKILL_LEVELS.map(level => (
                          <SelectItem key={level} value={level} className="capitalize">
                            {level}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Max Comfortable Pace (boxes/hr)</Label>
                    <Input
                      type="number"
                      value={maxPace}
                      onChange={(e) => setMaxPace(e.target.value)}
                      placeholder="e.g., 12"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Known Limitations (optional)</Label>
                  <Textarea
                    value={limitations}
                    onChange={(e) => setLimitations(e.target.value)}
                    placeholder="e.g., Prefers morning shifts, needs frequent breaks"
                    rows={3}
                  />
                </div>

                <Button 
                  onClick={handleSaveSetup}
                  disabled={updateWorker.isPending}
                  className="w-full"
                >
                  Save Setup
                </Button>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
