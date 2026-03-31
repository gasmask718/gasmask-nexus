import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useVASession } from '@/contexts/VASessionContext';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Phone, Loader2 } from 'lucide-react';

interface PhoneNumber {
  id: string;
  phone_number: string;
  friendly_name: string;
  in_use: boolean;
  assigned_va_id: string | null;
}

export function VAOnboardingModal() {
  const { isOnboarded, startSession, t } = useVASession();
  const [step, setStep] = useState<'language' | 'number'>('language');
  const [selectedLang, setSelectedLang] = useState<'en' | 'es' | null>(null);
  const [selectedNumber, setSelectedNumber] = useState<PhoneNumber | null>(null);
  const [loading, setLoading] = useState(false);

  const { data: numbers = [], isLoading } = useQuery({
    queryKey: ['va-phone-numbers'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('brandaro_phone_numbers')
        .select('id, phone_number, friendly_name, in_use, assigned_va_id')
        .eq('is_active', true)
        .order('friendly_name');
      return (data || []) as PhoneNumber[];
    },
    enabled: step === 'number',
  });

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
      <DialogContent className="max-w-lg bg-slate-900 border-cyan-500/20 text-white [&>button]:hidden" onInteractOutside={e => e.preventDefault()}>
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
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {numbers.map((num) => (
                  <div
                    key={num.id}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                      selectedNumber?.id === num.id
                        ? 'border-cyan-500 bg-cyan-500/10'
                        : num.in_use
                        ? 'border-slate-700 opacity-50'
                        : 'border-slate-700 hover:border-slate-500 cursor-pointer'
                    }`}
                    onClick={() => !num.in_use && setSelectedNumber(num)}
                  >
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-slate-400" />
                      <div>
                        <p className="font-medium text-sm">{num.friendly_name}</p>
                        <p className="text-xs text-slate-400 font-mono">{num.phone_number}</p>
                      </div>
                    </div>
                    <Badge className={num.in_use ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}>
                      {num.in_use ? `🔴 ${t('va.onboarding.inUse')}` : `🟢 ${t('va.onboarding.available')}`}
                    </Badge>
                  </div>
                ))}
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
