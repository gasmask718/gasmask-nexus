import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Award, TrendingUp, Clock, AlertTriangle, XCircle } from 'lucide-react';
import { PerformanceMetrics } from '@/services/wholesaler/useWholesalerAnalytics';

interface Props {
  metrics: PerformanceMetrics | null;
}

const tierConfig: Record<string, { color: string; bg: string; border: string; icon: string }> = {
  Standard: { color: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/30', icon: '🔵' },
  Silver: { color: 'text-slate-300', bg: 'bg-slate-400/10', border: 'border-slate-400/30', icon: '🥈' },
  Gold: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', icon: '🥇' },
  Platinum: { color: 'text-cyan-300', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', icon: '💎' },
};

export function PerformanceScorecard({ metrics }: Props) {
  if (!metrics) return null;

  const tier = tierConfig[metrics.tier] || tierConfig.Standard;

  const scores = [
    { label: 'Avg Fulfillment', value: `${metrics.avgFulfillmentHours.toFixed(0)}h`, icon: Clock, good: metrics.avgFulfillmentHours < 24 },
    { label: 'On-Time Rate', value: `${metrics.onTimePercent.toFixed(1)}%`, icon: TrendingUp, good: metrics.onTimePercent >= 95 },
    { label: 'Dispute Rate', value: `${metrics.disputePercent.toFixed(1)}%`, icon: AlertTriangle, good: metrics.disputePercent < 5 },
    { label: 'Refund Rate', value: `${metrics.refundPercent.toFixed(1)}%`, icon: XCircle, good: metrics.refundPercent < 3 },
  ];

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Award className="h-4 w-4 text-amber-400" />
            Performance
          </CardTitle>
          <Badge className={`${tier.bg} ${tier.color} ${tier.border} text-xs px-2`}>
            {tier.icon} {metrics.tier}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {scores.map((s, i) => (
            <div key={i} className={`p-2.5 rounded-lg border ${s.good ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <s.icon className={`h-3 w-3 ${s.good ? 'text-emerald-400' : 'text-red-400'}`} />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</span>
              </div>
              <p className={`text-lg font-bold ${s.good ? 'text-emerald-400' : 'text-red-400'}`}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className={`p-2.5 rounded-lg ${tier.bg} border ${tier.border}`}>
          <p className={`text-xs ${tier.color}`}>{metrics.tierProgress}</p>
        </div>
      </CardContent>
    </Card>
  );
}
