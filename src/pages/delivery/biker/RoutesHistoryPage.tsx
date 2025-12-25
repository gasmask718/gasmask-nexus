import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, History, Eye, Store, AlertTriangle, Calendar } from "lucide-react";
import { format, subDays } from 'date-fns';
import { useResolvedData } from '@/hooks/useSimulationData';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';

// Simulated past routes
const SIMULATED_PAST_ROUTES = [
  {
    id: 'BK-RT-H001',
    date: format(subDays(new Date(), 1), 'yyyy-MM-dd'),
    area: 'Brooklyn',
    biker_name: 'Alex T',
    stores_completed: 8,
    issues_count: 1,
  },
  {
    id: 'BK-RT-H002',
    date: format(subDays(new Date(), 1), 'yyyy-MM-dd'),
    area: 'Queens',
    biker_name: 'Sam K',
    stores_completed: 6,
    issues_count: 0,
  },
  {
    id: 'BK-RT-H003',
    date: format(subDays(new Date(), 2), 'yyyy-MM-dd'),
    area: 'Bronx',
    biker_name: 'Jordan L',
    stores_completed: 5,
    issues_count: 2,
  },
  {
    id: 'BK-RT-H004',
    date: format(subDays(new Date(), 2), 'yyyy-MM-dd'),
    area: 'Harlem',
    biker_name: 'Chris D',
    stores_completed: 7,
    issues_count: 0,
  },
  {
    id: 'BK-RT-H005',
    date: format(subDays(new Date(), 3), 'yyyy-MM-dd'),
    area: 'Brooklyn',
    biker_name: 'Alex T',
    stores_completed: 9,
    issues_count: 1,
  },
  {
    id: 'BK-RT-H006',
    date: format(subDays(new Date(), 3), 'yyyy-MM-dd'),
    area: 'Manhattan',
    biker_name: 'Mike R',
    stores_completed: 4,
    issues_count: 0,
  },
  {
    id: 'BK-RT-H007',
    date: format(subDays(new Date(), 4), 'yyyy-MM-dd'),
    area: 'Queens',
    biker_name: 'Sam K',
    stores_completed: 7,
    issues_count: 1,
  },
  {
    id: 'BK-RT-H008',
    date: format(subDays(new Date(), 5), 'yyyy-MM-dd'),
    area: 'Brooklyn',
    biker_name: 'Jordan L',
    stores_completed: 6,
    issues_count: 0,
  },
  {
    id: 'BK-RT-H009',
    date: format(subDays(new Date(), 6), 'yyyy-MM-dd'),
    area: 'Bronx',
    biker_name: 'Chris D',
    stores_completed: 5,
    issues_count: 2,
  },
  {
    id: 'BK-RT-H010',
    date: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
    area: 'Harlem',
    biker_name: 'Alex T',
    stores_completed: 8,
    issues_count: 1,
  },
];

export default function RoutesHistoryPage() {
  const navigate = useNavigate();
  const { simulationMode, scenario } = useSimulationMode();

  // No real routes history fetch for now (placeholder)
  const { data: resolvedRoutes, isSimulated } = useResolvedData([], SIMULATED_PAST_ROUTES);

  const totalStores = resolvedRoutes.reduce((sum: number, r: any) => sum + r.stores_completed, 0);
  const totalIssues = resolvedRoutes.reduce((sum: number, r: any) => sum + r.issues_count, 0);

  return (
    <div className="min-h-screen p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/biker/home')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">Routes History</h1>
            {isSimulated && <SimulationBadge />}
          </div>
          <p className="text-muted-foreground">Biker OS → Routes History</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <History className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Past Routes</p>
                <p className="text-2xl font-bold">{resolvedRoutes.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Store className="h-8 w-8 text-emerald-500" />
              <div>
                <p className="text-sm text-muted-foreground">Stores Visited</p>
                <p className="text-2xl font-bold">{totalStores}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-amber-500" />
              <div>
                <p className="text-sm text-muted-foreground">Issues Reported</p>
                <p className="text-2xl font-bold">{totalIssues}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Days Covered</p>
                <p className="text-2xl font-bold">7</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Routes History Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Past Routes (Last 7 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {resolvedRoutes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No past routes found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Route ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Area</TableHead>
                  <TableHead>Biker Assigned</TableHead>
                  <TableHead>Stores Completed</TableHead>
                  <TableHead>Issues</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resolvedRoutes.map((route: any) => (
                  <TableRow 
                    key={route.id} 
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell className="font-medium">{route.id}</TableCell>
                    <TableCell>{format(new Date(route.date), 'MMM d, yyyy')}</TableCell>
                    <TableCell>{route.area}</TableCell>
                    <TableCell>{route.biker_name}</TableCell>
                    <TableCell>
                      <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30">
                        {route.stores_completed} stores
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {route.issues_count > 0 ? (
                        <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">
                          {route.issues_count} issues
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate('/delivery/biker-tasks');
                          }}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Route
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            // View stores
                          }}
                        >
                          <Store className="h-4 w-4 mr-1" />
                          Stores
                        </Button>
                        {route.issues_count > 0 && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate('/delivery/bikers/issues');
                            }}
                          >
                            <AlertTriangle className="h-4 w-4 mr-1" />
                            Issues
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
