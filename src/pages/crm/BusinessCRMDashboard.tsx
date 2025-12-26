/**
 * BusinessCRMDashboard - Business-scoped CRM dashboard
 * Accessed via /crm/:businessSlug - shows CRM for a specific business
 */
import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import { useCRMBlueprint, useAvailableEntityTypes } from '@/hooks/useCRMBlueprint';
import { useCRMSimulation, useCRMSimulationStats } from '@/hooks/useCRMSimulation';
import { useCRMEntityCounts } from '@/hooks/useCRMEntityCounts';
import { BusinessContextGuard } from '@/components/crm/BusinessContextGuard';
import CRMLayout from './CRMLayout';
import {
  Building2, Users, Plus, Settings, ArrowLeft, ChevronRight,
  LayoutGrid, Activity, Briefcase, RefreshCw, AlertTriangle
} from 'lucide-react';

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  Building2, Users, Plus, Settings, ArrowLeft, ChevronRight,
  LayoutGrid, Activity, Briefcase,
};

export default function BusinessCRMDashboard() {
  const { businessSlug } = useParams<{ businessSlug: string }>();
  const navigate = useNavigate();
  const { simulationMode } = useSimulationMode();
  
  // Get blueprint for this business
  const { blueprint, businessName, businessId, isLoading: blueprintLoading } = useCRMBlueprint(businessSlug);
  const entityTypes = useAvailableEntityTypes(businessSlug);
  const simulationStats = useCRMSimulationStats(businessSlug || null);
  const { isSimulationMode } = useCRMSimulation(businessSlug || null);
  
  // Get real entity counts - need both businessId and entityTypes
  const entityTypesForCounts = blueprint.enabledEntityTypes;
  const { counts: realCounts, isLoading: countsLoading } = useCRMEntityCounts(
    businessId || null,
    entityTypesForCounts
  );

  const renderIcon = (iconName: string, className = "h-5 w-5") => {
    const IconComponent = ICON_MAP[iconName];
    return IconComponent ? <IconComponent className={className} /> : <Building2 className={className} />;
  };

  const getVariantClasses = (variant: string) => {
    switch (variant) {
      case 'cyan': return 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20';
      case 'green': return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'amber': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
      case 'purple': return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
      case 'red': return 'bg-red-500/10 text-red-600 border-red-500/20';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  // Get KPI values (simulation or real)
  const getKPIValue = (kpi: typeof blueprint.kpiConfig[0]) => {
    if (isSimulationMode && simulationStats[kpi.entityType || '']) {
      return simulationStats[kpi.entityType || ''];
    }
    return realCounts[kpi.entityType || ''] || 0;
  };

  // Get entity count
  const getEntityCount = (entityKey: string) => {
    if (isSimulationMode) {
      return simulationStats[entityKey] || 0;
    }
    return realCounts[entityKey] || 0;
  };

  return (
    <BusinessContextGuard businessSlug={businessSlug}>
      <CRMLayout title={`${businessName} CRM`}>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/crm')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                All Businesses
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold">{businessName}</h1>
                  {isSimulationMode && <SimulationBadge />}
                </div>
                <p className="text-muted-foreground text-sm">
                  {blueprint.enabledEntityTypes.length} entity types enabled
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => navigate(`/crm/settings?business=${businessSlug}`)}>
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Quick Add
              </Button>
            </div>
          </div>

          {/* KPI Tiles */}
          {blueprint.kpiConfig.length > 0 && (
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
              {blueprint.kpiConfig.map((kpi) => (
                <Card 
                  key={kpi.key}
                  className={`p-4 cursor-pointer hover:shadow-md transition-all border ${getVariantClasses(kpi.variant)}`}
                  onClick={() => kpi.clickable && navigate(`/crm/${businessSlug}/${kpi.entityType}`)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${getVariantClasses(kpi.variant)}`}>
                        {renderIcon(kpi.icon)}
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{kpi.label}</p>
                        <p className="text-2xl font-bold">{getKPIValue(kpi)}</p>
                      </div>
                    </div>
                    {kpi.clickable && <ChevronRight className="h-5 w-5 text-muted-foreground" />}
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Entity Types Grid */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LayoutGrid className="h-5 w-5" />
                Entity Types
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
                {entityTypes.map((entity) => {
                  const count = getEntityCount(entity.key);
                  return (
                    <Card
                      key={entity.key}
                      className="p-4 cursor-pointer hover:shadow-md transition-all group"
                      onClick={() => navigate(`/crm/${businessSlug}/${entity.key}`)}
                    >
                      <div className="flex items-center gap-3">
                        <div 
                          className="p-2 rounded-lg"
                          style={{ backgroundColor: `${entity.color}20`, color: entity.color }}
                        >
                          {renderIcon(entity.icon)}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium group-hover:text-primary transition-colors">
                            {entity.labelPlural}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {count} records
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Activity Feed */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  {isSimulationMode ? (
                    <div className="space-y-3">
                      {[
                        { type: 'New record added', entity: 'Sample Record 1', time: '2h ago' },
                        { type: 'Status updated', entity: 'Sample Record 2', time: '3h ago' },
                        { type: 'Note added', entity: 'Sample Record 3', time: '5h ago' },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer">
                          <div className="h-2 w-2 rounded-full bg-primary" />
                          <div className="flex-1">
                            <p className="text-sm font-medium">{item.type}</p>
                            <p className="text-xs text-muted-foreground">{item.entity}</p>
                          </div>
                          <span className="text-xs text-muted-foreground">{item.time}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      No recent activity
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Quick Add */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Quick Add
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 grid-cols-2">
                  {entityTypes.slice(0, 6).map((entity) => (
                    <Button
                      key={entity.key}
                      variant="outline"
                      className="justify-start"
                      onClick={() => navigate(`/crm/${businessSlug}/${entity.key}/new`)}
                    >
                      <div 
                        className="p-1 rounded mr-2"
                        style={{ backgroundColor: `${entity.color}20`, color: entity.color }}
                      >
                        {renderIcon(entity.icon, 'h-4 w-4')}
                      </div>
                      Add {entity.label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Pipeline Overview */}
          {blueprint.features.showPipeline && Object.keys(blueprint.pipelines).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />
                  Pipeline Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {Object.entries(blueprint.pipelines).map(([key, stages]) => (
                    <div key={key} className="flex gap-2">
                      {stages.slice(0, 5).map((stage) => (
                        <div
                          key={stage.value}
                          className="flex-shrink-0 p-3 rounded-lg border min-w-[140px]"
                          style={{ borderColor: stage.color }}
                        >
                          <div 
                            className="h-2 w-2 rounded-full mb-2"
                            style={{ backgroundColor: stage.color }}
                          />
                          <p className="text-sm font-medium">{stage.label}</p>
                          <p className="text-lg font-bold">0</p>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </CRMLayout>
    </BusinessContextGuard>
  );
}
