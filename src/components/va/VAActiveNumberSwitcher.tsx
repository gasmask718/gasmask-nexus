/**
 * VAActiveNumberSwitcher — live caller-ID swap for an in-session VA.
 *
 * Company-scoped: lists only the ACTIVE company's numbers from
 * v_va_caller_ids. AI-backed lines are flagged so the VA knows callbacks to
 * that number reach the AI agent, not a human. A company with no number
 * renders a blocked state instead of leaking the global pool.
 */
import { useVASession } from '@/contexts/VASessionContext';
import { useVACompany } from '@/contexts/VACompanyContext';
import { useVACallerIds } from '@/hooks/useVACallerIds';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Phone, AlertTriangle, Bot } from 'lucide-react';
import { toast } from 'sonner';

export function VAActiveNumberSwitcher() {
  const { twilioNumberId, twilioNumber, switchNumber, isOnboarded } = useVASession();
  const { activeCompany } = useVACompany();
  const { numbers: allNumbers } = useVACallerIds(activeCompany?.id);
  // Human VAs never present the AI agent line as their outbound caller ID.
  const numbers = allNumbers.filter((n) => !n.is_ai_number);
  const hasNumbers = numbers.length > 0;

  if (!isOnboarded) return null;

  if (!hasNumbers) {
    return (
      <span className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-400 text-xs">
        <AlertTriangle className="h-3 w-3" />
        No caller ID — calls blocked
      </span>
    );
  }

  const handleChange = async (id: string) => {
    const picked = numbers.find((n) => n.dc_number_id === id);
    if (!picked) return;
    try {
      await switchNumber(picked.dc_number_id, picked.phone_number);
      toast.success(
        `Caller ID set to ${picked.friendly_name || picked.phone_number} · ${picked.phone_number}`,
      );
    } catch (err: any) {
      toast.error(`Failed to switch number: ${err?.message || 'unknown error'}`);
    }
  };

  return (
    <Select value={twilioNumberId ?? ''} onValueChange={handleChange}>
      <SelectTrigger className="h-8 w-[230px] bg-caller/10 border-caller/30 text-caller-glow text-xs">
        <div className="flex items-center gap-1.5 min-w-0">
          <Phone className="h-3 w-3 shrink-0" />
          <SelectValue placeholder="Select active number…">
            <span className="font-mono truncate">{twilioNumber || 'Select number'}</span>
          </SelectValue>
        </div>
      </SelectTrigger>
      <SelectContent className="bg-slate-900 border-slate-700 text-white">
        {numbers.map((num) => (
          <SelectItem
            key={num.dc_number_id}
            value={num.dc_number_id}
            className="focus:bg-caller/10 focus:text-caller"
          >
            <div className="flex flex-col">
              <span className="text-xs font-medium flex items-center gap-1.5">
                {num.friendly_name || num.phone_number}
                {num.is_default_caller_id && (
                  <span className="text-[9px] text-slate-400">(default)</span>
                )}
                {num.is_ai_number && (
                  <span
                    className="inline-flex items-center gap-0.5 text-[9px] text-amber-400"
                    title="Humans-first inbound is live: callbacks ring on-shift VAs and forward phones first; the AI concierge answers only if nobody picks up."
                  >
                    <Bot className="h-2.5 w-2.5" /> AI fallback
                  </span>
                )}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">{num.phone_number}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
