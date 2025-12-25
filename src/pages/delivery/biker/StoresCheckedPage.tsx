import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Store, Eye, Route, FileText, CheckCircle } from "lucide-react";
import { format } from 'date-fns';
import { useResolvedData } from '@/hooks/useSimulationData';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import { getSimulationScenario } from '@/lib/simulation/scenarioData';

// Simulated store checks for today
const SIMULATED_STORE_CHECKS = [
  { id: 'sc-001', store_id: 'sim-store-001', store_name: 'Brooklyn Smoke Shop', address: '123 Flatbush Ave, Brooklyn', biker_name: 'Alex T', time_checked: '09:45 AM', status: 'approved' },
  { id: 'sc-002', store_id: 'sim-store-002', store_name: 'Crown Heights Market', address: '456 Eastern Pkwy, Brooklyn', biker_name: 'Sam K', time_checked: '10:30 AM', status: 'approved' },
  { id: 'sc-003', store_id: 'sim-store-003', store_name: 'Flatbush Convenience', address: '789 Flatbush Ave, Brooklyn', biker_name: 'Jordan L', time_checked: '11:15 AM', status: 'submitted' },
  { id: 'sc-004', store_id: 'sim-store-006', store_name: 'Canarsie Smoke Shop', address: '987 Rockaway Pkwy, Brooklyn', biker_name: 'Chris D', time_checked: '12:00 PM', status: 'approved' },
  { id: 'sc-005', store_id: 'sim-store-007', store_name: 'Harlem Convenience', address: '147 Malcolm X Blvd, Harlem', biker_name: 'Alex T', time_checked: '01:30 PM', status: 'approved' },
  { id: 'sc-006', store_id: 'sim-store-008', store_name: 'Queens Deli', address: '258 Jamaica Ave, Queens', biker_name: 'Sam K', time_checked: '02:15 PM', status: 'submitted' },
  { id: 'sc-007', store_id: 'sim-store-009', store_name: 'Bronx Deli', address: '369 Grand Concourse, Bronx', biker_name: 'Jordan L', time_checked: '03:00 PM', status: 'approved' },
];

export default function StoresCheckedPage() {
  const navigate = useNavigate();
  const { simulationMode, scenario } = useSimulationMode();
  const today = format(new Date(), 'yyyy-MM-dd');

  // Fetch real store checks
  const { data: realChecks = [], isLoading } = useQuery({
    queryKey: ['store-checks-today-page', today],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
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
        id: check.id,
        store_id: check.location_id,
        store_name: check.location?.name || 'Unknown',
        address: check.location ? `${check.location.address_line1}, ${check.location.city}` : '',
        biker_name: check.biker?.full_name || 'Unassigned',
        time_checked: format(new Date(check.created_at), 'hh:mm a'),
        status: check.status,
      }));
    }
  });

  const { data: resolvedChecks, isSimulated } = useResolvedData(realChecks, SIMULATED_STORE_CHECKS);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30">Approved</Badge>;
      case 'submitted':
        return <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30">Submitted</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500/20 text-red-500 border-red-500/30">Rejected</Badge>;
      case 'assigned':
        return <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">Pending</Badge>;
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
            <h1 className="text-3xl font-bold">Stores Checked Today</h1>
            {isSimulated && <SimulationBadge />}
          </div>
          <p className="text-muted-foreground">Biker OS → Stores Checked Today</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Store className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Checked</p>
                <p className="text-2xl font-bold">{resolvedChecks.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-emerald-500" />
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold">
                  {resolvedChecks.filter((c: any) => c.status === 'approved').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Submitted</p>
                <p className="text-2xl font-bold">
                  {resolvedChecks.filter((c: any) => c.status === 'submitted').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div>
                <p className="text-sm text-muted-foreground">Rejected</p>
                <p className="text-2xl font-bold">
                  {resolvedChecks.filter((c: any) => c.status === 'rejected').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Store Checks Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            Today's Store Checks
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && !simulationMode ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : resolvedChecks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No store checks today</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store Name</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Biker Assigned</TableHead>
                  <TableHead>Time Checked</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resolvedChecks.map((check: any) => (
                  <TableRow 
                    key={check.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/delivery/store/${check.store_id}`)}
                  >
                    <TableCell className="font-medium">{check.store_name}</TableCell>
                    <TableCell className="text-muted-foreground">{check.address}</TableCell>
                    <TableCell>{check.biker_name}</TableCell>
                    <TableCell>{check.time_checked}</TableCell>
                    <TableCell>{getStatusBadge(check.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/delivery/store/${check.store_id}`);
                          }}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Store
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate('/delivery/biker-tasks');
                          }}
                        >
                          <Route className="h-4 w-4 mr-1" />
                          Route
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            // View proof/notes
                          }}
                        >
                          <FileText className="h-4 w-4 mr-1" />
                          Notes
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
