import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, FileText, Download, DollarSign, Calendar, Store, CreditCard, Check } from 'lucide-react';
import { format } from 'date-fns';

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'cashapp', label: 'CashApp' },
  { value: 'check', label: 'Check' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
];

const BillingInvoiceDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoice-detail', id],
    queryFn: async () => {
      // Try invoices table first (for store invoices)
      const { data: storeInvoice } = await supabase
        .from('invoices')
        .select(`
          *,
          store:stores(id, name, address_street, address_city, phone)
        `)
        .eq('id', id)
        .single();

      if (storeInvoice) return storeInvoice as any;

      // Fallback to customer_invoices
      const { data: customerInvoice, error } = await supabase
        .from('customer_invoices')
        .select(`
          *,
          customer:crm_customers(id, name, business_type)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return customerInvoice as any;
    },
    enabled: !!id,
  });

  const markPaidMutation = useMutation({
    mutationFn: async (paymentMethod: string) => {
      const table = invoice?.source === 'invoices' ? 'invoices' : 'customer_invoices';
      const { error } = await supabase
        .from(table)
        .update({
          payment_status: 'paid',
          payment_method: paymentMethod,
          paid_at: new Date().toISOString(),
          amount_paid: invoice?.total_amount || invoice?.total,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Invoice marked as paid');
      queryClient.invalidateQueries({ queryKey: ['invoice-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['all-invoices'] });
    },
    onError: (error: any) => {
      toast.error(`Failed to update invoice: ${error.message}`);
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-500">Paid</Badge>;
      case 'partial':
        return <Badge className="bg-yellow-500">Partial</Badge>;
      case 'overdue':
        return <Badge variant="destructive">Overdue</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleMarkPaid = () => {
    if (!selectedPaymentMethod) {
      toast.error('Please select a payment method');
      return;
    }
    markPaidMutation.mutate(selectedPaymentMethod);
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  if (!invoice) {
    return (
      <Layout>
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Invoice Not Found</h2>
          <p className="text-muted-foreground mb-4">The invoice you're looking for doesn't exist.</p>
          <Button onClick={() => navigate('/billing/invoices')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Invoices
          </Button>
        </div>
      </Layout>
    );
  }

  const isPaid = invoice.payment_status === 'paid';
  const totalAmount = invoice.total_amount || invoice.total || 0;
  const amountPaid = invoice.amount_paid || 0;
  const amountDue = totalAmount - amountPaid;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/billing/invoices')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{invoice.invoice_number}</h1>
              {getStatusBadge(invoice.payment_status || invoice.status)}
            </div>
            <p className="text-muted-foreground">
              Created {invoice.created_at ? format(new Date(invoice.created_at), 'PPP') : 'N/A'}
            </p>
          </div>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Invoice Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Invoice Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Invoice Number</span>
                <span className="font-medium">{invoice.invoice_number}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Due Date</span>
                <span className="font-medium">
                  {invoice.due_date ? format(new Date(invoice.due_date), 'PPP') : 'N/A'}
                </span>
              </div>
              <Separator />
              {invoice.brand && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Brand(s)</span>
                    <Badge variant="outline" className="capitalize">{invoice.brand}</Badge>
                  </div>
                  <Separator />
                </>
              )}
              {invoice.payment_method && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Payment Method</span>
                    <Badge variant="outline" className="capitalize">{invoice.payment_method}</Badge>
                  </div>
                  <Separator />
                </>
              )}
              {invoice.paid_at && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Paid On</span>
                  <span className="font-medium text-green-500">
                    {format(new Date(invoice.paid_at), 'PPP')}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Customer/Store Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5 text-primary" />
                {invoice.store ? 'Store' : 'Customer'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {invoice.store ? (
                <>
                  <div>
                    <span className="text-muted-foreground text-sm">Name</span>
                    <p className="font-medium">{invoice.store.name}</p>
                  </div>
                  {invoice.store.address_street && (
                    <div>
                      <span className="text-muted-foreground text-sm">Address</span>
                      <p className="font-medium">
                        {invoice.store.address_street}, {invoice.store.address_city}
                      </p>
                    </div>
                  )}
                  {invoice.store.phone && (
                    <div>
                      <span className="text-muted-foreground text-sm">Phone</span>
                      <p className="font-medium">{invoice.store.phone}</p>
                    </div>
                  )}
                </>
              ) : invoice.customer ? (
                <>
                  <div>
                    <span className="text-muted-foreground text-sm">Name</span>
                    <p className="font-medium">{invoice.customer.name}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-sm">Type</span>
                    <Badge variant="outline" className="capitalize">{invoice.customer.business_type}</Badge>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground">No customer information</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Amount Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Payment Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">${Number(invoice.subtotal || 0).toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Tax</span>
              <span className="font-medium">${Number(invoice.tax || 0).toFixed(2)}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between text-lg">
              <span className="font-semibold">Total</span>
              <span className="font-bold">${Number(totalAmount).toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Amount Paid</span>
              <span className="font-medium text-green-500">${Number(amountPaid).toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-lg">
              <span className="font-semibold">Amount Due</span>
              <span className={`font-bold ${amountDue > 0 ? 'text-orange-500' : 'text-green-500'}`}>
                ${Number(amountDue).toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Payment Actions */}
        {!isPaid && amountDue > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                Record Payment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Select value={selectedPaymentMethod} onValueChange={setSelectedPaymentMethod}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((method) => (
                      <SelectItem key={method.value} value={method.value}>
                        {method.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  onClick={handleMarkPaid}
                  disabled={markPaidMutation.isPending || !selectedPaymentMethod}
                  className="gap-2"
                >
                  <Check className="h-4 w-4" />
                  {markPaidMutation.isPending ? 'Processing...' : 'Mark as Paid'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        {invoice.notes && (
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground whitespace-pre-wrap">{invoice.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default BillingInvoiceDetail;
