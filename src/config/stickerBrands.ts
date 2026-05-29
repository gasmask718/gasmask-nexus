/**
 * CANONICAL STICKER SYSTEM CONFIGURATION
 * 
 * ⚠️ IMPORTANT: This file is for the BIKER/DRIVER PORTAL sticker section ONLY.
 * 
 * The PRIMARY sticker system uses:
 * - Table: store_brand_stickers
 * - Hook: useBrandStickers (src/hooks/useBrandStickers.ts)
 * - Component: BrandStickersCard (src/components/store/BrandStickersCard.tsx)
 * 
 * The 4 canonical sticker types (SINGLE SOURCE OF TRUTH):
 * 1. Front Door Sticker
 * 2. Brand Character Sticker
 * 3. Authorized Retailer Sticker
 * 4. Telephone Number Sticker
 * 
 * Each sticker has two states per brand:
 * - Installed: sticker is physically placed
 * - Requested: store has requested this sticker (used for routing/prep)
 * 
 * DEPRECATED: The store_master columns (sticker_on_door, sticker_in_store, etc.)
 * are LEGACY and should NOT be used. Use store_brand_stickers table instead.
 */

export const STICKER_BRANDS = [
  { id: 'gasmask', name: 'Gasmask' },
  { id: 'hotmama', name: 'HotMama' },
  { id: 'hotscolati', name: 'Hotscolatti' },
  { id: 'grabba-rus', name: 'GrabbaRus' },
] as const;

export const STICKER_TYPES = [
  { key: 'frontDoor', label: 'Front Door Sticker' },
  { key: 'authorizedRetailer', label: 'Authorized Retailer Sticker' },
  { key: 'brandCharacter', label: 'Brand Character Sticker' },
  { key: 'telephoneNumber', label: 'Telephone Number Sticker' },
] as const;

export type StickerBrandId = typeof STICKER_BRANDS[number]['id'];
export type StickerTypeKey = typeof STICKER_TYPES[number]['key'];

export interface StickerData {
  frontDoor: boolean;
  authorizedRetailer: boolean;
  brandCharacter: boolean;
  telephoneNumber: boolean;
  // Requested flags
  requestedFrontDoor?: boolean;
  requestedAuthorizedRetailer?: boolean;
  requestedBrandCharacter?: boolean;
  requestedTelephoneNumber?: boolean;
  notes: string;
}

/**
 * Validates that a brand ID is one of the approved sticker brands.
 * Use this for schema-level validation.
 */
export function isValidStickerBrand(brandId: string): brandId is StickerBrandId {
  return STICKER_BRANDS.some(b => b.id === brandId);
}

/**
 * Validates that a sticker type key is one of the approved types.
 */
export function isValidStickerType(typeKey: string): typeKey is StickerTypeKey {
  return STICKER_TYPES.some(t => t.key === typeKey);
}

/**
 * Creates an empty sticker data object for a brand.
 */
export function createEmptyStickerData(): StickerData {
  return {
    frontDoor: false,
    authorizedRetailer: false,
    brandCharacter: false,
    telephoneNumber: false,
    requestedFrontDoor: false,
    requestedAuthorizedRetailer: false,
    requestedBrandCharacter: false,
    requestedTelephoneNumber: false,
    notes: '',
  };
}

/**
 * Initializes sticker data for all approved brands.
 * This is the ONLY way to create the initial sticker state.
 */
export function initializeStickerDataForAllBrands(): Record<StickerBrandId, StickerData> {
  const data: Record<string, StickerData> = {};
  for (const brand of STICKER_BRANDS) {
    data[brand.id] = createEmptyStickerData();
  }
  return data as Record<StickerBrandId, StickerData>;
}

/**
 * Sanitizes sticker data to remove any non-approved brands or types.
 * Use this before saving to ensure data integrity.
 */
export function sanitizeStickerData(
  data: Record<string, any>
): Record<StickerBrandId, StickerData> {
  const sanitized: Record<string, StickerData> = {};
  
  for (const brand of STICKER_BRANDS) {
    const brandData = data[brand.id];
    sanitized[brand.id] = {
      frontDoor: Boolean(brandData?.frontDoor),
      authorizedRetailer: Boolean(brandData?.authorizedRetailer),
      brandCharacter: Boolean(brandData?.brandCharacter),
      telephoneNumber: Boolean(brandData?.telephoneNumber),
      requestedFrontDoor: Boolean(brandData?.requestedFrontDoor),
      requestedAuthorizedRetailer: Boolean(brandData?.requestedAuthorizedRetailer),
      requestedBrandCharacter: Boolean(brandData?.requestedBrandCharacter),
      requestedTelephoneNumber: Boolean(brandData?.requestedTelephoneNumber),
      notes: typeof brandData?.notes === 'string' ? brandData.notes : '',
    };
  }
  
  return sanitized as Record<StickerBrandId, StickerData>;
}
