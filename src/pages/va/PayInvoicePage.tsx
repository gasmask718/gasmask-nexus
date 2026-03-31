import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileText, CheckCircle } from 'lucide-react';

export default function PayInvoicePage() {
  const { invoiceId } = useParams();

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['pay-invoice', invoiceId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('va_invoices')
        .select('*')
        .eq('id', invoiceId)
        .single();
      return data;
    },
    enabled: !!invoiceId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <h2 className="text-lg font-bold mb-1">Invoice Not Found</h2>
            <p className="text-sm text-muted-foreground">This invoice may have been removed or the link is invalid.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const lineItems = (invoice.line_items || []) as Array<{ description: string; price: number }>;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center border-b">
          <div className="mx-auto h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Invoice from Brandaro</CardTitle>
          <p className="text-sm text-muted-foreground">For: {invoice.customer_name}</p>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {invoice.service_type && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Service</span>
              <span className="font-medium">{invoice.service_type}</span>
            </div>
          )}

          <div className="space-y-2">
            {lineItems.map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span>{item.description}</span>
                <span className="font-mono">${item.price.toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="border-t pt-3 flex justify-between font-bold text-lg">
            <span>Total</span>
            <span>${parseFloat(invoice.total).toFixed(2)}</span>
          </div>

          {invoice.due_date && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Due Date</span>
              <span>{new Date(invoice.due_date).toLocaleDateString()}</span>
            </div>
          )}

          <Badge className={
            invoice.status === 'paid' ? 'bg-green-100 text-green-700' :
            invoice.status === 'sent' ? 'bg-blue-100 text-blue-700' :
            'bg-yellow-100 text-yellow-700'
          }>
            {invoice.status === 'paid' ? '✅ Paid' : invoice.status === 'sent' ? '📨 Sent' : '📋 Draft'}
          </Badge>

          {invoice.status !== 'paid' && (
            <Button className="w-full" size="lg">
              <CheckCircle className="h-4 w-4 mr-2" /> Pay Now — ${parseFloat(invoice.total).toFixed(2)}
            </Button>
          )}

          {invoice.notes && (
            <p className="text-xs text-muted-foreground text-center">{invoice.notes}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
