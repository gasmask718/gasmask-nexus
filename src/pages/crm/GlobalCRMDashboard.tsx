/**
 * Global CRM Dashboard - Business-Configurable CRM
 * Entity-centric design with blueprint-driven UI
 */
import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import { useCRMBlueprint, useAvailableEntityTypes } from '@/hooks/useCRMBlueprint';
import { useCRMSimulation, useCRMSimulationStats } from '@/hooks/useCRMSimulation';
import CRMLayout from './CRMLayout';
import {
  Building2, Users, Search, Plus, Settings, ArrowRight,
  Sparkles, Calendar, Star, UserCheck, Package, Briefcase,
  Phone, MessageCircle, FileText, Image, ListTodo, Activity,
  Store, ChevronRight, RefreshCw, Filter, LayoutGrid, List,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  Building2, Users, Search, Plus, Settings, ArrowRight, Sparkles,
  Calendar, Star, UserCheck, Package, Briefcase, Phone, MessageCircle,
  FileText, Image, ListTodo, Activity, Store,
};

interface BusinessCard {
  id: string;
  name: string;
  slug: string;
  logo_url?: string | null;
  business_type?: string | null;
  industry?: string | null;
  created_at: string;
}

export default function GlobalCRMDashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const { currentBusiness, businesses } = useBusiness();
  const { simulationMode } = useSimulationMode();
  
  // Get selected business from URL or context
  const selectedBusinessSlug = searchParams.get('business') || currentBusiness?.slug;
  
  // Get blueprint for selected business
  const { blueprint, businessName } = useCRMBlueprint(selectedBusinessSlug || undefined);
  const entityTypes = useAvailableEntityTypes(selectedBusinessSlug || undefined);
  const simulationStats = useCRMSimulationStats(selectedBusinessSlug || null);
  const { isSimulationMode, simulationData } = useCRMSimulation(selectedBusinessSlug || null);

  // Fetch all businesses for the grid
  const { data: allBusinesses = [], isLoading: businessesLoading, refetch } = useQuery({
    queryKey: ['global-crm-businesses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('businesses')
        .select('id, name, slug, logo_url, business_type, industry, created_at')
        .order('name');
      if (error) throw error;
      return data as BusinessCard[];
    },
  });

  // Filter businesses by search
  const filteredBusinesses = useMemo(() => {
    if (!searchTerm) return allBusinesses;
    const term = searchTerm.toLowerCase();
    return allBusinesses.filter(b => 
      b.name.toLowerCase().includes(term) ||
      b.industry?.toLowerCase().includes(term) ||
      b.business_type?.toLowerCase().includes(term)
    );
  }, [allBusinesses, searchTerm]);

  // Get KPI values (simulation or real)
  const getKPIValue = (kpi: typeof blueprint.kpiConfig[0]) => {
    if (isSimulationMode && simulationStats[kpi.entityType || '']) {
      return simulationStats[kpi.entityType || ''];
    }
    return 0; // Real data would come from database queries
  };

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

  // If a business is selected, show the business CRM dashboard
  if (selectedBusinessSlug) {
    return (
      <CRMLayout title={`${businessName} CRM`}>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/crm')}>
                <ArrowRight className="h-4 w-4 rotate-180 mr-2" />
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
              <Button variant="outline" onClick={() => navigate('/crm/settings')}>
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
                  onClick={() => kpi.clickable && navigate(`/crm/${selectedBusinessSlug}/${kpi.entityType}`)}
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
                  const count = isSimulationMode ? (simulationStats[entity.key] || 0) : 0;
                  return (
                    <Card
                      key={entity.key}
                      className="p-4 cursor-pointer hover:shadow-md transition-all group"
                      onClick={() => navigate(`/crm/${selectedBusinessSlug}/${entity.key}`)}
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

          {/* Quick Actions based on features */}
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
                        { type: 'New partner added', entity: 'Luxury Wheels NYC', time: '2h ago' },
                        { type: 'Booking confirmed', entity: 'Jennifer Martinez', time: '3h ago' },
                        { type: 'Quote sent', entity: 'Robert Kim', time: '5h ago' },
                        { type: 'Note added', entity: 'Elite Helicopters', time: '1d ago' },
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
                      onClick={() => navigate(`/crm/${selectedBusinessSlug}/${entity.key}/new`)}
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

          {/* Feature-specific sections */}
          {blueprint.features.showPipeline && (
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
    );
  }

  // No business selected - show business grid
  return (
    <CRMLayout title="Global CRM">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">Global CRM</h1>
              {simulationMode && <SimulationBadge />}
            </div>
            <p className="text-muted-foreground mt-1">
              Business-configurable CRM for all entities
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={() => navigate('/crm/settings')}>
              <Settings className="h-4 w-4 mr-2" />
              CRM Settings
            </Button>
            <Button onClick={() => navigate('/crm/add-business')}>
              <Plus className="h-4 w-4 mr-2" />
              Add Business
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search businesses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-1 border rounded-lg p-1">
            <Button 
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'} 
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button 
              variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Businesses Grid/List */}
        {businessesLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[1,2,3,4,5,6].map(i => (
              <Card key={i} className="p-6 animate-pulse">
                <div className="h-24 bg-muted rounded" />
              </Card>
            ))}
          </div>
        ) : filteredBusinesses.length === 0 ? (
          <Card className="p-12 text-center">
            <Building2 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">
              {searchTerm ? 'No Matching Businesses' : 'No Businesses Found'}
            </h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              {searchTerm 
                ? `No businesses match "${searchTerm}"`
                : 'Add your first business to get started with the Global CRM'
              }
            </p>
            <Button onClick={() => navigate('/crm/add-business')} size="lg">
              <Plus className="mr-2 h-5 w-5" />
              Add Business
            </Button>
          </Card>
        ) : viewMode === 'grid' ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredBusinesses.map((business) => (
              <Card
                key={business.id}
                className="p-6 cursor-pointer hover:shadow-lg transition-all group border-t-4"
                style={{ borderTopColor: 'hsl(var(--primary))' }}
                onClick={() => navigate(`/crm?business=${business.slug}`)}
              >
                <div className="flex items-start justify-between mb-4">
                  {business.logo_url ? (
                    <img
                      src={business.logo_url}
                      alt={business.name}
                      className="w-12 h-12 rounded-lg object-contain"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                      {business.name.charAt(0)}
                    </div>
                  )}
                  {business.industry && (
                    <Badge variant="outline" className="text-xs">
                      {business.industry}
                    </Badge>
                  )}
                </div>
                <h3 className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors">
                  {business.name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {business.business_type || 'No type specified'}
                </p>
                <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
                  <span>Click to manage CRM</span>
                  <ChevronRight className="h-4 w-4" />
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <ScrollArea className="h-[600px]">
              <div className="divide-y">
                {filteredBusinesses.map((business) => (
                  <div
                    key={business.id}
                    className="flex items-center gap-4 p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/crm?business=${business.slug}`)}
                  >
                    {business.logo_url ? (
                      <img
                        src={business.logo_url}
                        alt={business.name}
                        className="w-10 h-10 rounded-lg object-contain"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {business.name.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="font-medium">{business.name}</h3>
                      <p className="text-sm text-muted-foreground">{business.business_type}</p>
                    </div>
                    {business.industry && (
                      <Badge variant="outline">{business.industry}</Badge>
                    )}
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                ))}
              </div>
            </ScrollArea>
          </Card>
        )}
      </div>
    </CRMLayout>
  );
}
