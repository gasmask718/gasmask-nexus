// Dynasty Direct — photo → product identity (client helper).
//
// Thin wrapper over the dd-identify-product-photo function. It never decides
// anything itself: the backend reads the photo, applies the confidence gate and,
// only for an IDENTIFIED product, hands the identifiers to the existing
// shipping-spec sourcing service.

import { supabase } from '@/integrations/supabase/client';
import type { SourcingRowResult } from './shippingSpecs';

export type PhotoIdStatus =
  | 'identified'
  | 'likely_match'
  | 'needs_more_photos'
  | 'not_identified'
  | 'confirmed_by_admin';

export interface PhotoIdentifiers {
  barcode_digits: string | null;
  brand: string | null;
  product_name: string | null;
  model_mpn: string | null;
  sku: string | null;
  size_or_count: string | null;
  pack_count: number | null;
  flavor_or_variant: string | null;
  package_text: string | null;
}

export interface PhotoIdResponse {
  product_id: string;
  status: PhotoIdStatus;
  reason?: string;
  next_photo_hint?: string | null;
  identifiers?: PhotoIdentifiers;
  gtin_valid?: boolean;
  method?: string[];
  applied_fields?: string[];
  skipped?: string;
  error?: string;
  sourcing?: SourcingRowResult | null;
}

export async function identifyProductPhoto(
  productId: string,
  opts: { force?: boolean; imageUrls?: string[]; triggeredBy?: string; autoSource?: boolean } = {},
): Promise<PhotoIdResponse> {
  const { data, error } = await supabase.functions.invoke('dd-identify-product-photo', {
    body: {
      product_id: productId,
      force: !!opts.force,
      image_urls: opts.imageUrls,
      auto_source: opts.autoSource !== false,
      triggered_by: opts.triggeredBy ?? 'ui',
    },
  });
  if (error) throw new Error(error.message);
  if ((data as any)?.error && !(data as any)?.status) throw new Error(String((data as any).error));
  return data as PhotoIdResponse;
}

/** Admin approving a LIKELY MATCH — identifiers are written only after this. */
export async function confirmPhotoIdentification(
  productId: string,
  triggeredBy = 'ui',
): Promise<PhotoIdResponse> {
  const { data, error } = await supabase.functions.invoke('dd-identify-product-photo', {
    body: { product_id: productId, confirm: true, triggered_by: triggeredBy },
  });
  if (error) throw new Error(error.message);
  if ((data as any)?.error) throw new Error(String((data as any).error));
  return data as PhotoIdResponse;
}

export function photoIdLabel(status: PhotoIdStatus | null | undefined): {
  label: string; tone: 'good' | 'warn' | 'bad' | 'muted';
} {
  switch (status) {
    case 'identified': return { label: 'Product identified', tone: 'good' };
    case 'confirmed_by_admin': return { label: 'Identity confirmed', tone: 'good' };
    case 'likely_match': return { label: 'Likely match — confirm', tone: 'warn' };
    case 'needs_more_photos': return { label: 'Need another photo', tone: 'warn' };
    case 'not_identified': return { label: 'Not identified from photo', tone: 'bad' };
    default: return { label: 'Not checked', tone: 'muted' };
  }
}
