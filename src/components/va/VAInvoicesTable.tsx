import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, Send, Copy, Loader2, FileText, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { VAInvoiceDetailDialog } from './VAInvoiceDetailDialog';

type FilterKey = 'all' | 'draft' | 'sent' | 'paid';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'sent', label: 'Sent' },
  { key: 'paid', label: 'Paid' },
];

export function VAInvoicesTable() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<FilterKey>('all');
  const [selected, setSelected] = useState<any | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['va-invoices', user?.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('va_invoices')
        .select('*')
        .eq('va_id', user!.id)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!user,
    refetchInterval: 10000,
  });

  const sendMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const { data, error } = await supabase.functions.invoke('va-send-invoice', {
        body: { invoice_id: invoiceId, channel: 'sms' },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onMutate: (id) => setSendingId(id),
    onSettled: () => setSendingId(null),
    onSuccess: (data: any) => {
      toast.success(`Invoice sent to ${data?.sent_to || 'customer'}`);
      qc.invalidateQueries({ queryKey: ['va-invoices', user?.id] });
    },
    onError: (e: any) => toast.error(e.message || 'Failed to send invoice'),
  });

  const filtered = invoices.filter((i: any) => filter === 'all' || i.status === filter);

  const copyLink = (link: string) => {
    if (!link) return;
    navigator.clipboard.writeText(link);
    toast.success('Payment link copied');
  };

  const statusBadge = (s: string) => {
    if (s === 'paid') return <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">Paid</Badge>;
    if (s === 'sent') return <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30">Sent</Badge>;
    return <Badge className="bg-slate-700 text-slate-300 border-slate-600">Draft</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-lg font-bold text-white mr-2">Invoices</h2>
        {FILTERS.map(f => {
          const count = f.key === 'all' ? invoices.length : invoices.filter((i: any) => i.status === f.key).length;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filter === f.key
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-slate-200'
              }`}
            >
              {f.label} <span className="ml-1 opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="py-16 text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-slate-700/50 flex items-center justify-center mx-auto">
              <FileText className="h-7 w-7 text-slate-500" />
            </div>
            <p className="text-slate-400">
              {filter === 'all' ? 'No invoices yet. Create one from a lead.' : `No ${filter} invoices.`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-800/50">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800 text-slate-400 text-xs">
                <th className="text-left p-3 pl-4 font-medium">Invoice #</th>
                <th className="text-left p-3 font-medium">Customer</th>
                <th className="text-left p-3 hidden md:table-cell font-medium">Service</th>
                <th className="text-right p-3 font-medium">Total</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 hidden lg:table-cell font-medium">Due</th>
                <th className="text-left p-3 hidden lg:table-cell font-medium">Created</th>
                <th className="text-right p-3 pr-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv: any, idx: number) => (
                <motion.tr
                  key={inv.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(idx * 0.02, 0.4) }}
                  className="border-t border-slate-700/50 hover:bg-slate-800/40 text-white"
                >
                  <td className="p-3 pl-4 font-mono text-xs text-cyan-300">{inv.invoice_number || '—'}</td>
                  <td className="p-3 font-medium">{inv.customer_name}</td>
                  <td className="p-3 text-slate-300 hidden md:table-cell">{inv.service_type || '—'}</td>
                  <td className="p-3 text-right font-mono text-emerald-300">${Number(inv.total || 0).toFixed(2)}</td>
                  <td className="p-3">{statusBadge(inv.status)}</td>
                  <td className="p-3 text-xs text-slate-400 hidden lg:table-cell">
                    {inv.due_date ? format(new Date(inv.due_date), 'MMM d') : '—'}
                  </td>
                  <td className="p-3 text-xs text-slate-400 hidden lg:table-cell">
                    {format(new Date(inv.created_at), 'MMM d')}
                  </td>
                  <td className="p-3 pr-4 text-right">
                    <div className="flex gap-1 justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-slate-300 hover:bg-slate-700"
                        onClick={() => { setSelected(inv); setDetailOpen(true); }}
                      >
                        <Eye className="h-3 w-3 mr-1" /> View
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-cyan-300 hover:bg-cyan-500/10"
                        disabled={sendingId === inv.id}
                        onClick={() => sendMutation.mutate(inv.id)}
                      >
                        {sendingId === inv.id ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : inv.status === 'draft' ? (
                          <Send className="h-3 w-3 mr-1" />
                        ) : (
                          <Mail className="h-3 w-3 mr-1" />
                        )}
                        {inv.status === 'draft' ? 'Send' : 'Resend'}
                      </Button>
                      {inv.payment_link && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-amber-300 hover:bg-amber-500/10"
                          onClick={() => copyLink(inv.payment_link)}
                        >
                          <Copy className="h-3 w-3 mr-1" /> Link
                        </Button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <VAInvoiceDetailDialog
        invoice={selected}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />
    </div>
  );
}
