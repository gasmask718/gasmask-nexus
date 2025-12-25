import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { 
  Bike, MapPin, Store, DollarSign, AlertTriangle, Route, 
  Plus, RefreshCw, Eye, ClipboardCheck, ChevronRight
} from "lucide-react";
import { format } from 'date-fns';
import { 
  BikerAssignmentDialog, 
  BikerOSMap, 
  ActiveBikersTable, 
  TodaysRoutesTable, 
  IssuesPanel 
} from '@/components/biker';
import { toast } from 'sonner';

export default function BikerDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [assignmentContext, setAssignmentContext] = useState<{
    entityType: 'store' | 'route' | 'issue';
    entityId?: string;
    entityName?: string;
  } | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<any>(null);

  // Fetch bikers
  const { data: bikers = [], isLoading: bikersLoading } = useQuery({
    queryKey: ['bikers-os'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bikers')
        .select('*')
        .order('full_name');
      if (error) throw error;
      return data;
    }
  });

  // Fetch today's store checks
  const today = format(new Date(), 'yyyy-MM-dd');
  const { data: todayChecks = [], isLoading: checksLoading } = useQuery({
    queryKey: ['store-checks-today', today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_checks')
        .select(`
          *,
          location:locations(id, name, address_line1, city),
          biker:bikers(id, full_name)
        `)
        .eq('scheduled_date', today)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data.map((check: any) => ({
        ...check,
        location_name: check.location?.name || 'Unknown',
        location_address: check.location ? `${check.location.address_line1}, ${check.location.city}` : '',
        biker_name: check.biker?.full_name
      }));
    }
  });

  // Fetch locations for map
  const { data: locations = [] } = useQuery({
    queryKey: ['locations-map'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('id, name, address_line1, city, lat, lng, location_type')
        .not('lat', 'is', null)
        .not('lng', 'is', null)
        .limit(100);
      if (error) throw error;
      return data;
    }
  });

  // Calculate stats
  const activeBikers = bikers.filter(b => b.status === 'active');
  const completedChecks = todayChecks.filter(c => c.status === 'approved' || c.status === 'submitted').length;
  const pendingChecks = todayChecks.filter(c => c.status === 'assigned' || c.status === 'in_progress').length;

  // Mock issues (would come from store_checks with issues or dedicated issues table)
  const issues = todayChecks
    .filter(c => c.status === 'rejected' || c.summary_notes?.toLowerCase().includes('issue'))
    .map((c: any, i: number) => ({
      id: c.id,
      store_id: c.location_id,
      store_name: c.location_name,
      issue_type: 'Check Rejected',
      severity: i === 0 ? 'high' : 'medium' as 'high' | 'medium' | 'low',
      reported_by: c.biker_name || 'Unknown',
      reported_at: format(new Date(c.created_at), 'MMM d, h:mm a'),
      status: 'open',
      description: c.summary_notes
    }));

  // Map data
  const bikerLocations = activeBikers.map(b => ({
    id: b.id,
    name: b.full_name,
    territory: b.territory || 'Unassigned',
    status: b.status,
    lat: 40.73 + (Math.random() * 0.1 - 0.05), // Demo coords
    lng: -73.93 + (Math.random() * 0.1 - 0.05),
    tasksToday: todayChecks.filter((c: any) => c.assigned_biker_id === b.id).length
  }));

  const storeLocations = locations.map((loc: any) => ({
    id: loc.id,
    name: loc.name,
    address: `${loc.address_line1}, ${loc.city}`,
    status: todayChecks.some((c: any) => c.location_id === loc.id && c.status === 'rejected') 
      ? 'issue' 
      : todayChecks.some((c: any) => c.location_id === loc.id) 
        ? 'active' 
        : 'needs_check',
    lat: loc.lat,
    lng: loc.lng,
    lastCheck: todayChecks.find((c: any) => c.location_id === loc.id)?.scheduled_date
  }));

  const stats = [
    { 
      label: "Active Bikers", 
      value: activeBikers.length.toString(), 
      icon: Bike, 
      change: `${bikers.filter(b => b.status !== 'active').length} offline`, 
      color: "text-emerald-500",
      onClick: () => setActiveTab('bikers')
    },
    { 
      label: "Stores Checked Today", 
      value: completedChecks.toString(), 
      icon: Store, 
      change: `${pendingChecks} pending`, 
      color: "text-blue-500",
      onClick: () => setActiveTab('routes')
    },
    { 
      label: "Issues Reported", 
      value: issues.length.toString(), 
      icon: AlertTriangle, 
      change: issues.filter(i => i.severity === 'high').length + " urgent", 
      color: "text-amber-500",
      onClick: () => setActiveTab('issues')
    },
    { 
      label: "Weekly Payouts", 
      value: "$4,280", 
      icon: DollarSign, 
      change: "Due Friday", 
      color: "text-purple-500",
      onClick: () => navigate('/delivery/payouts')
    },
  ];

  const handleAssignBiker = (entityType: 'store' | 'route' | 'issue', entityId: string, entityName: string) => {
    setAssignmentContext({ entityType, entityId, entityName });
    setShowAssignDialog(true);
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['bikers-os'] });
    queryClient.invalidateQueries({ queryKey: ['store-checks-today'] });
    queryClient.invalidateQueries({ queryKey: ['locations-map'] });
    toast.success('Data refreshed');
  };

  return (
    <div className="min-h-screen p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-500 bg-clip-text text-transparent">
            Biker OS Command Center
          </h1>
          <p className="text-muted-foreground mt-1">Field Operations, Store Checks & Inventory Verification</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={() => setActiveTab('map')}>
            <MapPin className="h-4 w-4 mr-2" />
            Live Map
          </Button>
          <Button 
            className="bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600"
            onClick={() => navigate('/delivery/biker-tasks')}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Store Check
          </Button>
        </div>
      </div>

      {/* Stats Grid - All Clickable */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Card 
            key={i} 
            className="border-border/50 bg-gradient-to-br from-background to-muted/20 cursor-pointer hover:shadow-lg transition-shadow"
            onClick={stat.onClick}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-3xl font-bold mt-1">{stat.value}</p>
                  <p className="text-xs text-emerald-500 mt-1">{stat.change}</p>
                </div>
                <div className={`p-3 rounded-xl bg-muted/50 ${stat.color}`}>
                  <stat.icon className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="map">Live Map</TabsTrigger>
          <TabsTrigger value="bikers">Active Bikers</TabsTrigger>
          <TabsTrigger value="routes">Today's Routes</TabsTrigger>
          <TabsTrigger value="issues">Issues</TabsTrigger>
          <TabsTrigger value="payouts">Payouts</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quick Map Preview */}
            <Card className="overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-blue-500" />
                  Live Map Preview
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setActiveTab('map')}>
                  Full Map <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="h-[300px] relative">
                  <BikerOSMap
                    bikers={bikerLocations.slice(0, 5)}
                    stores={storeLocations.slice(0, 10)}
                    onBikerClick={(id) => navigate(`/delivery/bikers/${id}`)}
                    onStoreClick={(id) => navigate(`/delivery/store/${id}`)}
                    onAssignBiker={(id, name) => handleAssignBiker('store', id, name)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Quick Issues */}
            <IssuesPanel
              issues={issues.slice(0, 3)}
              isLoading={checksLoading}
              onViewDetails={(issue) => setSelectedIssue(issue)}
              onAssignBiker={(storeId, storeName) => handleAssignBiker('store', storeId, storeName)}
              onEscalate={(issueId) => toast.info('Issue escalated to supervisor')}
            />
          </div>

          {/* Active Bikers Preview */}
          <ActiveBikersTable
            bikers={activeBikers.slice(0, 5).map(b => ({
              ...b,
              tasksToday: todayChecks.filter((c: any) => c.assigned_biker_id === b.id).length,
              completedToday: todayChecks.filter((c: any) => c.assigned_biker_id === b.id && c.status === 'approved').length
            }))}
            isLoading={bikersLoading}
            onAssignRoute={(bikerId, bikerName) => {
              navigate('/delivery/biker-tasks');
            }}
          />

          {/* Today's Routes Preview */}
          <TodaysRoutesTable
            checks={todayChecks.slice(0, 5)}
            isLoading={checksLoading}
            onViewDetails={(checkId) => navigate(`/delivery/biker-tasks`)}
            onAssignBiker={(checkId, locationName) => handleAssignBiker('issue', checkId, locationName)}
          />
        </TabsContent>

        {/* Full Map Tab */}
        <TabsContent value="map" className="h-[600px]">
          <Card className="h-full overflow-hidden">
            <CardContent className="p-0 h-full relative">
              <BikerOSMap
                bikers={bikerLocations}
                stores={storeLocations}
                onBikerClick={(id) => navigate(`/delivery/bikers/${id}`)}
                onStoreClick={(id) => navigate(`/delivery/store/${id}`)}
                onAssignBiker={(id, name) => handleAssignBiker('store', id, name)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Active Bikers Tab */}
        <TabsContent value="bikers">
          <ActiveBikersTable
            bikers={bikers.map(b => ({
              ...b,
              tasksToday: todayChecks.filter((c: any) => c.assigned_biker_id === b.id).length,
              completedToday: todayChecks.filter((c: any) => c.assigned_biker_id === b.id && c.status === 'approved').length
            }))}
            isLoading={bikersLoading}
            onAssignRoute={(bikerId, bikerName) => {
              navigate('/delivery/biker-tasks');
            }}
          />
        </TabsContent>

        {/* Today's Routes Tab */}
        <TabsContent value="routes">
          <TodaysRoutesTable
            checks={todayChecks}
            isLoading={checksLoading}
            onViewDetails={(checkId) => navigate(`/delivery/biker-tasks`)}
            onAssignBiker={(checkId, locationName) => handleAssignBiker('issue', checkId, locationName)}
          />
        </TabsContent>

        {/* Issues Tab */}
        <TabsContent value="issues">
          <IssuesPanel
            issues={issues}
            isLoading={checksLoading}
            onViewDetails={(issue) => setSelectedIssue(issue)}
            onAssignBiker={(storeId, storeName) => handleAssignBiker('store', storeId, storeName)}
            onEscalate={(issueId) => toast.info('Issue escalated to supervisor')}
          />
        </TabsContent>

        {/* Payouts Tab */}
        <TabsContent value="payouts">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="border-border/50">
              <CardContent className="p-6 text-center">
                <DollarSign className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Total This Week</p>
                <p className="text-3xl font-bold">$4,280</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-6 text-center">
                <ClipboardCheck className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Checks Completed</p>
                <p className="text-3xl font-bold">{completedChecks}</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-6 text-center">
                <Bike className="h-8 w-8 text-purple-500 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Avg Per Biker</p>
                <p className="text-3xl font-bold">${activeBikers.length > 0 ? Math.round(4280 / activeBikers.length) : 0}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Weekly Payout Summary</CardTitle>
              <Button onClick={() => navigate('/delivery/payouts')}>
                Manage Payouts <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {bikers.slice(0, 5).map((biker, i) => {
                  const checks = todayChecks.filter((c: any) => c.assigned_biker_id === biker.id).length * 7;
                  const rate = 0.75;
                  const bonus = checks > 100 ? 15 : checks > 80 ? 10 : checks > 60 ? 5 : 0;
                  const total = (checks * rate) + bonus;
                  return (
                    <div 
                      key={biker.id} 
                      className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/delivery/bikers/${biker.id}`)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white font-bold">
                          {biker.full_name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium">{biker.full_name}</p>
                          <p className="text-sm text-muted-foreground">{checks} checks @ ${rate}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-emerald-600">${total.toFixed(2)}</p>
                        {bonus > 0 && (
                          <p className="text-xs text-amber-500">+${bonus} bonus</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Assignment Dialog */}
      {assignmentContext && (
        <BikerAssignmentDialog
          open={showAssignDialog}
          onOpenChange={setShowAssignDialog}
          entityType={assignmentContext.entityType}
          entityId={assignmentContext.entityId}
          entityName={assignmentContext.entityName}
          onAssigned={() => {
            queryClient.invalidateQueries({ queryKey: ['store-checks-today'] });
          }}
        />
      )}

      {/* Issue Details Sheet */}
      <Sheet open={!!selectedIssue} onOpenChange={() => setSelectedIssue(null)}>
        <SheetContent side="right" className="w-[500px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Issue Details
            </SheetTitle>
          </SheetHeader>
          {selectedIssue && (
            <div className="mt-6 space-y-6">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Store</p>
                  <p className="font-medium text-lg">{selectedIssue.store_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Issue Type</p>
                  <p className="font-medium">{selectedIssue.issue_type}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Severity</p>
                  <Badge variant="outline" className={`capitalize ${
                    selectedIssue.severity === 'high' ? 'bg-red-500/10 text-red-600' :
                    selectedIssue.severity === 'medium' ? 'bg-amber-500/10 text-amber-600' :
                    'bg-emerald-500/10 text-emerald-600'
                  }`}>
                    {selectedIssue.severity}
                  </Badge>
                </div>
                {selectedIssue.description && (
                  <div>
                    <p className="text-sm text-muted-foreground">Description</p>
                    <p className="text-sm">{selectedIssue.description}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Reported By</p>
                  <p className="font-medium">{selectedIssue.reported_by}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Reported At</p>
                  <p className="font-medium">{selectedIssue.reported_at}</p>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-4 border-t">
                <Button onClick={() => navigate(`/delivery/store/${selectedIssue.store_id}`)}>
                  <Eye className="h-4 w-4 mr-2" />
                  View Store Profile
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => {
                    handleAssignBiker('store', selectedIssue.store_id, selectedIssue.store_name);
                    setSelectedIssue(null);
                  }}
                >
                  <Bike className="h-4 w-4 mr-2" />
                  Assign Biker
                </Button>
                <Button variant="outline" onClick={() => navigate('/delivery/biker-tasks')}>
                  <Route className="h-4 w-4 mr-2" />
                  Attach to Route
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
