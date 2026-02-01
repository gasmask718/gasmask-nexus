/**
 * WORKER PROFILE CARD
 * 
 * Detailed skill breakdown for individual workers showing:
 * - Task-level metrics with office comparison
 * - Consistency Index
 * - Learning Curve Indicator
 * - Predictability Score
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  User, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Zap,
  Shield,
  Clock,
  Target,
  BarChart3,
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Gauge,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { WorkerSkillProfile, CycleBenchmark } from '@/hooks/useWorkerPerformance';

const TREND_ICONS = {
  improving: <TrendingUp className="h-3 w-3 text-emerald-500" />,
  stable: <Minus className="h-3 w-3 text-muted-foreground" />,
  declining: <TrendingDown className="h-3 w-3 text-red-500" />,
};

const TREND_LABELS = {
  improving: 'Improving',
  stable: 'Stable',
  declining: 'Declining',
};

interface WorkerProfileCardProps {
  profile: WorkerSkillProfile;
  workerName: string;
  workerRole?: string;
  officeBenchmarks?: {
    avgTubeFillSeconds: number;
    avgStickerApplySeconds: number;
    avgBoxesPerHour: number;
    avgDefectRate: number;
  };
  benchmark?: CycleBenchmark;
  onViewDetails?: () => void;
}

// Helper functions
function getConsistencyLabel(variance: number): { label: string; color: string } {
  if (variance <= 0.15) return { label: 'Very Consistent', color: 'text-emerald-600' };
  if (variance <= 0.30) return { label: 'Moderately Consistent', color: 'text-amber-600' };
  return { label: 'Inconsistent', color: 'text-red-600' };
}

function getPredictabilityLabel(score: number): { label: string; color: string; badge: string } {
  if (score >= 75) return { label: 'Highly Predictable', color: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700' };
  if (score >= 50) return { label: 'Moderately Predictable', color: 'text-amber-600', badge: 'bg-amber-100 text-amber-700' };
  return { label: 'Unpredictable', color: 'text-red-600', badge: 'bg-red-100 text-red-700' };
}

function getComparisonColor(workerValue: number, officeValue: number, lowerIsBetter: boolean = false): string {
  if (officeValue === 0) return 'text-muted-foreground';
  const ratio = workerValue / officeValue;
  
  if (lowerIsBetter) {
    if (ratio <= 0.85) return 'text-emerald-600'; // 15% better
    if (ratio >= 1.15) return 'text-red-600'; // 15% worse
    return 'text-amber-600';
  } else {
    if (ratio >= 1.15) return 'text-emerald-600'; // 15% better
    if (ratio <= 0.85) return 'text-red-600'; // 15% worse
    return 'text-amber-600';
  }
}

function getDelta(workerValue: number, officeValue: number): string {
  if (officeValue === 0) return '—';
  const delta = ((workerValue - officeValue) / officeValue) * 100;
  if (Math.abs(delta) < 1) return '=';
  return delta > 0 ? `+${delta.toFixed(0)}%` : `${delta.toFixed(0)}%`;
}

export function WorkerProfileCard({ 
  profile, 
  workerName, 
  workerRole,
  officeBenchmarks,
  benchmark,
  onViewDetails 
}: WorkerProfileCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Calculate derived metrics (UI-only, not recalculating backend logic)
  const consistencyVariance = profile.rolling_7_day_boxes > 0 
    ? Math.abs((profile.rolling_7_day_defects || 0) / profile.rolling_7_day_boxes) 
    : 0.25;
  const consistency = getConsistencyLabel(consistencyVariance);
  
  // Predictability Score: combination of reliability, consistency, and trend stability
  const predictabilityScore = Math.round(
    (profile.reliability_score * 0.4) +
    ((1 - Math.min(consistencyVariance, 1)) * 100 * 0.3) +
    ((profile.trend_speed === 'stable' ? 75 : profile.trend_speed === 'improving' ? 100 : 50) * 0.15) +
    ((profile.trend_quality === 'stable' ? 75 : profile.trend_quality === 'improving' ? 100 : 50) * 0.15)
  );
  const predictability = getPredictabilityLabel(predictabilityScore);

  // Learning curve: derive from trends
  const learningCurve = profile.trend_speed === 'improving' || profile.trend_quality === 'improving'
    ? 'Improving'
    : profile.trend_speed === 'declining' || profile.trend_quality === 'declining'
    ? 'Declining'
    : 'Stable';

  // Default office benchmarks if not provided
  const officeAvg = officeBenchmarks || {
    avgTubeFillSeconds: benchmark?.expected_tube_fill_seconds || 8,
    avgStickerApplySeconds: benchmark?.expected_sticker_apply_seconds || 5,
    avgBoxesPerHour: benchmark?.expected_boxes_per_hour || 10,
    avgDefectRate: 5,
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm font-medium">{workerName}</CardTitle>
              <div className="flex items-center gap-2 mt-0.5">
                {workerRole && (
                  <Badge variant="outline" className="text-xs capitalize">
                    {workerRole}
                  </Badge>
                )}
                <Badge className={cn("text-xs", predictability.badge)}>
                  <Gauge className="h-3 w-3 mr-1" />
                  {predictability.label}
                </Badge>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold text-foreground">
              {profile.overall_score || 50}
            </p>
            <p className="text-xs text-muted-foreground">Overall</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Core Scores with Trends */}
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center p-2 rounded-md bg-muted/50">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Zap className="h-3 w-3 text-amber-500" />
              <span className="text-xs font-medium">Speed</span>
              {TREND_ICONS[profile.trend_speed || 'stable']}
            </div>
            <Progress value={profile.speed_score || 50} className="h-1.5 mb-1" />
            <span className="text-sm font-semibold">{profile.speed_score || 50}</span>
          </div>
          <div className="text-center p-2 rounded-md bg-muted/50">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Shield className="h-3 w-3 text-blue-500" />
              <span className="text-xs font-medium">Quality</span>
              {TREND_ICONS[profile.trend_quality || 'stable']}
            </div>
            <Progress value={profile.quality_score || 50} className="h-1.5 mb-1" />
            <span className="text-sm font-semibold">{profile.quality_score || 50}</span>
          </div>
          <div className="text-center p-2 rounded-md bg-muted/50">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Clock className="h-3 w-3 text-purple-500" />
              <span className="text-xs font-medium">Reliable</span>
            </div>
            <Progress value={profile.reliability_score || 50} className="h-1.5 mb-1" />
            <span className="text-sm font-semibold">{profile.reliability_score || 50}</span>
          </div>
        </div>

        <Separator />

        {/* Task-Level Metrics vs Office Average */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase">Task Performance vs Office</p>
          
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between items-center p-1.5 rounded bg-muted/30">
              <span>Tube Fill</span>
              <div className="flex items-center gap-1">
                <span className={getComparisonColor(profile.avg_tube_fill_seconds || 0, officeAvg.avgTubeFillSeconds, true)}>
                  {profile.avg_tube_fill_seconds?.toFixed(1) || '—'}s
                </span>
                <span className="text-muted-foreground text-[10px]">
                  ({getDelta(profile.avg_tube_fill_seconds || 0, officeAvg.avgTubeFillSeconds)})
                </span>
              </div>
            </div>
            <div className="flex justify-between items-center p-1.5 rounded bg-muted/30">
              <span>Sticker Apply</span>
              <div className="flex items-center gap-1">
                <span className={getComparisonColor(profile.avg_sticker_apply_seconds || 0, officeAvg.avgStickerApplySeconds, true)}>
                  {profile.avg_sticker_apply_seconds?.toFixed(1) || '—'}s
                </span>
                <span className="text-muted-foreground text-[10px]">
                  ({getDelta(profile.avg_sticker_apply_seconds || 0, officeAvg.avgStickerApplySeconds)})
                </span>
              </div>
            </div>
            <div className="flex justify-between items-center p-1.5 rounded bg-muted/30">
              <span>Boxes/Hour</span>
              <div className="flex items-center gap-1">
                <span className={getComparisonColor(profile.boxes_per_hour || 0, officeAvg.avgBoxesPerHour)}>
                  {profile.boxes_per_hour?.toFixed(1) || '—'}
                </span>
                <span className="text-muted-foreground text-[10px]">
                  ({getDelta(profile.boxes_per_hour || 0, officeAvg.avgBoxesPerHour)})
                </span>
              </div>
            </div>
            <div className="flex justify-between items-center p-1.5 rounded bg-muted/30">
              <span>Defects/1k</span>
              <div className="flex items-center gap-1">
                <span className={getComparisonColor(profile.defect_rate_per_thousand || 0, officeAvg.avgDefectRate, true)}>
                  {profile.defect_rate_per_thousand?.toFixed(1) || '—'}
                </span>
                <span className="text-muted-foreground text-[10px]">
                  ({getDelta(profile.defect_rate_per_thousand || 0, officeAvg.avgDefectRate)})
                </span>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Consistency & Learning Curve */}
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Consistency</p>
            <div className="flex items-center justify-center gap-1">
              <Activity className="h-3 w-3" />
              <span className={cn("text-sm font-medium", consistency.color)}>
                {consistency.label}
              </span>
            </div>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Learning Curve</p>
            <div className="flex items-center justify-center gap-1">
              {learningCurve === 'Improving' && <TrendingUp className="h-3 w-3 text-emerald-500" />}
              {learningCurve === 'Stable' && <Minus className="h-3 w-3 text-muted-foreground" />}
              {learningCurve === 'Declining' && <TrendingDown className="h-3 w-3 text-red-500" />}
              <span className={cn(
                "text-sm font-medium",
                learningCurve === 'Improving' && 'text-emerald-600',
                learningCurve === 'Declining' && 'text-red-600',
                learningCurve === 'Stable' && 'text-muted-foreground'
              )}>
                {learningCurve}
              </span>
            </div>
          </div>
        </div>

        {/* View Details Button */}
        {onViewDetails && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full mt-2"
            onClick={onViewDetails}
          >
            View Full Profile
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}

        {/* Last Updated */}
        {profile.last_calculated_at && (
          <p className="text-[10px] text-muted-foreground text-center pt-1 border-t flex items-center justify-center gap-1">
            <Calendar className="h-3 w-3" />
            Updated: {new Date(profile.last_calculated_at).toLocaleDateString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
