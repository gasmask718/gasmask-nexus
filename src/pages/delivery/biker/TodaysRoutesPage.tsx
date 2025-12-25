import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ArrowLeft, Route, Eye, MapPin, ChevronDown, ChevronRight, Store } from "lucide-react";
import { useResolvedData } from '@/hooks/useSimulationData';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import { getSimulationScenario } from '@/lib/simulation/scenarioData';

// Simulated biker routes (different from driver routes)
const SIMULATED_BIKER_ROUTES = [
  {
    id: 'BK-RT-001',
    area: 'Brooklyn',
    biker_name: 'Alex T',
    stores_count: 6,
    status: 'in_progress',
    stores: [
      { id: 'sim-store-001', name: 'Brooklyn Smoke Shop', address: '123 Flatbush Ave', status: 'checked' },
      { id: 'sim-store-002', name: 'Crown Heights Market', address: '456 Eastern Pkwy', status: 'checked' },
      { id: 'sim-store-003', name: 'Flatbush Convenience', address: '789 Flatbush Ave', status: 'pending' },
      { id: 'sim-store-004', name: 'Parkside Deli', address: '321 Ocean Ave', status: 'pending' },
      { id: 'sim-store-005', name: 'Kings Plaza Kiosk', address: '654 Kings Plaza', status: 'pending' },
      { id: 'sim-store-006', name: 'Canarsie Smoke Shop', address: '987 Rockaway Pkwy', status: 'pending' },
    ],
  },
  {
    id: 'BK-RT-002',
    area: 'Queens',
    biker_name: 'Sam K',
    stores_count: 4,
    status: 'scheduled',
    stores: [
      { id: 'sim-store-008', name: 'Queens Deli', address: '258 Jamaica Ave', status: 'pending' },
      { id: 'sim-store-010', name: 'Queens Smoke Shop', address: '481 Northern Blvd', status: 'pending' },
      { id: 'sim-store-011', name: 'Astoria Market', address: '147 Steinway St', status: 'pending' },
      { id: 'sim-store-012', name: 'Flushing Convenience', address: '369 Main St', status: 'pending' },
    ],
  },
  {
    id: 'BK-RT-003',
    area: 'Bronx',
    biker_name: 'Jordan L',
    stores_count: 3,
    status: 'completed',
    stores: [
      { id: 'sim-store-009', name: 'Bronx Deli', address: '369 Grand Concourse', status: 'checked' },
      { id: 'sim-store-013', name: 'Fordham Smoke Shop', address: '741 Fordham Rd', status: 'checked' },
      { id: 'sim-store-014', name: 'Hunts Point Market', address: '852 Southern Blvd', status: 'checked' },
    ],
  },
  {
    id: 'BK-RT-004',
    area: 'Harlem',
    biker_name: 'Chris D',
    stores_count: 5,
    status: 'in_progress',
    stores: [
      { id: 'sim-store-007', name: 'Harlem Convenience', address: '147 Malcolm X Blvd', status: 'checked' },
      { id: 'sim-store-015', name: 'Lenox Market', address: '258 Lenox Ave', status: 'checked' },
      { id: 'sim-store-016', name: 'Washington Heights Deli', address: '369 St Nicholas Ave', status: 'pending' },
      { id: 'sim-store-017', name: 'Inwood Smoke Shop', address: '481 Dyckman St', status: 'pending' },
      { id: 'sim-store-018', name: 'Hamilton Heights Store', address: '159 W 145th St', status: 'pending' },
    ],
  },
];

export default function TodaysRoutesPage() {
  const navigate = useNavigate();
  const { simulationMode, scenario } = useSimulationMode();
  const [expandedRoutes, setExpandedRoutes] = useState<string[]>([]);

  // No real biker routes fetch for now (placeholder)
  const { data: resolvedRoutes, isSimulated } = useResolvedData([], SIMULATED_BIKER_ROUTES);

  const toggleExpand = (routeId: string) => {
    setExpandedRoutes(prev => 
      prev.includes(routeId) 
        ? prev.filter(id => id !== routeId)
        : [...prev, routeId]
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30">Completed</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30">In Progress</Badge>;
      case 'scheduled':
        return <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">Scheduled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getCheckStatusBadge = (status: string) => {
    return status === 'checked' 
      ? <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30 text-xs">Checked</Badge>
      : <Badge variant="outline" className="text-xs">Pending</Badge>;
  };

  const totalStores = resolvedRoutes.reduce((sum: number, r: any) => sum + r.stores_count, 0);
  const completedRoutes = resolvedRoutes.filter((r: any) => r.status === 'completed').length;

  return (
    <div className="min-h-screen p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/biker/home')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">Today's Routes</h1>
            {isSimulated && <SimulationBadge />}
          </div>
          <p className="text-muted-foreground">Biker OS → Today's Routes</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Route className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Routes</p>
                <p className="text-2xl font-bold">{resolvedRoutes.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Store className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Stores</p>
                <p className="text-2xl font-bold">{totalStores}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold">
                  {resolvedRoutes.filter((r: any) => r.status === 'in_progress').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">{completedRoutes}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Routes List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Route className="h-5 w-5" />
            All Routes Today
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {resolvedRoutes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No routes today</div>
          ) : (
            resolvedRoutes.map((route: any) => (
              <Collapsible 
                key={route.id}
                open={expandedRoutes.includes(route.id)}
                onOpenChange={() => toggleExpand(route.id)}
              >
                <div className="border rounded-lg overflow-hidden">
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-4">
                        {expandedRoutes.includes(route.id) ? (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        )}
                        <div>
                          <p className="font-medium">{route.id}</p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {route.area}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm">{route.biker_name}</p>
                          <p className="text-xs text-muted-foreground">{route.stores_count} stores</p>
                        </div>
                        {getStatusBadge(route.status)}
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate('/delivery/biker-tasks');
                          }}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Details
                        </Button>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border-t bg-muted/20">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Store Name</TableHead>
                            <TableHead>Address</TableHead>
                            <TableHead>Check Status</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {route.stores.map((store: any) => (
                            <TableRow 
                              key={store.id}
                              className="cursor-pointer hover:bg-muted/30"
                              onClick={() => navigate(`/delivery/store/${store.id}`)}
                            >
                              <TableCell className="font-medium">{store.name}</TableCell>
                              <TableCell className="text-muted-foreground">{store.address}</TableCell>
                              <TableCell>{getCheckStatusBadge(store.status)}</TableCell>
                              <TableCell className="text-right">
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/delivery/store/${store.id}`);
                                  }}
                                >
                                  <Eye className="h-4 w-4 mr-1" />
                                  View
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
