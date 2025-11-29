import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DrillDownEntity, DrillDownFilters, buildDrillDownUrl } from '@/lib/drilldown';

interface DrillDownTileProps {
  icon: React.ElementType;
  label: string;
  value: number | string;
  entity: DrillDownEntity;
  filters: DrillDownFilters;
  title?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
  subtext?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const variantStyles = {
  default: 'bg-card hover:bg-muted/50 border-border',
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

export function DrillDownTile({
  icon: Icon,
  label,
  value,
  entity,
  filters,
  title,
  variant = 'default',
  subtext,
  className,
  size = 'md',
}: DrillDownTileProps) {
  const navigate = useNavigate();
  
  const handleClick = () => {
    const url = buildDrillDownUrl({ entity, filters, title: title || label });
    navigate(url);
  };
  
  return (
    <Card 
      className={cn(
        'transition-all duration-200 cursor-pointer hover:scale-[1.02] hover:shadow-md',
        variantStyles[variant],
        className
      )}
      onClick={handleClick}
    >
      <CardContent className={sizeStyles[size].padding}>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className={cn('text-muted-foreground', sizeStyles[size].label)}>{label}</p>
            <p className={cn('font-bold', sizeStyles[size].value)}>{value}</p>
            {subtext && (
              <p className={cn('text-muted-foreground', sizeStyles[size].label)}>{subtext}</p>
            )}
          </div>
          <div className={cn('p-2 rounded-lg', iconVariantStyles[variant])}>
            <Icon className={sizeStyles[size].icon} />
          </div>
        </div>
        
        <div className="mt-2 flex items-center justify-between">
          <Badge variant="outline" className="text-[10px] bg-background/50">
            Click to view
          </Badge>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}
