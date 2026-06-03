import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Building2, Music, Sparkles, Shield, Wrench, Zap, Brain, Phone, Rocket, Star,
  type LucideIcon,
} from 'lucide-react';

export interface DCBusiness {
  business_key: string;
  name: string;
  icon: string;
  color: string;
  is_live: boolean;
  is_internal: boolean;
  sort_order: number;
  agents_label: string | null;
  phone_default: string | null;
}

const ICON_MAP: Record<string, LucideIcon> = {
  Building2, Music, Sparkles, Shield, Wrench, Zap, Brain, Phone, Rocket, Star,
};

export function getDCBusinessIcon(name: string): LucideIcon {
  return ICON_MAP[name] || Building2;
}

export function useDCBusinesses() {
  return useQuery({
    queryKey: ['dc-businesses'],
    queryFn: async (): Promise<DCBusiness[]> => {
      const { data, error } = await (supabase as any)
        .from('dc_businesses')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    staleTime: 60_000,
  });
}
