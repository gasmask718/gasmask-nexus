import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { 
  Truck, Phone, MessageSquare, DollarSign, MapPin, Send, 
  CheckCircle, Clock, Route, Users, AlertTriangle 
} from "lucide-react";
import { format } from "date-fns";
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import { SimulationModeToggle, SimulationBanner } from '@/components/delivery/SimulationModeToggle';

const TOBACCO_BRANDS = ["gasmask", "hotmama", "hotscolati", "grabba_r_us"];

const typeLabels: Record<string, string> = {
  store: "Store",
  wholesaler: "Wholesaler",
  direct_customer: "Direct Customer",
};

// FORCED SIMULATION DATA for debt collection
const SIMULATED_DEBTS = [
  {
    id: 'sim-debt-1',
    driver_name: 'Mike R',
    type: 'Fuel Advance',
    amount: 120,
    status: 'outstanding',
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    company: { name: 'Brooklyn Smoke Shop', type: 'store', default_city: 'Brooklyn', default_state: 'NY', default_phone: '(718) 555-0101', neighborhood: 'Crown Heights' }
  },
  {
    id: 'sim-debt-2',
    driver_name: 'Sam K',
    type: 'Vehicle Damage',
    amount: 300,
    status: 'in_collection',
    created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
    company: { name: 'Queens Tobacco Outlet', type: 'wholesaler', default_city: 'Queens', default_state: 'NY', default_phone: '(718) 555-0202', neighborhood: 'Jamaica' }
  },
  {
    id: 'sim-debt-3',
    driver_name: 'Alex T',
    type: 'Cash Advance',
    amount: 120,
    status: 'settled',
    created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
    company: { name: 'Bronx Quick Stop', type: 'store', default_city: 'Bronx', default_state: 'NY', default_phone: '(718) 555-0303', neighborhood: 'Fordham' }
  },
  {
    id: 'sim-debt-4',
    driver_name: 'Jordan P',
    type: 'Equipment Loss',
    amount: 85,
    status: 'outstanding',
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    company: { name: 'Manhattan Smoke & Vape', type: 'store', default_city: 'Manhattan', default_state: 'NY', default_phone: '(212) 555-0404', neighborhood: 'Harlem' }
  },
  {
    id: 'sim-debt-5',
    driver_name: 'Chris L',
    type: 'Toll Reimbursement',
    amount: 35,
    status: 'outstanding',
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    company: { name: 'Staten Island Convenience', type: 'store', default_city: 'Staten Island', default_state: 'NY', default_phone: '(718) 555-0505', neighborhood: 'St. George' }
  },
];

