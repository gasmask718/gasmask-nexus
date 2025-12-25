import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useBusiness } from "@/contexts/BusinessContext";
import { useSimulationMode, SimulationBadge } from "@/contexts/SimulationModeContext";
import { useDeliveries, useStoreChecks, useDrivers, useBikers } from "@/hooks/useDeliveryData";
import { useResolvedData, useSimulationData } from "@/hooks/useSimulationData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SimulationModeToggle, SimulationBanner } from "@/components/delivery/SimulationModeToggle";
import { 
  Truck, 
  Bike, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  Users,
  Package,
  DollarSign,
  ArrowRight,
  Plus,
  Radio,
  Eye,
  Zap,
  Wallet,
  AlertCircle
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

export default function DeliveryDashboard() {
  const navigate = useNavigate();
  const { currentBusiness } = useBusiness();
  const { simulationMode } = useSimulationMode();
  const simData = useSimulationData();
  const businessId = currentBusiness?.id;

  const today = format(new Date(), "yyyy-MM-dd");
  const { data: deliveries = [] } = useDeliveries(businessId, { date: today });
  const { data: storeChecks = [] } = useStoreChecks(businessId, { date: today });
  const { data: drivers = [] } = useDrivers(businessId);
  const { data: bikers = [] } = useBikers(businessId);

  // Resolve data using simulation hook
  const resolvedRoutes = useResolvedData(deliveries, simData.routes as any[]);
  const resolvedDrivers = useResolvedData(drivers, simData.drivers as any[]);
  const resolvedBikers = useResolvedData(bikers, simData.bikers as any[]);
  const resolvedIssues = useResolvedData(storeChecks, simData.issues as any[]);
  const resolvedActivity = useResolvedData([], simData.activityFeed as any[]);

  // Calculate KPIs from resolved data or use simulation KPIs
  const inProgressDeliveries = deliveries.filter(d => d.status === "in_progress");
  const scheduledDeliveries = deliveries.filter(d => d.status === "scheduled");
  const completedDeliveries = deliveries.filter(d => d.status === "completed");
  
  const pendingChecks = storeChecks.filter(c => c.status === "assigned" || c.status === "in_progress");
  const submittedChecks = storeChecks.filter(c => c.status === "submitted");

  const activeDrivers = drivers.filter(d => d.status === "active");
  const activeBikers = bikers.filter(b => b.status === "active");

  // Use simulation KPIs when no real data
  const hasRealData = deliveries.length > 0 || drivers.length > 0 || bikers.length > 0;
  const showSimulated = simulationMode && !hasRealData;
  
  const kpis = showSimulated && simData.kpis ? {
    deliveriesToday: simData.kpis.deliveries_today,
    stopsCompleted: simData.kpis.stops_completed,
    stopsPending: simData.kpis.stops_pending,
    activeDrivers: simData.kpis.active_drivers,
    activeBikers: simData.kpis.active_bikers,
    openIssues: simData.kpis.open_issues,
    payoutsPending: simData.kpis.payouts_pending,
    totalPendingAmount: simData.kpis.total_pending_amount,
  } : {
    deliveriesToday: deliveries.length,
    stopsCompleted: completedDeliveries.length,
    stopsPending: scheduledDeliveries.length + inProgressDeliveries.length,
    activeDrivers: activeDrivers.length,
    activeBikers: activeBikers.length,
    openIssues: submittedChecks.length,
    payoutsPending: 0,
    totalPendingAmount: 0,
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'delivery': return <Truck className="h-4 w-4" />;
      case 'biker': return <Bike className="h-4 w-4" />;
      case 'issue': return <AlertTriangle className="h-4 w-4" />;
      case 'route': return <MapPin className="h-4 w-4" />;
      case 'payout': return <DollarSign className="h-4 w-4" />;
      default: return <Radio className="h-4 w-4" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'success': return 'text-green-600 bg-green-100 dark:bg-green-900/30';
      case 'warning': return 'text-amber-600 bg-amber-100 dark:bg-amber-900/30';
      case 'error': return 'text-red-600 bg-red-100 dark:bg-red-900/30';
      default: return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30';
    }
  };

  return (
    <div className="flex flex-col">
      <SimulationBanner />
      
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Truck className="h-8 w-8 text-primary" />
              Delivery & Logistics
            </h1>
            <p className="text-muted-foreground">Today: {format(new Date(), "EEEE, MMMM d, yyyy")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SimulationModeToggle />
            <Button onClick={() => navigate("/delivery/deliveries")} variant="outline">
              <Package className="h-4 w-4 mr-2" />
              Deliveries Board
            </Button>
            <Button onClick={() => navigate("/delivery/drivers")}>
              <Users className="h-4 w-4 mr-2" />
              Manage Drivers
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/delivery/deliveries")}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Truck className="h-4 w-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-xl font-bold">{kpis.deliveriesToday}</p>
                  <p className="text-xs text-muted-foreground">Deliveries Today</p>
                </div>
              </div>
              {showSimulated && <SimulationBadge className="mt-2" />}
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/delivery/deliveries")}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                </div>
                <div>
                  <p className="text-xl font-bold">{kpis.stopsCompleted}</p>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/delivery/deliveries")}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-500/10 rounded-lg">
                  <Clock className="h-4 w-4 text-amber-500" />
                </div>
                <div>
                  <p className="text-xl font-bold">{kpis.stopsPending}</p>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/delivery/drivers")}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-slate-500/10 rounded-lg">
                  <Users className="h-4 w-4 text-slate-500" />
                </div>
                <div>
                  <p className="text-xl font-bold">{kpis.activeDrivers}</p>
                  <p className="text-xs text-muted-foreground">Active Drivers</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/delivery/bikers")}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-cyan-500/10 rounded-lg">
                  <Bike className="h-4 w-4 text-cyan-500" />
                </div>
                <div>
                  <p className="text-xl font-bold">{kpis.activeBikers}</p>
                  <p className="text-xs text-muted-foreground">Active Bikers</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/delivery/biker-tasks")}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-red-500/10 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                </div>
                <div>
                  <p className="text-xl font-bold">{kpis.openIssues}</p>
                  <p className="text-xs text-muted-foreground">Open Issues</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/delivery/payouts")}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <Wallet className="h-4 w-4 text-purple-500" />
                </div>
                <div>
                  <p className="text-xl font-bold">{kpis.payoutsPending}</p>
                  <p className="text-xs text-muted-foreground">Payouts Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/delivery/payouts")}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-500/10 rounded-lg">
                  <DollarSign className="h-4 w-4 text-emerald-500" />
                </div>
                <div>
                  <p className="text-xl font-bold">${kpis.totalPendingAmount}</p>
                  <p className="text-xs text-muted-foreground">Pending Amount</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active Deliveries */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Active Deliveries
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate("/delivery/deliveries")}>
                View All <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              {resolvedRoutes.showEmptyState ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No active deliveries today</p>
                  <p className="text-sm mt-1">Enable Simulation Mode to see demo data</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {resolvedRoutes.data.slice(0, 5).map((item: any) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/delivery/routes/${item.id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${item.status === 'in_progress' ? 'bg-amber-500/10' : 'bg-blue-500/10'}`}>
                          <Truck className={`h-4 w-4 ${item.status === 'in_progress' ? 'text-amber-500' : 'text-blue-500'}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{item.delivery_type?.replace("_", " ").toUpperCase() || item.delivery_type}</p>
                            {item.is_simulated && <SimulationBadge />}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {item.driver?.full_name || item.driver_name || "Unassigned"} • {item.total_stops || item.delivery_stops?.length || item.stops?.length || 0} stops
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={item.priority === 'urgent' ? 'destructive' : item.priority === 'high' ? 'default' : 'secondary'}>
                          {item.priority}
                        </Badge>
                        <Badge variant={item.status === 'in_progress' ? 'default' : 'outline'}>
                          {item.status?.replace("_", " ")}
                        </Badge>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="default" className="w-full justify-start" onClick={() => navigate("/delivery/deliveries?action=create")}>
                <Plus className="h-4 w-4 mr-2" />
                Create Delivery
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => navigate("/delivery/drivers")}>
                <Users className="h-4 w-4 mr-2" />
                Assign Driver
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => navigate("/delivery/bikers")}>
                <Bike className="h-4 w-4 mr-2" />
                Assign Biker
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => navigate("/delivery/biker-tasks")}>
                <AlertTriangle className="h-4 w-4 mr-2" />
                View Issues
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => navigate("/delivery/payouts")}>
                <DollarSign className="h-4 w-4 mr-2" />
                View Payouts
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => navigate("/delivery/locations")}>
                <MapPin className="h-4 w-4 mr-2" />
                Manage Locations
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Live Activity Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Radio className="h-5 w-5 text-green-500 animate-pulse" />
                Live Activity Feed
              </CardTitle>
              {resolvedActivity.isSimulated && <SimulationBadge />}
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-3">
                  {resolvedActivity.data.map((activity: any) => (
                    <div
                      key={activity.id}
                      className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => {
                        if (activity.entity_type === 'delivery') navigate(`/delivery/routes/${activity.entity_id}`);
                        else if (activity.entity_type === 'biker') navigate(`/delivery/bikers/${activity.entity_id}`);
                        else if (activity.entity_type === 'issue') navigate(`/delivery/issues/${activity.entity_id}`);
                      }}
                    >
                      <div className={`p-1.5 rounded-full ${getSeverityColor(activity.severity)}`}>
                        {getActivityIcon(activity.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{activity.message}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" className="shrink-0">
                        <Eye className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  {resolvedActivity.showEmptyState && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Radio className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Activity feed will update in real-time</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Open Issues */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Open Issues ({resolvedIssues.data.filter((i: any) => i.status !== 'resolved').length})
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate("/delivery/biker-tasks")}>
                View All <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-3">
                  {resolvedIssues.data.filter((i: any) => i.status !== 'resolved').map((issue: any) => (
                    <div
                      key={issue.id}
                      className="p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/delivery/issues/${issue.id}`)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={issue.severity === 'critical' || issue.severity === 'high' ? 'destructive' : 'secondary'}>
                            {issue.severity || issue.check_type?.replace("_", " ") || issue.issue_type}
                          </Badge>
                          {issue.is_simulated && <SimulationBadge />}
                        </div>
                        <Badge variant="outline">{issue.status?.replace("_", " ")}</Badge>
                      </div>
                      <p className="font-medium text-sm">{issue.store_name || issue.location?.name || "Unknown Store"}</p>
                      <p className="text-xs text-muted-foreground">{issue.issue_type || "Store Check"} • {issue.reported_by || issue.biker?.full_name || "Unknown"}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-muted-foreground">
                          {issue.reported_at ? formatDistanceToNow(new Date(issue.reported_at), { addSuffix: true }) : ''}
                        </span>
                        <div className="flex gap-1">
                          <Button variant="outline" size="sm" className="h-7 text-xs">View Store</Button>
                          <Button variant="default" size="sm" className="h-7 text-xs">Details</Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!showSimulated && submittedChecks.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-30 text-green-500" />
                      <p className="text-sm">No open issues</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
