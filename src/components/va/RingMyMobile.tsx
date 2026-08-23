/**
 * RingMyMobile — "ring my mobile too" for the VA portal.
 *
 * A VA in the field cannot use the browser softphone. This writes their own
 * inbound_ring_targets row (target_type='mobile', user_id=them) for the
 * ACTIVE company. The switch IS the on-shift marker for the mobile leg:
 * on → the inbound handler rings their cell; off → it doesn't.
 *
 * RLS: ring_va_insert_own_mobile requires an active va_company_memberships
 * row for the company, so a VA can only register against their own companies.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useVACompanySafe } from '@/contexts/VACompanyContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Smartphone, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

function toE164(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return raw.startsWith('+') ? raw : `+${digits}`;
}

export function RingMyMobile() {
  const companyCtx = useVACompanySafe();
  const activeCompany = companyCtx?.activeCompany ?? null;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [rowId, setRowId] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!activeCompany) { setLoading(false); return; }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) { setLoading(false); return; }
      setUserId(user.id);
      const { data } = await (supabase as any)
        .from('inbound_ring_targets')
        .select('id, phone_e164, active')
        .eq('va_company_id', activeCompany.id)
        .eq('user_id', user.id)
        .eq('target_type', 'mobile')
        .maybeSingle();
      if (!cancelled) {
        if (data) {
          setRowId(data.id);
          setPhone(data.phone_e164 || '');
          setEnabled(!!data.active);
        } else {
          setRowId(null);
          setEnabled(false);
        }
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeCompany?.id]);

  const save = async (nextEnabled: boolean, nextPhone: string) => {
    if (!userId || !activeCompany) return;
    const e164 = toE164(nextPhone.trim());
    if (nextEnabled && !/^\+[1-9]\d{7,14}$/.test(e164)) {
      toast.error('Enter your mobile in full format, e.g. +17185551234');
      return;
    }
    setSaving(true);
    const payload = {
      va_company_id: activeCompany.id,
      user_id: userId,
      label: 'My mobile',
      target_type: 'mobile',
      phone_e164: e164,
      ring_order: 10,
      active: nextEnabled,
      only_business_hours: false,
    };
    const { data, error } = rowId
      ? await (supabase as any).from('inbound_ring_targets').update(payload).eq('id', rowId).select('id').maybeSingle()
      : await (supabase as any).from('inbound_ring_targets').insert(payload).select('id').maybeSingle();
    setSaving(false);
    if (error) {
      toast.error(`Could not save: ${error.message}`);
      return;
    }
    if (data?.id) setRowId(data.id);
    setEnabled(nextEnabled);
    toast.success(nextEnabled
      ? `Inbound calls for ${activeCompany.name} will ring ${e164} while you're on shift`
      : 'Your mobile will no longer ring');
  };

  if (!activeCompany || loading) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className={enabled
            ? 'gap-1 text-emerald-400 hover:text-emerald-300'
            : 'gap-1 text-slate-400 hover:text-slate-200'}
          title={enabled ? `Inbound rings your mobile (${phone})` : 'Ring my mobile on inbound calls'}
        >
          <Smartphone className="h-3 w-3" />
          <span className="hidden md:inline">{enabled ? 'Mobile rings' : 'Ring my mobile'}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 bg-slate-900 border-slate-700 text-white" align="end">
        <div className="space-y-3">
          <p className="text-xs text-slate-400">
            When someone calls a {activeCompany.name} number and no softphone picks up,
            your mobile rings too. Turn this off when you go off shift.
          </p>
          <div className="space-y-1.5">
            <Label className="text-xs">Your mobile</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+17185551234"
              className="h-8 bg-slate-800 border-slate-600 text-white text-sm"
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Ring my mobile</Label>
            {saving
              ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              : (
                <Switch
                  checked={enabled}
                  onCheckedChange={(v) => save(v, phone)}
                  disabled={saving}
                />
              )}
          </div>
          {enabled && (
            <Button
              size="sm"
              variant="outline"
              className="w-full h-7 text-xs border-slate-600"
              disabled={saving}
              onClick={() => save(true, phone)}
            >
              Save number
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
