import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Zap,
  Route as RouteIcon,
  MapPin,
  Calendar as CalendarIcon,
  Users,
  Clock,
  CheckCircle,
  AlertTriangle,
  Navigation,
  Loader2,
  TrendingUp,
  Play,
  Save,
  Send,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Package,
  Truck,
  Bike,
  GripVertical,
  X,
  Target,
  Timer,
  Gauge,
  AlertCircle,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GRABBA_BRAND_CONFIG, ALL_BRANDS_OPTION, type GrabbaBrandId } from "@/config/grabbaSkyscraper";
import { usePrimaryResponsiveContactBatch } from "@/hooks/usePrimaryResponsiveContact";
import { StoreContactIntelBadge } from "@/components/contact/StoreContactIntelBadge";
import { PredictiveIntelCompact } from "@/components/contact/PredictiveIntelCompact";

// Types
interface OptimizationResult {
  id: string;
  driver: string;
  driver_id: string;
  role: string;
  stops: number;
  distance: number;
  duration: number;
  profit: number;
  score: number;
  territory: string;
  stores: Array<{
    id: string;
    name: string;
    urgency: number;
    lat: number;
    lng: number;
  }>;
  autonomy_eligible: boolean;
  guardrail_blocks: string[];
  risk_level: 'low' | 'medium' | 'high';
}

interface WorkPoolItem {
  id: string;
  store_id: string;
  store_name: string;
  address: string;
  urgency_score: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  delivery_window?: string;
  brand?: string;
  type: 'delivery' | 'restock' | 'collection';
}

const OPTIMIZATION_MODES = [
  { value: 'balanced', label: 'Balanced', description: 'Balance between time, distance, and priority' },
  { value: 'fastest', label: 'Fastest', description: 'Minimize total route time' },
  { value: 'shortest', label: 'Least Distance', description: 'Minimize total distance traveled' },
  { value: 'priority', label: 'Priority-First', description: 'Prioritize urgent deliveries first' },
];

const TERRITORIES = [
  'Brooklyn', 'Queens', 'Manhattan', 'Bronx', 'Staten Island'
];

