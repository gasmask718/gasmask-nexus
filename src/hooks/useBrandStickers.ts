import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { TUBE_BRANDS, TubeIntelRole } from './useTubeIntelligence';

// Canonical sticker names - SINGLE SOURCE OF TRUTH
export const STICKER_TYPES = [
  { id: 'front_door_sticker', name: 'Front Door Sticker', icon: 'door' },
  { id: 'brand_character_sticker', name: 'Brand Character Sticker', icon: 'character' },
  { id: 'authorized_retailer_sticker', name: 'Authorized Retailer Sticker', icon: 'badge' },
  { id: 'telephone_number_sticker', name: 'Telephone Number Sticker', icon: 'phone' },
] as const;

export type StickerTypeId = typeof STICKER_TYPES[number]['id'];

export interface BrandStickerStatus {
  id: string;
  store_id: string;
  brand_id: string | null;
  brand_name: string;
  front_door_sticker: boolean | null;
  brand_character_sticker: boolean | null;
  authorized_retailer_sticker: boolean | null;
  telephone_number_sticker: boolean | null;
  notes: string | null;
  last_verified_by: string | null;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BrandStickerUpdatePayload {
  id?: string;
  store_id: string;
  brand_id?: string;
  brand_name: string;
  sticker_type: StickerTypeId;
  value: boolean;
}

// Role-based permissions for stickers
export const STICKER_ROLE_PERMISSIONS: Record<TubeIntelRole, boolean> = {
  admin: true,
  va: true,
  ambassador: true,
  biker: true,
  driver: false, // Read-only
};

export function canEditStickers(role: TubeIntelRole): boolean {
  return STICKER_ROLE_PERMISSIONS[role] ?? false;
}

/**
 * Hook to fetch brand sticker status for a store
 */
export function useBrandStickers(storeId: string | null) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['brand-stickers', storeId],
    queryFn: async () => {
      if (!storeId) return [];

      const { data, error } = await supabase
        .from('store_brand_stickers')
        .select('*')
        .eq('store_id', storeId)
        .order('brand_name');

      if (error) throw error;
      return data as BrandStickerStatus[];
    },
    enabled: !!storeId,
  });

  // Initialize missing brands for a store
  const initializeBrands = useMutation({
    mutationFn: async (storeId: string) => {
      const existing = query.data || [];
      const existingBrandNames = new Set(existing.map(e => e.brand_name));
      
      const missingBrands = TUBE_BRANDS.filter(b => !existingBrandNames.has(b.name));
      
      if (missingBrands.length === 0) return [];

      const inserts = missingBrands.map(brand => ({
        store_id: storeId,
        brand_id: brand.id,
        brand_name: brand.name,
        front_door_sticker: false,
        brand_character_sticker: false,
        authorized_retailer_sticker: false,
        telephone_number_sticker: false,
      }));

      const { data, error } = await supabase
        .from('store_brand_stickers')
        .insert(inserts)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand-stickers', storeId] });
    },
  });

  // Update a single sticker field
  const updateSticker = useMutation({
    mutationFn: async (payload: BrandStickerUpdatePayload) => {
      const { id, store_id, brand_id, brand_name, sticker_type, value } = payload;

      if (id) {
        // Update existing record
        const { error } = await supabase
          .from('store_brand_stickers')
          .update({ 
            [sticker_type]: value,
            last_verified_by: user?.id || null,
            last_verified_at: new Date().toISOString(),
          })
          .eq('id', id);

        if (error) throw error;
      } else {
        // Create new record
        const { error } = await supabase
          .from('store_brand_stickers')
          .insert({
            store_id,
            brand_id,
            brand_name,
            [sticker_type]: value,
            last_verified_by: user?.id || null,
            last_verified_at: new Date().toISOString(),
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand-stickers', storeId] });
      toast.success('Sticker status updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  // Update notes for a brand
  const updateNotes = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await supabase
        .from('store_brand_stickers')
        .update({ 
          notes,
          last_verified_by: user?.id || null,
          last_verified_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand-stickers', storeId] });
      toast.success('Notes saved');
    },
    onError: (error: Error) => {
      toast.error(`Failed to save notes: ${error.message}`);
    },
  });

  // Calculate completion stats
  const getCompletionStats = (record: BrandStickerStatus) => {
    const installed = [
      record.front_door_sticker,
      record.brand_character_sticker,
      record.authorized_retailer_sticker,
      record.telephone_number_sticker,
    ].filter(Boolean).length;
    
    return {
      installed,
      total: 4,
      percentage: Math.round((installed / 4) * 100),
    };
  };

  return {
    data: query.data || [],
    isLoading: query.isLoading,
    refetch: query.refetch,
    initializeBrands,
    updateSticker,
    updateNotes,
    getCompletionStats,
  };
}

/**
 * Hook to get global sticker summary counts
 */
export function useStickerSummary() {
  return useQuery({
    queryKey: ['sticker-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_brand_stickers')
        .select('front_door_sticker, brand_character_sticker, authorized_retailer_sticker, telephone_number_sticker');

      if (error) throw error;

      let totalStickers = 0;
      let installedStickers = 0;

      data?.forEach(item => {
        totalStickers += 4;
        if (item.front_door_sticker) installedStickers++;
        if (item.brand_character_sticker) installedStickers++;
        if (item.authorized_retailer_sticker) installedStickers++;
        if (item.telephone_number_sticker) installedStickers++;
      });

      return {
        totalRecords: data?.length || 0,
        totalStickers,
        installedStickers,
        completionPercentage: totalStickers > 0 
          ? Math.round((installedStickers / totalStickers) * 100) 
          : 0,
      };
    },
  });
}
