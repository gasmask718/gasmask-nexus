import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, Mail, MessageSquare, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface VAInvoiceDetailDialogProps {
  invoice: any | null;
  open: boolean;
  onClose: () => void;
}

export function VAInvoiceDetailDialog({ invoice, open, onClose }: VAInvoiceDetailDialogProps) {
  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['va-invoice-logs', invoice?.id],
    queryFn: async () => {
      if (!invoice?.id) return [];
      const { data } = await (supabase as any)
        .from('va_invoice_logs')
        .select('*')
        .eq('invoice_id', invoice.id)
        .order('sent_at', { ascending: false });
      return data || [];
    },
    enabled: !!invoice?.id && open,
  });

  if (!invoice) return null;

  const copyLink = () => {
    if (!invoice.payment_link) return;
    navigator.clipboard.writeText(invoice.payment_link);
    toast.success('Payment link copied');
  };

  const statusBadge = (s: string) => {
    if (s === 'paid') return <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">Paid</Badge>;
    if (s === 'sent') return <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30">Sent</Badge>;
    return <Badge className="bg-slate-700 text-slate-300 border-slate-600">Draft</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-slate-900 border-cyan-500/20 text-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>{invoice.invoice_number || 'Invoice'}</span>
            {statusBadge(invoice.status)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Customer */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs text-slate-400 mb-1">Customer</div>
              <div className="font-medium">{invoice.customer_name}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">Service</div>
              <div className="font-medium">{invoice.service_type || '—'}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">Created</div>
              <div className="font-medium">{format(new Date(invoice.created_at), 'MMM d, yyyy')}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">Due</div>
              <div className="font-medium">
                {invoice.due_date ? format(new Date(invoice.due_date), 'MMM d, yyyy') : '—'}
              </div>
            </div>
          </div>

          {/* Line items */}
          <div className="rounded-lg border border-slate-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-800 text-slate-400 text-xs">
                <tr>
                  <th className="text-left p-2 pl-3">Description</th>
                  <th className="text-right p-2 pr-3 w-24">Price</th>
                </tr>
              </thead>
              <tbody>
                {(invoice.line_items || []).map((item: any, i: number) => (
                  <tr key={i} className="border-t border-slate-700">
                    <td className="p-2 pl-3">{item.description || '—'}</td>
                    <td className="p-2 pr-3 text-right font-mono">${Number(item.price || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-800/50 border-t border-slate-700">
                  <td className="p-2 pl-3 font-bold">Total</td>
                  <td className="p-2 pr-3 text-right font-bold text-cyan-400 text-base">
                    ${Number(invoice.total || 0).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Payment link */}
          {invoice.payment_link && (
            <div className="bg-slate-800 rounded-lg p-3 flex items-center gap-2">
              <code className="text-xs text-slate-300 truncate flex-1">{invoice.payment_link}</code>
              <Button size="sm" variant="ghost" onClick={copyLink} className="text-cyan-400 h-7">
                <Copy className="h-3 w-3 mr-1" /> Copy
              </Button>
            </div>
          )}

          {invoice.notes && (
            <div>
              <div className="text-xs text-slate-400 mb-1">Notes</div>
              <p className="text-sm text-slate-300 italic">{invoice.notes}</p>
            </div>
          )}

          {invoice.last_send_error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
              <strong>Last send error:</strong> {invoice.last_send_error}
            </div>
          )}

          {/* Send history */}
          <div>
            <div className="text-xs text-slate-400 mb-2 font-semibold uppercase tracking-wide">Send History</div>
            {logsLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
            ) : logs.length === 0 ? (
              <p className="text-xs text-slate-500">Not sent yet</p>
            ) : (
              <div className="space-y-1.5">
                {logs.map((log: any) => (
                  <div key={log.id} className="flex items-center gap-2 text-xs bg-slate-800/50 rounded p-2">
                    {log.sent_via === 'sms' ? (
                      <MessageSquare className="h-3 w-3 text-amber-400" />
                    ) : (
                      <Mail className="h-3 w-3 text-cyan-400" />
                    )}
                    <span className="text-slate-300">{log.sent_to}</span>
                    <span className="text-slate-500 ml-auto">
                      {format(new Date(log.sent_at), 'MMM d, h:mm a')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
