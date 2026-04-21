import { useState, useEffect } from 'react';
import { useVASession } from '@/contexts/VASessionContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface LineItem { description: string; price: number; }

interface VAInvoiceModalProps {
  open: boolean;
  onClose: () => void;
  lead?: { id: string; business_name: string; phone?: string; } | null;
  sendOnSave?: boolean;
}

const SERVICE_TYPES = [
  'Website Design', 'SEO Package', 'Google Ads Management',
  'Social Media Marketing', 'Full Digital Package', 'Consultation', 'Other',
];

export function VAInvoiceModal({ open, onClose, lead, sendOnSave }: VAInvoiceModalProps) {
  const { t } = useVASession();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    customerName: '',
    serviceType: '',
    dueDate: '',
    notes: '',
    lineItems: [{ description: '', price: 0 }] as LineItem[],
  });

  useEffect(() => {
    if (open && lead) {
      setForm(f => ({ ...f, customerName: lead.business_name || '' }));
    }
  }, [open, lead]);

  const total = form.lineItems.reduce((s, i) => s + (i.price || 0), 0);

  const addItem = () => setForm(f => ({ ...f, lineItems: [...f.lineItems, { description: '', price: 0 }] }));
  const removeItem = (idx: number) => setForm(f => ({ ...f, lineItems: f.lineItems.filter((_, i) => i !== idx) }));
  const updateItem = (idx: number, field: keyof LineItem, value: string | number) => {
    setForm(f => ({
      ...f,
      lineItems: f.lineItems.map((item, i) => i === idx ? { ...item, [field]: value } : item),
    }));
  };

  const handleSave = async () => {
    if (!form.customerName || form.lineItems.length === 0) {
      toast.error(t('va.invoice.required'));
      return;
    }
    setSaving(true);
    try {
      const paymentLink = `${window.location.origin}/pay/${crypto.randomUUID()}`;
      const { data: inserted, error } = await (supabase as any)
        .from('va_invoices')
        .insert({
          lead_id: lead?.id || null,
          va_id: user?.id,
          customer_name: form.customerName,
          service_type: form.serviceType || null,
          line_items: form.lineItems,
          total,
          status: 'draft',
          payment_link: paymentLink,
          due_date: form.dueDate || null,
          notes: form.notes || null,
        })
        .select('id')
        .single();
      if (error) throw error;

      qc.invalidateQueries({ queryKey: ['va-invoices', user?.id] });

      if (sendOnSave && inserted?.id) {
        try {
          const { data: sendData, error: sendErr } = await supabase.functions.invoke('va-send-invoice', {
            body: { invoice_id: inserted.id, channel: 'email' },
          });
          if (sendErr || (sendData as any)?.error) {
            throw new Error(sendErr?.message || (sendData as any)?.error);
          }
          toast.success(`Invoice created & sent to ${(sendData as any)?.sent_to || 'customer'}`);
          qc.invalidateQueries({ queryKey: ['va-invoices', user?.id] });
        } catch (e: any) {
          toast.warning(`Invoice saved as draft — send failed: ${e.message}`);
        }
      } else {
        toast.success(t('va.invoice.saved'));
      }
      onClose();
    } catch (err: any) {
      toast.error(err.message || t('va.invoice.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-slate-900 border-cyan-500/20 text-white">
        <DialogHeader>
          <DialogTitle>{sendOnSave ? 'Create & Send Invoice' : t('va.invoice.title')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-slate-400">{t('va.invoice.customerName')}</label>
            <Input value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))}
              className="bg-slate-800 border-slate-700 text-white" />
          </div>
          <div>
            <label className="text-xs text-slate-400">{t('va.invoice.serviceType')}</label>
            <Select value={form.serviceType} onValueChange={v => setForm(f => ({ ...f, serviceType: v }))}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SERVICE_TYPES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-2 block">{t('va.invoice.lineItems')}</label>
            {form.lineItems.map((item, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <Input value={item.description} onChange={e => updateItem(i, 'description', e.target.value)}
                  placeholder={t('va.invoice.description')} className="flex-1 bg-slate-800 border-slate-700 text-white text-sm" />
                <Input type="number" value={item.price || ''} onChange={e => updateItem(i, 'price', parseFloat(e.target.value) || 0)}
                  placeholder="$0" className="w-24 bg-slate-800 border-slate-700 text-white text-sm" />
                {form.lineItems.length > 1 && (
                  <Button size="icon" variant="ghost" className="text-red-400 h-9 w-9" onClick={() => removeItem(i)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={addItem} className="text-xs border-slate-700">
              <Plus className="h-3 w-3 mr-1" /> {t('va.invoice.addItem')}
            </Button>
          </div>

          <div className="flex justify-between items-center bg-slate-800 rounded-lg p-3">
            <span className="font-bold text-white">{t('va.invoice.total')}</span>
            <span className="text-xl font-bold text-cyan-400">${total.toFixed(2)}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400">{t('va.invoice.dueDate')}</label>
              <Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div>
              <label className="text-xs text-slate-400">{t('va.invoice.notes')}</label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="bg-slate-800 border-slate-700 text-white" />
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full bg-cyan-600 hover:bg-cyan-700">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {sendOnSave ? 'Save & Send' : t('va.invoice.save')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
