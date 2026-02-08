/**
 * Momentum Panel — Execution health & motivation signals
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Flame,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap,
} from 'lucide-react';

interface MomentumPanelProps {
  completedThisWeek: number;
  totalActive: number;
  totalOverdue: number;
  completionRate: number;
  totalDeferred: number;
}

export function MomentumPanel({
  completedThisWeek,
  totalActive,
  totalOverdue,
  completionRate,
  totalDeferred,
}: MomentumPanelProps) {
  // Momentum state
  const getMomentumState = () => {
    if (totalOverdue > 3) return { label: 'At Risk', color: 'text-destructive', icon: AlertTriangle, bg: 'bg-destructive/10' };
    if (totalOverdue > 0) return { label: 'Slipping', color: 'text-orange-400', icon: Clock, bg: 'bg-orange-500/10' };
    if (completedThisWeek >= 5) return { label: 'On Fire', color: 'text-green-400', icon: Flame, bg: 'bg-green-500/10' };
    if (completedThisWeek >= 2) return { label: 'Momentum', color: 'text-blue-400', icon: TrendingUp, bg: 'bg-blue-500/10' };
    return { label: 'Warming Up', color: 'text-muted-foreground', icon: Zap, bg: 'bg-muted' };
  };

  const momentum = getMomentumState();
  const MomentumIcon = momentum.icon;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {/* Momentum State */}
      <Card className={momentum.bg}>
        <CardContent className="p-4 flex flex-col items-center justify-center text-center">
          <MomentumIcon className={`h-6 w-6 mb-1 ${momentum.color}`} />
          <span className={`text-sm font-bold ${momentum.color}`}>{momentum.label}</span>
          <span className="text-[10px] text-muted-foreground">Execution State</span>
        </CardContent>
      </Card>

      {/* Completed This Week */}
      <Card>
        <CardContent className="p-4 flex flex-col items-center justify-center text-center">
          <CheckCircle className="h-6 w-6 mb-1 text-green-400" />
          <span className="text-xl font-bold">{completedThisWeek}</span>
          <span className="text-[10px] text-muted-foreground">Done This Week</span>
        </CardContent>
      </Card>

      {/* Active Missions */}
      <Card>
        <CardContent className="p-4 flex flex-col items-center justify-center text-center">
          <Zap className="h-6 w-6 mb-1 text-blue-400" />
          <span className="text-xl font-bold">{totalActive}</span>
          <span className="text-[10px] text-muted-foreground">Active</span>
        </CardContent>
      </Card>

      {/* Overdue */}
      <Card className={totalOverdue > 0 ? 'border-destructive/30' : ''}>
        <CardContent className="p-4 flex flex-col items-center justify-center text-center">
          <AlertTriangle className={`h-6 w-6 mb-1 ${totalOverdue > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
          <span className={`text-xl font-bold ${totalOverdue > 0 ? 'text-destructive' : ''}`}>{totalOverdue}</span>
          <span className="text-[10px] text-muted-foreground">Overdue</span>
        </CardContent>
      </Card>

      {/* Completion Rate */}
      <Card>
        <CardContent className="p-4 flex flex-col items-center justify-center text-center">
          <div className="w-full mb-1">
            <Progress value={completionRate} className="h-2" />
          </div>
          <span className="text-xl font-bold">{completionRate}%</span>
          <span className="text-[10px] text-muted-foreground">Lifetime Rate</span>
        </CardContent>
      </Card>
    </div>
  );
}
