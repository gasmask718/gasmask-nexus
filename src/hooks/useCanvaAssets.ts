import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type AssetType =
  | 'store_flyer'
  | 'product_card'
  | 'sticker_design'
  | 'campaign_image'
  | 'welcome_card'
  | 'price_sheet'
  | 'social_post'
  | 'weekly_report'
  | 'demo_banner';

export function useStoreAssets(storeId?: string) {
  return useQuery({
    queryKey: ['canva-assets', storeId],
    queryFn: async () => {
      if (!storeId) return [];
      const { data, error } = await supabase
        .from('generated_assets' as any)
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!storeId,
  });
}

export function useAssetsByType(assetType?: AssetType) {
  return useQuery({
    queryKey: ['canva-assets-type', assetType],
    queryFn: async () => {
      let query = supabase
        .from('generated_assets' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (assetType) query = query.eq('asset_type', assetType);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as any[];
    },
  });
}

export function useGenerateCanvaAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      asset_type: AssetType;
      store_id?: string;
      lead_id?: string;
      brand?: string;
      product_name?: string;
      custom_data?: Record<string, any>;
    }) => {
      const { data, error } = await supabase.functions.invoke('generate-canva-asset', {
        body: params,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['canva-assets', variables.store_id] });
      queryClient.invalidateQueries({ queryKey: ['canva-assets-type', variables.asset_type] });
      if (data.success) {
        toast.success('Design generated — click to download or edit in Canva');
      } else {
        toast.error(data.error || 'Generation failed');
      }
    },
    onError: (e: any) => {
      toast.error(e.message || 'Failed to generate design');
    },
  });
}

export function useBulkGenerateAssets() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      asset_type: AssetType;
      brand?: string;
      store_ids: string[];
      product_name?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('canva-bulk-generate', {
        body: params,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['canva-assets-type'] });
      toast.success(
        `Generated ${data.generated} designs${data.failed > 0 ? ` · ${data.failed} failed` : ''}`
      );
    },
  });
}

export function useCanvaTemplates(assetType?: AssetType) {
  return useQuery({
    queryKey: ['canva-templates', assetType],
    queryFn: async () => {
      let query = supabase
        .from('canva_templates' as any)
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (assetType) query = query.eq('asset_type', assetType);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as any[];
    },
  });
}
