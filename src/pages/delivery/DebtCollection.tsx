import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useBusiness } from "@/contexts/BusinessContext";
import { useSimulationMode, SimulationBadge, SimulatedSection } from "@/contexts/SimulationModeContext";
import { SimulationModeToggle, SimulationBanner } from "@/components/delivery/SimulationModeToggle";
import { useResolvedData, useSimulationData } from "@/hooks/useSimulationData";
import Layout from "@/components/Layout";
import { useDriverDebts, useDrivers, useCreateDebt, useRecordDebtPayment, type DriverDebt } from "@/hooks/useDeliveryData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { 
  Plus, 
  Search, 
  ArrowLeft,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  MoreHorizontal
} from "lucide-react";
import { format } from "date-fns";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const DEBT_TYPES = ["advance", "damage", "chargeback", "fuel", "tolls", "other"];
const PAYMENT_METHODS = ["withheld_from_payout", "cash", "zelle", "ach", "other"];

export default function DebtCollection() {
  const navigate = useNavigate();
  const { currentBusiness } = useBusiness();
  const { simulationMode } = useSimulationMode();
  const simData = useSimulationData();
  const businessId = currentBusiness?.id;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [paymentDebt, setPaymentDebt] = useState<DriverDebt | null>(null);
  
  const [debtForm, setDebtForm] = useState({
    driver_id: "",
    debt_type: "advance",
    original_amount: "",
    notes: "",
  });

  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    method: "cash",
    reference: "",
  });

  const { data: debts = [], isLoading } = useDriverDebts(businessId);
  const { data: drivers = [] } = useDrivers(businessId);
  const createDebt = useCreateDebt();
  const recordPayment = useRecordDebtPayment();

  // Convert simulation debts to match expected format
  const simDebts = simData.debts.map(d => ({
    id: d.id,
    driver_id: d.driver_id,
    debt_type: d.debt_type,
    original_amount: d.original_amount,
    remaining_amount: d.remaining_amount,
    status: d.status,
    created_at: d.created_at.toISOString(),
    notes: d.notes,
    driver: { full_name: d.driver_name },
    is_simulated: true,
  }));

  // Resolve debts data
  const resolvedDebts = useResolvedData(debts, simDebts as any);

  const filteredDebts = resolvedDebts.data.filter(d => {
    const driverName = (d as any).driver?.full_name || (d as any).driver_name || '';
    const matchesSearch = driverName.toLowerCase().includes(search.toLowerCase()) ||
      d.debt_type.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Stats
  const totalOpen = debts.filter(d => d.status === "open").reduce((sum, d) => sum + d.remaining_amount, 0);
  const totalInCollection = debts.filter(d => d.status === "in_collection").reduce((sum, d) => sum + d.remaining_amount, 0);
  const totalSettled = debts.filter(d => d.status === "settled").length;

  const handleCreateDebt = async () => {
    if (!businessId || !debtForm.driver_id || !debtForm.original_amount) return;
    const amount = parseFloat(debtForm.original_amount);
    await createDebt.mutateAsync({
      business_id: businessId,
      driver_id: debtForm.driver_id,
      debt_type: debtForm.debt_type,
      original_amount: amount,
      remaining_amount: amount,
      notes: debtForm.notes || undefined,
    });
    setCreateOpen(false);
    setDebtForm({ driver_id: "", debt_type: "advance", original_amount: "", notes: "" });
  };

  const handleRecordPayment = async () => {
    if (!paymentDebt || !paymentForm.amount || !businessId) return;
    await recordPayment.mutateAsync({
      debtId: paymentDebt.id,
      amount: parseFloat(paymentForm.amount),
      method: paymentForm.method,
      reference: paymentForm.reference || undefined,
      businessId,
    });
    setPaymentDebt(null);
    setPaymentForm({ amount: "", method: "cash", reference: "" });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return "default";
      case "in_collection": return "destructive";
      case "settled": return "secondary";
      case "written_off": return "outline";
      default: return "secondary";
    }
  };

  return (
    <Layout>
      <SimulationBanner />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/delivery")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              Debt Collection
              {resolvedDebts.isSimulated && <SimulationBadge />}
            </h1>
            <p className="text-muted-foreground">Track and collect driver debts</p>
          </div>
        </div>
        <SimulationModeToggle />
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Debt
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Debt</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Driver *</Label>
                <Select value={debtForm.driver_id} onValueChange={(v) => setDebtForm({ ...debtForm, driver_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select driver..." />
                  </SelectTrigger>
                  <SelectContent>
                    {drivers.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Debt Type</Label>
                <Select value={debtForm.debt_type} onValueChange={(v) => setDebtForm({ ...debtForm, debt_type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEBT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Amount *</Label>
                <Input 
                  type="number"
                  value={debtForm.original_amount}
                  onChange={(e) => setDebtForm({ ...debtForm, original_amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea 
                  value={debtForm.notes}
                  onChange={(e) => setDebtForm({ ...debtForm, notes: e.target.value })}
                  placeholder="Reason for debt..."
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateDebt} disabled={!debtForm.driver_id || !debtForm.original_amount || createDebt.isPending}>
                  Create Debt
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <DollarSign className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">${resolvedDebts.data.filter(d => d.status === "open").reduce((sum, d) => sum + d.remaining_amount, 0).toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Open Debt</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">${resolvedDebts.data.filter(d => d.status === "in_collection").reduce((sum, d) => sum + d.remaining_amount, 0).toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">In Collection</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{resolvedDebts.data.filter(d => d.status === "settled").length}</p>
                <p className="text-xs text-muted-foreground">Settled</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-500/10 rounded-lg">
                <DollarSign className="h-5 w-5 text-slate-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{resolvedDebts.data.length}</p>
                <p className="text-xs text-muted-foreground">Total Records</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search debts..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_collection">In Collection</SelectItem>
            <SelectItem value="settled">Settled</SelectItem>
            <SelectItem value="written_off">Written Off</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Debts Table */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : filteredDebts.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No debts found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredDebts.map((debt) => (
            <Card key={debt.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="font-medium">{debt.driver?.full_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {debt.debt_type.charAt(0).toUpperCase() + debt.debt_type.slice(1)} • {format(new Date(debt.created_at), "MMM d, yyyy")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-bold text-lg">${debt.remaining_amount.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">of ${debt.original_amount.toFixed(2)}</p>
                    </div>
                    <Badge variant={getStatusColor(debt.status)}>{debt.status.replace("_", " ")}</Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {debt.status !== "settled" && debt.status !== "written_off" && (
                          <DropdownMenuItem onClick={() => setPaymentDebt(debt)}>
                            Record Payment
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem>View Details</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                {debt.notes && (
                  <p className="text-sm text-muted-foreground mt-2">{debt.notes}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Payment Dialog */}
      <Dialog open={!!paymentDebt} onOpenChange={(open) => !open && setPaymentDebt(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          {paymentDebt && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-medium">{paymentDebt.driver?.full_name}</p>
                <p className="text-sm text-muted-foreground">
                  Remaining: <span className="font-bold">${paymentDebt.remaining_amount.toFixed(2)}</span>
                </p>
              </div>
              <div className="space-y-2">
                <Label>Payment Amount *</Label>
                <Input 
                  type="number"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  placeholder="0.00"
                  max={paymentDebt.remaining_amount}
                />
              </div>
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select value={paymentForm.method} onValueChange={(v) => setPaymentForm({ ...paymentForm, method: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>{m.replace("_", " ").toUpperCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Reference</Label>
                <Input 
                  value={paymentForm.reference}
                  onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                  placeholder="Transaction ID, receipt number..."
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setPaymentDebt(null)}>Cancel</Button>
                <Button onClick={handleRecordPayment} disabled={!paymentForm.amount || recordPayment.isPending}>
                  Record Payment
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
    </Layout>
  );
}
