import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon, ChevronRight } from 'lucide-react';
import { TopTierKPICard } from './TopTierKPICard';
import { TopTierKPI } from '@/hooks/toptier/useTopTierKPIs';
import { Button } from '@/components/ui/button';

interface TopTierKPISectionProps {
  title: string;
  icon: LucideIcon;
  kpis: TopTierKPI[];
  isLoading?: boolean;
  onSectionClick?: () => void;
  onKPIClick?: (kpi: TopTierKPI) => void;
  activeKPIId?: string | null;
  maxCards?: number;
  className?: string;
  children?: ReactNode;
}

export function TopTierKPISection({
  title,
  icon: Icon,
  kpis,
  isLoading = false,
  onSectionClick,
  onKPIClick,
  activeKPIId,
  maxCards = 6,
  className,
  children,
}: TopTierKPISectionProps) {
  const displayKPIs = kpis.slice(0, maxCards);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {kpis.length} metrics
          </span>
        </div>
        {onSectionClick && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onSectionClick}
            className="text-muted-foreground hover:text-foreground"
          >
            View All
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {isLoading ? (
          Array.from({ length: maxCards }).map((_, i) => (
            <TopTierKPICard
              key={i}
              name="Loading..."
              value={0}
              icon={Icon}
              color="default"
              isLoading
            />
          ))
        ) : (
          displayKPIs.map((kpi) => (
            <TopTierKPICard
              key={kpi.id}
              name={kpi.name}
              value={kpi.value}
              icon={kpi.icon}
              color={kpi.color}
              onClick={() => onKPIClick?.(kpi)}
              isActive={activeKPIId === kpi.id}
              description={kpi.description}
            />
          ))
        )}
      </div>

      {/* Additional Content */}
      {children}
    </div>
  );
}