export default function DriverDebtCollection() {
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [driverPhone, setDriverPhone] = useState("");
  const queryClient = useQueryClient();
  const { simulationMode } = useSimulationMode();

  const { data: unpaidAccounts, isLoading } = useQuery({
    queryKey: ["driver-debt-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select(`
          *,
          companies (
            id, name, type, default_phone, default_email, default_city, default_state,
            neighborhood, boro, payment_reliability_score, payment_reliability_tier
          )
        `)
        .in("payment_status", ["unpaid", "partial", "overdue"])
        .in("brand", TOBACCO_BRANDS)
        .order("due_date", { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  // FORCE simulation data when no real data
  const hasRealData = (unpaidAccounts?.length || 0) > 0;
  const showSimulated = simulationMode && !hasRealData;
  
  // Resolved accounts - real or simulated
  const resolvedAccounts = useMemo(() => {
    if (hasRealData) return unpaidAccounts || [];
    if (showSimulated) {
      return SIMULATED_DEBTS.map(d => ({
        id: d.id,
        total: d.amount,
        total_amount: d.amount,
        brand: 'gasmask',
        payment_status: d.status === 'settled' ? 'paid' : d.status === 'in_collection' ? 'overdue' : 'unpaid',
        due_date: d.created_at,
        companies: d.company,
        _sim_driver_name: d.driver_name,
        _sim_type: d.type,
        _sim_status: d.status,
      }));
    }
    return [];
  }, [hasRealData, showSimulated, unpaidAccounts]);

  const handleToggleAccount = (id: string) => {
    setSelectedAccounts((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedAccounts.length === resolvedAccounts.length) {
      setSelectedAccounts([]);
    } else {
      setSelectedAccounts(resolvedAccounts.map((a: any) => a.id) || []);
    }
  };

  const dispatchMutation = useMutation({
    mutationFn: async () => {
      // Prevent DB writes for simulated data
      if (showSimulated) {
        const selectedData = resolvedAccounts.filter((a: any) => selectedAccounts.includes(a.id));
        return { message: 'Simulated dispatch', count: selectedData.length };
      }
      
      const selectedData = unpaidAccounts?.filter((a) => selectedAccounts.includes(a.id));
      
      // Create dispatch list message
      const listItems = selectedData?.map((inv, i) => {
        const company = inv.companies as {
          name?: string;
          default_city?: string;
          default_state?: string;
          default_phone?: string;
        } | null;
        const amount = Number(inv.total) || Number(inv.total_amount) || 0;
        return `${i + 1}. ${company?.name || 'Unknown'}\n   📍 ${company?.default_city || ''}, ${company?.default_state || ''}\n   💰 $${amount.toLocaleString()} owed\n   📞 ${company?.default_phone || 'No phone'}\n`;
      }).join("\n");

      const totalAmount = selectedData?.reduce((sum, inv) => {
        return sum + (Number(inv.total) || Number(inv.total_amount) || 0);
      }, 0) || 0;

      const message = `🚚 COLLECTION ROUTE\n\n${listItems}\n\nTotal: $${totalAmount.toLocaleString()}\n\nDriver: ${driverPhone || 'Not specified'}`;

      // Log the dispatch - just console log for now since communication_logs schema may vary
      console.log("Dispatch message:", message);

      return { message, count: selectedData?.length };
    },
    onSuccess: (data) => {
      toast.success(showSimulated ? `[Simulated] Route dispatched with ${data.count} stops` : `Route dispatched with ${data.count} stops`);
      setSelectedAccounts([]);
    },
    onError: () => {
      toast.error("Failed to dispatch route");
    },
  });

  const updatePaymentMutation = useMutation({
    mutationFn: async ({ invoiceId, status }: { invoiceId: string; status: string }) => {
      const { error } = await supabase
        .from("invoices")
        .update({ 
          payment_status: status,
          paid_at: status === "paid" ? new Date().toISOString() : null 
        })
        .eq("id", invoiceId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["driver-debt-accounts"] });
      toast.success("Payment status updated");
    },
  });

  const totalSelected = selectedAccounts.length;
  const totalOwed = resolvedAccounts
    .filter((a: any) => selectedAccounts.includes(a.id))
    .reduce((sum: number, inv: any) => sum + (Number(inv.total) || Number(inv.total_amount) || 0), 0) || 0;

  const totalOutstanding = resolvedAccounts.reduce((sum: number, inv: any) => {
    return sum + (Number(inv.total) || Number(inv.total_amount) || 0);
  }, 0) || 0;

  return (
    <Layout>
      <SimulationBanner />
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent flex items-center gap-2">
                Driver Debt Collection
                {showSimulated && <SimulationBadge />}
              </h1>
              <p className="text-muted-foreground">Assign unpaid accounts to drivers for collection</p>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <SimulationModeToggle />
            <Badge variant="outline" className="text-lg px-4 py-2">
              <Users className="h-4 w-4 mr-2" />
              {totalSelected} Selected
            </Badge>
            <Badge variant="secondary" className="text-lg px-4 py-2 bg-red-500/20 text-red-500">
              <DollarSign className="h-4 w-4 mr-2" />
              ${totalOwed.toLocaleString()}
            </Badge>
          </div>
        </div>

        {/* Dispatch Panel */}
        <Card className="border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-transparent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-orange-500" />
              Dispatch Route
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="text-sm text-muted-foreground mb-2 block">Driver Phone Number</label>
                <Input
                  placeholder="+1 (555) 000-0000"
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                />
              </div>
              <Button
                onClick={() => dispatchMutation.mutate()}
                disabled={selectedAccounts.length === 0 || dispatchMutation.isPending}
                className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
              >
                <Send className="h-4 w-4 mr-2" />
                Dispatch {totalSelected} Stops
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-red-500/10">
                  <AlertTriangle className="h-6 w-6 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{resolvedAccounts.length}</p>
                  <p className="text-sm text-muted-foreground">Unpaid Accounts</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-orange-500/10">
                  <DollarSign className="h-6 w-6 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">${totalOutstanding.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Total Outstanding</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-blue-500/10">
                  <Route className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalSelected}</p>
                  <p className="text-sm text-muted-foreground">Selected for Route</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-green-500/10">
                  <CheckCircle className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">${totalOwed.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Route Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Accounts Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Select Accounts for Collection</CardTitle>
              <Button variant="outline" size="sm" onClick={handleSelectAll}>
                {selectedAccounts.length === resolvedAccounts.length ? "Deselect All" : "Select All"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading && !showSimulated ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead>Amount Owed</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Quick Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resolvedAccounts.map((invoice: any) => {
                    const company = invoice.companies as {
                      name?: string;
                      type?: string;
                      default_city?: string;
                      default_state?: string;
                      default_phone?: string;
                      neighborhood?: string;
                      boro?: string;
                    } | null;
                    const isSelected = selectedAccounts.includes(invoice.id);
                    const amount = Number(invoice.total) || Number(invoice.total_amount) || 0;
                    const isSimulated = invoice.id?.startsWith('sim-');
                    
                    // For simulated data, show driver name and debt type
                    const displayName = isSimulated 
                      ? `${invoice._sim_driver_name} - ${invoice._sim_type}`
                      : (company?.name || "Unknown");
                    const displayStatus = isSimulated 
                      ? invoice._sim_status 
                      : invoice.payment_status;
                    
                    return (
                      <TableRow 
                        key={invoice.id} 
                        className={isSelected ? "bg-orange-500/5" : ""}
                      >
                        <TableCell>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleToggleAccount(invoice.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium flex items-center gap-2">
                              {displayName}
                              {isSimulated && <SimulationBadge />}
                            </p>
                            <Badge variant="outline" className="text-xs">
                              {isSimulated ? invoice._sim_type : (typeLabels[company?.type || "store"] || company?.type)}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            {company?.default_city}, {company?.default_state}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {company?.neighborhood || company?.boro || ""}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize">
                            {(invoice.brand || "").replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-bold text-red-500">
                            ${amount.toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm">{company?.default_phone || "No phone"}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant={displayStatus === "overdue" || displayStatus === "in_collection" ? "destructive" : displayStatus === "settled" ? "default" : "secondary"}>
                            {displayStatus}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-green-500"
                              onClick={() => {
                                if (isSimulated) {
                                  toast.success("[Simulated] Marked as paid");
                                } else {
                                  updatePaymentMutation.mutate({ invoiceId: invoice.id, status: "paid" });
                                }
                              }}
                              title="Mark Paid"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-yellow-500"
                              onClick={() => {
                                if (isSimulated) {
                                  toast.success("[Simulated] Marked as partial");
                                } else {
                                  updatePaymentMutation.mutate({ invoiceId: invoice.id, status: "partial" });
                                }
                              }}
                              title="Mark Partial"
                            >
                              <Clock className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              title="Call"
                            >
                              <Phone className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              title="Message"
                            >
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {resolvedAccounts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        {simulationMode ? "No debts in simulation data" : "No unpaid accounts found"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}