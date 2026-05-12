import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useVASession } from '@/contexts/VASessionContext';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Phone, Loader2, Clock, User, PhoneOutgoing, Unlock } from 'lucide-react';
import { toast } from 'sonner';
import {
  useNumberLastSessions,
  formatDateTime,
  formatDuration,
} from '@/hooks/useNumberLastSessions';

interface PhoneNumber {
  id: string;
  phone_number: string;
  friendly_name: string;
  business: string | null;
}

export function VAOnboardingModal() {
  const { isOnboarded, startSession, t } = useVASession();
  const [step, setStep] = useState<'language' | 'number'>('language');
  const [selectedLang, setSelectedLang] = useState<'en' | 'es' | null>(null);
  const [selectedNumber, setSelectedNumber] = useState<PhoneNumber | null>(null);
  const [loading, setLoading] = useState(false);
  const [releasingId, setReleasingId] = useState<string | null>(null);
  const qc = useQueryClient();

  const handleForceRelease = async (numberId: string, label: string) => {
    setReleasingId(numberId);
    try {
      const { data, error } = await (supabase as any).rpc('force_release_va_number', {
        p_number_id: numberId,
      });
      if (error) throw error;
      toast.success(`Released ${label} (${data ?? 0} session${data === 1 ? '' : 's'} closed)`);
      await qc.invalidateQueries({ queryKey: ['brandaro-number-last-sessions'] });
    } catch (e: any) {
      toast.error(`Force release failed: ${e?.message || 'unknown error'}`);
    } finally {
      setReleasingId(null);
    }
  };

  // Pull numbers from /communication/provision-numbers source of truth (dc_phone_numbers).
  // Exclude toll-free + Brandaro AI Agent numbers (cannot be used as VA caller-ID).
  const { data: numbers = [], isLoading } = useQuery({
    queryKey: ['va-phone-numbers-dc'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('dc_phone_numbers')
        .select('id, phone_number, friendly_name, business, number_type, is_active')
        .eq('is_active', true)
        .eq('number_type', 'local')
        .not('friendly_name', 'ilike', '%AI Agent%')
        .order('business')
        .order('phone_number');
      return ((data || []) as any[]).map((n) => ({
        id: n.id,
        phone_number: n.phone_number,
        friendly_name: n.friendly_name || n.phone_number,
        business: n.business,
      })) as PhoneNumber[];
    },
    enabled: step === 'number',
  });

  // Last-session enrichment so each number row shows who last used it,
  // when, how long, and whether it's currently held by another VA.
  const { data: sessionData } = useNumberLastSessions();
  const sessionsById = sessionData?.byId;

  const handleStart = async () => {
    if (!selectedNumber || !selectedLang) return;
    setLoading(true);
    try {
      await startSession(selectedNumber.id, selectedNumber.phone_number, selectedLang);
    } finally {
      setLoading(false);
    }
  };

  if (isOnboarded) return null;

  return (
    <Dialog open={!isOnboarded} onOpenChange={() => {}}>
      <DialogContent className="max-w-xl bg-slate-900 border-cyan-500/20 text-white [&>button]:hidden" onInteractOutside={e => e.preventDefault()}>
        {step === 'language' ? (
          <div className="text-center space-y-6 py-4">
            <h2 className="text-xl font-bold">{t('va.onboarding.languageTitle')}</h2>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => { setSelectedLang('en'); setStep('number'); }}
                className="p-8 rounded-xl border-2 border-slate-700 hover:border-cyan-500 transition-all text-center space-y-2 hover:bg-cyan-500/10"
              >
                <span className="text-4xl">🇺🇸</span>
                <p className="font-semibold text-lg">English</p>
              </button>
              <button
                onClick={() => { setSelectedLang('es'); setStep('number'); }}
                className="p-8 rounded-xl border-2 border-slate-700 hover:border-cyan-500 transition-all text-center space-y-2 hover:bg-cyan-500/10"
              >
                <span className="text-4xl">🇪🇸</span>
                <p className="font-semibold text-lg">Español</p>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{t('va.onboarding.numberTitle')}</h2>
              <button onClick={() => setStep('language')} className="text-xs text-cyan-400 hover:text-cyan-300">← Back</button>
            </div>
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-cyan-400" /></div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {numbers.map((num) => {
                  const sess = sessionsById?.get(num.id);
                  const isActive = !!sess?.session_active && !sess?.ended_at;
                  const lastUserLabel = sess?.va_name
                    || (sess?.last_va_id ? `${sess.last_va_id.slice(0, 8)}…` : null);
                  const todayDials = sess?.today_dials ?? 0;
                  return (
                    <div
                      key={num.id}
                      className={`p-3 rounded-lg border transition-all ${
                        selectedNumber?.id === num.id
                          ? 'border-cyan-500 bg-cyan-500/10'
                          : isActive
                          ? 'border-amber-500/40 bg-amber-500/5 opacity-80'
                          : 'border-slate-700 hover:border-slate-500 cursor-pointer'
                      }`}
                      onClick={() => !isActive && setSelectedNumber(num)}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <Phone className="h-4 w-4 text-slate-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{num.friendly_name}</p>
                            <p className="text-xs text-slate-400 font-mono">{num.phone_number}</p>
                          </div>
                        </div>
                        {isActive ? (
                          <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                            <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Currently Active
                          </Badge>
                        ) : (
                          <Badge className="bg-slate-700/40 text-slate-300 border border-slate-600 shrink-0">
                            🟢 {t('va.onboarding.available')}
                          </Badge>
                        )}
                      </div>
                      <div className="mt-2 grid grid-cols-4 gap-2 text-[11px] text-slate-400 pl-7">
                        <div className="flex items-center gap-1 min-w-0">
                          <User className="h-3 w-3 shrink-0" />
                          <span className="truncate" title={lastUserLabel || ''}>
                            {lastUserLabel || 'Never used'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 shrink-0" />
                          <span>{sess?.session_id ? formatDateTime(sess.started_at) : '—'}</span>
                        </div>
                        <div className="font-mono">
                          {sess?.session_id ? formatDuration(sess.started_at, sess.ended_at) : '—'}
                        </div>
                        <div className="flex items-center justify-end gap-1 font-mono">
                          <PhoneOutgoing className="h-3 w-3 text-cyan-400" />
                          <span className="text-cyan-300">{todayDials}</span>
                          <span className="text-slate-500">today</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <Button
              onClick={handleStart}
              disabled={!selectedNumber || loading}
              className="w-full bg-cyan-600 hover:bg-cyan-700"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t('va.onboarding.startSession')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
