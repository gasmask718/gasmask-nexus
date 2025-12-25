import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Bike, Eye, MapPin, ClipboardList, Route } from "lucide-react";
import { useResolvedData } from '@/hooks/useSimulationData';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import { getSimulationScenario } from '@/lib/simulation/scenarioData';

export default function ActiveBikersPage() {
  const navigate = useNavigate();
  const { simulationMode, scenario } = useSimulationMode();
  const simData = getSimulationScenario(scenario);

  // Fetch real bikers
  const { data: realBikers = [], isLoading } = useQuery({
    queryKey: ['bikers-active-page'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('bikers')
        .select('*')
        .order('full_name');
      if (error) throw error;
      return data;
    }
  });

  const { data: resolvedBikers, isSimulated } = useResolvedData(
    realBikers,
    simData.bikers.map(b => ({
      id: b.id,
      full_name: b.full_name,
      phone: b.phone,
      status: b.status,
      territory: b.territory,
      tasks_today: b.tasks_today,
      tasks_completed: b.tasks_completed,
      performance_score: b.performance_score,
    }))
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30">Active</Badge>;
      case 'on_task':
        return <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30">On Task</Badge>;
      case 'offline':
        return <Badge className="bg-gray-500/20 text-gray-500 border-gray-500/30">Offline</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/biker/home')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">Active Bikers</h1>
            {isSimulated && <SimulationBadge />}
          </div>
          <p className="text-muted-foreground">Biker OS → Active Bikers</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Bike className="h-8 w-8 text-emerald-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Bikers</p>
                <p className="text-2xl font-bold">{resolvedBikers.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold">
                  {resolvedBikers.filter((b: any) => b.status === 'active').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">On Task</p>
                <p className="text-2xl font-bold">
                  {resolvedBikers.filter((b: any) => b.status === 'on_task').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-gray-500" />
              <div>
                <p className="text-sm text-muted-foreground">Offline</p>
                <p className="text-2xl font-bold">
                  {resolvedBikers.filter((b: any) => b.status === 'offline').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bikers Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bike className="h-5 w-5" />
            All Bikers
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && !simulationMode ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : resolvedBikers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No bikers found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Biker Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Area / Borough</TableHead>
                  <TableHead>Tasks Today</TableHead>
                  <TableHead>Performance Score</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resolvedBikers.map((biker: any) => (
                  <TableRow 
                    key={biker.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/delivery/bikers/${biker.id}`)}
                  >
                    <TableCell className="font-medium">{biker.full_name}</TableCell>
                    <TableCell>{getStatusBadge(biker.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        {biker.territory || 'Unassigned'}
                      </div>
                    </TableCell>
                    <TableCell>{biker.tasks_today || 0}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-emerald-500"
                            style={{ width: `${biker.performance_score || 0}%` }}
                          />
                        </div>
                        <span className="text-sm">{biker.performance_score || 0}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/delivery/bikers/${biker.id}`);
                          }}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Profile
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate('/delivery/biker-tasks');
                          }}
                        >
                          <ClipboardList className="h-4 w-4 mr-1" />
                          Tasks
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate('/delivery/biker-tasks');
                          }}
                        >
                          <Route className="h-4 w-4 mr-1" />
                          Assign
                        </Button>
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
