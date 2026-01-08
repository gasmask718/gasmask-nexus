import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { FileText, DollarSign, Calendar, Package, Plus, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface Invoice {
  id: string;
  invoice_number: string;
  total_amount: number;
  subtotal: number;
  tax: number;
  payment_status: string;
  payment_method: string | null;
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
  brand: string | null;
  notes: string | null;
}

interface InvoiceHistoryCardProps {
  storeId: string;
  onCreateInvoice?: () => void;
}

export function InvoiceHistoryCard({ storeId, onCreateInvoice }: InvoiceHistoryCardProps) {
  const queryClient = useQueryClient();
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [newStatus, setNewStatus] = useState<string>('');

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['store-invoices', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as Invoice[];
    },
    enabled: !!storeId,
  });

  const togglePaymentStatusMutation = useMutation({
    mutationFn: async ({ invoiceId, newStatus }: { invoiceId: string; newStatus: string }) => {
      const updateData: any = {
        payment_status: newStatus,
      };

      if (newStatus === 'paid') {
        updateData.paid_at = new Date().toISOString();
      } else {
        updateData.paid_at = null;
      }

      const { error } = await supabase
        .from('invoices')
        .update(updateData)
        .eq('id', invoiceId);

      if (error) throw error;

      // Try to find and update corresponding order in visit_logs
      // We'll search for orders with matching invoice number or created around the same time
      const invoice = invoices.find(inv => inv.id === invoiceId);
      if (invoice) {
        // Find orders created around the same time as the invoice
        const invoiceDate = new Date(invoice.created_at);
        const startDate = new Date(invoiceDate.getTime() - 60000); // 1 minute before
        const endDate = new Date(invoiceDate.getTime() + 60000); // 1 minute after

        const { data: matchingOrders } = await supabase
          .from('visit_logs')
          .select('id')
          .eq('store_id', storeId)
          .eq('visit_type', 'order')
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString());

        if (matchingOrders && matchingOrders.length > 0) {
          // Update the most recent matching order
          const orderToUpdate = matchingOrders[0];
          await supabase
            .from('visit_logs')
            .update({
              cash_collected: newStatus === 'paid' ? invoice.total_amount : null,
            })
            .eq('id', orderToUpdate.id);
        }
      }
    },
    onSuccess: () => {
      toast.success(`Invoice status updated to ${newStatus}`);
      queryClient.invalidateQueries({ queryKey: ['store-invoices', storeId] });
      queryClient.invalidateQueries({ queryKey: ['store-orders-history', storeId] });
      setConfirmDialogOpen(false);
      setSelectedInvoice(null);
    },
    onError: (error: any) => {
      toast.error(`Failed to update status: ${error.message}`);
    },
  });

  const handleToggleStatus = (invoice: Invoice) => {
    const currentStatus = invoice.payment_status;
    const nextStatus = currentStatus === 'paid' ? 'unpaid' : 'paid';
    setSelectedInvoice(invoice);
    setNewStatus(nextStatus);
    setConfirmDialogOpen(true);
  };

  const handleConfirmToggle = () => {
    if (selectedInvoice) {
      togglePaymentStatusMutation.mutate({
        invoiceId: selectedInvoice.id,
        newStatus,
      });
    }
  };

  const totalPaid = invoices
    .filter(inv => inv.payment_status === 'paid')
    .reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0);

  const totalUnpaid = invoices
    .filter(inv => inv.payment_status !== 'paid')
    .reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0);

  const totalValue = invoices.reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-500/10 text-green-600 border-green-500/30';
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30';
      case 'overdue':
        return 'bg-red-500/10 text-red-600 border-red-500/30';
      default:
        return 'bg-gray-500/10 text-gray-600 border-gray-500/30';
    }
  };

  if (isLoading) {
    return (
      <Card className="glass-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Invoice History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Invoice History
          </CardTitle>
          {onCreateInvoice && (
            <Button
              onClick={onCreateInvoice}
              size="sm"
              className="bg-primary hover:bg-primary/90"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Invoice
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Money Tracking Summary */}
        <div className="grid grid-cols-3 gap-4 p-4 rounded-lg bg-secondary/30 border">
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Total Paid</p>
            <p className="text-lg font-bold text-green-600">${totalPaid.toFixed(2)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Unpaid</p>
            <p className="text-lg font-bold text-yellow-600">${totalUnpaid.toFixed(2)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Total Value</p>
            <p className="text-lg font-bold">${totalValue.toFixed(2)}</p>
          </div>
        </div>

        {/* Invoice List */}
        {invoices.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No invoices yet</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="p-4 rounded-lg bg-secondary/30 border space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{invoice.invoice_number}</span>
                      <Badge
                        variant="outline"
                        className={`text-xs cursor-pointer hover:opacity-80 transition-opacity ${getStatusColor(invoice.payment_status)}`}
                        onClick={() => handleToggleStatus(invoice)}
                        title={`Click to mark as ${invoice.payment_status === 'paid' ? 'unpaid' : 'paid'}`}
                      >
                        {invoice.payment_status}
                      </Badge>
                    </div>
                    {invoice.brand && (
                      <p className="text-sm text-muted-foreground">{invoice.brand}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">${Number(invoice.total_amount).toFixed(2)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground pt-2 border-t">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>
                      {invoice.created_at
                        ? format(new Date(invoice.created_at), 'MMM d, yyyy')
                        : 'N/A'}
                    </span>
                  </div>
                  {invoice.due_date && (
                    <div className="flex items-center gap-1">
                      <span>Due:</span>
                      <span>{format(new Date(invoice.due_date), 'MMM d, yyyy')}</span>
                    </div>
                  )}
                  {invoice.payment_method && (
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      <span className="capitalize">{invoice.payment_method}</span>
                    </div>
                  )}
                  {invoice.paid_at && (
                    <div className="flex items-center gap-1">
                      <span>Paid:</span>
                      <span>{format(new Date(invoice.paid_at), 'MMM d, yyyy')}</span>
                    </div>
                  )}
                </div>

                {invoice.notes && (
                  <p className="text-xs text-muted-foreground italic pt-1 border-t">
                    {invoice.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change Payment Status?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to mark invoice <strong>{selectedInvoice?.invoice_number}</strong> as <strong>{newStatus}</strong>?
              {newStatus === 'paid' && (
                <span className="block mt-2 text-green-600">
                  This will record the payment and update the totals.
                </span>
              )}
              {newStatus === 'unpaid' && (
                <span className="block mt-2 text-yellow-600">
                  This will remove the payment record and update the totals.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={togglePaymentStatusMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmToggle}
              disabled={togglePaymentStatusMutation.isPending}
            >
              {togglePaymentStatusMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

