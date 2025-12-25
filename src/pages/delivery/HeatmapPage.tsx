import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { 
  Map, RefreshCw, ThermometerSun, AlertTriangle, CheckCircle, 
  Store, UserPlus, Route, Flame, ArrowRight
} from 'lucide-react';
import { 
  useTerritoryStats, 
  useBoroList, 
  useNeighborhoodList, 
  useComputeTerritoryStats,
  useStoresInTerritory,
  useIssuesInTerritory
} from '@/hooks/useTerritoryStats';
import { useGenerateRouteSuggestion } from '@/hooks/useRouteSuggestions';
import { format } from 'date-fns';
import { BikerAssignmentDialog } from '@/components/biker/BikerAssignmentDialog';

const HeatmapPage: React.FC = () => {
  const navigate = useNavigate();
  const today = format(new Date(), 'yyyy-MM-dd');
  
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedBoro, setSelectedBoro] = useState<string>('');
  const [drilldownBoro, setDrilldownBoro] = useState<string | null>(null);
  const [drilldownNeighborhood, setDrilldownNeighborhood] = useState<string | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignContext, setAssignContext] = useState<{ boro: string; neighborhood?: string } | null>(null);

  const { data: boros = [] } = useBoroList();
  const { data: neighborhoods = [] } = useNeighborhoodList(selectedBoro);
  const { data: territoryStats = [], isLoading } = useTerritoryStats({ date: selectedDate, boro: selectedBoro || undefined });
  const computeStats = useComputeTerritoryStats();
  const generateRoute = useGenerateRouteSuggestion();
  
  const { data: drilldownStores = [] } = useStoresInTerritory(drilldownBoro || undefined);
  const { data: drilldownIssues = [] } = useIssuesInTerritory(drilldownBoro || undefined);

  const getHeatColor = (score: number) => {
    if (score >= 70) return 'bg-red-500';
    if (score >= 50) return 'bg-orange-500';
    if (score >= 30) return 'bg-yellow-500';
    if (score >= 10) return 'bg-green-300';
    return 'bg-green-500';
  };

  const getHeatIntensity = (score: number) => {
    return Math.min(100, Math.max(20, score));
  };

  const handleCellClick = (boro: string, neighborhood?: string) => {
    setDrilldownBoro(boro);
    setDrilldownNeighborhood(neighborhood || null);
  };

  const handleAssignBiker = (boro: string, neighborhood?: string) => {
    setAssignContext({ boro, neighborhood });
    setAssignDialogOpen(true);
  };

  const handleGenerateRoute = (boro: string, neighborhood?: string) => {
    generateRoute.mutate({ 
      date: selectedDate, 
      boro, 
      neighborhood,
      priorityFocus: 'sla_risk'
    });
  };

  // Group by boro
  const boroStats = boros.map(boro => {
    const stats = territoryStats.filter(s => s.boro === boro);
    const totalIssues = stats.reduce((sum, s) => sum + s.issues_open, 0);
    const criticalIssues = stats.reduce((sum, s) => sum + s.issues_critical, 0);
    const tasksCompleted = stats.reduce((sum, s) => sum + s.tasks_completed, 0);
    const avgHeat = stats.length > 0 ? stats.reduce((sum, s) => sum + s.heat_score, 0) / stats.length : 0;
    
    return { boro, totalIssues, criticalIssues, tasksCompleted, heatScore: avgHeat, neighborhoods: stats };
  });

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <ThermometerSun className="h-8 w-8 text-orange-500" />
              Territory Heatmap
            </h1>
            <p className="text-muted-foreground">View issue density and activity by borough/neighborhood</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => computeStats.mutate({ date: selectedDate })}
              disabled={computeStats.isPending}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${computeStats.isPending ? 'animate-spin' : ''}`} />
              Refresh Stats
            </Button>
            <Button onClick={() => navigate('/delivery/route-suggestions')}>
              <Route className="h-4 w-4 mr-2" />
              Route Suggestions
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4 flex gap-4 items-center">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Date:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-1 border rounded-md bg-background"
              />
            </div>
            <Select value={selectedBoro || 'all'} onValueChange={(v) => setSelectedBoro(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Boroughs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Boroughs</SelectItem>
                {boros.map(boro => (
                  <SelectItem key={boro} value={boro}>{boro}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Heatmap Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            <p className="text-muted-foreground col-span-3 text-center py-8">Loading...</p>
          ) : boroStats.length === 0 ? (
            <Card className="col-span-3">
              <CardContent className="py-8 text-center">
                <Map className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No territory data available</p>
                <Button className="mt-4" onClick={() => computeStats.mutate({ date: selectedDate })}>
                  Compute Stats
                </Button>
              </CardContent>
            </Card>
          ) : (
            boroStats.map((stat) => (
              <Card 
                key={stat.boro}
                className="cursor-pointer hover:shadow-lg transition-shadow overflow-hidden"
                onClick={() => handleCellClick(stat.boro)}
              >
                <div 
                  className={`h-2 ${getHeatColor(stat.heatScore)}`}
                  style={{ opacity: getHeatIntensity(stat.heatScore) / 100 }}
                />
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Flame className={`h-5 w-5 ${stat.heatScore > 50 ? 'text-red-500' : 'text-orange-400'}`} />
                      {stat.boro}
                    </span>
                    <Badge variant={stat.heatScore > 50 ? 'destructive' : 'secondary'}>
                      Heat: {stat.heatScore.toFixed(0)}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2 text-center mb-4">
                    <div>
                      <p className="text-2xl font-bold text-red-500">{stat.totalIssues}</p>
                      <p className="text-xs text-muted-foreground">Open Issues</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-orange-500">{stat.criticalIssues}</p>
                      <p className="text-xs text-muted-foreground">Critical</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-500">{stat.tasksCompleted}</p>
                      <p className="text-xs text-muted-foreground">Completed</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1"
                      onClick={(e) => { e.stopPropagation(); handleAssignBiker(stat.boro); }}
                    >
                      <UserPlus className="h-3 w-3 mr-1" /> Assign
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1"
                      onClick={(e) => { e.stopPropagation(); handleGenerateRoute(stat.boro); }}
                    >
                      <Route className="h-3 w-3 mr-1" /> Route
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Legend */}
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-medium mb-2">Heat Score Legend</p>
            <div className="flex gap-4 items-center">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-green-500" />
                <span className="text-sm">Low (0-10)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-yellow-500" />
                <span className="text-sm">Medium (30-50)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-orange-500" />
                <span className="text-sm">High (50-70)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-red-500" />
                <span className="text-sm">Critical (70+)</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Drilldown Sheet */}
        <Sheet open={!!drilldownBoro} onOpenChange={() => setDrilldownBoro(null)}>
          <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <Map className="h-5 w-5" />
                {drilldownBoro} {drilldownNeighborhood && `- ${drilldownNeighborhood}`}
              </SheetTitle>
            </SheetHeader>
            
            <div className="mt-6 space-y-6">
              {/* Actions */}
              <div className="flex gap-2">
                <Button 
                  className="flex-1" 
                  onClick={() => drilldownBoro && handleAssignBiker(drilldownBoro, drilldownNeighborhood || undefined)}
                >
                  <UserPlus className="h-4 w-4 mr-2" /> Assign Biker
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => drilldownBoro && handleGenerateRoute(drilldownBoro, drilldownNeighborhood || undefined)}
                >
                  <Route className="h-4 w-4 mr-2" /> Generate Route
                </Button>
              </div>

              {/* Issues in Territory */}
              <div>
                <h3 className="font-medium flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  Open Issues ({drilldownIssues.length})
                </h3>
                <div className="space-y-2">
                  {drilldownIssues.slice(0, 10).map((issue: any) => (
                    <div 
                      key={issue.id}
                      className="p-3 rounded-lg bg-muted/50 flex items-center justify-between cursor-pointer hover:bg-muted"
                      onClick={() => navigate(`/delivery/issues/${issue.id}`)}
                    >
                      <div>
                        <p className="font-medium">{issue.location?.name || 'Unknown Store'}</p>
                        <p className="text-sm text-muted-foreground">{issue.issue_type}</p>
                      </div>
                      <Badge variant={issue.severity === 'critical' ? 'destructive' : 'secondary'}>
                        {issue.severity}
                      </Badge>
                    </div>
                  ))}
                  {drilldownIssues.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No open issues</p>
                  )}
                </div>
              </div>

              {/* Stores in Territory */}
              <div>
                <h3 className="font-medium flex items-center gap-2 mb-3">
                  <Store className="h-4 w-4 text-blue-500" />
                  Stores ({drilldownStores.length})
                </h3>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {drilldownStores.slice(0, 20).map((store: any) => (
                    <div 
                      key={store.id}
                      className="p-3 rounded-lg bg-muted/50 flex items-center justify-between cursor-pointer hover:bg-muted"
                      onClick={() => navigate(`/delivery/store/${store.id}`)}
                    >
                      <div>
                        <p className="font-medium">{store.name}</p>
                        <p className="text-sm text-muted-foreground">{store.address}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Assignment Dialog */}
        {assignContext && (
          <BikerAssignmentDialog
            open={assignDialogOpen}
            onOpenChange={setAssignDialogOpen}
            entityType="store"
            entityName={`${assignContext.boro}${assignContext.neighborhood ? ` - ${assignContext.neighborhood}` : ''}`}
            onAssigned={() => setAssignContext(null)}
          />
        )}
      </div>
    </Layout>
  );
};

export default HeatmapPage;
