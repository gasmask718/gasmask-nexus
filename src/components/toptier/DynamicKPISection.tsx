/**
 * Dynamic KPI Section Component
 * Renders sections of KPIs grouped by category with management controls
 */
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings, Plus, RefreshCw } from "lucide-react";
import { useAllDynamicKPIs, KPICategory, CalculatedKPI } from "@/hooks/useDynamicKPIs";
import { DynamicKPICard } from "./DynamicKPICard";
import { useUserRole } from "@/hooks/useUserRole";
import { cn } from "@/lib/utils";

interface DynamicKPISectionProps {
  businessId?: string;
  showManageButton?: boolean;
  compact?: boolean;
  maxColumns?: number;
}

export function DynamicKPISection({ 
  businessId, 
  showManageButton = true, 
  compact = false,
  maxColumns = 4 
}: DynamicKPISectionProps) {
  const navigate = useNavigate();
  const { isAdmin, role } = useUserRole();
  const { groupedKPIs, isLoading, refetch } = useAllDynamicKPIs(businessId, role || undefined);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-9 w-28" />
        </div>
        <div className={cn(
          "grid gap-4",
          maxColumns === 4 && "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
          maxColumns === 3 && "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
          maxColumns === 2 && "grid-cols-1 md:grid-cols-2",
        )}>
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  if (!groupedKPIs || groupedKPIs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
        <p className="text-lg font-medium">No KPIs configured yet</p>
        <p className="text-sm mt-1">Create KPIs to track your business metrics</p>
        {isAdmin() && showManageButton && (
          <Button 
            variant="default" 
            className="mt-4"
            onClick={() => navigate("/crm/toptier-experience/kpis/manage")}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Your First KPI
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header with Manage button */}
      {showManageButton && (
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Key Performance Indicators</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              title="Refresh KPIs"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            {isAdmin() && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/crm/toptier-experience/kpis/manage")}
              >
                <Settings className="h-4 w-4 mr-2" />
                Manage KPIs
              </Button>
            )}
          </div>
        </div>
      )}

      {/* KPI Groups */}
      {groupedKPIs.map(({ category, kpis }) => (
        <KPICategoryGroup 
          key={category.id} 
          category={category} 
          kpis={kpis} 
          compact={compact}
          maxColumns={maxColumns}
        />
      ))}
    </div>
  );
}

interface KPICategoryGroupProps {
  category: KPICategory;
  kpis: CalculatedKPI[];
  compact?: boolean;
  maxColumns?: number;
}

function KPICategoryGroup({ category, kpis, compact = false, maxColumns = 4 }: KPICategoryGroupProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-md font-medium text-muted-foreground">{category.name}</h3>
        {category.description && (
          <span className="text-xs text-muted-foreground">— {category.description}</span>
        )}
        <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
          {kpis.length} {kpis.length === 1 ? 'KPI' : 'KPIs'}
        </span>
      </div>
      <div className={cn(
        "grid gap-4",
        maxColumns === 4 && "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
        maxColumns === 3 && "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
        maxColumns === 2 && "grid-cols-1 md:grid-cols-2",
      )}>
        {kpis.map(kpi => (
          <DynamicKPICard key={kpi.id} kpi={kpi} compact={compact} />
        ))}
      </div>
    </div>
  );
}

export default DynamicKPISection;
