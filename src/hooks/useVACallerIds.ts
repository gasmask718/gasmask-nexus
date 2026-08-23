/**
 * useVACallerIds — the phone numbers a VA may present as caller ID for one
 * company, read from v_va_caller_ids (owner-maintained mapping of
 * dc_phone_numbers → va_companies with default + AI/human-line flags).
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface VACallerId {
  dc_number_id: string;
  phone_number: string;
  number_friendly_name: string | null;
  is_default_caller_id: boolean;
  is_ai_number: boolean;
  use_note: string | null;
  calls_for: string | null;
}

export function useVACallerIds(companyId: string | null | undefined) {
  const query = useQuery({
    queryKey: ['va-caller-ids', companyId],
    enabled: !!companyId,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<VACallerId[]> => {
      const { data, error } = await (supabase as any)
        .from('v_va_caller_ids')
        .select(
          'dc_number_id, phone_number, number_friendly_name, is_default_caller_id, is_ai_number, use_note, calls_for',
        )
        .eq('company_id', companyId)
        .eq('number_status', 'active')
        .not('phone_number', 'is', null)
        .order('is_default_caller_id', { ascending: false })
        .order('number_friendly_name');
      if (error) throw error;
      return (data || []) as VACallerId[];
    },
  });

  const numbers = query.data ?? [];
  const defaultNumber = numbers.find((n) => n.is_default_caller_id) ?? numbers[0] ?? null;

  return { ...query, numbers, defaultNumber, hasNumbers: numbers.length > 0 };
}
