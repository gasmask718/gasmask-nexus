import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePortalCustomerId } from '@/hooks/usePortalCustomerId';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Package, ArrowLeft, Download, CreditCard } from 'lucide-react';
import { ReceiptStatusIndicator, InvoiceReceiptPanel, InvoiceActivityTimeline } from '@/components/invoice';
import type { ReceiptStatus } from '@/components/invoice/ReceiptStatusIndicator';
import { InvoiceRepairBanner } from '@/components/inventory/InvoiceRepairBanner';

const PortalInvoiceDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { customerId } = usePortalCustomerId();


  const { data: invoice, isLoading } = useQuery({
    queryKey: ['portal-invoice', id, customerId],
    queryFn: async () => {
      if (!customerId) return null;
      const { data, error } = await supabase
        .from('customer_invoices')
        .select(`
          *,
          receipt_status,
          receipt_sent_at,
          receipt_delivered_at,
          receipt_failure_reason,
          receipt_phone_used,
          receipt_message_sid
        `)
        .eq('id', id)
        .eq('customer_id', customerId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!customerId && !!id,
  });

  if (!customerId) return null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 text-center">
          <p className="text-muted-foreground mb-4">Invoice not found</p>
          <Button onClick={() => navigate('/portal/invoices')}>Back to Invoices</Button>
        </Card>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      paid: 'default',
      sent: 'secondary',
      overdue: 'destructive',
      partial: 'outline',
    };
    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/portal/invoices')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <Package className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">Invoice Details</h1>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
        <Card className="p-8">
          <InvoiceRepairBanner
            repairStatus={(invoice as any).repair_status}
            repairNotes={(invoice as any).repair_notes}
            repairedAt={(invoice as any).repaired_at}
          />
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold">{invoice.invoice_number}</h2>
              <p className="text-muted-foreground">
                Invoice Date: {new Date(invoice.invoice_date).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <ReceiptStatusIndicator
                status={(invoice as any).receipt_status as ReceiptStatus}
                sentAt={(invoice as any).receipt_sent_at}
                showLabel
              />
              {getStatusBadge(invoice.status)}
            </div>
          </div>

          <div className="space-y-4 pb-6 border-b">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-semibold">${Number(invoice.subtotal || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax</span>
              <span className="font-semibold">${Number(invoice.tax || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg">
              <span className="font-bold">Total Amount</span>
              <span className="font-bold">${Number(invoice.total_amount).toFixed(2)}</span>
            </div>
          </div>

          {invoice.due_date && (
            <div className="pt-6">
              <p className="text-sm text-muted-foreground">
                Due Date: {new Date(invoice.due_date).toLocaleDateString()}
              </p>
            </div>
          )}

          {invoice.notes && (
            <div className="pt-4">
              <p className="text-sm font-medium mb-2">Notes:</p>
              <p className="text-sm text-muted-foreground">{invoice.notes}</p>
            </div>
          )}

          <div className="pt-6 space-y-3">
            {invoice.status !== 'paid' && (
              <Button className="w-full" size="lg">
                <CreditCard className="mr-2 h-5 w-5" />
                Pay Now
              </Button>
            )}
            {invoice.pdf_url && (
              <Button variant="outline" className="w-full" onClick={() => window.open(invoice.pdf_url, '_blank')}>
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </Button>
            )}
          </div>
        </Card>

        {/* Invoice Activity Timeline - Full audit trail */}
        <InvoiceActivityTimeline
          invoiceId={invoice.id}
          invoiceCreatedAt={invoice.created_at}
        />

        {/* Receipt Delivery Audit Panel */}
        <InvoiceReceiptPanel
          receiptStatus={(invoice as any).receipt_status as ReceiptStatus}
          receiptSentAt={(invoice as any).receipt_sent_at}
          receiptDeliveredAt={(invoice as any).receipt_delivered_at}
          receiptFailureReason={(invoice as any).receipt_failure_reason}
          receiptPhoneUsed={(invoice as any).receipt_phone_used}
          receiptMessageSid={(invoice as any).receipt_message_sid}
        />
      </div>
    </div>
  );
};

export default PortalInvoiceDetail;