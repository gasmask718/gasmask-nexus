/**
 * SUPERVISOR SCORECARD PANEL
 * Display-only rolling 30-day performance scorecard.
 * Goal + Efficiency weighted. No incentives.
 */

import { useSupervisorScorecards, useSupervisorSnapshots, type SupervisorScorecard as ScorecardType, type SupervisorTier } from '@/hooks/useSupervisorPerformance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Target, TrendingUp, TrendingDown, Minus, RotateCcw, Leaf, Users, Award, Info, Shield, Rocket } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  officeId: string;
}

function getScoreColor(score: number): string {
  if (score >= 95) return 'text-emerald-600';
  if (score >= 85) return 'text-amber-600';
  return 'text-red-600';
}

function getScoreBadge(score: number): { label: string; className: string } {
  if (score >= 95) return { label: 'Strong', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
  if (score >= 85) return { label: 'Steady', className: 'bg-amber-100 text-amber-800 border-amber-200' };
  return { label: 'Needs Focus', className: 'bg-red-100 text-red-800 border-red-200' };
}

function getTierBadge(tier: SupervisorTier): { className: string } {
  switch (tier) {
    case 'Elite': return { className: 'bg-violet-100 text-violet-800 border-violet-200' };
    case 'Strong': return { className: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
    case 'Developing': return { className: 'bg-amber-100 text-amber-800 border-amber-200' };
    case 'Needs Support': return { className: 'bg-red-100 text-red-800 border-red-200' };
  }
}

function TrendArrow({ current, previous }: { current: number; previous?: number }) {
  if (previous === undefined) return <Minus className="h-3 w-3 text-muted-foreground" />;
  const diff = current - previous;
  if (diff > 2) return <TrendingUp className="h-3 w-3 text-emerald-600" />;
  if (diff < -2) return <TrendingDown className="h-3 w-3 text-red-600" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
}

function MiniKPI({ label, value, suffix = '%', icon }: { label: string; value: number; suffix?: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
      <div className="text-muted-foreground">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn('text-sm font-semibold', getScoreColor(value))}>
          {value.toFixed(1)}{suffix}
        </p>
      </div>
    </div>
  );
}

function ScorecardCard({ scorecard, previousIndex }: { scorecard: ScorecardType; previousIndex?: number }) {
  const badge = getScoreBadge(scorecard.composite_index);
  const tierBadge = getTierBadge(scorecard.tier);
  
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-sm text-muted-foreground">
              {scorecard.supervisor_name || scorecard.supervisor_user_id?.slice(0, 8) || 'Supervisor'}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className={cn('text-3xl font-bold', getScoreColor(scorecard.composite_index))}>
                {scorecard.composite_index}
              </span>
              <TrendArrow current={scorecard.composite_index} previous={previousIndex} />
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge className={cn('text-xs', badge.className)}>{badge.label}</Badge>
            <Badge variant="outline" className={cn('text-xs', tierBadge.className)}>
              <Shield className="h-3 w-3 mr-1" />
              {scorecard.tier}
            </Badge>
          </div>
        </div>

        {/* Stability + Expansion */}
        <div className="flex items-center gap-2 mb-3">
          {scorecard.stability_score !== null && (
            <span className="text-xs text-muted-foreground">
              Stability σ: <span className={cn('font-medium', scorecard.stability_score <= 5 ? 'text-emerald-600' : 'text-amber-600')}>{scorecard.stability_score}</span>
            </span>
          )}
          {scorecard.expansion_ready && (
            <Badge className="bg-violet-100 text-violet-800 border-violet-200 text-xs">
              <Rocket className="h-3 w-3 mr-1" />Expansion Ready
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <MiniKPI 
            label="Goal Hit" 
            value={scorecard.goal_completion_rate || 0} 
            icon={<Target className="h-3.5 w-3.5" />} 
          />
          <MiniKPI 
            label="Boxes/Worker" 
            value={scorecard.avg_boxes_per_worker || 0} 
            suffix="" 
            icon={<Users className="h-3.5 w-3.5" />} 
          />
          <MiniKPI 
            label="Reopen Rate" 
            value={scorecard.reopen_rate || 0} 
            icon={<RotateCcw className="h-3.5 w-3.5" />} 
          />
          <MiniKPI 
            label="Material Δ" 
            value={((scorecard.material_efficiency_delta || 0) * 100)} 
            icon={<Leaf className="h-3.5 w-3.5" />} 
          />
        </div>

        {/* Score breakdown */}
        <div className="mt-3 pt-3 border-t flex items-center gap-1 text-xs text-muted-foreground">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 cursor-help">
                  <Info className="h-3 w-3" />
                  <span>Score Weights: Goal 40% · Efficiency 40% · Reopen 10% · Material 10%</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs space-y-1">
                  <p>Goal Score: {scorecard.goal_score.toFixed(0)}</p>
                  <p>Efficiency Score: {scorecard.efficiency_score.toFixed(0)}</p>
                  <p>Reopen Score: {scorecard.reopen_score.toFixed(0)}</p>
                  <p>Material Score: {scorecard.material_score.toFixed(0)}</p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  );
}

export function SupervisorScorecard({ officeId }: Props) {
  const { data: scorecards = [], isLoading } = useSupervisorScorecards(officeId);
  const { data: snapshots = [] } = useSupervisorSnapshots(officeId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Award className="h-5 w-5" /> Supervisor Scorecard</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">Loading performance data...</p></CardContent>
      </Card>
    );
  }

  if (!scorecards.length) {
    return (
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Award className="h-5 w-5" /> Supervisor Scorecard</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No production data in the last 30 days. Scorecards will populate as daily summaries are recorded.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Award className="h-5 w-5" />
              Supervisor Performance — Rolling 30 Day
            </CardTitle>
            <Badge variant="outline" className="text-xs">Display Only · v1</Badge>
          </div>
        </CardHeader>
      </Card>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {scorecards.map((sc, i) => {
          const prevSnapshot = snapshots.find(
            s => s.supervisor_user_id === sc.supervisor_user_id && s.office_id === sc.office_id
          );
          return (
            <ScorecardCard 
              key={`${sc.office_id}-${sc.supervisor_user_id}-${i}`}
              scorecard={sc}
              previousIndex={prevSnapshot?.composite_index}
            />
          );
        })}
      </div>
    </div>
  );
}
