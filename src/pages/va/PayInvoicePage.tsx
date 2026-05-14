import { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileText, CheckCircle, CreditCard, SplitSquareHorizontal } from 'lucide-react';
import { toast } from 'sonner';

export default function PayInvoicePage() {
  const { invoiceId } = useParams();
  const [params, setParams] = useSearchParams();
  const qc = useQueryClient();

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
    refetchInterval: 10_000,
  });

  // Verify Stripe payment when redirected back via success_url
  useEffect(() => {
    const paid = params.get('paid');
    const sessionId = params.get('session_id');
    if (!paid || !sessionId || !invoiceId) return;
    (async () => {
      try {
        const { data } = await supabase.functions.invoke('va-verify-payment', {
          body: { invoice_id: invoiceId, session_id: sessionId, phase: paid },
        });
        if ((data as any)?.paid) {
          toast.success(
            paid === 'deposit'
              ? 'Deposit received — thank you!'
              : paid === 'final'
                ? 'Final payment received — thank you!'
                : 'Payment received — thank you!',
          );
          qc.invalidateQueries({ queryKey: ['pay-invoice', invoiceId] });
        }
      } finally {
        params.delete('paid');
        params.delete('session_id');
        setParams(params, { replace: true });
      }
    })();
  }, [params, invoiceId, qc, setParams]);

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
  const total = parseFloat(invoice.total);
  const isSplit = invoice.payment_type === 'split';
  const depositPaid = invoice.deposit_status === 'paid';
  const finalPaid = invoice.final_status === 'paid';
  const fullyPaid = invoice.status === 'paid';

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
            <span>${total.toFixed(2)}</span>
          </div>

          {invoice.due_date && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Due Date</span>
              <span>{new Date(invoice.due_date).toLocaleDateString()}</span>
            </div>
          )}

          <div className="flex justify-center">
            <Badge className={
              fullyPaid ? 'bg-green-100 text-green-700' :
              invoice.status === 'partially_paid' ? 'bg-amber-100 text-amber-700' :
              invoice.status === 'sent' ? 'bg-blue-100 text-blue-700' :
              'bg-yellow-100 text-yellow-700'
            }>
              {fullyPaid ? '✅ Paid in Full'
                : invoice.status === 'partially_paid' ? '🟡 50% Deposit Received'
                : invoice.status === 'sent' ? '📨 Awaiting Payment'
                : '📋 Draft'}
            </Badge>
          </div>

          {!fullyPaid && isSplit && (
            <div className="space-y-2">
              <Button
                className="w-full"
                size="lg"
                disabled={depositPaid || !invoice.deposit_payment_link}
                onClick={() => invoice.deposit_payment_link && (window.location.href = invoice.deposit_payment_link)}
              >
                {depositPaid ? (
                  <><CheckCircle className="h-4 w-4 mr-2" /> Deposit Paid</>
                ) : (
                  <><SplitSquareHorizontal className="h-4 w-4 mr-2" /> Brandaro Digital Pay — 50% Deposit (${Number(invoice.deposit_amount || 0).toFixed(2)})</>
                )}
              </Button>
              <Button
                className="w-full"
                size="lg"
                variant={depositPaid ? 'default' : 'outline'}
                disabled={finalPaid || !invoice.final_payment_link}
                onClick={() => invoice.final_payment_link && (window.location.href = invoice.final_payment_link)}
              >
                {finalPaid ? (
                  <><CheckCircle className="h-4 w-4 mr-2" /> Final Paid</>
                ) : (
                  <><CreditCard className="h-4 w-4 mr-2" /> Brandaro Digital Pay — Final 50% (${Number(invoice.final_amount || 0).toFixed(2)})</>
                )}
              </Button>
              <p className="text-[11px] text-muted-foreground text-center">
                Pay 50% now to start the project. The final 50% is due on completion.
              </p>
            </div>
          )}

          {!fullyPaid && !isSplit && invoice.payment_link && (
            <Button
              className="w-full"
              size="lg"
              onClick={() => (window.location.href = invoice.payment_link)}
            >
              <CreditCard className="h-4 w-4 mr-2" /> Pay Now — ${total.toFixed(2)}
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
