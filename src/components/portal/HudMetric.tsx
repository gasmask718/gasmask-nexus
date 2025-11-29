import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface HudMetricProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  variant?: 'default' | 'cyan' | 'green' | 'amber' | 'purple' | 'red';
  size?: 'sm' | 'md' | 'lg';
}

const valueStyles = {
  default: 'text-foreground',
  cyan: 'text-hud-cyan',
  green: 'text-hud-green',
  amber: 'text-hud-amber',
  purple: 'text-hud-purple',
  red: 'text-primary',
};

const sizeStyles = {
  sm: 'text-xl',
  md: 'text-3xl',
  lg: 'text-5xl',
};

export function HudMetric({
  label,
  value,
  icon,
  trend,
  trendValue,
  variant = 'default',
  size = 'md'
}: HudMetricProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className={cn('font-mono font-bold', valueStyles[variant], sizeStyles[size])}>
        {value}
      </div>
      {trend && trendValue && (
        <div className={cn(
          'flex items-center gap-1 text-xs',
          trend === 'up' && 'text-hud-green',
          trend === 'down' && 'text-destructive',
          trend === 'neutral' && 'text-muted-foreground'
        )}>
          {trend === 'up' && <TrendingUp className="h-3 w-3" />}
          {trend === 'down' && <TrendingDown className="h-3 w-3" />}
          {trend === 'neutral' && <Minus className="h-3 w-3" />}
          <span>{trendValue}</span>
        </div>
      )}
    </div>
  );
}
