import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { 
  DollarSign, TrendingUp, AlertTriangle, Clock, CheckCircle, Users, 
  FileText, Search, Building2, Star, Package, ExternalLink, Plus,
  CreditCard, Receipt, BarChart3
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { toast } from "sonner";
import { GRABBA_BRAND_IDS, getBrandConfig, type GrabbaBrand, GRABBA_BRAND_CONFIG } from "@/config/grabbaSkyscraper";
import { useGrabbaBrand } from "@/contexts/GrabbaBrandContext";
import { BrandFilterBar } from "@/components/grabba/BrandFilterBar";

// ═══════════════════════════════════════════════════════════════════════════════
// FLOOR 5 — GRABBA ORDERS & INVOICES
// Invoices, payments, unpaid accounts, and billing for Grabba brands
// ═══════════════════════════════════════════════════════════════════════════════

const PaymentReliabilityBadge = ({ score, tier }: { score: number; tier: string }) => {
  const stars = tier === 'elite' ? 5 : tier === 'solid' ? 4 : tier === 'middle' ? 3 : tier === 'concerning' ? 2 : 1;
  const color = stars >= 4 ? "text-yellow-500" : stars === 3 ? "text-gray-400" : "text-red-500";
  
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`h-3 w-3 ${i < stars ? color + " fill-current" : "text-muted"}`} />
      ))}
      <span className="text-xs text-muted-foreground ml-1">({score})</span>
    </div>
  );
};

