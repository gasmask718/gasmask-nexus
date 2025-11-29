// Phase 11B - Interactive Stat Tile with Insight Panel Integration

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { InsightType } from './InsightPanel';

interface InteractiveStatTileProps {
  icon: React.ElementType;
  label: string;
  value: number | string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
  insightType?: InsightType;
  onClick?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function InteractiveStatTile({
  icon: Icon,
  label,
  value,
  trend,
  trendValue,
  variant = 'default',
  insightType,
  onClick,
  className,
  size = 'md',
}: InteractiveStatTileProps) {
  const isClickable = !!onClick || !!insightType;

  const variantStyles = {
    default: 'bg-card hover:bg-muted/50',
    success: 'bg-green-500/5 border-green-500/20 hover:bg-green-500/10',
    warning: 'bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/10',
    danger: 'bg-red-500/5 border-red-500/20 hover:bg-red-500/10',
    info: 'bg-blue-500/5 border-blue-500/20 hover:bg-blue-500/10',
    purple: 'bg-purple-500/5 border-purple-500/20 hover:bg-purple-500/10',
  };

  const iconVariantStyles = {
    default: 'text-muted-foreground bg-muted',
    success: 'text-green-500 bg-green-500/10',
    warning: 'text-amber-500 bg-amber-500/10',
    danger: 'text-red-500 bg-red-500/10',
    info: 'text-blue-500 bg-blue-500/10',
    purple: 'text-purple-500 bg-purple-500/10',
  };

  const sizeStyles = {
    sm: { padding: 'p-3', icon: 'h-4 w-4', value: 'text-lg', label: 'text-[10px]' },
    md: { padding: 'p-4', icon: 'h-5 w-5', value: 'text-2xl', label: 'text-xs' },
    lg: { padding: 'p-5', icon: 'h-6 w-6', value: 'text-3xl', label: 'text-sm' },
  };

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  return (
    <Card 
      className={cn(
        'transition-all duration-200',
        variantStyles[variant],
        isClickable && 'cursor-pointer hover:scale-[1.02] hover:shadow-md',
        className
      )}
      onClick={onClick}
    >
      <CardContent className={sizeStyles[size].padding}>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className={cn('text-muted-foreground', sizeStyles[size].label)}>{label}</p>
            <p className={cn('font-bold', sizeStyles[size].value)}>{value}</p>
            {trendValue && (
              <div className={cn(
                'flex items-center gap-1',
                sizeStyles[size].label,
                trend === 'up' && 'text-green-500',
                trend === 'down' && 'text-red-500',
                trend === 'neutral' && 'text-muted-foreground'
              )}>
                <TrendIcon className="h-3 w-3" />
                <span>{trendValue}</span>
              </div>
            )}
          </div>
          <div className={cn('p-2 rounded-lg', iconVariantStyles[variant])}>
            <Icon className={sizeStyles[size].icon} />
          </div>
        </div>
        
        {isClickable && (
          <div className="mt-2 flex items-center justify-between">
            <Badge variant="outline" className="text-[10px] bg-background/50">
              Click to view
            </Badge>
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Wrapper component that auto-connects to InsightPanel
interface SmartStatTileProps extends Omit<InteractiveStatTileProps, 'onClick'> {
  insightType: InsightType;
  onOpenInsight: (type: InsightType) => void;
}

export function SmartStatTile({ insightType, onOpenInsight, ...props }: SmartStatTileProps) {
  return (
    <InteractiveStatTile
      {...props}
      insightType={insightType}
      onClick={() => onOpenInsight(insightType)}
    />
  );
}