export default function RouteOptimizerPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // State
  const [selectedDate, setSelectedDate] = useState<Date>(addDays(new Date(), 1));
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedTerritory, setSelectedTerritory] = useState<string>("__all__");
  const [optimizationMode, setOptimizationMode] = useState<string>("balanced");
  const [vehicleType, setVehicleType] = useState<string>("__all__");
  const [selectedWorkItems, setSelectedWorkItems] = useState<string[]>([]);
  const [proposedRoutes, setProposedRoutes] = useState<OptimizationResult[]>([]);
  const [selectedRoutes, setSelectedRoutes] = useState<string[]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  
  // Batch-load contact intelligence for all stores in proposed routes
  const routeStoreIds = useMemo(
    () => [...new Set(proposedRoutes.flatMap(r => r.stores.map(s => s.id)))],
    [proposedRoutes]
  );
  const { contactsByStore: routeContactsByStore } = usePrimaryResponsiveContactBatch(routeStoreIds);

  // Fetch unassigned work pool (stores needing visits)
  const { data: workPool = [], isLoading: loadingWorkPool } = useQuery({
    queryKey: ['route-optimizer-work-pool', selectedBrands, selectedTerritory],
    queryFn: async () => {
      let query = supabase
        .from('stores')
        .select(`
          id, name, address_line1, address_city, lat, lng, type, tags,
          store_product_state(urgency_score, tubes_left, eta_stockout)
        `)
        .eq('status', 'active')
        .eq('approval_status', 'approved') // Phase 7: exclude pending captures
        .not('lat', 'is', null)
        .not('lng', 'is', null);
      
      if (selectedTerritory && selectedTerritory !== '__all__') {
        query = query.contains('tags', [selectedTerritory]);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      // Transform to work pool items with urgency
      return (data || []).map((store: any) => {
        const state = store.store_product_state?.[0];
        const urgency = state?.urgency_score || 0;
        let priority: 'critical' | 'high' | 'medium' | 'low' = 'low';
        if (urgency >= 80) priority = 'critical';
        else if (urgency >= 60) priority = 'high';
        else if (urgency >= 40) priority = 'medium';
        
        return {
          id: store.id,
          store_id: store.id,
          store_name: store.name,
          address: `${store.address_city || ''}`,
          urgency_score: urgency,
          priority,
          type: 'restock' as const,
          brand: store.tags?.[0] || undefined,
        };
      }).filter((item: WorkPoolItem) => item.urgency_score > 20)
        .sort((a: WorkPoolItem, b: WorkPoolItem) => b.urgency_score - a.urgency_score);
    },
  });
  
  // Fetch available workers
  const { data: workers = [] } = useQuery({
    queryKey: ['route-optimizer-workers', vehicleType],
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select(`
          id, name, role,
          worker_performance(trust_score, reliability_score, autonomy_level, trend_direction)
        `)
        .in('role', vehicleType === '__all__' ? ['driver', 'biker'] : [vehicleType as 'driver' | 'biker']);
      
      const { data, error } = await query.limit(20);
      if (error) throw error;
      return data || [];
    },
  });
  
  // Fetch existing routes for the date
  const { data: existingRoutes = [] } = useQuery({
    queryKey: ['route-optimizer-existing', format(selectedDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('routes')
        .select('id, territory, status, type, assigned_to')
        .eq('date', format(selectedDate, 'yyyy-MM-dd'));
      if (error) throw error;
      return data || [];
    },
  });
  
  // Run optimization
  const optimizeMutation = useMutation({
    mutationFn: async () => {
      setIsOptimizing(true);
      const { data, error } = await supabase.functions.invoke('optimize-routes', {
        body: {
          date: format(selectedDate, 'yyyy-MM-dd'),
          territory: selectedTerritory !== '__all__' ? selectedTerritory : null,
          mode: optimizationMode,
          vehicle_type: vehicleType !== '__all__' ? vehicleType : null,
          store_ids: selectedWorkItems.length > 0 ? selectedWorkItems : undefined,
        }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setIsOptimizing(false);
      if (data.routes && data.routes.length > 0) {
        // Transform routes to our format
        const transformed: OptimizationResult[] = data.routes.map((r: any) => ({
          id: r.id,
          driver: r.driver || 'Unassigned',
          driver_id: r.driver_id || '',
          role: r.role || 'driver',
          stops: r.stops || 0,
          distance: r.distance || 0,
          duration: r.duration || 0,
          profit: r.profit || 0,
          score: r.score || 0,
          territory: r.territory || 'Multi-Zone',
          stores: r.stores || [],
          autonomy_eligible: r.autonomy_eligible !== false,
          guardrail_blocks: r.guardrail_blocks || [],
          risk_level: r.risk_level || 'low',
        }));
        setProposedRoutes(transformed);
        setSelectedRoutes(transformed.map(r => r.id));
        toast.success(`✨ ${data.routes_created} routes generated!`, {
          description: `Total stops: ${data.routes.reduce((sum: number, r: any) => sum + (r.stops || 0), 0)}`
        });
      } else {
        toast.info('No routes generated', {
          description: 'Try adjusting filters or adding more stores to the work pool'
        });
      }
    },
    onError: (error: any) => {
      setIsOptimizing(false);
      toast.error('Optimization failed', {
        description: error.message
      });
    }
  });
  
  // Approve routes
  const approveMutation = useMutation({
    mutationFn: async () => {
      // Routes are already created by optimize-routes, just update status
      const routeIds = selectedRoutes;
      if (routeIds.length === 0) throw new Error('No routes selected');
      
      const { error } = await supabase
        .from('routes')
        .update({ status: 'planned' })
        .in('id', routeIds);
      
      if (error) throw error;
      return routeIds.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} routes approved!`, {
        description: 'Routes are now visible in Route Manager and Ops Center'
      });
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      navigate('/delivery/route-manager');
    },
    onError: (error: any) => {
      toast.error('Failed to approve routes', {
        description: error.message
      });
    }
  });
  
  // Toggle work item selection
  const toggleWorkItem = useCallback((id: string) => {
    setSelectedWorkItems(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  }, []);
  
  // Toggle route selection
  const toggleRoute = useCallback((id: string) => {
    setSelectedRoutes(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  }, []);
  
  // Select all work items
  const selectAllWork = useCallback(() => {
    setSelectedWorkItems(workPool.map(w => w.id));
  }, [workPool]);
  
  // Clear work selection
  const clearWorkSelection = useCallback(() => {
    setSelectedWorkItems([]);
  }, []);
  
  // Get priority badge color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      default: return 'bg-slate-500';
    }
  };
  
  // Calculate stats
  const totalStops = proposedRoutes.reduce((sum, r) => sum + r.stops, 0);
  const totalDistance = proposedRoutes.reduce((sum, r) => sum + r.distance, 0);
  const avgScore = proposedRoutes.length > 0 
    ? Math.round(proposedRoutes.reduce((sum, r) => sum + r.score, 0) / proposedRoutes.length)
    : 0;
  const blockedRoutes = proposedRoutes.filter(r => r.guardrail_blocks.length > 0).length;
  const highRiskRoutes = proposedRoutes.filter(r => r.risk_level === 'high').length;
  const autoEligibleRoutes = proposedRoutes.filter(r => r.autonomy_eligible).length;

  return (
    <div className="p-6 space-y-6 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/delivery/route-manager")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Zap className="h-6 w-6 text-primary" />
              Route Optimizer
            </h1>
            <p className="text-muted-foreground">AI-powered route planning and optimization engine</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Users className="h-3 w-3" />
            {workers.length} Workers
          </Badge>
          <Badge variant="outline" className="gap-1">
            <MapPin className="h-3 w-3" />
            {workPool.length} Pending Stops
          </Badge>
        </div>
      </div>
      
      {/* Control Panel */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Optimization Control Panel
          </CardTitle>
          <CardDescription>Configure parameters for route generation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* Date Selector */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {format(selectedDate, 'MMM d, yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            {/* Territory */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Territory</Label>
              <Select value={selectedTerritory} onValueChange={setSelectedTerritory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Territories</SelectItem>
                  {TERRITORIES.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Optimization Mode */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Optimization Mode</Label>
              <Select value={optimizationMode} onValueChange={setOptimizationMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPTIMIZATION_MODES.map(mode => (
                    <SelectItem key={mode.value} value={mode.value}>
                      {mode.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Vehicle Type */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Vehicle Type</Label>
              <Select value={vehicleType} onValueChange={setVehicleType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Types</SelectItem>
                  <SelectItem value="driver">
                    <span className="flex items-center gap-2">
                      <Truck className="h-4 w-4" /> Driver (Car/Van)
                    </span>
                  </SelectItem>
                  <SelectItem value="biker">
                    <span className="flex items-center gap-2">
                      <Bike className="h-4 w-4" /> Biker
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Brand Multi-Select simplified */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Brand Filter</Label>
              <Select 
                value={selectedBrands.length === 0 ? 'all' : selectedBrands[0]} 
                onValueChange={(v) => setSelectedBrands(v === 'all' ? [] : [v])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Brands" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Brands</SelectItem>
                  {Object.entries(GRABBA_BRAND_CONFIG).map(([key, brand]) => (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        <span>{brand.icon}</span> {brand.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Run Button */}
            <div className="space-y-2">
              <Label className="text-sm font-medium opacity-0">Action</Label>
              <Button 
                onClick={() => optimizeMutation.mutate()}
                disabled={isOptimizing}
                className="w-full"
                size="default"
              >
                {isOptimizing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Optimizing...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Run Optimization
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Work Pool Panel - Left */}
        <div className="lg:col-span-4">
          <Card className="h-[600px] flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Package className="h-4 w-4" />
                  Unassigned Work Pool
                </CardTitle>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={selectAllWork}>
                    Select All
                  </Button>
                  <Button variant="ghost" size="sm" onClick={clearWorkSelection}>
                    Clear
                  </Button>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                {selectedWorkItems.length} of {workPool.length} selected
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
              <ScrollArea className="h-full px-4">
                {loadingWorkPool ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : workPool.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No pending work items</p>
                  </div>
                ) : (
                  <div className="space-y-2 pb-4">
                    {workPool.map((item) => (
                      <div
                        key={item.id}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                          selectedWorkItems.includes(item.id)
                            ? "border-primary bg-primary/5"
                            : "hover:bg-muted/50"
                        )}
                        onClick={() => toggleWorkItem(item.id)}
                      >
                        <Checkbox
                          checked={selectedWorkItems.includes(item.id)}
                          onCheckedChange={() => toggleWorkItem(item.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate text-sm">{item.store_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{item.address}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge className={cn("text-xs", getPriorityColor(item.priority))}>
                            {item.priority}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            Score: {item.urgency_score}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
        
        {/* Route Proposals Panel - Center */}
        <div className="lg:col-span-5">
          <Card className="h-[600px] flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <RouteIcon className="h-4 w-4" />
                  Route Proposals
                </CardTitle>
                {proposedRoutes.length > 0 && (
                  <Badge variant="secondary">
                    {selectedRoutes.length} / {proposedRoutes.length} selected
                  </Badge>
                )}
              </div>
              {proposedRoutes.length > 0 && (
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {totalStops} stops
                  </span>
                  <span className="flex items-center gap-1">
                    <Navigation className="h-3 w-3" /> {totalDistance.toFixed(1)} km
                  </span>
                  <span className="flex items-center gap-1">
                    <Gauge className="h-3 w-3" /> Avg score: {avgScore}
                  </span>
                </div>
              )}
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
              <ScrollArea className="h-full px-4">
                {proposedRoutes.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Zap className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No routes generated yet</p>
                    <p className="text-sm mt-1">Configure parameters and run optimization</p>
                  </div>
                ) : (
                  <div className="space-y-3 pb-4">
                    {proposedRoutes.map((route) => (
                      <div
                        key={route.id}
                        className={cn(
                          "p-4 rounded-lg border cursor-pointer transition-colors",
                          selectedRoutes.includes(route.id)
                            ? "border-primary bg-primary/5"
                            : "hover:bg-muted/50",
                          route.guardrail_blocks.length > 0 && "border-amber-500/50"
                        )}
                        onClick={() => toggleRoute(route.id)}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={selectedRoutes.includes(route.id)}
                              onCheckedChange={() => toggleRoute(route.id)}
                            />
                            <div>
                              <p className="font-medium">{route.driver}</p>
                              <p className="text-xs text-muted-foreground">
                                {route.role === 'biker' ? '🚴' : '🚗'} {route.role} • {route.territory}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {route.autonomy_eligible ? (
                              <Badge variant="outline" className="text-green-600 border-green-500 text-xs">
                                <ShieldCheck className="h-3 w-3 mr-1" />
                                Auto-eligible
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-amber-600 border-amber-500 text-xs">
                                <ShieldAlert className="h-3 w-3 mr-1" />
                                Manual
                              </Badge>
                            )}
                            {/* Risk Level Badge */}
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "text-xs",
                                route.risk_level === 'high' && "text-red-600 border-red-500",
                                route.risk_level === 'medium' && "text-amber-600 border-amber-500",
                                route.risk_level === 'low' && "text-green-600 border-green-500"
                              )}
                            >
                              {route.risk_level === 'high' ? '⚠️' : route.risk_level === 'medium' ? '⚡' : '✓'} {route.risk_level}
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-4 gap-2 text-center">
                          <div className="p-2 bg-muted/50 rounded">
                            <p className="text-lg font-bold">{route.stops}</p>
                            <p className="text-xs text-muted-foreground">Stops</p>
                          </div>
                          <div className="p-2 bg-muted/50 rounded">
                            <p className="text-lg font-bold">{route.distance.toFixed(1)}</p>
                            <p className="text-xs text-muted-foreground">km</p>
                          </div>
                          <div className="p-2 bg-muted/50 rounded">
                            <p className="text-lg font-bold">{route.duration}</p>
                            <p className="text-xs text-muted-foreground">min</p>
                          </div>
                          <div className="p-2 bg-muted/50 rounded">
                            <p className="text-lg font-bold">{route.score}</p>
                            <p className="text-xs text-muted-foreground">Score</p>
                          </div>
                        </div>
                        
                        {/* Contact Intelligence per route */}
                        {route.stores.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {route.stores.slice(0, 2).map(store => (
                              <div key={store.id} className="flex items-center gap-2 text-xs">
                                <span className="text-muted-foreground truncate max-w-[100px]">{store.name}</span>
                                <StoreContactIntelBadge 
                                  contact={routeContactsByStore[store.id]} 
                                  compact 
                                  className="flex-1" 
                                />
                                <PredictiveIntelCompact storeId={store.id} />
                              </div>
                            ))}
                            {route.stores.length > 2 && (
                              <p className="text-xs text-muted-foreground pl-1">
                                + {route.stores.length - 2} more stops
                              </p>
                            )}
                          </div>
                        )}

                        {route.guardrail_blocks.length > 0 && (
                          <div className="mt-3 p-2 bg-amber-500/10 rounded border border-amber-500/30">
                            <p className="text-xs font-medium text-amber-600 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Guardrail Warnings:
                            </p>
                            <ul className="text-xs text-amber-600/80 mt-1 list-disc list-inside">
                              {route.guardrail_blocks.map((block, i) => (
                                <li key={i}>{block}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
        
        {/* Validation & Actions Panel - Right */}
        <div className="lg:col-span-3 space-y-4">
          {/* Validation Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4" />
                Route Validation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {proposedRoutes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Run optimization to see validation
                </p>
              ) : (
              <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Total Routes</span>
                    <Badge variant="secondary">{proposedRoutes.length}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Auto-Eligible</span>
                    <Badge className="bg-green-500">
                      {autoEligibleRoutes}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">High Risk</span>
                    <Badge className={highRiskRoutes > 0 ? "bg-red-500" : "bg-slate-500"}>
                      {highRiskRoutes}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Guardrail Blocks</span>
                    <Badge className={blockedRoutes > 0 ? "bg-amber-500" : "bg-slate-500"}>
                      {blockedRoutes}
                    </Badge>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Avg Optimization Score</span>
                    <span className="text-lg font-bold text-primary">{avgScore}</span>
                  </div>
                  <Progress value={avgScore} className="h-2" />
                </>
              )}
            </CardContent>
          </Card>
          
          {/* Existing Routes Warning */}
          {existingRoutes.length > 0 && (
            <Card className="border-amber-500/50 bg-amber-500/5">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Existing Routes</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {existingRoutes.length} routes already exist for {format(selectedDate, 'MMM d')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Play className="h-4 w-4" />
                Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                variant="outline" 
                className="w-full justify-start"
                disabled={proposedRoutes.length === 0}
                onClick={() => {
                  setProposedRoutes([]);
                  setSelectedRoutes([]);
                }}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reset Proposals
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full justify-start"
                disabled={selectedRoutes.length === 0}
              >
                <Save className="h-4 w-4 mr-2" />
                Save as Draft
              </Button>
              
              <Separator />
              
              <Button 
                className="w-full"
                size="lg"
                disabled={selectedRoutes.length === 0 || approveMutation.isPending}
                onClick={() => approveMutation.mutate()}
              >
                {approveMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Approving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve {selectedRoutes.length} Routes
                  </>
                )}
              </Button>
              
              <p className="text-xs text-muted-foreground text-center">
                Approved routes will appear in Route Manager and be assigned for {format(selectedDate, 'MMMM d')}
              </p>
            </CardContent>
          </Card>
          
          {/* Quick Stats */}
          <Card>
            <CardContent className="pt-4 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <TrendingUp className="h-4 w-4 text-primary" />
                <span>Clusters by urgency + proximity</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <RouteIcon className="h-4 w-4 text-primary" />
                <span>6-15 stops per route</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Zap className="h-4 w-4 text-primary" />
                <span>Auto-assigns to available workers</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span>Respects autonomy guardrails</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