export default function GrabbaFinance() {
  const { selectedBrand, setSelectedBrand, getBrandQuery } = useGrabbaBrand();
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  // ─────────────────────────────────────────────────────────────────────────────
  // FETCH INVOICES WITH BRAND FILTERING
  // ─────────────────────────────────────────────────────────────────────────────
  const { data: invoices, isLoading: loadingInvoices } = useQuery({
    queryKey: ["grabba-finance-invoices", selectedBrand],
    queryFn: async () => {
      const brandsToQuery = getBrandQuery();
      const { data } = await supabase
        .from("invoices")
        .select(`
          *,
          company:companies(id, name, default_phone, neighborhood, boro, payment_reliability_score, payment_reliability_tier)
        `)
        .in("brand", brandsToQuery)
        .order("created_at", { ascending: false });

      return data || [];
    },
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // FETCH ORDERS WITH BRAND FILTERING
  // ─────────────────────────────────────────────────────────────────────────────
  const { data: orders, isLoading: loadingOrders } = useQuery({
    queryKey: ["grabba-finance-orders", selectedBrand],
    queryFn: async () => {
      const brandsToQuery = getBrandQuery();
      const { data } = await supabase
        .from("wholesale_orders")
        .select(`
          *,
          company:companies(id, name, neighborhood),
          store:stores(id, name)
        `)
        .in("brand", brandsToQuery)
        .order("created_at", { ascending: false })
        .limit(100);

      return data || [];
    },
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // FETCH AMBASSADOR COMMISSIONS
  // ─────────────────────────────────────────────────────────────────────────────
  const { data: commissions } = useQuery({
    queryKey: ["grabba-finance-commissions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ambassador_commissions")
        .select(`*, ambassador:ambassadors(user_id)`)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // UPDATE PAYMENT STATUS
  // ─────────────────────────────────────────────────────────────────────────────
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
      queryClient.invalidateQueries({ queryKey: ["grabba-finance-invoices"] });
      toast.success("Payment status updated");
    },
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // CALCULATE METRICS
  // ─────────────────────────────────────────────────────────────────────────────
  const totalRevenue = invoices?.reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0;
  const paidRevenue = invoices?.filter(i => i.payment_status === 'paid')?.reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0;
  const unpaidTotal = invoices?.filter(i => i.payment_status !== 'paid')?.reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0;
  const unpaidInvoices = invoices?.filter(i => i.payment_status !== 'paid') || [];

  // Aging buckets
  const now = new Date();
  const aging = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
  
  unpaidInvoices.forEach(inv => {
    if (!inv.due_date) return;
    const daysPastDue = Math.max(0, differenceInDays(now, new Date(inv.due_date)));
    if (daysPastDue <= 30) aging['0-30'] += inv.total_amount || 0;
    else if (daysPastDue <= 60) aging['31-60'] += inv.total_amount || 0;
    else if (daysPastDue <= 90) aging['61-90'] += inv.total_amount || 0;
    else aging['90+'] += inv.total_amount || 0;
  });

  // Revenue by brand
  const revenueByBrand: Record<GrabbaBrand, number> = {} as any;
  GRABBA_BRAND_IDS.forEach(brand => {
    revenueByBrand[brand] = invoices?.filter(i => i.brand === brand)?.reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0;
  });

  // Order stats
  const totalOrders = orders?.length || 0;
  const totalTubes = orders?.reduce((sum, o) => sum + (o.tubes_total || (o.boxes || 0) * 100), 0) || 0;
  const totalBoxes = orders?.reduce((sum, o) => sum + (o.boxes || 0), 0) || 0;

  const pendingCommissions = commissions?.filter(c => c.status === 'pending')?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0;
  const paidCommissions = commissions?.filter(c => c.status === 'paid')?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0;

  // Filter invoices by search
  const filteredInvoices = invoices?.filter(inv => 
    !search || 
    inv.company?.name?.toLowerCase().includes(search.toLowerCase()) ||
    inv.invoice_number?.toLowerCase().includes(search.toLowerCase())
  );

  // Filter orders by search
  const filteredOrders = orders?.filter(o => 
    !search || 
    o.company?.name?.toLowerCase().includes(search.toLowerCase()) ||
    o.store?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const getOverdueDays = (dueDate: string | null) => {
    if (!dueDate) return 0;
    const diff = differenceInDays(new Date(), new Date(dueDate));
    return diff > 0 ? diff : 0;
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
        {/* HEADER */}
        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <FileText className="h-8 w-8 text-primary" />
              Grabba Orders & Invoices
            </h1>
            <p className="text-muted-foreground mt-1">
              Floor 5 — Invoices, payments, unpaid accounts, and billing for Grabba brands
            </p>
          </div>
          <BrandFilterBar
            selectedBrand={selectedBrand}
            onBrandChange={setSelectedBrand}
            variant="default"
          />
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
        {/* UNPAID BALANCE SNAPSHOT */}
        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
        <Card className="bg-gradient-to-r from-red-500/10 via-red-500/5 to-transparent border-red-500/20">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-red-500/20">
                  <AlertTriangle className="h-8 w-8 text-red-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Unpaid Balance</p>
                  <p className="text-4xl font-bold text-red-500">
                    ${unpaidTotal.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {unpaidInvoices.length} unpaid invoices
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-500">${paidRevenue.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Collected</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-500">${totalRevenue.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Total Revenue</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-amber-500">{totalOrders}</p>
                  <p className="text-xs text-muted-foreground">Total Orders</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
        {/* KPI CARDS */}
        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="bg-gradient-to-br from-green-500/10 to-green-900/5 border-green-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-green-400">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs">Total Revenue</span>
              </div>
              <div className="text-2xl font-bold text-foreground mt-1">
                ${totalRevenue.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-900/5 border-blue-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-blue-400">
                <Package className="h-4 w-4" />
                <span className="text-xs">Total Tubes</span>
              </div>
              <div className="text-2xl font-bold text-foreground mt-1">
                {totalTubes.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-900/5 border-purple-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-purple-400">
                <Receipt className="h-4 w-4" />
                <span className="text-xs">Total Boxes</span>
              </div>
              <div className="text-2xl font-bold text-foreground mt-1">
                {totalBoxes.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-900/5 border-amber-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-amber-400">
                <Users className="h-4 w-4" />
                <span className="text-xs">Pending Commissions</span>
              </div>
              <div className="text-2xl font-bold text-foreground mt-1">
                ${pendingCommissions.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-900/5 border-emerald-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle className="h-4 w-4" />
                <span className="text-xs">Paid Commissions</span>
              </div>
              <div className="text-2xl font-bold text-foreground mt-1">
                ${paidCommissions.toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
        {/* TABS */}
        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
        <Tabs defaultValue="unpaid" className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="unpaid">Unpaid Accounts</TabsTrigger>
            <TabsTrigger value="orders">Order Tables</TabsTrigger>
            <TabsTrigger value="invoices">All Invoices</TabsTrigger>
            <TabsTrigger value="aging">Aging Report</TabsTrigger>
            <TabsTrigger value="brand">Brand Breakdown</TabsTrigger>
            <TabsTrigger value="commissions">Commissions</TabsTrigger>
          </TabsList>

          {/* ─────────────────────────────────────────────────────────────────────────────
              UNPAID ACCOUNTS TAB
          ───────────────────────────────────────────────────────────────────────────── */}
          <TabsContent value="unpaid">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    Unpaid Accounts
                  </CardTitle>
                  <CardDescription>Outstanding balances requiring collection</CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search companies..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {loadingInvoices ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : unpaidInvoices.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-2" />
                    <p className="text-muted-foreground">All accounts are paid!</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Company</TableHead>
                          <TableHead>Brand</TableHead>
                          <TableHead>Invoice #</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Due Date</TableHead>
                          <TableHead>Overdue</TableHead>
                          <TableHead>Reliability</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredInvoices?.filter(i => i.payment_status !== 'paid').map((invoice) => {
                          const config = invoice.brand ? getBrandConfig(invoice.brand as GrabbaBrand) : null;
                          const overdueDays = getOverdueDays(invoice.due_date);
                          const company = invoice.company as any;
                          
                          return (
                            <TableRow key={invoice.id} className={overdueDays > 30 ? "bg-red-500/5" : ""}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Building2 className="h-4 w-4 text-muted-foreground" />
                                  <div>
                                    <p className="font-medium">{company?.name || "Unknown"}</p>
                                    <p className="text-xs text-muted-foreground">{company?.neighborhood}</p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                {config && <Badge className={config.pill}>{config.label}</Badge>}
                              </TableCell>
                              <TableCell className="font-mono text-sm">{invoice.invoice_number || "—"}</TableCell>
                              <TableCell className="font-bold text-red-500">
                                ${(invoice.total_amount || 0).toLocaleString()}
                              </TableCell>
                              <TableCell>
                                {invoice.due_date ? format(new Date(invoice.due_date), "MMM d, yyyy") : "—"}
                              </TableCell>
                              <TableCell>
                                <Badge variant={overdueDays > 30 ? "destructive" : overdueDays > 7 ? "secondary" : "outline"}>
                                  {overdueDays} days
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <PaymentReliabilityBadge
                                  score={company?.payment_reliability_score || 50}
                                  tier={company?.payment_reliability_tier || "middle"}
                                />
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-green-500"
                                    onClick={() => updatePaymentMutation.mutate({ invoiceId: invoice.id, status: "paid" })}
                                    title="Mark Paid"
                                  >
                                    <CheckCircle className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-yellow-500"
                                    onClick={() => updatePaymentMutation.mutate({ invoiceId: invoice.id, status: "partial" })}
                                    title="Mark Partial"
                                  >
                                    <Clock className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─────────────────────────────────────────────────────────────────────────────
              ORDER TABLES TAB (BRAND FILTERED)
          ───────────────────────────────────────────────────────────────────────────── */}
          <TabsContent value="orders">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" />
                    Order Tables
                  </CardTitle>
                  <CardDescription>Company-wide delivery orders filtered by brand</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search orders..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Button size="sm" className="gap-2">
                    <Plus className="h-4 w-4" /> New Order
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingOrders ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : filteredOrders?.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">No orders found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-[600px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Company/Store</TableHead>
                          <TableHead>Brand</TableHead>
                          <TableHead>Boxes</TableHead>
                          <TableHead>Tubes</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredOrders?.map((order) => {
                          const config = order.brand ? getBrandConfig(order.brand as GrabbaBrand) : null;
                          return (
                            <TableRow key={order.id}>
                              <TableCell className="text-sm">
                                {order.created_at ? format(new Date(order.created_at), "MMM d, yyyy") : "—"}
                              </TableCell>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{order.company?.name || order.store?.name || "Unknown"}</p>
                                  <p className="text-xs text-muted-foreground">{order.company?.neighborhood}</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                {config && <Badge className={config.pill}>{config.label}</Badge>}
                              </TableCell>
                              <TableCell className="font-medium">{order.boxes || 0}</TableCell>
                              <TableCell className="font-medium">{order.tubes_total || (order.boxes || 0) * 100}</TableCell>
                              <TableCell>
                                <Badge variant={order.status === 'delivered' ? 'default' : 'secondary'}>
                                  {order.status || 'pending'}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─────────────────────────────────────────────────────────────────────────────
              ALL INVOICES TAB
          ───────────────────────────────────────────────────────────────────────────── */}
          <TabsContent value="invoices">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Receipt className="h-5 w-5 text-primary" />
                    All Invoices
                  </CardTitle>
                  <CardDescription>Complete invoice history</CardDescription>
                </div>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" /> Create Invoice
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto max-h-[600px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Brand</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInvoices?.map((invoice) => {
                        const config = invoice.brand ? getBrandConfig(invoice.brand as GrabbaBrand) : null;
                        return (
                          <TableRow key={invoice.id}>
                            <TableCell className="font-mono text-sm">{invoice.invoice_number || invoice.id.slice(0, 8)}</TableCell>
                            <TableCell>{invoice.company?.name || "Unknown"}</TableCell>
                            <TableCell>
                              {config && <Badge className={config.pill}>{config.label}</Badge>}
                            </TableCell>
                            <TableCell className="font-medium">${(invoice.total_amount || 0).toLocaleString()}</TableCell>
                            <TableCell>
                              <Badge variant={invoice.payment_status === 'paid' ? 'default' : invoice.payment_status === 'partial' ? 'secondary' : 'destructive'}>
                                {invoice.payment_status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {invoice.created_at ? format(new Date(invoice.created_at), "MMM d, yyyy") : "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─────────────────────────────────────────────────────────────────────────────
              AGING REPORT TAB
          ───────────────────────────────────────────────────────────────────────────── */}
          <TabsContent value="aging">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-amber-500" />
                  Aging Report
                </CardTitle>
                <CardDescription>Outstanding balances by age</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                    <div className="text-sm text-green-400">0-30 Days</div>
                    <div className="text-2xl font-bold text-foreground mt-1">
                      ${aging['0-30'].toLocaleString()}
                    </div>
                    <Progress value={unpaidTotal > 0 ? (aging['0-30'] / unpaidTotal) * 100 : 0} className="h-2 mt-2" />
                  </div>
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <div className="text-sm text-amber-400">31-60 Days</div>
                    <div className="text-2xl font-bold text-foreground mt-1">
                      ${aging['31-60'].toLocaleString()}
                    </div>
                    <Progress value={unpaidTotal > 0 ? (aging['31-60'] / unpaidTotal) * 100 : 0} className="h-2 mt-2" />
                  </div>
                  <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20">
                    <div className="text-sm text-orange-400">61-90 Days</div>
                    <div className="text-2xl font-bold text-foreground mt-1">
                      ${aging['61-90'].toLocaleString()}
                    </div>
                    <Progress value={unpaidTotal > 0 ? (aging['61-90'] / unpaidTotal) * 100 : 0} className="h-2 mt-2" />
                  </div>
                  <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                    <div className="text-sm text-red-400">90+ Days</div>
                    <div className="text-2xl font-bold text-foreground mt-1">
                      ${aging['90+'].toLocaleString()}
                    </div>
                    <Progress value={unpaidTotal > 0 ? (aging['90+'] / unpaidTotal) * 100 : 0} className="h-2 mt-2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─────────────────────────────────────────────────────────────────────────────
              BRAND BREAKDOWN TAB
          ───────────────────────────────────────────────────────────────────────────── */}
          <TabsContent value="brand">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Revenue by Brand
                </CardTitle>
                <CardDescription>Financial breakdown across Grabba brands</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {GRABBA_BRAND_IDS.map(brand => {
                    const config = GRABBA_BRAND_CONFIG[brand];
                    const revenue = revenueByBrand[brand];
                    const unpaid = invoices?.filter(i => i.brand === brand && i.payment_status !== 'paid')
                      ?.reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0;
                    const percentage = totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0;
                    
                    return (
                      <div key={brand} className={`p-4 rounded-xl border ${config.gradient}`}>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-xl">{config.icon}</span>
                          <span className="font-medium text-foreground">{config.label}</span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Revenue</span>
                            <span className="font-bold text-foreground">${revenue.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Unpaid</span>
                            <span className="font-bold text-red-400">${unpaid.toLocaleString()}</span>
                          </div>
                          <Progress value={percentage} className="h-2" />
                          <p className="text-xs text-muted-foreground">{percentage.toFixed(1)}% of total</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─────────────────────────────────────────────────────────────────────────────
              COMMISSIONS TAB
          ───────────────────────────────────────────────────────────────────────────── */}
          <TabsContent value="commissions">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Ambassador Commissions
                </CardTitle>
                <CardDescription>Track and manage ambassador payouts</CardDescription>
              </CardHeader>
              <CardContent>
                {commissions?.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">No commissions found</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto">
                    {commissions?.map(comm => (
                      <div key={comm.id} className="p-4 rounded-xl border border-border/50 bg-card/30 flex items-center justify-between">
                        <div>
                          <div className="font-medium text-foreground capitalize">{comm.entity_type}</div>
                          <div className="text-sm text-muted-foreground">{comm.notes || 'No notes'}</div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-xl font-bold text-green-400">${comm.amount?.toLocaleString()}</div>
                          <Badge variant={comm.status === 'paid' ? 'default' : 'secondary'}>
                            {comm.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
