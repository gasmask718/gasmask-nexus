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
import { AIFinanceForecast } from "@/components/grabba/intelligence";
import { EntityModal, FieldConfig, ExportButton } from "@/components/crud";
import { DeleteConfirmModal } from "@/components/crud/DeleteConfirmModal";
import { GlobalAddButton } from "@/components/crud/GlobalAddButton";
import { TableRowActions } from "@/components/crud/TableRowActions";
import { DataTablePagination } from "@/components/crud/DataTablePagination";
import { useCrudOperations } from "@/hooks/useCrudOperations";
import { invoiceFields, orderFields } from "@/config/entityFieldConfigs";

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
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const queryClient = useQueryClient();

  // Modal states
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<any>(null);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [deletingItem, setDeletingItem] = useState<{ id: string; type: 'invoice' | 'order'; name: string } | null>(null);

  // CRUD operations
  const invoiceCrud = useCrudOperations({
    table: "invoices",
    queryKey: ["grabba-finance-invoices"],
    successMessages: {
      create: "Invoice created",
      update: "Invoice updated",
      delete: "Invoice deleted"
    }
  });

  const orderCrud = useCrudOperations({
    table: "wholesale_orders",
    queryKey: ["grabba-finance-orders"],
    successMessages: {
      create: "Order created",
      update: "Order updated",
      delete: "Order deleted"
    }
  });

  // Fetch invoices
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

  // Fetch orders
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
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Fetch commissions
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

  // Calculate metrics
  const totalRevenue = invoices?.reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0;
  const paidRevenue = invoices?.filter(i => i.payment_status === 'paid')?.reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0;
  const unpaidTotal = invoices?.filter(i => i.payment_status !== 'paid')?.reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0;
  const unpaidInvoices = invoices?.filter(i => i.payment_status !== 'paid') || [];

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

  const totalOrders = orders?.length || 0;
  const totalTubes = orders?.reduce((sum, o) => sum + (o.tubes_total || (o.boxes || 0) * 100), 0) || 0;
  const totalBoxes = orders?.reduce((sum, o) => sum + (o.boxes || 0), 0) || 0;
  const pendingCommissions = commissions?.filter(c => c.status === 'pending')?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0;
  const paidCommissions = commissions?.filter(c => c.status === 'paid')?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0;

  // Filter and paginate
  const filteredInvoices = invoices?.filter(inv => 
    !search || 
    inv.company?.name?.toLowerCase().includes(search.toLowerCase()) ||
    inv.invoice_number?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const filteredOrders = orders?.filter(o => 
    !search || 
    o.company?.name?.toLowerCase().includes(search.toLowerCase()) ||
    o.store?.name?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const paginatedInvoices = filteredInvoices.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const getOverdueDays = (dueDate: string | null) => {
    if (!dueDate) return 0;
    const diff = differenceInDays(new Date(), new Date(dueDate));
    return diff > 0 ? diff : 0;
  };

  // Handlers
  const handleCreateInvoice = async (data: Record<string, any>) => {
    await invoiceCrud.create(data);
    setInvoiceModalOpen(false);
  };

  const handleUpdateInvoice = async (data: Record<string, any>) => {
    if (editingInvoice) {
      await invoiceCrud.update({ id: editingInvoice.id, ...data });
      setEditingInvoice(null);
    }
  };

  const handleCreateOrder = async (data: Record<string, any>) => {
    await orderCrud.create(data);
    setOrderModalOpen(false);
  };

  const handleUpdateOrder = async (data: Record<string, any>) => {
    if (editingOrder) {
      await orderCrud.update({ id: editingOrder.id, ...data });
      setEditingOrder(null);
    }
  };

  const handleDelete = async () => {
    if (deletingItem) {
      if (deletingItem.type === 'invoice') {
        await invoiceCrud.remove(deletingItem.id);
      } else {
        await orderCrud.remove(deletingItem.id);
      }
      setDeletingItem(null);
    }
  };

  const handleMarkPaid = async (invoiceId: string) => {
    await invoiceCrud.update({ id: invoiceId, payment_status: 'paid', paid_at: new Date().toISOString() });
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
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

        {/* Unpaid Balance Snapshot */}
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

        {/* KPI Cards */}
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

        {/* Main content with AI sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-3">
            {/* Tabs */}
            <Tabs defaultValue="invoices" className="space-y-6">
              <div className="flex items-center justify-between">
                <TabsList className="bg-muted/50">
                  <TabsTrigger value="invoices">All Invoices</TabsTrigger>
                  <TabsTrigger value="orders">Order Tables</TabsTrigger>
                  <TabsTrigger value="aging">Aging Report</TabsTrigger>
                  <TabsTrigger value="commissions">Commissions</TabsTrigger>
                </TabsList>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-10 w-64"
                    />
                  </div>
                </div>
              </div>

          {/* Invoices Tab */}
          <TabsContent value="invoices">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Receipt className="h-5 w-5 text-primary" />
                    Invoices
                  </CardTitle>
                  <CardDescription>{filteredInvoices.length} total invoices</CardDescription>
                </div>
                <Button onClick={() => setInvoiceModalOpen(true)} size="sm" className="gap-2">
                  <Plus className="h-4 w-4" /> New Invoice
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Brand</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedInvoices.map((inv: any) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                        <TableCell>{inv.company?.name || 'N/A'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{inv.brand}</Badge>
                        </TableCell>
                        <TableCell>${(inv.total_amount || 0).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={inv.payment_status === 'paid' ? 'default' : 'destructive'}>
                            {inv.payment_status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {inv.due_date ? format(new Date(inv.due_date), "MMM d, yyyy") : '-'}
                        </TableCell>
                        <TableCell>
                          <TableRowActions
                            actions={[
                              { type: 'edit', onClick: () => setEditingInvoice(inv) },
                              ...(inv.payment_status !== 'paid' ? [{ type: 'activate' as const, label: 'Mark Paid', onClick: () => handleMarkPaid(inv.id) }] : []),
                              { type: 'delete', onClick: () => setDeletingItem({ id: inv.id, type: 'invoice', name: inv.invoice_number }) }
                            ]}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <DataTablePagination
                  currentPage={currentPage}
                  totalPages={Math.ceil(filteredInvoices.length / pageSize)}
                  pageSize={pageSize}
                  totalItems={filteredInvoices.length}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={setPageSize}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" />
                    Orders
                  </CardTitle>
                  <CardDescription>{filteredOrders.length} total orders</CardDescription>
                </div>
                <Button onClick={() => setOrderModalOpen(true)} size="sm" className="gap-2">
                  <Plus className="h-4 w-4" /> New Order
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company/Store</TableHead>
                      <TableHead>Brand</TableHead>
                      <TableHead>Boxes</TableHead>
                      <TableHead>Tubes</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedOrders.map((order: any) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">
                          {order.company?.name || order.store?.name || 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{order.brand}</Badge>
                        </TableCell>
                        <TableCell>{order.boxes || 0}</TableCell>
                        <TableCell>{order.tubes_total || (order.boxes || 0) * 100}</TableCell>
                        <TableCell>${(order.total_amount || 0).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={order.status === 'delivered' ? 'default' : 'secondary'}>
                            {order.status || 'pending'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {order.created_at ? format(new Date(order.created_at), "MMM d") : '-'}
                        </TableCell>
                        <TableCell>
                          <TableRowActions
                            actions={[
                              { type: 'edit', onClick: () => setEditingOrder(order) },
                              { type: 'delete', onClick: () => setDeletingItem({ id: order.id, type: 'order', name: `Order ${order.id.slice(0,8)}` }) }
                            ]}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <DataTablePagination
                  currentPage={currentPage}
                  totalPages={Math.ceil(filteredOrders.length / pageSize)}
                  pageSize={pageSize}
                  totalItems={filteredOrders.length}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={setPageSize}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aging Tab */}
          <TabsContent value="aging">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle>Aging Report</CardTitle>
                <CardDescription>Outstanding balances by age</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(aging).map(([range, amount]) => (
                    <Card key={range} className="bg-muted/30">
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">{range} days</p>
                        <p className="text-2xl font-bold">${amount.toLocaleString()}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Commissions Tab */}
          <TabsContent value="commissions">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Ambassador Commissions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ambassador</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commissions?.slice(0, 20).map((comm: any) => (
                      <TableRow key={comm.id}>
                        <TableCell>{comm.ambassador_id?.slice(0, 8)}</TableCell>
                        <TableCell>${(comm.amount || 0).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={comm.status === 'paid' ? 'default' : 'secondary'}>
                            {comm.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {comm.created_at ? format(new Date(comm.created_at), "MMM d") : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
            </Tabs>
          </div>
          
          {/* AI Finance Sidebar */}
          <div className="hidden lg:block">
            <AIFinanceForecast />
          </div>
        </div>
      </div>

      {/* Modals */}
      <EntityModal
        open={invoiceModalOpen}
        onOpenChange={setInvoiceModalOpen}
        title="Create Invoice"
        fields={invoiceFields}
        onSubmit={handleCreateInvoice}
        mode="create"
      />

      <EntityModal
        open={!!editingInvoice}
        onOpenChange={(open) => !open && setEditingInvoice(null)}
        title="Edit Invoice"
        fields={invoiceFields}
        defaultValues={editingInvoice || {}}
        onSubmit={handleUpdateInvoice}
        mode="edit"
      />

      <EntityModal
        open={orderModalOpen}
        onOpenChange={setOrderModalOpen}
        title="Create Order"
        fields={orderFields}
        onSubmit={handleCreateOrder}
        mode="create"
      />

      <EntityModal
        open={!!editingOrder}
        onOpenChange={(open) => !open && setEditingOrder(null)}
        title="Edit Order"
        fields={orderFields}
        defaultValues={editingOrder || {}}
        onSubmit={handleUpdateOrder}
        mode="edit"
      />

      <DeleteConfirmModal
        open={deleteModalOpen || !!deletingItem}
        onOpenChange={(open) => { setDeleteModalOpen(open); if (!open) setDeletingItem(null); }}
        title={`Delete ${deletingItem?.type}`}
        itemName={deletingItem?.name}
        onConfirm={handleDelete}
      />

      <GlobalAddButton
        label="New Invoice"
        onClick={() => setInvoiceModalOpen(true)}
        variant="floating"
      />
    </div>
  );
}
