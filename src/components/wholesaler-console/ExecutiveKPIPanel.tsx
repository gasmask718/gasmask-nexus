import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { TrendKPI } from '@/services/wholesaler/useWholesalerAnalytics';

interface Props {
  kpis: TrendKPI[];
}

export function ExecutiveKPIPanel({ kpis }: Props) {
  const formatValue = (kpi: TrendKPI) => {
    switch (kpi.format) {
      case 'currency': return `$${kpi.value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
      case 'percent': return `${kpi.value.toFixed(1)}%`;
      case 'hours': return `${kpi.value.toFixed(1)}h`;
      default: return kpi.value.toLocaleString();
    }
  };

  const TrendIcon = ({ trend }: { trend: string }) => {
    if (trend === 'up') return <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />;
    if (trend === 'down') return <TrendingDown className="h-3.5 w-3.5 text-red-400" />;
    return <Minus className="h-3.5 w-3.5 text-zinc-500" />;
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {kpis.map((kpi, i) => (
        <div
          key={i}
          className="relative overflow-hidden rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm p-4"
        >
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
            {kpi.label}
          </p>
          <p className="text-2xl font-bold tracking-tight">
            {formatValue(kpi)}
          </p>
          <div className="flex items-center gap-1 mt-1.5">
            <TrendIcon trend={kpi.trend} />
            <span className={`text-xs font-medium ${
              kpi.trend === 'up' ? 'text-emerald-400' : 
              kpi.trend === 'down' ? 'text-red-400' : 'text-zinc-500'
            }`}>
              {kpi.trendPercent > 0 ? `${kpi.trendPercent.toFixed(0)}%` : '—'}
            </span>
            <span className="text-[10px] text-muted-foreground">vs prior</span>
          </div>
          {/* Subtle gradient accent */}
          <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-primary/5 to-transparent rounded-bl-full" />
        </div>
      ))}
    </div>
  );
}
