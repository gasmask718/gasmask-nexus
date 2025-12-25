import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, AlertTriangle, Eye, Store, UserPlus, ArrowUpRight } from "lucide-react";
import { format } from 'date-fns';
import { useResolvedData } from '@/hooks/useSimulationData';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import { getSimulationScenario } from '@/lib/simulation/scenarioData';
import { useBikerIssues } from '@/hooks/useBikerIssues';

export default function BikerIssuesPage() {
  const navigate = useNavigate();
  const { simulationMode, scenario } = useSimulationMode();
  const simData = getSimulationScenario(scenario);

  // Fetch real issues
  const { data: realIssues = [], isLoading } = useBikerIssues();

  const simulatedIssues = simData.issues.map(issue => ({
    id: issue.id,
    store_id: issue.store_id,
    store_name: issue.store_name,
    issue_type: issue.issue_type,
    severity: issue.severity,
    biker_name: issue.reported_by,
    status: issue.status,
    reported_at: issue.reported_at,
    description: issue.description,
  }));

  const { data: resolvedIssues, isSimulated } = useResolvedData(
    realIssues.map((i: any) => ({
      id: i.id,
      store_id: i.location_id,
      store_name: i.location_name || 'Unknown',
      issue_type: i.issue_type,
      severity: i.severity,
      biker_name: i.reporter_name || 'Unknown',
      status: i.status,
      reported_at: new Date(i.reported_at),
      description: i.description,
    })),
    simulatedIssues
  );

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <Badge className="bg-red-600 text-white">Critical</Badge>;
      case 'high':
        return <Badge className="bg-red-500/20 text-red-500 border-red-500/30">High</Badge>;
      case 'medium':
        return <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">Medium</Badge>;
      case 'low':
        return <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30">Low</Badge>;
      default:
        return <Badge variant="outline">{severity}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <Badge variant="outline">Open</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30">In Progress</Badge>;
      case 'resolved':
        return <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30">Resolved</Badge>;
      case 'escalated':
        return <Badge className="bg-purple-500/20 text-purple-500 border-purple-500/30">Escalated</Badge>;
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
            <h1 className="text-3xl font-bold">Issues Reported</h1>
            {isSimulated && <SimulationBadge />}
          </div>
          <p className="text-muted-foreground">Biker OS → Issues Reported</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-amber-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Issues</p>
                <p className="text-2xl font-bold">{resolvedIssues.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div>
                <p className="text-sm text-muted-foreground">High/Critical</p>
                <p className="text-2xl font-bold">
                  {resolvedIssues.filter((i: any) => i.severity === 'high' || i.severity === 'critical').length}
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
                <p className="text-sm text-muted-foreground">Open</p>
                <p className="text-2xl font-bold">
                  {resolvedIssues.filter((i: any) => i.status === 'open').length}
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
                <p className="text-sm text-muted-foreground">Resolved</p>
                <p className="text-2xl font-bold">
                  {resolvedIssues.filter((i: any) => i.status === 'resolved').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Issues Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            All Reported Issues
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && !simulationMode ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : resolvedIssues.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No issues reported</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store Name</TableHead>
                  <TableHead>Issue Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Assigned Biker</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resolvedIssues.map((issue: any) => (
                  <TableRow 
                    key={issue.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/delivery/issues/${issue.id}`)}
                  >
                    <TableCell className="font-medium">{issue.store_name}</TableCell>
                    <TableCell>{issue.issue_type}</TableCell>
                    <TableCell>{getSeverityBadge(issue.severity)}</TableCell>
                    <TableCell>{issue.biker_name}</TableCell>
                    <TableCell>{getStatusBadge(issue.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/delivery/issues/${issue.id}`);
                          }}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Details
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/delivery/store/${issue.store_id}`);
                          }}
                        >
                          <Store className="h-4 w-4 mr-1" />
                          Store
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Assign/Escalate logic
                          }}
                        >
                          <ArrowUpRight className="h-4 w-4 mr-1" />
                          Escalate
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
