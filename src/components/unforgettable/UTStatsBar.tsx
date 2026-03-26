import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Users, Phone, Target, Zap, TrendingUp, CheckCircle } from 'lucide-react';

interface Props {
  stats: {
    total: number;
    byStatus: Record<string, number>;
    byCategory: Record<string, number>;
    avgScore: number;
  } | undefined;
}

export function UTStatsBar({ stats }: Props) {
  const cards = [
    { label: 'Total Leads', value: stats?.total || 0, icon: Users, color: 'text-blue-500' },
    { label: 'New', value: stats?.byStatus?.new || 0, icon: Zap, color: 'text-yellow-500' },
    { label: 'Contacted', value: stats?.byStatus?.contacted || 0, icon: Phone, color: 'text-orange-500' },
    { label: 'Interested', value: stats?.byStatus?.interested || 0, icon: Target, color: 'text-green-500' },
    { label: 'Onboarded', value: stats?.byStatus?.onboarded || 0, icon: CheckCircle, color: 'text-emerald-500' },
    { label: 'Avg AI Score', value: stats?.avgScore || 0, icon: TrendingUp, color: 'text-purple-500' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map(c => (
        <Card key={c.label} className="border-border/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <c.icon className={`h-4 w-4 ${c.color}`} />
              <span className="text-xs text-muted-foreground">{c.label}</span>
            </div>
            <p className="text-xl font-bold mt-1">{c.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
