/**
 * Dynamic KPI Section Component
 * Renders a section of KPIs grouped by category
 */
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings, Plus } from "lucide-react";
import { useAllDynamicKPIs, KPICategory, CalculatedKPI } from "@/hooks/useDynamicKPIs";
import { DynamicKPICard } from "./DynamicKPICard";
import { useUserRole } from "@/hooks/useUserRole";

interface DynamicKPISectionProps {
  businessId?: string;
  showManageButton?: boolean;
}

export function DynamicKPISection({ businessId, showManageButton = true }: DynamicKPISectionProps) {
  const navigate = useNavigate();
  const { groupedKPIs, isLoading } = useAllDynamicKPIs(businessId);
  const { isAdmin } = useUserRole();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  if (!groupedKPIs || groupedKPIs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No KPIs configured yet.</p>
        {isAdmin() && showManageButton && (
          <Button 
            variant="outline" 
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
      {isAdmin() && showManageButton && (
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Dynamic KPIs</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/crm/toptier-experience/kpis/manage")}
          >
            <Settings className="h-4 w-4 mr-2" />
            Manage KPIs
          </Button>
        </div>
      )}

      {/* KPI Groups */}
      {groupedKPIs.map(({ category, kpis }) => (
        <KPICategoryGroup key={category.id} category={category} kpis={kpis} />
      ))}
    </div>
  );
}

interface KPICategoryGroupProps {
  category: KPICategory;
  kpis: CalculatedKPI[];
}

function KPICategoryGroup({ category, kpis }: KPICategoryGroupProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-md font-medium text-muted-foreground">{category.name}</h3>
        {category.description && (
          <span className="text-xs text-muted-foreground">— {category.description}</span>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {kpis.map(kpi => (
          <DynamicKPICard key={kpi.id} kpi={kpi} />
        ))}
      </div>
    </div>
  );
}

export default DynamicKPISection;
