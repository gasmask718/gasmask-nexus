import { useState } from "react";
import { format, addDays } from "date-fns";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDeliveryCapacity, TerritoryCapacity, WorkerLoad, CapacityAlert } from "@/hooks/useDeliveryCapacity";
import { 
  Users, 
  Truck, 
  Bike, 
  UserCircle, 
  Route, 
  MapPin, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown,
  ArrowRight,
  RefreshCw,
  Calendar,
  Target,
  Zap,
  Clock,
  ChevronRight
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════════════════════
// DELIVERY CAPACITY COMMAND — Floor 4 Pre-Dispatch Intelligence
// ═══════════════════════════════════════════════════════════════════════════════

const DeliveryCapacityCommand = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTerritory, setSelectedTerritory] = useState<string | undefined>();

  const { 
    summary, 
    territoryCapacity, 
    workerLoads, 
    alerts,
    territories,
    isLoading,
    isToday,
    isTomorrow
  } = useDeliveryCapacity(selectedDate, selectedTerritory);

  const dateOptions = [
    { label: 'Today', date: new Date() },
    { label: 'Tomorrow', date: addDays(new Date(), 1) },
  ];

  const getUtilizationColor = (percent: number) => {
    if (percent < 50) return 'text-yellow-500';
    if (percent <= 80) return 'text-green-500';
    if (percent <= 100) return 'text-yellow-500';
    return 'text-destructive';
  };

  const getUtilizationBg = (percent: number) => {
    if (percent < 50) return 'bg-yellow-500/10';
    if (percent <= 80) return 'bg-green-500/10';
    if (percent <= 100) return 'bg-yellow-500/10';
    return 'bg-destructive/10';
  };

  const getStatusBadge = (status: TerritoryCapacity['status']) => {
    switch (status) {
      case 'underutilized':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600">Underutilized</Badge>;
      case 'balanced':
        return <Badge variant="outline" className="text-green-600 border-green-600">Balanced</Badge>;
      case 'overloaded':
        return <Badge variant="destructive">Overloaded</Badge>;
    }
  };

  const getSlaRiskBadge = (risk: WorkerLoad['slaRisk']) => {
    switch (risk) {
      case 'low':
        return <Badge variant="outline" className="text-green-600 border-green-600">Low Risk</Badge>;
      case 'medium':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600">Medium Risk</Badge>;
      case 'high':
        return <Badge variant="destructive">High Risk</Badge>;
    }
  };

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header Command Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Delivery Capacity Command</h1>
            <p className="text-muted-foreground mt-1">
              Pre-dispatch intelligence — prevent overload before routes fail
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Date Selector */}
            <div className="flex rounded-lg border bg-muted/50 p-1">
              {dateOptions.map(opt => (
                <Button
                  key={opt.label}
                  variant={format(selectedDate, 'yyyy-MM-dd') === format(opt.date, 'yyyy-MM-dd') ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setSelectedDate(opt.date)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>

            {/* Territory Selector */}
            <Select value={selectedTerritory || 'all'} onValueChange={v => setSelectedTerritory(v === 'all' ? undefined : v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Territories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Territories</SelectItem>
                {territories.map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Quick Actions */}
            <Button variant="outline" size="icon">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Summary KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          <KPICard
            icon={Users}
            label="Total Workers"
            value={isLoading ? '-' : summary.totalWorkers}
            subtext={`${summary.totalDrivers}D / ${summary.totalBikers}B`}
          />
          <KPICard
            icon={Truck}
            label="Drivers"
            value={isLoading ? '-' : summary.totalDrivers}
          />
          <KPICard
            icon={Bike}
            label="Bikers"
            value={isLoading ? '-' : summary.totalBikers}
          />
          <KPICard
            icon={UserCircle}
            label="Ambassadors"
            value={isLoading ? '-' : summary.totalAmbassadors}
          />
          <KPICard
            icon={Route}
            label="Routes"
            value={isLoading ? '-' : summary.totalRoutes}
            subtext={isToday ? 'Active today' : 'Planned'}
          />
          <KPICard
            icon={MapPin}
            label="Stops"
            value={isLoading ? '-' : summary.totalStops}
          />
          <KPICard
            icon={Target}
            label="Avg/Worker"
            value={isLoading ? '-' : summary.avgStopsPerWorker}
            subtext="stops"
          />
          <KPICard
            icon={Zap}
            label="Utilization"
            value={isLoading ? '-' : `${summary.utilizationPercent}%`}
            highlight={summary.utilizationPercent > 100 ? 'destructive' : summary.utilizationPercent > 80 ? 'warning' : 'success'}
          />
        </div>

        {/* Alerts Panel */}
        {alerts.length > 0 && (
          <Card className="border-yellow-500/50 bg-yellow-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                Capacity Risk Alerts ({alerts.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {alerts.slice(0, 5).map(alert => (
                  <AlertCard key={alert.id} alert={alert} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content Tabs */}
        <Tabs defaultValue="territories" className="space-y-4">
          <TabsList>
            <TabsTrigger value="territories">Territory Grid</TabsTrigger>
            <TabsTrigger value="workers">Worker Load</TabsTrigger>
            <TabsTrigger value="timeline">Time View</TabsTrigger>
          </TabsList>

          {/* Territory Capacity Grid */}
          <TabsContent value="territories" className="space-y-4">
            {isLoading ? (
              <Card>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : territoryCapacity.length === 0 ? (
              <EmptyState
                title="No capacity data"
                description="No territories with capacity metrics found for this date."
                icon={MapPin}
              />
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Territory</TableHead>
                      <TableHead className="text-center">Workers</TableHead>
                      <TableHead className="text-center">Routes</TableHead>
                      <TableHead className="text-center">Stops</TableHead>
                      <TableHead className="text-center">Avg/Worker</TableHead>
                      <TableHead>Utilization</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {territoryCapacity.map(t => (
                      <TableRow key={t.territory} className={cn(
                        t.status === 'overloaded' && 'bg-destructive/5',
                        t.status === 'underutilized' && 'bg-yellow-500/5'
                      )}>
                        <TableCell className="font-medium">{t.territory}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1.5 text-sm">
                            <span className="flex items-center gap-0.5"><Truck className="h-3 w-3" />{t.drivers}</span>
                            <span className="text-muted-foreground">/</span>
                            <span className="flex items-center gap-0.5"><Bike className="h-3 w-3" />{t.bikers}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{t.activeRoutes}</TableCell>
                        <TableCell className="text-center">{t.totalStops}</TableCell>
                        <TableCell className="text-center font-mono">{t.avgStopsPerWorker}</TableCell>
                        <TableCell>
                          <div className="w-full max-w-[120px]">
                            <div className="flex justify-between text-xs mb-1">
                              <span className={getUtilizationColor(t.utilizationPercent)}>
                                {t.utilizationPercent}%
                              </span>
                            </div>
                            <Progress value={Math.min(t.utilizationPercent, 100)} className="h-2" />
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(t.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="sm" asChild>
                              <Link to={`/delivery/route-optimizer?territory=${t.territory}`}>
                                Rebalance
                              </Link>
                            </Button>
                            <Button variant="ghost" size="sm" asChild>
                              <Link to={`/delivery/live-map?territory=${t.territory}`}>
                                <ChevronRight className="h-4 w-4" />
                              </Link>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>

          {/* Worker Load Breakdown */}
          <TabsContent value="workers" className="space-y-4">
            {isLoading ? (
              <Card>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {[1, 2, 3, 4, 5].map(i => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : workerLoads.length === 0 ? (
              <EmptyState
                title="No worker data"
                description="No workers found with capacity assignments."
                icon={Users}
              />
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Worker</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="text-center">Routes</TableHead>
                      <TableHead className="text-center">Stops</TableHead>
                      <TableHead className="text-center">Est. Time</TableHead>
                      <TableHead>Utilization</TableHead>
                      <TableHead>SLA Risk</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {workerLoads.map(w => (
                      <TableRow key={w.id} className={cn(
                        w.isOverloaded && 'bg-destructive/5',
                        w.isIdle && 'bg-muted/50'
                      )}>
                        <TableCell className="font-medium">{w.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{w.role}</Badge>
                        </TableCell>
                        <TableCell className="text-center">{w.assignedRoutes}</TableCell>
                        <TableCell className="text-center">{w.stopsAssigned}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1 text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {Math.round(w.estimatedMinutes / 60 * 10) / 10}h
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="w-full max-w-[100px]">
                            <div className="flex justify-between text-xs mb-1">
                              <span className={getUtilizationColor(w.utilizationPercent)}>
                                {w.utilizationPercent}%
                              </span>
                            </div>
                            <Progress value={Math.min(w.utilizationPercent, 100)} className="h-1.5" />
                          </div>
                        </TableCell>
                        <TableCell>{getSlaRiskBadge(w.slaRisk)}</TableCell>
                        <TableCell>
                          {w.isOverloaded && (
                            <Badge variant="destructive" className="text-xs">
                              <TrendingUp className="h-3 w-3 mr-1" />Overloaded
                            </Badge>
                          )}
                          {w.isIdle && (
                            <Badge variant="secondary" className="text-xs">
                              <TrendingDown className="h-3 w-3 mr-1" />Idle
                            </Badge>
                          )}
                          {!w.isOverloaded && !w.isIdle && (
                            <Badge variant="outline" className="text-xs text-green-600">Optimal</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>

          {/* Time-Based View */}
          <TabsContent value="timeline" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-6">
              <TimeCard
                title="Today"
                date={new Date()}
                isActive={isToday}
                territoryData={territoryCapacity}
                isLoading={isLoading}
              />
              <TimeCard
                title="Tomorrow"
                date={addDays(new Date(), 1)}
                isActive={isTomorrow}
                territoryData={[]} // Would need separate query
                isLoading={isLoading}
              />
            </div>
          </TabsContent>
        </Tabs>

        {/* Action Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
            <CardDescription>Manual capacity management actions (non-autonomous)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" asChild>
                <Link to="/delivery/drivers">
                  <Users className="mr-2 h-4 w-4" />
                  Add Worker to Territory
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/delivery/route-optimizer">
                  <Route className="mr-2 h-4 w-4" />
                  Split Overloaded Routes
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/delivery/autonomy-console">
                  <Zap className="mr-2 h-4 w-4" />
                  Open Autonomy Console
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/delivery/live-map">
                  <MapPin className="mr-2 h-4 w-4" />
                  View Live Map
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

interface KPICardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subtext?: string;
  highlight?: 'success' | 'warning' | 'destructive';
}

function KPICard({ icon: Icon, label, value, subtext, highlight }: KPICardProps) {
  return (
    <Card className={cn(
      highlight === 'destructive' && 'border-destructive/50 bg-destructive/5',
      highlight === 'warning' && 'border-yellow-500/50 bg-yellow-500/5',
      highlight === 'success' && 'border-green-500/50 bg-green-500/5'
    )}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-lg",
            highlight === 'destructive' ? 'bg-destructive/10' : 
            highlight === 'warning' ? 'bg-yellow-500/10' : 
            highlight === 'success' ? 'bg-green-500/10' : 'bg-muted'
          )}>
            <Icon className={cn(
              "h-4 w-4",
              highlight === 'destructive' ? 'text-destructive' :
              highlight === 'warning' ? 'text-yellow-500' :
              highlight === 'success' ? 'text-green-500' : 'text-muted-foreground'
            )} />
          </div>
          <div>
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
            {subtext && <div className="text-xs text-muted-foreground/80">{subtext}</div>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface AlertCardProps {
  alert: CapacityAlert;
}

function AlertCard({ alert }: AlertCardProps) {
  return (
    <div className={cn(
      "flex items-start gap-3 p-3 rounded-lg",
      alert.severity === 'critical' ? 'bg-destructive/10 border border-destructive/30' : 'bg-yellow-500/10 border border-yellow-500/30'
    )}>
      <AlertTriangle className={cn(
        "h-5 w-5 mt-0.5 shrink-0",
        alert.severity === 'critical' ? 'text-destructive' : 'text-yellow-500'
      )} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className="text-xs">{alert.territory}</Badge>
          <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'} className="text-xs">
            {alert.type.replace('_', ' ')}
          </Badge>
        </div>
        <p className="font-medium text-sm">{alert.message}</p>
        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
          <ArrowRight className="h-3 w-3" />
          {alert.recommendation}
        </p>
      </div>
    </div>
  );
}

interface TimeCardProps {
  title: string;
  date: Date;
  isActive: boolean;
  territoryData: TerritoryCapacity[];
  isLoading: boolean;
}

function TimeCard({ title, date, isActive, territoryData, isLoading }: TimeCardProps) {
  const totalRoutes = territoryData.reduce((sum, t) => sum + t.activeRoutes, 0);
  const totalStops = territoryData.reduce((sum, t) => sum + t.totalStops, 0);
  const totalWorkers = territoryData.reduce((sum, t) => sum + t.totalWorkers, 0);
  const avgUtil = territoryData.length > 0 
    ? Math.round(territoryData.reduce((sum, t) => sum + t.utilizationPercent, 0) / territoryData.length)
    : 0;

  return (
    <Card className={cn(isActive && 'ring-2 ring-primary')}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {title}
          </CardTitle>
          <Badge variant={isActive ? 'default' : 'outline'}>
            {format(date, 'MMM d, yyyy')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-2xl font-bold">{totalRoutes}</div>
                <div className="text-xs text-muted-foreground">Planned Routes</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{totalStops}</div>
                <div className="text-xs text-muted-foreground">Planned Stops</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{totalWorkers}</div>
                <div className="text-xs text-muted-foreground">Available Workers</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{avgUtil}%</div>
                <div className="text-xs text-muted-foreground">Avg Utilization</div>
              </div>
            </div>
            {territoryData.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No capacity data for this date
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default DeliveryCapacityCommand;
