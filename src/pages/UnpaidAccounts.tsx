import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Phone, MessageSquare, DollarSign, AlertTriangle, Star, Building2, Search, TrendingDown, CheckCircle, Clock, ExternalLink } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { toast } from "sonner";

const TOBACCO_BRANDS = ["gasmask", "hotmama", "hotscolati", "grabba_r_us"];

const brandColors: Record<string, { bg: string; text: string; gradient: string }> = {
  gasmask: { bg: "bg-red-600", text: "text-red-600", gradient: "from-red-600 to-black" },
  hotmama: { bg: "bg-rose-400", text: "text-rose-400", gradient: "from-rose-400 to-rose-600" },
  hotscolati: { bg: "bg-red-700", text: "text-red-700", gradient: "from-red-700 to-black" },
  grabba_r_us: { bg: "bg-purple-500", text: "text-purple-500", gradient: "from-purple-500 to-pink-500" },
};

const typeLabels: Record<string, string> = {
  store: "Store",
  wholesaler: "Wholesaler",
  direct_customer: "Direct Customer",
};

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

export default function UnpaidAccounts() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [overdueFilter, setOverdueFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [boroFilter, setBoroFilter] = useState<string>("all");

  const { data: unpaidInvoices, isLoading } = useQuery({
    queryKey: ["unpaid-accounts", brandFilter],
    queryFn: async () => {
      let query = supabase
        .from("invoices")
        .select(`
          *,
          companies (
            id, name, type, default_phone, default_email, default_city, default_state,
            neighborhood, boro, payment_reliability_score, payment_reliability_tier
          )
        `)
        .in("payment_status", ["unpaid", "partial", "overdue"])
        .in("brand", TOBACCO_BRANDS);

      if (brandFilter !== "all") {
        query = query.eq("brand", brandFilter);
      }

      const { data, error } = await query.order("due_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: paymentStats } = useQuery({
    queryKey: ["payment-stats"],
    queryFn: async () => {
      const { data: invoices } = await supabase
        .from("invoices")
        .select("total, total_amount, payment_status, brand")
        .in("payment_status", ["unpaid", "partial", "overdue"])
        .in("brand", TOBACCO_BRANDS);

      const totalOwed = invoices?.reduce((sum, inv) => sum + (Number(inv.total) || Number(inv.total_amount) || 0), 0) || 0;
      const byBrand = invoices?.reduce((acc, inv) => {
        const brand = inv.brand || "unknown";
        if (TOBACCO_BRANDS.includes(brand)) {
          acc[brand] = (acc[brand] || 0) + (Number(inv.total) || Number(inv.total_amount) || 0);
        }
        return acc;
      }, {} as Record<string, number>) || {};

      return { totalOwed, byBrand, count: invoices?.length || 0 };
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
      queryClient.invalidateQueries({ queryKey: ["unpaid-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["payment-stats"] });
      toast.success("Payment status updated");
    },
  });

  const filteredInvoices = unpaidInvoices?.filter((inv) => {
    const company = inv.companies as { name?: string; type?: string; boro?: string } | null;
    
    if (search) {
      const companyName = company?.name?.toLowerCase() || "";
      if (!companyName.includes(search.toLowerCase())) return false;
    }
    if (typeFilter !== "all" && company?.type !== typeFilter) return false;
    if (boroFilter !== "all" && company?.boro !== boroFilter) return false;
    
    if (overdueFilter !== "all" && inv.due_date) {
      const overdueDays = differenceInDays(new Date(), new Date(inv.due_date));
      if (overdueDays < parseInt(overdueFilter)) return false;
    }
    
    return true;
  });

  const getOverdueDays = (dueDate: string | null) => {
    if (!dueDate) return 0;
    const diff = differenceInDays(new Date(), new Date(dueDate));
    return diff > 0 ? diff : 0;
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
              Unpaid Accounts
            </h1>
            <p className="text-muted-foreground">Track and manage outstanding payments for GasMask & Grabba brands</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="border-red-500/20 bg-gradient-to-br from-red-500/10 to-transparent">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total Outstanding</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-500">
                ${paymentStats?.totalOwed?.toLocaleString() || "0"}
              </div>
              <p className="text-xs text-muted-foreground">{paymentStats?.count || 0} unpaid invoices</p>
            </CardContent>
          </Card>

          {TOBACCO_BRANDS.map((brand) => (
            <Card key={brand} className={`border-border/50 bg-gradient-to-br ${brandColors[brand]?.gradient ? `from-${brand === 'gasmask' ? 'red-600' : brand === 'hotmama' ? 'rose-400' : brand === 'hotscolati' ? 'red-700' : 'purple-500'}/10` : ''} to-transparent`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground capitalize">{brand.replace("_", " ")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${(paymentStats?.byBrand?.[brand] || 0).toLocaleString()}</div>
                <Badge className={brandColors[brand]?.bg || "bg-gray-500"}>
                  {brand.replace("_", " ")}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search companies..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={brandFilter} onValueChange={setBrandFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Brand" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Brands</SelectItem>
                  <SelectItem value="gasmask">GasMask</SelectItem>
                  <SelectItem value="hotmama">HotMama</SelectItem>
                  <SelectItem value="hotscolati">Hotscolati</SelectItem>
                  <SelectItem value="grabba_r_us">Grabba R Us</SelectItem>
                </SelectContent>
              </Select>
              <Select value={overdueFilter} onValueChange={setOverdueFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Overdue" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="7">7+ Days</SelectItem>
                  <SelectItem value="15">15+ Days</SelectItem>
                  <SelectItem value="30">30+ Days</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="store">Store</SelectItem>
                  <SelectItem value="wholesaler">Wholesaler</SelectItem>
                  <SelectItem value="direct_customer">Direct Customer</SelectItem>
                </SelectContent>
              </Select>
              <Select value={boroFilter} onValueChange={setBoroFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Boro" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Boros</SelectItem>
                  <SelectItem value="manhattan">Manhattan</SelectItem>
                  <SelectItem value="brooklyn">Brooklyn</SelectItem>
                  <SelectItem value="queens">Queens</SelectItem>
                  <SelectItem value="bronx">Bronx</SelectItem>
                  <SelectItem value="staten_island">Staten Island</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Unpaid Accounts Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-500" />
              Outstanding Accounts ({filteredInvoices?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Amount Owed</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Days Overdue</TableHead>
                    <TableHead>Reliability</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices?.map((invoice) => {
                    const company = invoice.companies as {
                      id?: string;
                      name?: string;
                      type?: string;
                      default_city?: string;
                      default_state?: string;
                      payment_reliability_score?: number;
                      payment_reliability_tier?: string;
                    } | null;
                    const overdueDays = getOverdueDays(invoice.due_date);
                    const amount = Number(invoice.total) || Number(invoice.total_amount) || 0;
                    
                    return (
                      <TableRow key={invoice.id} className={overdueDays > 30 ? "bg-red-500/5" : ""}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{company?.name || "Unknown"}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{company?.default_city}, {company?.default_state}</span>
                                <Badge variant="outline" className="text-[10px]">
                                  {typeLabels[company?.type || "store"] || company?.type}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={brandColors[invoice.brand || ""]?.bg || "bg-gray-500"}>
                            {(invoice.brand || "N/A").replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono">{invoice.invoice_number || "—"}</TableCell>
                        <TableCell className="font-bold text-red-500">
                          ${amount.toLocaleString()}
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
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => company?.id && navigate(`/companies/${company.id}`)}
                              title="Open Company"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {(!filteredInvoices || filteredInvoices.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No unpaid accounts found
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