import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, TrendingDown, AlertTriangle, Zap, 
  Target, Users, Activity, Clock
} from 'lucide-react';

interface PerformanceSignal {
  type: 'positive' | 'warning' | 'critical' | 'info';
  title: string;
  description: string;
  metric?: string;
  action?: string;
  icon: React.ElementType;
}

interface AmbassadorPerformanceSignalsProps {
  ambassadorId: string;
  metrics: {
    totalStores: number;
    activeStores: number;
    dormantStores: number;
    totalRevenue: number;
    revenueChange?: number;
    avgOrderValue: number;
    pendingCommission: number;
    recentOrdersCount: number;
  };
}

export const AmbassadorPerformanceSignals: React.FC<AmbassadorPerformanceSignalsProps> = ({
  ambassadorId,
  metrics
}) => {
  // Generate AI signals based on metrics
  const generateSignals = (): PerformanceSignal[] => {
    const signals: PerformanceSignal[] = [];

    // Strong acquisition momentum
    if (metrics.totalStores >= 5 && metrics.activeStores >= 3) {
      signals.push({
        type: 'positive',
        title: 'Strong Store Portfolio',
        description: `Managing ${metrics.activeStores} active stores out of ${metrics.totalStores} total. Good acquisition track record.`,
        metric: `${Math.round((metrics.activeStores / metrics.totalStores) * 100)}% active rate`,
        icon: TrendingUp
      });
    }

    // High churn rate warning
    if (metrics.totalStores > 0 && metrics.dormantStores / metrics.totalStores > 0.4) {
      signals.push({
        type: 'warning',
        title: 'High Store Dormancy',
        description: `${metrics.dormantStores} of ${metrics.totalStores} stores are dormant. Consider re-engagement outreach.`,
        action: 'Schedule check-ins with dormant stores',
        icon: AlertTriangle
      });
    }

    // Low activity warning
    if (metrics.recentOrdersCount < 2 && metrics.totalStores > 0) {
      signals.push({
        type: 'warning',
        title: 'Low Recent Activity',
        description: 'Few orders in the past 30 days. May indicate reduced engagement.',
        action: 'Follow up with ambassador on territory status',
        icon: Clock
      });
    }

    // Revenue positive signal
    if (metrics.totalRevenue > 1000) {
      signals.push({
        type: 'positive',
        title: 'Revenue Contributor',
        description: `Generated $${metrics.totalRevenue.toLocaleString()} in total sales through referrals.`,
        metric: `Avg order: $${metrics.avgOrderValue.toFixed(0)}`,
        icon: Zap
      });
    }

    // Pending commission alert
    if (metrics.pendingCommission > 100) {
      signals.push({
        type: 'info',
        title: 'Commission Pending',
        description: `$${metrics.pendingCommission.toFixed(2)} in commissions awaiting payout.`,
        action: 'Review for payout eligibility',
        icon: Target
      });
    }

    // New ambassador / needs support
    if (metrics.totalStores === 0) {
      signals.push({
        type: 'info',
        title: 'No Stores Acquired Yet',
        description: 'This ambassador has not acquired any stores. May need onboarding support.',
        action: 'Assign territory and provide training',
        icon: Users
      });
    }

    // Growth momentum
    if (metrics.revenueChange && metrics.revenueChange > 20) {
      signals.push({
        type: 'positive',
        title: 'Strong Growth Momentum',
        description: `Revenue up ${metrics.revenueChange}% compared to previous period.`,
        icon: Activity
      });
    }

    // Declining signal
    if (metrics.revenueChange && metrics.revenueChange < -20) {
      signals.push({
        type: 'critical',
        title: 'Declining Performance',
        description: `Revenue down ${Math.abs(metrics.revenueChange)}% from previous period.`,
        action: 'Investigate causes and provide support',
        icon: TrendingDown
      });
    }

    return signals;
  };

  const signals = generateSignals();

  const getSignalStyles = (type: PerformanceSignal['type']) => {
    switch (type) {
      case 'positive':
        return 'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400';
      case 'warning':
        return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-400';
      case 'critical':
        return 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400';
      case 'info':
        return 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-400';
    }
  };

  const getBadgeVariant = (type: PerformanceSignal['type']) => {
    switch (type) {
      case 'positive': return 'default';
      case 'warning': return 'secondary';
      case 'critical': return 'destructive';
      case 'info': return 'outline';
    }
  };

  if (signals.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            AI Performance Signals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">
            No significant signals detected. Performance is stable.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          AI Performance Signals
          <Badge variant="secondary" className="ml-auto">{signals.length} signals</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {signals.map((signal, index) => {
          const Icon = signal.icon;
          return (
            <div 
              key={index} 
              className={`p-4 rounded-lg border ${getSignalStyles(signal.type)}`}
            >
              <div className="flex items-start gap-3">
                <Icon className="h-5 w-5 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium">{signal.title}</h4>
                    {signal.metric && (
                      <Badge variant={getBadgeVariant(signal.type)} className="text-xs">
                        {signal.metric}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm opacity-90">{signal.description}</p>
                  {signal.action && (
                    <p className="text-sm mt-2 font-medium opacity-75">
                      → {signal.action}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
