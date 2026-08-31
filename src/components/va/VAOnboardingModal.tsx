/**
 * VAOnboardingModal — session start gate for the VA portal.
 *
 * Company-scoped: numbers come from v_va_caller_ids for the ACTIVE company
 * (VACompanyContext). A company with no assigned number blocks session start
 * with an explicit message instead of silently leaking the global pool.
 */
import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Phone, CheckCircle2, AlertTriangle, Globe, Bot } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useVACompany } from '@/contexts/VACompanyContext';
import { useVASession } from '@/contexts/VASessionContext';
import { useVACallerIds } from '@/hooks/useVACallerIds';
import { toast } from 'sonner';

interface VAOnboardingModalProps {
  isOpen?: boolean;
  onSessionStarted?: (selectedNumber: string, agentName?: string) => void;
}

function useNumberLastSessions(numberIds: string[]) {
  return useQuery({
    queryKey: ['va-number-last-sessions', numberIds],
    enabled: numberIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('va_sessions')
        .select('twilio_number_id, created_at')
        .in('twilio_number_id', numberIds)
        .order('created_at', { ascending: false });

      const byNumber: Record<string, string> = {};
      (data || []).forEach((s: any) => {
        if (!byNumber[s.twilio_number_id]) byNumber[s.twilio_number_id] = s.created_at;
      });
      return byNumber;
    },
  });
}

export function VAOnboardingModal({ isOpen: isOpenProp, onSessionStarted }: VAOnboardingModalProps = {}) {
  const session = useVASession();
  const isOpen = isOpenProp ?? !session.isOnboarded;
  const { activeCompany, companies, setActiveCompany } = useVACompany();
  const { numbers, defaultNumber, hasNumbers, isLoading: numbersLoading } = useVACallerIds(activeCompany?.id);

  const [step, setStep] = useState<1 | 2>(1);
  const [language, setLanguage] = useState<'en' | 'es'>('en');
  const [selectedNumber, setSelectedNumber] = useState<string>('');
  const [isStarting, setIsStarting] = useState(false);
  const [forceReleaseId, setForceReleaseId] = useState<string | null>(null);
  const [isForceReleasing, setIsForceReleasing] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string>('va-agent-jackson');

  // Which companies have at least one callable number (for the switch shortcut)
  const { data: companiesWithNumbers = [] } = useQuery({
    queryKey: ['va-companies-with-numbers'],
    enabled: isOpen && companies.length > 1,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('v_va_caller_ids')
        .select('company_id')
        .not('phone_number', 'is', null)
        .eq('number_status', 'active');
      const ids = new Set(((data || []) as any[]).map((r) => r.company_id));
      return companies.filter((c) => ids.has(c.id));
    },
  });

  // Default-select the company's default caller ID whenever the list changes
  useEffect(() => {
    if (defaultNumber) setSelectedNumber(defaultNumber.phone_number);
    else setSelectedNumber('');
  }, [defaultNumber?.dc_number_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: lastSessions = {} } = useNumberLastSessions(numbers.map((n) => n.dc_number_id));

  const handleForceRelease = async () => {
    if (!forceReleaseId) return;
    setIsForceReleasing(true);
    try {
      const { error } = await (supabase as any)
        .from('dc_phone_numbers')
        .update({ assigned_to: null })
        .eq('id', forceReleaseId);
      if (error) throw error;
      toast.success('Number released. You can now select it.');
      setForceReleaseId(null);
    } catch (err: any) {
      toast.error(`Force release failed: ${err?.message || 'unknown error'}`);
    } finally {
      setIsForceReleasing(false);
    }
  };

  const handleStart = async () => {
    const picked = numbers.find((n) => n.phone_number === selectedNumber);
    if (!picked) return;
    setIsStarting(true);
    try {
      if (onSessionStarted) await onSessionStarted(picked.phone_number, selectedAgent);
      else await session.startSession(picked.dc_number_id, picked.phone_number, language);
    } catch (err: any) {
      toast.error(`Failed to start session: ${err?.message || 'unknown error'}`);
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="max-w-2xl" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Phone className="h-5 w-5 text-primary" />
            Start Your VA Session{activeCompany ? ` — ${activeCompany.name}` : ''}
          </DialogTitle>
          <DialogDescription>
            {step === 1
              ? 'Step 1 of 2: Choose your language preference'
              : `Step 2 of 2: Select the ${activeCompany?.name ?? 'company'} phone number you'll call from`}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4 py-4">
            <Label>Language / Idioma</Label>
            <Select value={language} onValueChange={(v: any) => setLanguage(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">
                  <span className="flex items-center gap-2">
                    <Globe className="h-3.5 w-3.5" /> English
                  </span>
                </SelectItem>
                <SelectItem value="es">
                  <span className="flex items-center gap-2">
                    <Globe className="h-3.5 w-3.5" /> Español
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            <input type="hidden" value={selectedAgent} />
            <Button onClick={() => setStep(2)} className="w-full">
              Continue
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 py-4">
            <Label>Phone Number</Label>

            {numbersLoading && (
              <div className="text-sm text-muted-foreground py-6 text-center">Loading numbers…</div>
            )}

            {!numbersLoading && !hasNumbers && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 space-y-3">
                <div className="flex items-center gap-2 text-amber-400">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <p className="text-sm font-semibold">
                    {activeCompany?.name ?? 'This company'} has no phone number assigned.
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Add one before calling. The owner assigns numbers per company in the phone library —
                  calls are blocked until then so no other company's caller ID is used by mistake.
                </p>
                {companiesWithNumbers.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <p className="text-xs text-muted-foreground">Or switch to a company that has one:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {companiesWithNumbers.map((c) => (
                        <Button
                          key={c.id}
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => setActiveCompany(c.id)}
                        >
                          {c.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {numbers.map((num) => {
                const isSelected = selectedNumber === num.phone_number;
                const lastUsed = lastSessions[num.dc_number_id];
                return (
                  <div
                    key={num.dc_number_id}
                    onClick={() => setSelectedNumber(num.phone_number)}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-primary/10 border-primary'
                        : 'border-border hover:bg-accent/50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {isSelected && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium">{num.friendly_name || num.phone_number}</p>
                          {num.is_default_caller_id && (
                            <Badge variant="secondary" className="text-[9px] h-4 px-1.5">Default</Badge>
                          )}
                          {num.is_ai_number && (
                            <Badge
                              variant="outline"
                              className="text-[9px] h-4 px-1.5 border-amber-500/40 text-amber-400 gap-1"
                            >
                              <Bot className="h-2.5 w-2.5" /> AI line
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground font-mono">{num.phone_number}</p>
                        {num.is_ai_number && num.use_note && (
                          <p className="text-[10px] text-amber-400/80 mt-0.5">{num.use_note}</p>
                        )}
                        {lastUsed && (
                          <p className="text-[10px] text-muted-foreground/60">
                            Last used {new Date(lastUsed).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {forceReleaseId && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                <p className="text-xs text-amber-300 flex-1">
                  This number is assigned to another session. Force release it?
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleForceRelease}
                  disabled={isForceReleasing}
                  className="border-amber-500/30 text-amber-300 hover:bg-amber-500/20"
                >
                  {isForceReleasing ? 'Releasing…' : 'Force Release'}
                </Button>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                onClick={handleStart}
                disabled={!selectedNumber || isStarting || !hasNumbers}
                className="flex-1"
              >
                {isStarting ? 'Starting…' : 'Start Session'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
