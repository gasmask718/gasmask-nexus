import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, AlertTriangle, CheckCircle, Download } from "lucide-react";
import { toast } from "sonner";

export default function Billing() {
  const { data: invoices, refetch } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, stores(name, address_city)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: wallets } = useQuery({
    queryKey: ["store-wallets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_wallet")
        .select("*, stores(name, address_city)")
        .order("balance", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const { error } = await supabase
        .from("invoices")
        .update({
          payment_status: "paid",
          paid_at: new Date().toISOString(),
        })
        .eq("id", invoiceId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Invoice marked as paid");
      refetch();
    },
  });

  const unpaidInvoices = invoices?.filter(i => i.payment_status === "unpaid") || [];
  const overdueInvoices = invoices?.filter(i => i.payment_status === "overdue") || [];
  const totalOutstanding = unpaidInvoices.reduce((sum, inv) => sum + (inv.total_amount - inv.amount_paid), 0);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <DollarSign className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Billing & Invoices</h1>
            <p className="text-muted-foreground">Manage store payments and balances</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Outstanding</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalOutstanding.toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Unpaid Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{unpaidInvoices.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">{overdueInvoices.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Stores with Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {wallets?.filter(w => w.balance < 0).length || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Invoices Table */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices?.slice(0, 20).map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{invoice.stores?.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {invoice.stores?.address_city}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-bold">${invoice.total_amount.toFixed(2)}</TableCell>
                    <TableCell>${invoice.amount_paid.toFixed(2)}</TableCell>
                    <TableCell>{new Date(invoice.due_date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          invoice.payment_status === "paid"
                            ? "default"
                            : invoice.payment_status === "overdue"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {invoice.payment_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {invoice.payment_status !== "paid" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => markPaidMutation.mutate(invoice.id)}
                          >
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Mark Paid
                          </Button>
                        )}
                        <Button size="sm" variant="ghost">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Store Balances */}
        <Card>
          <CardHeader>
            <CardTitle>Store Balances</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store</TableHead>
                  <TableHead>Current Balance</TableHead>
                  <TableHead>Credit Limit</TableHead>
                  <TableHead>Total Spent</TableHead>
                  <TableHead>Payment Risk</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wallets?.slice(0, 15).map((wallet) => (
                  <TableRow key={wallet.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{wallet.stores?.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {wallet.stores?.address_city}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={wallet.balance < 0 ? "text-red-500 font-bold" : "font-bold"}>
                        ${wallet.balance.toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell>${wallet.credit_limit.toFixed(2)}</TableCell>
                    <TableCell>${wallet.total_spent.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          wallet.payment_risk_score >= 70
                            ? "default"
                            : wallet.payment_risk_score >= 40
                            ? "secondary"
                            : "destructive"
                        }
                      >
                        {wallet.payment_risk_score}/100
                      </Badge>
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
