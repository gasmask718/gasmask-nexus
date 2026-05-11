/**
 * VAActiveNumberSwitcher — live caller-ID swap for an in-session VA.
 *
 * Pulls the same dc_phone_numbers pool used by the onboarding modal and lets
 * the VA change the active Twilio number without ending the session. The
 * selected number is what every subsequent outbound call (browser SDK or
 * server-dispatched) uses as the From / callerId.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useVASession } from '@/contexts/VASessionContext';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Phone } from 'lucide-react';
import { toast } from 'sonner';

interface PoolNumber {
  id: string;
  phone_number: string;
  friendly_name: string;
  business: string | null;
}

export function VAActiveNumberSwitcher() {
  const { twilioNumberId, twilioNumber, switchNumber, isOnboarded } = useVASession();

  const { data: numbers = [] } = useQuery({
    queryKey: ['va-active-number-switcher'],
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
      })) as PoolNumber[];
    },
    enabled: isOnboarded,
  });

  if (!isOnboarded) return null;

  const handleChange = async (id: string) => {
    const picked = numbers.find((n) => n.id === id);
    if (!picked) return;
    try {
      await switchNumber(picked.id, picked.phone_number);
      toast.success(`Caller ID set to ${picked.friendly_name} · ${picked.phone_number}`);
    } catch (err: any) {
      toast.error(`Failed to switch number: ${err?.message || 'unknown error'}`);
    }
  };

  return (
    <Select value={twilioNumberId ?? ''} onValueChange={handleChange}>
      <SelectTrigger className="h-8 w-[230px] bg-cyan-500/10 border-cyan-500/30 text-cyan-300 text-xs">
        <div className="flex items-center gap-1.5 min-w-0">
          <Phone className="h-3 w-3 shrink-0" />
          <SelectValue placeholder="Select active number…">
            <span className="font-mono truncate">{twilioNumber || 'Select number'}</span>
          </SelectValue>
        </div>
      </SelectTrigger>
      <SelectContent className="bg-slate-900 border-slate-700 text-white">
        {numbers.map((num) => (
          <SelectItem key={num.id} value={num.id} className="focus:bg-cyan-500/10 focus:text-cyan-300">
            <div className="flex flex-col">
              <span className="text-xs font-medium">{num.friendly_name}</span>
              <span className="text-[10px] text-slate-400 font-mono">{num.phone_number}</span>
            </div>
          </SelectItem>
        ))}
        {numbers.length === 0 && (
          <div className="px-3 py-2 text-xs text-slate-400">No numbers available.</div>
        )}
      </SelectContent>
    </Select>
  );
}
