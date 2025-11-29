// Clickable Stat Card for Grabba Floors
// When clicked, opens InsightPanel with filtered data

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ChevronRight, LucideIcon } from 'lucide-react';
import { InsightType } from '@/components/system/InsightPanel';

interface ClickableStatCardProps {
  icon: LucideIcon;
  label: string;
  value: number | string;
  subtext?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'cyan' | 'rose';
  insightType?: InsightType;
  onClick?: () => void;
  className?: string;
  clickable?: boolean;
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

export function ClickableStatCard({
  icon: Icon,
  label,
  value,
  subtext,
  variant = 'default',
  insightType,
  onClick,
  className,
  clickable = true,
}: ClickableStatCardProps) {
  const styles = variantStyles[variant];
  const isClickable = clickable && (onClick || insightType);

  return (
    <Card 
      className={cn(
        styles.card,
        'transition-all duration-200',
        isClickable && 'cursor-pointer hover:scale-[1.02] hover:shadow-md',
        className
      )}
      onClick={isClickable ? onClick : undefined}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className={cn('flex items-center gap-2', styles.icon)}>
              <Icon className="h-4 w-4" />
              <span className="text-xs">{label}</span>
            </div>
            <div className="text-2xl font-bold text-foreground mt-1">{value}</div>
            {subtext && (
              <div className="text-xs text-muted-foreground">{subtext}</div>
            )}
          </div>
          {isClickable && (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        {isClickable && (
          <div className="mt-2 pt-2 border-t border-border/50">
            <Badge variant="outline" className="text-[10px]">
              Click to view details
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ClickableStatCard;
