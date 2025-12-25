import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, DollarSign, Eye, ClipboardList, Store, CheckCircle } from "lucide-react";
import { useResolvedData } from '@/hooks/useSimulationData';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import { getSimulationScenario } from '@/lib/simulation/scenarioData';

export default function WeeklyPayoutsPage() {
  const navigate = useNavigate();
  const { simulationMode, scenario } = useSimulationMode();
  const simData = getSimulationScenario(scenario);

  // Filter for biker payouts only
  const simulatedPayouts = simData.payouts
    .filter(p => p.worker_type === 'biker')
    .map(p => ({
      id: p.id,
      biker_id: p.worker_id,
      biker_name: p.worker_name,
      tasks_completed: p.line_items.length * 10, // Simulated task count
      earnings: p.total_earned,
      bonuses: p.adjustments > 0 ? p.adjustments : Math.round(p.total_earned * 0.1),
      deductions: p.debt_withheld,
      total: p.total_to_pay,
      status: p.status,
    }));

  // No real payout data fetch for now (placeholder)
  const { data: resolvedPayouts, isSimulated } = useResolvedData([], simulatedPayouts);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30">Paid</Badge>;
      case 'approved':
        return <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30">Approved</Badge>;
      case 'pending_approval':
        return <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">Pending</Badge>;
      case 'draft':
        return <Badge variant="outline">Draft</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const totalEarnings = resolvedPayouts.reduce((sum: number, p: any) => sum + p.earnings, 0);
  const totalBonuses = resolvedPayouts.reduce((sum: number, p: any) => sum + p.bonuses, 0);
  const totalPayout = resolvedPayouts.reduce((sum: number, p: any) => sum + p.total, 0);

  return (
    <div className="min-h-screen p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/biker/home')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">Weekly Payouts</h1>
            {isSimulated && <SimulationBadge />}
          </div>
          <p className="text-muted-foreground">Biker OS → Weekly Payouts</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-emerald-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Earnings</p>
                <p className="text-2xl font-bold">${totalEarnings.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Bonuses</p>
                <p className="text-2xl font-bold">${totalBonuses.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Payout</p>
                <p className="text-2xl font-bold">${totalPayout.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <div>
                <p className="text-sm text-muted-foreground">Pending Approval</p>
                <p className="text-2xl font-bold">
                  {resolvedPayouts.filter((p: any) => p.status === 'pending_approval').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payouts Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Biker Payouts This Week
          </CardTitle>
        </CardHeader>
        <CardContent>
          {resolvedPayouts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No payouts this week</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Biker Name</TableHead>
                  <TableHead>Tasks Completed</TableHead>
                  <TableHead>Earnings</TableHead>
                  <TableHead>Bonuses / Deductions</TableHead>
                  <TableHead>Payout Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resolvedPayouts.map((payout: any) => (
                  <TableRow 
                    key={payout.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/delivery/bikers/${payout.biker_id}`)}
                  >
                    <TableCell className="font-medium">{payout.biker_name}</TableCell>
                    <TableCell>{payout.tasks_completed}</TableCell>
                    <TableCell className="text-emerald-600 font-medium">${payout.earnings}</TableCell>
                    <TableCell>
                      <span className="text-emerald-500">+${payout.bonuses}</span>
                      {payout.deductions > 0 && (
                        <span className="text-red-500 ml-2">-${payout.deductions}</span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(payout.status)}</TableCell>
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
                          <ClipboardList className="h-4 w-4 mr-1" />
                          Tasks
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            // View store list
                          }}
                        >
                          <Store className="h-4 w-4 mr-1" />
                          Stores
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate('/delivery/payouts');
                          }}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Details
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
