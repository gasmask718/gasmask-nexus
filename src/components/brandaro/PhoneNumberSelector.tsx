import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Phone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface PhoneNumberSelectorProps {
  value: string;
  onChange: (number: string) => void;
  brand?: string;
  purpose?: string;
  className?: string;
}

export function PhoneNumberSelector({
  value,
  onChange,
  brand,
  purpose,
  className = '',
}: PhoneNumberSelectorProps) {
  const { data: numbers = [] } = useQuery({
    queryKey: ['phone-numbers-selector', brand, purpose],
    queryFn: async () => {
      let query = (supabase as any)
        .from('brandaro_phone_numbers')
        .select('*')
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('friendly_name');

      if (brand) query = query.eq('brand', brand);
      if (purpose) query = query.eq('purpose', purpose);

      const { data } = await query;
      return data || [];
    },
  });

  const defaultNumber = (numbers as any[]).find((n: any) => n.is_default);
  const effectiveValue = value || defaultNumber?.phone_number || '';

  return (
    <Select value={effectiveValue} onValueChange={onChange}>
      <SelectTrigger className={`h-8 text-xs ${className}`}>
        <div className="flex items-center gap-1.5">
          <Phone className="h-3 w-3 text-muted-foreground" />
          <SelectValue placeholder="Select number..." />
        </div>
      </SelectTrigger>
      <SelectContent>
        {(numbers as any[]).map((num: any) => (
          <SelectItem key={num.id} value={num.phone_number}>
            <div className="flex items-center gap-2">
              <span className="text-xs">{num.friendly_name}</span>
              {num.is_default && (
                <Badge variant="secondary" className="text-[8px] h-3.5 px-1">Default</Badge>
              )}
            </div>
          </SelectItem>
        ))}
        {(numbers as any[]).length === 0 && (
          <div className="px-3 py-2 text-xs text-muted-foreground">
            No numbers configured. Add numbers in Phone Library.
          </div>
        )}
      </SelectContent>
    </Select>
  );
}
