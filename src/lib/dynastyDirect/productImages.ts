/**
 * Dynasty Direct product photos.
 *
 * Photos live in the PUBLIC `product-images` bucket. The enhancement pass
 * (dd-process-image → Remove.bg + Cloudinary) is an upgrade, never a
 * prerequisite: if it fails, the original file is still stored here so the
 * product keeps a real, permanent photo URL. No blob:/object URLs ever reach
 * the database.
 */
import { supabase } from '@/integrations/supabase/client';

export const DD_PRODUCT_IMAGE_BUCKET = 'product-images';

export async function uploadOriginalToStorage(file: File, folder: string): Promise<string> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `dd-products/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from(DD_PRODUCT_IMAGE_BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type || undefined });
  if (error) throw error;
  const { data } = supabase.storage.from(DD_PRODUCT_IMAGE_BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) throw new Error('Storage returned no URL for the uploaded photo');
  return data.publicUrl;
}

/** True when a product cannot be rated by the shipping engine on its own numbers. */
export function missingShippingData(p: {
  weight_oz?: number | null; length_in?: number | null; width_in?: number | null; height_in?: number | null;
}): boolean {
  return !(Number(p.weight_oz) > 0 && Number(p.length_in) > 0 && Number(p.width_in) > 0 && Number(p.height_in) > 0);
}
