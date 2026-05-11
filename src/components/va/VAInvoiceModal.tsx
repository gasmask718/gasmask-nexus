import { useState, useEffect } from 'react';
import { useVASession } from '@/contexts/VASessionContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Loader2, CreditCard, SplitSquareHorizontal, Package, Mail, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

// Parse a package price string like "$1,500", "$2,997", "$5,000+" → number.
// Returns 0 for non-numeric ("Custom") so the VA can fill it in manually.
function parsePackagePrice(raw: string | null | undefined): number {
  if (!raw) return 0;
  const cleaned = String(raw).replace(/[^0-9.]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

interface LineItem { description: string; price: number; }

interface VAInvoiceModalProps {
  open: boolean;
  onClose: () => void;
  lead?: { id: string; business_name: string; phone?: string; email?: string } | null;
  sendOnSave?: boolean;
}

const SERVICE_TYPES = [
  'Website Design', 'SEO Package', 'Google Ads Management',
  'Social Media Marketing', 'Full Digital Package', 'Consultation', 'Other',
];

type PaymentType = 'full' | 'split';
type SendChannel = 'email' | 'sms';

export function VAInvoiceModal({ open, onClose, lead, sendOnSave }: VAInvoiceModalProps) {
  const { t } = useVASession();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    serviceType: '',
    dueDate: '',
    notes: '',
    paymentType: 'split' as PaymentType,
    depositPercent: 50,
    sendChannel: 'email' as SendChannel,
    lineItems: [{ description: '', price: 0 }] as LineItem[],
  });

  useEffect(() => {
    if (open && lead) {
      setForm(f => ({
        ...f,
        customerName: lead.business_name || '',
        customerEmail: lead.email || f.customerEmail,
        customerPhone: lead.phone || f.customerPhone,
      }));
    }
  }, [open, lead]);

  const total = form.lineItems.reduce((s, i) => s + (i.price || 0), 0);
  const deposit = +(total * (form.depositPercent / 100)).toFixed(2);
  const finalAmt = +(total - deposit).toFixed(2);

  const addItem = () => setForm(f => ({ ...f, lineItems: [...f.lineItems, { description: '', price: 0 }] }));
  const removeItem = (idx: number) => setForm(f => ({ ...f, lineItems: f.lineItems.filter((_, i) => i !== idx) }));
  const updateItem = (idx: number, field: keyof LineItem, value: string | number) => {
    setForm(f => ({
      ...f,
      lineItems: f.lineItems.map((item, i) => i === idx ? { ...item, [field]: value } : item),
    }));
  };

  // Pull live packages from the same DB-backed source as Scripts & Rebuttals → Services.
  const { data: packages = [] } = useQuery({
    queryKey: ['brandaro-packages-invoice'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('brandaro_packages')
        .select('id, package_name, price, payment_terms, included_highlights, sort_order')
        .eq('is_active', true)
        .order('sort_order');
      return data || [];
    },
    enabled: open,
  });

  const addPackage = (pkgId: string) => {
    const pkg = packages.find((p: any) => p.id === pkgId);
    if (!pkg) return;
    const price = parsePackagePrice(pkg.price);
    const desc = `${pkg.package_name} Package — ${pkg.included_highlights || ''}`.trim();
    setForm(f => {
      // If the only existing row is empty, replace it instead of appending.
      const onlyEmpty =
        f.lineItems.length === 1 && !f.lineItems[0].description && !f.lineItems[0].price;
      const next = { description: desc, price };
      const lineItems = onlyEmpty ? [next] : [...f.lineItems, next];
      // Auto-align payment plan to the package's terms when split is implied.
      const terms = (pkg.payment_terms || '').toLowerCase();
      const looksSplit = terms.includes('deposit') || terms.includes('launch');
      return {
        ...f,
        lineItems,
        serviceType: f.serviceType || 'Website Design',
        paymentType: looksSplit ? 'split' : f.paymentType,
        depositPercent: looksSplit ? 50 : f.depositPercent,
      };
    });
    if (price === 0) {
      toast.info(`${pkg.package_name} added — enter a custom price (listed as "${pkg.price}").`);
    } else {
      toast.success(`${pkg.package_name} added · $${price.toLocaleString()}`);
    }
  };

  const handleSave = async () => {
    if (!form.customerName || form.lineItems.length === 0 || total <= 0) {
      toast.error('Customer name + at least one line item with a price are required.');
      return;
    }
    if (sendOnSave) {
      if (form.sendChannel === 'email' && !form.customerEmail) {
        toast.error('Customer email is required to send via email.');
        return;
      }
      if (form.sendChannel === 'sms' && !form.customerPhone) {
        toast.error('Customer phone is required to send via SMS.');
        return;
      }
    }
    setSaving(true);
    try {
      const { data: inserted, error } = await (supabase as any)
        .from('va_invoices')
        .insert({
          lead_id: lead?.id || null,
          va_id: user?.id,
          customer_name: form.customerName,
          customer_email: form.customerEmail || null,
          customer_phone: form.customerPhone || null,
          service_type: form.serviceType || null,
          line_items: form.lineItems,
          total,
          status: 'draft',
          payment_type: form.paymentType,
          deposit_percent: form.paymentType === 'split' ? form.depositPercent : 100,
          due_date: form.dueDate || null,
          notes: form.notes || null,
        })
        .select('id')
        .single();
      if (error) throw error;
      const invoiceId = inserted?.id;

      const { data: stripeData, error: stripeErr } = await supabase.functions.invoke(
        'va-stripe-checkout',
        { body: { invoice_id: invoiceId } },
      );
      if (stripeErr || (stripeData as any)?.error) {
        throw new Error(stripeErr?.message || (stripeData as any)?.error || 'Stripe checkout failed');
      }

      qc.invalidateQueries({ queryKey: ['va-invoices', user?.id] });

      if (sendOnSave && invoiceId) {
        try {
          const recipient = form.sendChannel === 'email' ? form.customerEmail : form.customerPhone;
          const { data: sendData, error: sendErr } = await supabase.functions.invoke('va-send-invoice', {
            body: { invoice_id: invoiceId, channel: form.sendChannel, recipient },
          });
          if (sendErr || (sendData as any)?.error) {
            throw new Error(sendErr?.message || (sendData as any)?.error);
          }
          toast.success(`Invoice sent via ${form.sendChannel.toUpperCase()} to ${(sendData as any)?.sent_to || 'customer'}`);
          qc.invalidateQueries({ queryKey: ['va-invoices', user?.id] });
        } catch (e: any) {
          toast.warning(`Invoice + Stripe link saved — ${form.sendChannel} send failed: ${e.message}`);
        }
      } else {
        toast.success(
          form.paymentType === 'split'
            ? `Invoice saved · Stripe deposit + final links ready`
            : `Invoice saved · Stripe payment link ready`,
        );
      }
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save invoice');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-slate-900 border-cyan-500/20 text-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{sendOnSave ? 'Create & Send Invoice' : t('va.invoice.title')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400">{t('va.invoice.customerName')}</label>
              <Input value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))}
                className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div>
              <label className="text-xs text-slate-400">Customer Email</label>
              <Input type="email" value={form.customerEmail} onChange={e => setForm(f => ({ ...f, customerEmail: e.target.value }))}
                placeholder="customer@example.com" className="bg-slate-800 border-slate-700 text-white" />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400">Customer Phone (for SMS)</label>
            <Input type="tel" value={form.customerPhone} onChange={e => setForm(f => ({ ...f, customerPhone: e.target.value }))}
              placeholder="+15558675309" className="bg-slate-800 border-slate-700 text-white" />
          </div>

          {sendOnSave && (
            <div>
              <label className="text-xs text-slate-400 mb-2 block">Send Invoice Via</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, sendChannel: 'email' }))}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    form.sendChannel === 'email'
                      ? 'border-cyan-500 bg-cyan-500/10'
                      : 'border-slate-700 hover:border-slate-500'
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Mail className="h-4 w-4" /> Email
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 truncate">
                    {form.customerEmail || 'Add email above'}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, sendChannel: 'sms' }))}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    form.sendChannel === 'sms'
                      ? 'border-cyan-500 bg-cyan-500/10'
                      : 'border-slate-700 hover:border-slate-500'
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <MessageSquare className="h-4 w-4" /> Text Message
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 truncate">
                    {form.customerPhone || 'Add phone above'}
                  </div>
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="text-xs text-slate-400">{t('va.invoice.serviceType')}</label>
            <Select value={form.serviceType} onValueChange={v => setForm(f => ({ ...f, serviceType: v }))}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SERVICE_TYPES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Live packages from Scripts & Rebuttals → Services */}
          {packages.length > 0 && (
            <div>
              <label className="text-xs text-slate-400 mb-2 flex items-center gap-1.5">
                <Package className="h-3 w-3 text-cyan-300" />
                Inline a Package (live from Scripts & Rebuttals)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {packages.map((p: any) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addPackage(p.id)}
                    className="text-left p-2 rounded-lg border border-slate-700 hover:border-cyan-500/60 hover:bg-cyan-500/5 transition-all"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-bold text-white capitalize">{p.package_name}</span>
                      <span className="text-cyan-300 font-bold text-xs">{p.price}</span>
                    </div>
                    {p.payment_terms && (
                      <div className="text-[10px] text-slate-400 mt-0.5">{p.payment_terms}</div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

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

          {/* Payment type chooser */}
          <div>
            <label className="text-xs text-slate-400 mb-2 block">Payment Plan</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, paymentType: 'full' }))}
                className={`p-3 rounded-lg border text-left transition-all ${
                  form.paymentType === 'full'
                    ? 'border-cyan-500 bg-cyan-500/10'
                    : 'border-slate-700 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  <CreditCard className="h-4 w-4" /> Pay in Full
                </div>
                <div className="text-[11px] text-slate-400 mt-1">Single payment link.</div>
              </button>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, paymentType: 'split' }))}
                className={`p-3 rounded-lg border text-left transition-all ${
                  form.paymentType === 'split'
                    ? 'border-cyan-500 bg-cyan-500/10'
                    : 'border-slate-700 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  <SplitSquareHorizontal className="h-4 w-4" /> 50% Now / 50% on Completion
                </div>
                <div className="text-[11px] text-slate-400 mt-1">Two Stripe links: deposit + final.</div>
              </button>
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg p-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Total</span>
              <span className="font-bold text-cyan-400 text-lg">${total.toFixed(2)}</span>
            </div>
            {form.paymentType === 'split' && (
              <>
                <div className="flex justify-between text-xs text-slate-300">
                  <span>Deposit (now)</span>
                  <span className="font-mono">${deposit.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-300">
                  <span>Final (on completion)</span>
                  <span className="font-mono">${finalAmt.toFixed(2)}</span>
                </div>
              </>
            )}
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

          <Button onClick={handleSave} disabled={saving || total <= 0} className="w-full bg-cyan-600 hover:bg-cyan-700">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CreditCard className="h-4 w-4 mr-2" />}
            {sendOnSave ? `Save & Send via ${form.sendChannel === 'sms' ? 'SMS' : 'Email'}` : 'Save & Generate Stripe Link'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
