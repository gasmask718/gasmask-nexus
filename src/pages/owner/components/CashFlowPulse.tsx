import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { DollarSign, TrendingUp, TrendingDown, Wallet, CreditCard, Clock, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CashMetric {
  label: string;
  value: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  badge?: string;
  badgeColor?: string;
}

const cashMetrics: CashMetric[] = [
  { label: 'Available Cash', value: '$186,200', badge: 'Banks', badgeColor: 'emerald' },
  { label: 'Credit Lines', value: '$420,000', badge: 'Revolving', badgeColor: 'blue' },
  { label: 'Pending Payouts', value: '$24,850', badge: 'Due', badgeColor: 'amber' },
  { label: 'Accounts Receivable', value: '$67,900', badge: 'Net 30/45', badgeColor: 'purple' },
];

const todayFlow = [
  { type: 'in', label: 'Store payments received', amount: '+$4,280', time: '2h ago' },
  { type: 'in', label: 'Wholesale order paid', amount: '+$2,150', time: '4h ago' },
  { type: 'out', label: 'Driver payouts', amount: '-$1,200', time: '5h ago' },
  { type: 'in', label: 'TopTier booking deposit', amount: '+$850', time: '6h ago' },
];

export function CashFlowPulse() {
  const badgeColors = {
    emerald: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10',
    blue: 'border-blue-500/40 text-blue-400 bg-blue-500/10',
    amber: 'border-amber-500/40 text-amber-400 bg-amber-500/10',
    purple: 'border-purple-500/40 text-purple-400 bg-purple-500/10',
  };

  return (
    <Card className="rounded-xl shadow-lg border-border/50 h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <DollarSign className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <CardTitle className="text-base">Cash & Liquidity</CardTitle>
              <CardDescription className="text-xs">Real-time financial position</CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 text-[10px]">
            Live
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Cash Position Grid */}
        <div className="grid grid-cols-2 gap-3">
          {cashMetrics.map((metric, idx) => (
            <div key={idx} className="p-3 rounded-lg bg-muted/30 border border-border/50">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{metric.label}</p>
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold">{metric.value}</span>
                <Badge 
                  variant="outline" 
                  className={cn("text-[9px] px-1.5", badgeColors[metric.badgeColor as keyof typeof badgeColors])}
                >
                  {metric.badge}
                </Badge>
              </div>
            </div>
          ))}
        </div>

        <Separator className="my-3" />

        {/* Today's Flow */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Today's Cash Flow
          </p>
          <div className="space-y-2">
            {todayFlow.map((flow, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  {flow.type === 'in' ? (
                    <ArrowUpRight className="h-3 w-3 text-emerald-400" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 text-red-400" />
                  )}
                  <span className="text-muted-foreground">{flow.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "font-medium",
                    flow.type === 'in' ? 'text-emerald-400' : 'text-red-400'
                  )}>
                    {flow.amount}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{flow.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Net Today */}
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <div className="flex items-center justify-between">
            <span className="text-xs text-emerald-300">Net Cash Flow Today</span>
            <span className="text-lg font-bold text-emerald-400">+$6,080</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default CashFlowPulse;
