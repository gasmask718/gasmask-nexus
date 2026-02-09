/**
 * Invoice Detail Modal — Shows full invoice details fetched from database
 * Used on Ambassador Orders page when clicking View on an invoice row
 */
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import {
  FileText, DollarSign, Clock, CheckCircle, Store,
  Calendar, User, CreditCard, Package, AlertCircle,
} from 'lucide-react';

interface InvoiceDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string | null;
}

interface InvoiceLineItem {
  id: string;
  product_name: string;
  brand: string;
  quantity: number;
  unit_price: number;
  total: number;
  sale_channel: string | null;
  sale_unit: string | null;
}

interface InvoiceDetail {
  id: string;
  invoice_number: string | null;
  store_id: string;
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  total_amount: number | null;
  payment_status: string | null;
  payment_method: string | null;
  paid_at: string | null;
  due_date: string | null;
  notes: string | null;
  brand: string | null;
  created_by: string | null;
  received_by: string | null;
  partial_amount: number | null;
  is_historical: boolean | null;
  receipt_status: string | null;
  receipt_sent_at: string | null;
  created_at: string;
  store: { name: string } | null;
  line_items: InvoiceLineItem[];
}

function useInvoiceDetail(invoiceId: string | null) {
  return useQuery({
    queryKey: ['invoice-detail', invoiceId],
    queryFn: async (): Promise<InvoiceDetail | null> => {
      if (!invoiceId) return null;

      const { data, error } = await supabase
        .from('invoices')
        .select(`
          id, invoice_number, store_id, subtotal, tax, total, total_amount,
          payment_status, payment_method, paid_at, due_date, notes, brand,
          created_by, received_by, partial_amount, is_historical,
          receipt_status, receipt_sent_at, created_at,
          store:stores!store_id(name),
          line_items:invoice_line_items(id, product_name, brand, quantity, unit_price, total, sale_channel, sale_unit)
        `)
        .eq('id', invoiceId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        ...data,
        store: Array.isArray(data.store) ? data.store[0] : data.store,
        line_items: (data.line_items || []) as InvoiceLineItem[],
      } as InvoiceDetail;
    },
    enabled: !!invoiceId,
  });
}

const getPaymentBadge = (status: string | null) => {
  switch (status) {
    case 'paid':
      return <Badge className="bg-green-500/20 text-green-500 border-green-500/30"><CheckCircle className="h-3 w-3 mr-1" />Paid</Badge>;
    case 'partial':
      return <Badge className="bg-orange-500/20 text-orange-500 border-orange-500/30"><DollarSign className="h-3 w-3 mr-1" />Partial</Badge>;
    case 'unpaid':
    case 'pending':
      return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30"><Clock className="h-3 w-3 mr-1" />Unpaid</Badge>;
    default:
      return <Badge variant="outline">{status || 'Unknown'}</Badge>;
  }
};

const getReceiptBadge = (status: string | null) => {
  switch (status) {
    case 'delivered':
      return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">Delivered</Badge>;
    case 'sent':
      return <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30">Sent</Badge>;
    case 'failed':
      return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30">Failed</Badge>;
    default:
      return <Badge variant="outline" className="text-muted-foreground">Not Sent</Badge>;
  }
};

const getChannelLabel = (channel: string | null) => {
  switch (channel) {
    case 'retail': return 'Retail';
    case 'wholesale': return 'Wholesale';
    case 'street': return 'Street';
    default: return channel || '—';
  }
};

export function InvoiceDetailModal({ open, onOpenChange, invoiceId }: InvoiceDetailModalProps) {
  const { data: invoice, isLoading, isError } = useInvoiceDetail(invoiceId);

  const totalAmount = invoice?.total ?? invoice?.total_amount ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Invoice Details
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4 py-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : isError || !invoice ? (
          <div className="flex items-center gap-3 py-8 text-destructive justify-center">
            <AlertCircle className="h-5 w-5" />
            <p>Failed to load invoice details</p>
          </div>
        ) : (
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-5 pb-4">
              {/* Header Info */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-semibold font-mono">
                    {invoice.invoice_number || `INV-${invoice.id.slice(0, 8).toUpperCase()}`}
                  </p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Store className="h-3.5 w-3.5" />
                    {invoice.store?.name || 'Unknown Store'}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {getPaymentBadge(invoice.payment_status)}
                  {invoice.is_historical && (
                    <Badge variant="outline" className="text-xs text-muted-foreground">Historical</Badge>
                  )}
                </div>
              </div>

              <Separator />

              {/* Key Details Grid */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Created</p>
                    <p className="font-medium">{format(new Date(invoice.created_at), 'MMM d, yyyy h:mm a')}</p>
                  </div>
                </div>

                {invoice.due_date && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground">Due Date</p>
                      <p className="font-medium">{format(new Date(invoice.due_date), 'MMM d, yyyy')}</p>
                    </div>
                  </div>
                )}

                {invoice.payment_method && (
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground">Payment Method</p>
                      <p className="font-medium capitalize">{invoice.payment_method}</p>
                    </div>
                  </div>
                )}

                {invoice.received_by && (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground">Received By</p>
                      <p className="font-medium">{invoice.received_by}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Receipt</p>
                    {getReceiptBadge(invoice.receipt_status)}
                  </div>
                </div>

                {invoice.brand && (
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground">Brand(s)</p>
                      <p className="font-medium">{invoice.brand}</p>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Line Items Table */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Line Items</h4>
                {invoice.line_items.length > 0 ? (
                  <div className="border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead>Brand</TableHead>
                          <TableHead>Channel</TableHead>
                          <TableHead className="text-center">Qty</TableHead>
                          <TableHead className="text-right">Price</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoice.line_items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.product_name}</TableCell>
                            <TableCell className="text-muted-foreground">{item.brand}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">{getChannelLabel(item.sale_channel)}</Badge>
                            </TableCell>
                            <TableCell className="text-center">{item.quantity}</TableCell>
                            <TableCell className="text-right">${Number(item.unit_price).toFixed(2)}</TableCell>
                            <TableCell className="text-right font-semibold">${Number(item.total).toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">No line items recorded</p>
                )}
              </div>

              <Separator />

              {/* Totals */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>${Number(invoice.subtotal || 0).toFixed(2)}</span>
                </div>
                {Number(invoice.tax || 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax</span>
                    <span>${Number(invoice.tax).toFixed(2)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold text-base">
                  <span>Total</span>
                  <span className="text-primary">${Number(totalAmount).toFixed(2)}</span>
                </div>
                {invoice.payment_status === 'partial' && invoice.partial_amount && (
                  <div className="flex justify-between text-orange-500">
                    <span>Amount Paid</span>
                    <span>${Number(invoice.partial_amount).toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* Notes */}
              {invoice.notes && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-semibold mb-1">Notes</h4>
                    <p className="text-sm text-muted-foreground">{invoice.notes}</p>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
