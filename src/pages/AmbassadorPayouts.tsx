import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users } from "lucide-react";

export default function AmbassadorPayouts() {
  const { data: ambassadors } = useQuery({
    queryKey: ["ambassador-earnings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ambassadors")
        .select("*, profiles(name), commission_ledger(commission_amount, status)")
        .order("total_earnings", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: commissions } = useQuery({
    queryKey: ["ambassador-commissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commission_ledger")
        .select("*, ambassadors(*, profiles(name))")
        .neq("status", "reversed")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
  });

  const totalPending = commissions?.filter(c => c.status === "pending").reduce((sum, c) => sum + Number(c.commission_amount || 0), 0) || 0;
  const totalPaid = commissions?.filter(c => c.status === "paid").reduce((sum, c) => sum + Number(c.commission_amount || 0), 0) || 0;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Users className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Ambassador Payouts</h1>
            <p className="text-muted-foreground">Commission tracking and payments</p>
          </div>
        </div>

        {/* Summary */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Total Pending</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">${totalPending.toFixed(2)}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Total Paid</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-green-500">${totalPaid.toFixed(2)}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Active Ambassadors</CardTitle></CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{ambassadors?.filter(a => a.is_active).length || 0}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Ambassador Earnings</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ambassador</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Total Earnings</TableHead>
                  <TableHead>Pending</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ambassadors?.map((amb: any) => {
                  const pending = amb.commission_ledger
                    ?.filter((c: any) => c.status === "pending")
                    .reduce((sum: number, c: any) => sum + Number(c.commission_amount || 0), 0) || 0;
                  return (
                    <TableRow key={amb.id}>
                      <TableCell className="font-medium">{amb.profiles?.name}</TableCell>
                      <TableCell><Badge variant="outline">{amb.tier}</Badge></TableCell>
                      <TableCell className="font-bold">${Number(amb.total_earnings || 0).toFixed(2)}</TableCell>
                      <TableCell>${pending.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant={amb.is_active ? "default" : "secondary"}>
                          {amb.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent Commissions</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ambassador</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commissions?.map((comm: any) => (
                  <TableRow key={comm.id}>
                    <TableCell className="font-medium">{comm.ambassadors?.profiles?.name}</TableCell>
                    <TableCell><Badge variant="outline">{comm.source_channel}</Badge></TableCell>
                    <TableCell className="font-bold">${Number(comm.commission_amount || 0).toFixed(2)}</TableCell>
                    <TableCell>{new Date(comm.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant={comm.status === "paid" ? "default" : "secondary"}>{comm.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
