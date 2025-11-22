import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, Calendar, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export default function Payroll() {
  const [selectedPeriod, setSelectedPeriod] = useState("week");

  const { data: payouts, refetch } = useQuery({
    queryKey: ["driver-payouts", selectedPeriod],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_payouts")
        .select("*, profiles!driver_payouts_driver_id_fkey(name)")
        .order("date", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
  });

  const generatePayrollMutation = useMutation({
    mutationFn: async () => {
      // Get all drivers
      const { data: drivers } = await supabase
        .from("profiles")
        .select("id, name")
        .eq("role", "driver");

      if (!drivers) throw new Error("No drivers found");

      const today = new Date().toISOString().split("T")[0];

      // Calculate payouts for each driver
      const payoutPromises = drivers.map(async (driver) => {
        // Get checkins for the week
        const { data: checkins } = await supabase
          .from("route_checkins")
          .select("*")
          .eq("driver_id", driver.id)
          .gte("checkin_time", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

        const basePayPerVisit = 25;
        const photoBonus = 5;
        const visits = checkins?.length || 0;
        const withPhotos = checkins?.filter((c) => c.photos?.length > 0).length || 0;

        const amount = visits * basePayPerVisit + withPhotos * photoBonus;

        return supabase.from("driver_payouts").insert({
          driver_id: driver.id,
          amount,
          date: today,
          calculated_breakdown: {
            visits,
            withPhotos,
            basePayPerVisit,
            photoBonus,
          },
        });
      });

      await Promise.all(payoutPromises);
    },
    onSuccess: () => {
      toast.success("Payroll generated successfully");
      refetch();
    },
    onError: (error: Error) => {
      toast.error("Failed to generate payroll", { description: error.message });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("driver_payouts")
        .update({ status })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status updated");
      refetch();
    },
  });

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Driver Payroll</h1>
              <p className="text-muted-foreground">Automated earnings & payouts</p>
            </div>
          </div>
          <Button onClick={() => generatePayrollMutation.mutate()} disabled={generatePayrollMutation.isPending}>
            <Calendar className="mr-2 h-4 w-4" />
            Generate Weekly Payroll
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Payouts</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Driver</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Visits</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts?.map((payout) => (
                  <TableRow key={payout.id}>
                    <TableCell className="font-medium">{payout.profiles?.name}</TableCell>
                    <TableCell>{new Date(payout.date).toLocaleDateString()}</TableCell>
                    <TableCell className="font-bold">${payout.amount}</TableCell>
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
                    <TableCell>
                      <Select
                        value={payout.status}
                        onValueChange={(status) =>
                          updateStatusMutation.mutate({ id: payout.id, status })
                        }
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="approved">Approved</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                        </SelectContent>
                      </Select>
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
