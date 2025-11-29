// ═══════════════════════════════════════════════════════════════════════════════
// SMART STAT CARD — Clickable KPI Card That Navigates to Results
// ═══════════════════════════════════════════════════════════════════════════════

import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ChevronRight, LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { encodeQueryToUrl } from '@/hooks/useSmartQuery';
import { PanelType } from './ResultsPanelActions';

export interface SmartStatCardProps {
  icon: LucideIcon;
  label: string;
  value: number | string;
  subtext?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'cyan' | 'rose';
  // Query configuration
  queryCommand: string;
  panelType: PanelType;
  brand?: string;
  // Optional overrides
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

const variantStyles = {
  default: {
    card: 'bg-card hover:bg-muted/50 border-border/50',
    icon: 'text-muted-foreground',
    iconBg: 'bg-muted',
  },
  success: {
    card: 'bg-gradient-to-br from-green-500/10 to-green-900/5 border-green-500/20 hover:border-green-500/40',
    icon: 'text-green-400',
    iconBg: 'bg-green-500/10',
  },
  warning: {
    card: 'bg-gradient-to-br from-amber-500/10 to-amber-900/5 border-amber-500/20 hover:border-amber-500/40',
    icon: 'text-amber-400',
    iconBg: 'bg-amber-500/10',
  },
  danger: {
    card: 'bg-gradient-to-br from-red-500/10 to-red-900/5 border-red-500/20 hover:border-red-500/40',
    icon: 'text-red-400',
    iconBg: 'bg-red-500/10',
  },
  info: {
    card: 'bg-gradient-to-br from-blue-500/10 to-blue-900/5 border-blue-500/20 hover:border-blue-500/40',
    icon: 'text-blue-400',
    iconBg: 'bg-blue-500/10',
  },
  purple: {
    card: 'bg-gradient-to-br from-purple-500/10 to-purple-900/5 border-purple-500/20 hover:border-purple-500/40',
    icon: 'text-purple-400',
    iconBg: 'bg-purple-500/10',
  },
  cyan: {
    card: 'bg-gradient-to-br from-cyan-500/10 to-cyan-900/5 border-cyan-500/20 hover:border-cyan-500/40',
    icon: 'text-cyan-400',
    iconBg: 'bg-cyan-500/10',
  },
  rose: {
    card: 'bg-gradient-to-br from-rose-500/10 to-rose-900/5 border-rose-500/20 hover:border-rose-500/40',
    icon: 'text-rose-400',
    iconBg: 'bg-rose-500/10',
  },
};

export function SmartStatCard({
  icon: Icon,
  label,
  value,
  subtext,
  trend,
  trendValue,
  variant = 'default',
  queryCommand,
  panelType,
  brand,
  onClick,
  disabled = false,
  className,
}: SmartStatCardProps) {
  const navigate = useNavigate();
  const styles = variantStyles[variant];

  const handleClick = () => {
    if (disabled) return;
    
    if (onClick) {
      onClick();
      return;
    }

    // Navigate to results page
    const queryParams = encodeQueryToUrl({
      command: queryCommand,
      brand,
    });
    navigate(`/grabba/results?panel=${panelType}&${queryParams}`);
  };

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : null;

  return (
    <Card
      className={cn(
        styles.card,
        'transition-all duration-200',
        !disabled && 'cursor-pointer hover:scale-[1.02] hover:shadow-md',
        disabled && 'opacity-60 cursor-not-allowed',
        className
      )}
      onClick={handleClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className={cn('flex items-center gap-2', styles.icon)}>
              <div className={cn('p-1.5 rounded-lg', styles.iconBg)}>
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-xs font-medium">{label}</span>
            </div>
            <div className="text-2xl font-bold text-foreground mt-2">{value}</div>
            {(subtext || trendValue) && (
              <div className="flex items-center gap-2 mt-1">
                {subtext && (
                  <span className="text-xs text-muted-foreground">{subtext}</span>
                )}
                {trendValue && TrendIcon && (
                  <span className={cn(
                    'flex items-center gap-0.5 text-xs',
                    trend === 'up' && 'text-green-500',
                    trend === 'down' && 'text-red-500'
                  )}>
                    <TrendIcon className="h-3 w-3" />
                    {trendValue}
                  </span>
                )}
              </div>
            )}
          </div>
          {!disabled && (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        {!disabled && (
          <div className="mt-3 pt-2 border-t border-border/50">
            <Badge variant="outline" className="text-[10px] bg-background/50">
              Click to view details
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default SmartStatCard;
