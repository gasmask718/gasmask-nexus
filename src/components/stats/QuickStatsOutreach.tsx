// ═══════════════════════════════════════════════════════════════════════════════
// QUICK STATS OUTREACH — Summary cards for outreach and escalation stats
// ═══════════════════════════════════════════════════════════════════════════════

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  MessageSquare, 
  Phone, 
  Route, 
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp
} from 'lucide-react';
import { useOutreachQueueStats } from '@/hooks/useOutreachPlans';
import { useEscalationStats } from '@/hooks/useStoreEscalations';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface QuickStatsOutreachProps {
  className?: string;
}

export function QuickStatsOutreach({ className }: QuickStatsOutreachProps) {
  const navigate = useNavigate();
  const { data: queueStats, isLoading: loadingQueue } = useOutreachQueueStats();
  const { data: escalationStats, isLoading: loadingEscalations } = useEscalationStats();

  const isLoading = loadingQueue || loadingEscalations;

  if (isLoading) {
    return (
      <Card className={cn("glass-card border-border/50", className)}>
        <CardHeader>
          <CardTitle className="text-base">Outreach Intelligence</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-16 bg-muted rounded" />
            <div className="h-16 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const stats = [
    {
      label: 'Drafts Pending Approval',
      value: queueStats?.draft || 0,
      icon: Clock,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
      onClick: () => navigate('/communication/outreach'),
    },
    {
      label: 'Active Outreach Plans',
      value: (queueStats?.approved || 0) + (queueStats?.running || 0),
      icon: MessageSquare,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      onClick: () => navigate('/communication/outreach'),
    },
    {
      label: 'Stores Needing Visit',
      value: (escalationStats?.pending || 0) + (escalationStats?.assigned || 0),
      icon: Route,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
      onClick: () => navigate('/communication/outreach'),
    },
    {
      label: 'High Priority Escalations',
      value: escalationStats?.highPriority || 0,
      icon: AlertTriangle,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
      onClick: () => navigate('/communication/outreach'),
    },
  ];

  return (
    <Card className={cn("glass-card border-border/50", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Outreach Intelligence
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/communication/outreach')}
          >
            View All
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {stats.map((stat) => (
            <button
              key={stat.label}
              onClick={stat.onClick}
              className={cn(
                "p-3 rounded-lg text-left transition-colors hover:opacity-80",
                stat.bgColor
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <stat.icon className={cn("h-4 w-4", stat.color)} />
                <span className={cn("text-2xl font-bold", stat.color)}>
                  {stat.value}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </button>
          ))}
        </div>

        {/* Summary by reason */}
        {escalationStats?.byReason && Object.keys(escalationStats.byReason).length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs text-muted-foreground mb-2">Escalation Reasons</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(escalationStats.byReason).map(([reason, count]) => (
                <Badge key={reason} variant="outline" className="text-xs">
                  {reason}: {count}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
