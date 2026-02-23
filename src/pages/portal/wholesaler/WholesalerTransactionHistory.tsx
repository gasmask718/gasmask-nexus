import { useState } from "react";
import { Link } from "react-router-dom";
import { useWholesalerProfile } from "@/services/wholesaler/useWholesalerProfile";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Search, FileText, Download, Calendar } from "lucide-react";
import { format } from "date-fns";
import { exportData } from "@/utils/exportUtils";

export default function WholesalerTransactionHistory() {
  const { profile, isLoading: profileLoading } = useWholesalerProfile();
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["wholesaler-transactions", profile?.id, dateFrom, dateTo],
    queryFn: async () => {
      if (!profile?.id) return [];
      let query = supabase
        .from("invoices")
        .select("id, invoice_number, created_at, total, total_amount, payment_status, status, brand, notes, entity_type, entity_id")
        .eq("entity_type", "wholesaler")
        .eq("entity_id", profile.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (dateFrom) query = query.gte("created_at", dateFrom);
      if (dateTo) query = query.lte("created_at", `${dateTo}T23:59:59`);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.id,
  });

  const filtered = invoices.filter((inv) => {
    const term = search.toLowerCase();
    return (
      inv.invoice_number?.toLowerCase().includes(term) ||
      inv.brand?.toLowerCase().includes(term) ||
      inv.payment_status?.toLowerCase().includes(term)
    );
  });

  const handleExport = () => {
    exportData({
      filename: `wholesaler-transactions-${format(new Date(), "yyyy-MM-dd")}`,
      format: "csv",
      data: filtered as Record<string, unknown>[],
      columns: [
        { key: "invoice_number", label: "Invoice #" },
        { key: "created_at", label: "Date" },
        { key: "brand", label: "Brand" },
        { key: "total", label: "Total" },
        { key: "payment_status", label: "Payment Status" },
        { key: "status", label: "Status" },
      ],
    });
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "paid": return "default";
      case "unpaid": return "destructive";
      case "partial": return "secondary";
      default: return "outline";
    }
  };

  if (profileLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/portal/wholesaler">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Transaction History</h1>
          <p className="text-muted-foreground">{invoices.length} invoices</p>
        </div>
        <Button variant="outline" onClick={handleExport} disabled={filtered.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by invoice #, brand..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[150px]"
                placeholder="From"
              />
              <span className="text-muted-foreground">to</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[150px]"
                placeholder="To"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No transactions found</h3>
            <p className="text-muted-foreground">
              {search || dateFrom || dateTo
                ? "Try adjusting your filters"
                : "Your purchase history will appear here"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 text-sm font-medium">Invoice #</th>
                    <th className="text-left p-3 text-sm font-medium">Date</th>
                    <th className="text-left p-3 text-sm font-medium">Brand</th>
                    <th className="text-right p-3 text-sm font-medium">Total</th>
                    <th className="text-center p-3 text-sm font-medium">Payment</th>
                    <th className="text-center p-3 text-sm font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((inv) => (
                    <tr key={inv.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="p-3 text-sm font-mono">{inv.invoice_number}</td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {format(new Date(inv.created_at), "MMM d, yyyy")}
                      </td>
                      <td className="p-3 text-sm">{inv.brand || "—"}</td>
                      <td className="p-3 text-sm text-right font-medium">
                        ${(inv.total || inv.total_amount || 0).toFixed(2)}
                      </td>
                      <td className="p-3 text-center">
                        <Badge variant={statusColor(inv.payment_status) as any}>
                          {inv.payment_status}
                        </Badge>
                      </td>
                      <td className="p-3 text-center">
                        <Badge variant="outline">{inv.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
