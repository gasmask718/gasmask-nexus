import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Bike, DollarSign } from "lucide-react";
import { useSimulationMode, SimulationBadge } from "@/contexts/SimulationModeContext";
import { SimulationModeToggle, SimulationBanner } from "@/components/delivery/SimulationModeToggle";

export default function BikerPayouts() {
  const { simulationMode, simulationData } = useSimulationMode();

  const { data: dbBikers } = useQuery({
    queryKey: ["biker-payouts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*, driver_payouts(*), driver_rewards(*)")
        .eq("role", "biker")
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  const { data: dbRecentPayouts } = useQuery({
    queryKey: ["recent-biker-payouts"],
    queryFn: async () => {
      const { data: bikerProfiles } = await supabase
        .from("profiles")
        .select("id")
        .eq("role", "biker");

      const bikerIds = bikerProfiles?.map(b => b.id) || [];

      const { data, error } = await supabase
        .from("driver_payouts")
        .select("*, profiles(name)")
        .in("driver_id", bikerIds)
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) throw error;
      return data;
    },
  });

  // Generate simulated bikers with payout data
  const simBikers = useMemo(() => {
    if (!simulationMode || (dbBikers && dbBikers.length > 0)) return [];
    return simulationData.bikers.map(b => ({
      id: b.id,
      name: b.full_name,
      driver_payouts: simulationData.payouts
        .filter(p => p.worker_id === b.id && p.worker_type === 'biker')
        .map(p => ({
          id: p.id,
          amount: p.total_to_pay,
          status: p.status,
        })),
      driver_rewards: [{ total_xp: Math.round(b.performance_score * 10) }],
      is_simulated: true,
    }));
  }, [simulationMode, simulationData, dbBikers]);

  // Generate simulated recent payouts
  const simRecentPayouts = useMemo(() => {
    if (!simulationMode || (dbRecentPayouts && dbRecentPayouts.length > 0)) return [];
    return simulationData.payouts
      .filter(p => p.worker_type === 'biker')
      .map(p => ({
        id: p.id,
        driver_id: p.worker_id,
        date: p.period_end,
        amount: p.total_to_pay,
        status: p.status,
        calculated_breakdown: { visits: p.line_items.length * 5 },
        profiles: { name: p.worker_name },
        is_simulated: true,
      }));
  }, [simulationMode, simulationData, dbRecentPayouts]);

  // Resolve data
  const bikers = (dbBikers && dbBikers.length > 0) ? dbBikers : simBikers;
  const recentPayouts = (dbRecentPayouts && dbRecentPayouts.length > 0) ? dbRecentPayouts : simRecentPayouts;
  const isSimulated = ((!dbBikers || dbBikers.length === 0) && simBikers.length > 0);

  const totalPending = recentPayouts?.filter(p => p.status === "pending" || p.status === "pending_approval").reduce((sum, p) => sum + p.amount, 0) || 0;
  const totalPaid = recentPayouts?.filter(p => p.status === "paid" || p.status === "approved").reduce((sum, p) => sum + p.amount, 0) || 0;

  return (
    <>
      <SimulationBanner />
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Bike className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                  Biker Payouts
                  {isSimulated && <SimulationBadge className="ml-2" />}
                </h1>
                <p className="text-muted-foreground">Delivery commission tracking</p>
              </div>
            </div>
            <SimulationModeToggle />
          </div>

          {/* Summary */}
          <div className="grid md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Pending Payouts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${totalPending.toFixed(2)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Paid This Month</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-500">${totalPaid.toFixed(2)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Active Bikers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{bikers?.length || 0}</div>
              </CardContent>
            </Card>
          </div>

          {/* Biker Earnings */}
          <Card>
            <CardHeader>
              <CardTitle>Biker Earnings Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Biker</TableHead>
                    <TableHead>Total Deliveries</TableHead>
                    <TableHead>Total Earned</TableHead>
                    <TableHead>Pending</TableHead>
                    <TableHead>XP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bikers?.map((biker) => {
                    const totalEarned = biker.driver_payouts?.reduce((sum: number, p: any) => sum + p.amount, 0) || 0;
                    const pending = biker.driver_payouts?.filter((p: any) => p.status === "pending" || p.status === "pending_approval").reduce((sum: number, p: any) => sum + p.amount, 0) || 0;

                    return (
                      <TableRow key={biker.id}>
                        <TableCell className="font-medium">{biker.name}</TableCell>
                        <TableCell>{biker.driver_payouts?.length || 0}</TableCell>
                        <TableCell className="font-bold">${totalEarned.toFixed(2)}</TableCell>
                        <TableCell>${pending.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {biker.driver_rewards?.[0]?.total_xp || 0} XP
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {(!bikers || bikers.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No bikers found. Enable Simulation Mode to see demo data.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Recent Payouts */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Payouts</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Biker</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Deliveries</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentPayouts?.map((payout) => (
                    <TableRow key={payout.id}>
                      <TableCell className="font-medium">{payout.profiles?.name}</TableCell>
                      <TableCell>{new Date(payout.date).toLocaleDateString()}</TableCell>
                      <TableCell className="font-bold">${payout.amount.toFixed(2)}</TableCell>
                      <TableCell>
                        {(payout.calculated_breakdown as any)?.visits || "N/A"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            payout.status === "paid"
                              ? "default"
                              : payout.status === "approved"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {payout.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!recentPayouts || recentPayouts.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No payouts found. Enable Simulation Mode to see demo data.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}