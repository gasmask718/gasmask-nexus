import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Phone, Clock, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { VAInvoiceModal } from './VAInvoiceModal';

interface Callback {
  id: string;
  lead_id: string;
  callback_scheduled_at: string;
  va_notes: string | null;
  lead_name?: string;
  lead_phone?: string;
}

interface VACallbacksQueueProps {
  onDialLead: (lead: { id: string; business_name: string; phone: string }) => void;
}

export function VACallbacksQueue({ onDialLead }: VACallbacksQueueProps) {
  const { user } = useAuth();
  const [callbacks, setCallbacks] = useState<Callback[]>([]);
  const [invoiceLead, setInvoiceLead] = useState<{ id: string; business_name: string; phone?: string } | null>(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [sendMode, setSendMode] = useState(false);

  const fetchCallbacks = async () => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from('va_call_logs')
      .select('id, lead_id, callback_scheduled_at, va_notes, brandaro_qualified_leads(business_name, phone_number)')
      .eq('va_id', user.id)
      // Dispositions are stored as UPPER_SNAKE codes (dialer_disposition_codes
      // / va_call_logs_disposition_check). Filtering on 'callback' matched
      // nothing, so scheduled callbacks never appeared in this queue.
      .eq('disposition', 'CALL_BACK')
      .not('callback_scheduled_at', 'is', null)
      .order('callback_scheduled_at', { ascending: true });

    if (data) {
      setCallbacks(data.map((d: any) => ({
        ...d,
        lead_name: d.brandaro_qualified_leads?.business_name || 'Unknown',
        lead_phone: d.brandaro_qualified_leads?.phone_number || '',
      })));
    }
  };

  useEffect(() => {
    fetchCallbacks();
    const interval = setInterval(fetchCallbacks, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // Toast notifications for due callbacks
  useEffect(() => {
    const checkDue = () => {
      const now = new Date();
      callbacks.forEach(cb => {
        const scheduled = new Date(cb.callback_scheduled_at);
        const diffMs = scheduled.getTime() - now.getTime();
        if (diffMs >= 0 && diffMs < 60000) {
          toast.info(`📞 Callback due: ${cb.lead_name}`, { duration: 10000 });
        }
      });
    };
    const interval = setInterval(checkDue, 30000);
    return () => clearInterval(interval);
  }, [callbacks]);

  const isPast = (dateStr: string) => new Date(dateStr) < new Date();

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader className="pb-2">
        <CardTitle className="text-white text-sm flex items-center gap-2">
          <Clock className="h-4 w-4 text-orange-400" />
          Scheduled Callbacks ({callbacks.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {callbacks.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">No callbacks scheduled</p>
        ) : (
          <div className="space-y-2">
            {callbacks.map(cb => (
              <div key={cb.id} className={`flex items-center justify-between p-2 rounded-lg border ${isPast(cb.callback_scheduled_at) ? 'border-orange-500/30 bg-orange-500/5' : 'border-slate-700 bg-slate-800/30'}`}>
                <div>
                  <p className="text-sm text-white font-medium">{cb.lead_name}</p>
                  <p className="text-xs text-slate-400 font-mono">{cb.lead_phone}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <Clock className="h-3 w-3 text-slate-500" />
                    <span className="text-xs text-slate-400">
                      {new Date(cb.callback_scheduled_at).toLocaleString()}
                    </span>
                    {isPast(cb.callback_scheduled_at) && (
                      <Badge className="bg-orange-500/20 text-orange-400 text-[10px]">OVERDUE</Badge>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Button size="sm" className="bg-gasmask text-gasmask-foreground hover:bg-gasmask-glow gap-1"
                    onClick={() => onDialLead({ id: cb.lead_id, business_name: cb.lead_name || '', phone: cb.lead_phone || '' })}>
                    <Phone className="h-3 w-3" /> Call
                  </Button>
                  <Button size="sm" variant="outline" className="border-gasmask/40 text-gasmask-glow gap-1 h-7 text-xs"
                    onClick={() => {
                      setInvoiceLead({ id: cb.lead_id, business_name: cb.lead_name || '', phone: cb.lead_phone || '' });
                      setSendMode(true);
                      setInvoiceOpen(true);
                    }}>
                    <FileText className="h-3 w-3" /> Invoice
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <VAInvoiceModal
        open={invoiceOpen}
        onClose={() => { setInvoiceOpen(false); setSendMode(false); }}
        lead={invoiceLead}
        sendOnSave={sendMode}
      />
    </Card>
  );
}
