import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Plus,
} from "lucide-react";
import { useAmbassadorOnlineSales } from "@/hooks/useAmbassadorOnlineSales";
import { format } from "date-fns";

import { dynastyDate } from '@/lib/dates';
interface AmbassadorSalesMetricsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ambassadorId: string;
  ambassadorName: string;
  trackingCode: string | null;
}

export function AmbassadorSalesMetricsModal({
  open,
  onOpenChange,
  ambassadorId,
  ambassadorName,
  trackingCode,
}: AmbassadorSalesMetricsModalProps) {
  const { sales, metrics, isLoading, createSale, isCreating } = useAmbassadorOnlineSales(ambassadorId);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSale, setNewSale] = useState({
    order_reference: "",
    order_amount: "",
    commission_amount: "",
    customer_name: "",
    customer_email: "",
  });

  const handleAddSale = async () => {
    if (!trackingCode) return;
    
    await createSale({
      ambassador_id: ambassadorId,
      tracking_code: trackingCode,
      order_reference: newSale.order_reference || null,
      order_amount: parseFloat(newSale.order_amount) || 0,
      commission_amount: parseFloat(newSale.commission_amount) || 0,
      customer_name: newSale.customer_name || null,
      customer_email: newSale.customer_email || null,
      status: "completed",
    });
    
    setNewSale({
      order_reference: "",
      order_amount: "",
      commission_amount: "",
      customer_name: "",
      customer_email: "",
    });
    setShowAddForm(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case "refunded":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="w-3 h-3 mr-1" />Refunded</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground">
            Online Sales Metrics - {ambassadorName}
          </DialogTitle>
          {trackingCode && (
            <p className="text-sm text-muted-foreground">
              Tracking Code: <span className="font-mono text-primary">{trackingCode}</span>
            </p>
          )}
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Metrics Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-background/50 border-border">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-primary" />
                    <span className="text-xs text-muted-foreground">Total Sales</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground mt-1">{metrics?.totalSales || 0}</p>
                </CardContent>
              </Card>
              
              <Card className="bg-background/50 border-border">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-green-500" />
                    <span className="text-xs text-muted-foreground">Total Revenue</span>
                  </div>
                  <p className="text-2xl font-bold text-green-500 mt-1">
                    ${metrics?.totalRevenue?.toFixed(2) || "0.00"}
                  </p>
                </CardContent>
              </Card>
              
              <Card className="bg-background/50 border-border">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-blue-500" />
                    <span className="text-xs text-muted-foreground">Commission Earned</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-500 mt-1">
                    ${metrics?.totalCommission?.toFixed(2) || "0.00"}
                  </p>
                </CardContent>
              </Card>
              
              <Card className="bg-background/50 border-border">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-purple-500" />
                    <span className="text-xs text-muted-foreground">Avg Order Value</span>
                  </div>
                  <p className="text-2xl font-bold text-purple-500 mt-1">
                    ${metrics?.averageOrderValue?.toFixed(2) || "0.00"}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Status Breakdown */}
            <div className="flex gap-4 flex-wrap">
              <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30">
                <CheckCircle className="w-3 h-3 mr-1" />
                {metrics?.completedSales || 0} Completed
              </Badge>
              <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30">
                <Clock className="w-3 h-3 mr-1" />
                {metrics?.pendingSales || 0} Pending
              </Badge>
              <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30">
                <XCircle className="w-3 h-3 mr-1" />
                {metrics?.refundedSales || 0} Refunded
              </Badge>
            </div>

            {/* Add Sale Button */}
            {trackingCode && !showAddForm && (
              <Button onClick={() => setShowAddForm(true)} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Record New Sale
              </Button>
            )}

            {/* Add Sale Form */}
            {showAddForm && (
              <Card className="bg-background/50 border-border">
                <CardHeader>
                  <CardTitle className="text-sm">Record New Sale</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="order_reference">Order Reference</Label>
                      <Input
                        id="order_reference"
                        value={newSale.order_reference}
                        onChange={(e) => setNewSale({ ...newSale, order_reference: e.target.value })}
                        placeholder="ORD-12345"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="order_amount">Order Amount ($)</Label>
                      <Input
                        id="order_amount"
                        type="number"
                        step="0.01"
                        value={newSale.order_amount}
                        onChange={(e) => setNewSale({ ...newSale, order_amount: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="commission_amount">Commission ($)</Label>
                      <Input
                        id="commission_amount"
                        type="number"
                        step="0.01"
                        value={newSale.commission_amount}
                        onChange={(e) => setNewSale({ ...newSale, commission_amount: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customer_name">Customer Name</Label>
                      <Input
                        id="customer_name"
                        value={newSale.customer_name}
                        onChange={(e) => setNewSale({ ...newSale, customer_name: e.target.value })}
                        placeholder="John Doe"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleAddSale} disabled={isCreating}>
                      {isCreating ? "Saving..." : "Save Sale"}
                    </Button>
                    <Button variant="outline" onClick={() => setShowAddForm(false)}>
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Sales List */}
            <Card className="bg-background/50 border-border">
              <CardHeader>
                <CardTitle className="text-sm">Recent Sales</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  {sales.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No online sales recorded yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {sales.map((sale) => (
                        <div
                          key={sale.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground">
                                {sale.order_reference || "No Reference"}
                              </span>
                              {getStatusBadge(sale.status)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {sale.customer_name || "Anonymous"} • {dynastyDate(sale.sale_date)}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-foreground">${Number(sale.order_amount).toFixed(2)}</p>
                            <p className="text-xs text-green-500">+${Number(sale.commission_amount).toFixed(2)} commission</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
