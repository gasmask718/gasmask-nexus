import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Decor categories registered in tt_service_routing where 'decorator' ∈ partner_types.
// Keep in sync with the validate_provider_package() trigger's whitelist.
export const DECOR_CATEGORIES = [
  { slug: 'hotel-decor', label: 'Hotel Decor' },
  { slug: 'truck-decor', label: 'Truck / Vehicle Decor' },
] as const;

export type DecoratorPackage = {
  id: string;
  tt_partner_id: string | null;
  provider_id: string | null;
  category: string;
  name: string;
  description: string | null;
  price: number;
  platform_fee_pct: number;
  is_published: boolean;
  is_active: boolean;
  inclusions: unknown;
  created_at?: string;
  updated_at?: string;
};

export type PackageInput = {
  category: string;
  name: string;
  description?: string | null;
  price: number;
  platform_fee_pct?: number;
  inclusions?: unknown;
  is_published?: boolean;
};

const TABLE = 'provider_packages' as const;

export function useDecoratorPackages(ttPartnerId: string | null | undefined) {
  return useQuery({
    queryKey: ['decorator-packages', ttPartnerId],
    enabled: !!ttPartnerId,
    queryFn: async (): Promise<DecoratorPackage[]> => {
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .select('*')
        .eq('tt_partner_id', ttPartnerId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as DecoratorPackage[];
    },
  });
}

export function useDecoratorPackageMutations(ttPartnerId: string | null | undefined) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['decorator-packages', ttPartnerId] });

  const createPackage = useMutation({
    mutationFn: async (input: PackageInput) => {
      if (!ttPartnerId) throw new Error('Missing tt_partner_id');
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .insert({
          tt_partner_id: ttPartnerId,
          provider_id: null,
          category: input.category,
          name: input.name,
          description: input.description ?? null,
          price: input.price,
          platform_fee_pct: input.platform_fee_pct ?? 15,
          inclusions: input.inclusions ?? [],
          is_published: input.is_published ?? false,
          is_active: true,
        })
        .select('*')
        .single();
      if (error) throw error;
      return data as DecoratorPackage;
    },
    onSuccess: invalidate,
  });

  const updatePackage = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<PackageInput> }) => {
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .update(patch)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return data as DecoratorPackage;
    },
    onSuccess: invalidate,
  });

  const deletePackage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from(TABLE).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const publishPackage = useMutation({
    mutationFn: async ({ id, is_published }: { id: string; is_published: boolean }) => {
      const { error } = await (supabase as any)
        .from(TABLE)
        .update({ is_published })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { createPackage, updatePackage, deletePackage, publishPackage };
}
