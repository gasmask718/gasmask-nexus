import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { TubeIntelRole } from './useTubeIntelligence';
import { parseRLSError } from '@/lib/rls-error-handler';
import { isFieldRole, FieldRole } from '@/services/fieldGovernance/types';
import { submitFieldChange, GOVERNANCE_STRICT_MODE } from '@/services/fieldGovernance/submitFieldChange';
// Canonical sticker brands - mapped to actual DB UUIDs
// These MUST match the brands table in the database
export const STICKER_BRANDS = [
  { slug: 'gasmask', name: 'GasMask', color: '#FF0000' },
  { slug: 'hotmama', name: 'Hot Mama', color: '#E7A1B0' },
  { slug: 'hotscolati', name: 'Hotscolatti', color: '#FF7F11' },
  { slug: 'grabba-rus', name: 'Grabba R Us', color: '#8A2BE2' },
] as const;

export type StickerBrandSlug = typeof STICKER_BRANDS[number]['slug'];

// Canonical sticker names - SINGLE SOURCE OF TRUTH
// ONLY these 4 sticker types are valid across the entire system
export const STICKER_TYPES = [
  { id: 'front_door_sticker', name: 'Front Door Sticker', icon: 'door' },
  { id: 'brand_character_sticker', name: 'Brand Character Sticker', icon: 'character' },
  { id: 'authorized_retailer_sticker', name: 'Authorized Retailer Sticker', icon: 'badge' },
  { id: 'telephone_number_sticker', name: 'Telephone Number Sticker', icon: 'phone' },
] as const;

// Requested sticker type mappings
export const REQUESTED_STICKER_TYPES = [
  { id: 'requested_front_door_sticker', stickerType: 'front_door_sticker', name: 'Front Door Sticker' },
  { id: 'requested_brand_character_sticker', stickerType: 'brand_character_sticker', name: 'Brand Character Sticker' },
  { id: 'requested_authorized_retailer_sticker', stickerType: 'authorized_retailer_sticker', name: 'Authorized Retailer Sticker' },
  { id: 'requested_telephone_number_sticker', stickerType: 'telephone_number_sticker', name: 'Telephone Number Sticker' },
] as const;

export type StickerTypeId = typeof STICKER_TYPES[number]['id'];
export type RequestedStickerTypeId = typeof REQUESTED_STICKER_TYPES[number]['id'];

// Brand UUID lookup cache
let brandUuidCache: Map<string, string> | null = null;

/**
 * Fetch brand UUIDs from the database and cache them
 */
async function getBrandUuidMap(): Promise<Map<string, string>> {
  if (brandUuidCache) return brandUuidCache;
  
  const { data, error } = await supabase
    .from('brands')
    .select('id, name')
    .in('name', STICKER_BRANDS.map(b => b.name));
  
  if (error) {
    console.error('Failed to fetch brand UUIDs:', error);
    throw new Error('Cannot load brand registry');
  }
  
  brandUuidCache = new Map();
  data?.forEach(brand => {
    brandUuidCache!.set(brand.name, brand.id);
  });
  
  return brandUuidCache;
}

/**
 * Get the UUID for a brand by name - throws if not found
 */
export async function getBrandUuid(brandName: string): Promise<string> {
  const map = await getBrandUuidMap();
  const uuid = map.get(brandName);
  if (!uuid) {
    throw new Error(`Brand "${brandName}" not found in registry. This is a data integrity issue.`);
  }
  return uuid;
}

/**
 * Validate that a value is a valid UUID
 */
export function isValidUuid(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

export interface BrandStickerStatus {
  id: string;
  store_id: string;
  brand_id: string | null;
  brand_name: string;
  // Installed stickers
  front_door_sticker: boolean | null;
  brand_character_sticker: boolean | null;
  authorized_retailer_sticker: boolean | null;
  telephone_number_sticker: boolean | null;
  // Requested stickers
  requested_front_door_sticker: boolean | null;
  requested_brand_character_sticker: boolean | null;
  requested_authorized_retailer_sticker: boolean | null;
  requested_telephone_number_sticker: boolean | null;
  // Per-sticker date tracking
  front_door_sticker_put_on_at: string | null;
  front_door_sticker_last_seen_at: string | null;
  front_door_sticker_notes: string | null;
  brand_character_sticker_put_on_at: string | null;
  brand_character_sticker_last_seen_at: string | null;
  brand_character_sticker_notes: string | null;
  authorized_retailer_sticker_put_on_at: string | null;
  authorized_retailer_sticker_last_seen_at: string | null;
  authorized_retailer_sticker_notes: string | null;
  telephone_number_sticker_put_on_at: string | null;
  telephone_number_sticker_last_seen_at: string | null;
  telephone_number_sticker_notes: string | null;
  // Metadata
  notes: string | null; // General brand notes (legacy)
  last_verified_by: string | null;
  last_verified_at: string | null;
  last_updated_by_role: string | null;
  created_at: string;
  updated_at: string;
}

export interface BrandStickerUpdatePayload {
  id?: string;
  store_id: string;
  brand_name: string;
  sticker_type: StickerTypeId;
  value: boolean;
}

export interface RequestedStickerUpdatePayload {
  id?: string;
  store_id: string;
  brand_name: string;
  requested_type: RequestedStickerTypeId;
  value: boolean;
}

export interface MarkSeenPayload {
  id: string;
  sticker_type: StickerTypeId;
  role: TubeIntelRole;
}

export interface StickerNotesPayload {
  id: string;
  sticker_type: StickerTypeId;
  notes: string | null;
  role: TubeIntelRole;
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
 * Get the requested column name for a sticker type
 */
export function getRequestedColumnForSticker(stickerType: StickerTypeId): RequestedStickerTypeId {
  return `requested_${stickerType}` as RequestedStickerTypeId;
}

/**
 * Get per-sticker column names for date tracking
 */
export function getStickerDateColumns(stickerType: StickerTypeId) {
  return {
    putOnAt: `${stickerType}_put_on_at` as keyof BrandStickerStatus,
    lastSeenAt: `${stickerType}_last_seen_at` as keyof BrandStickerStatus,
    notes: `${stickerType}_notes` as keyof BrandStickerStatus,
  };
}

/**
 * Check if a sticker has notes
 */
export function stickerHasNotes(record: BrandStickerStatus, stickerType: StickerTypeId): boolean {
  const { notes } = getStickerDateColumns(stickerType);
  const notesValue = record[notes];
  return !!notesValue && (notesValue as string).trim().length > 0;
}

/**
 * Get per-sticker date values
 */
export function getStickerDates(record: BrandStickerStatus, stickerType: StickerTypeId) {
  const cols = getStickerDateColumns(stickerType);
  return {
    putOnAt: record[cols.putOnAt] as string | null,
    lastSeenAt: record[cols.lastSeenAt] as string | null,
    notes: record[cols.notes] as string | null,
  };
}

/**
 * Hook to fetch brand sticker status for a store
 */
export function useBrandStickers(storeId: string | null) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { role: userRole } = useUserRole();

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
      // Validate store_id is a UUID
      if (!isValidUuid(storeId)) {
        throw new Error(`Invalid store_id: "${storeId}" is not a valid UUID`);
      }

      const existing = query.data || [];
      const existingBrandNames = new Set(existing.map(e => e.brand_name));
      
      const missingBrands = STICKER_BRANDS.filter(b => !existingBrandNames.has(b.name));
      
      if (missingBrands.length === 0) return [];

      // Get brand UUIDs from the database
      const brandUuidMap = await getBrandUuidMap();

      const inserts = missingBrands.map(brand => {
        const brandUuid = brandUuidMap.get(brand.name);
        if (!brandUuid) {
          console.warn(`Brand "${brand.name}" not found in brands table`);
        }
        return {
          store_id: storeId,
          brand_id: brandUuid || null,
          brand_name: brand.name,
          front_door_sticker: false,
          brand_character_sticker: false,
          authorized_retailer_sticker: false,
          telephone_number_sticker: false,
          requested_front_door_sticker: false,
          requested_brand_character_sticker: false,
          requested_authorized_retailer_sticker: false,
          requested_telephone_number_sticker: false,
        };
      });

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

  // Update a single sticker field (installed status) with governance
  const updateSticker = useMutation({
    mutationFn: async (payload: BrandStickerUpdatePayload & { role?: TubeIntelRole }) => {
      const { id, store_id, brand_name, sticker_type, value, role } = payload;
      const effectiveRole = role || userRole;

      // Validate store_id is a UUID
      if (!isValidUuid(store_id)) {
        throw new Error(`Invalid store_id: "${store_id}" is not a valid UUID`);
      }

      // For field roles, route through governance FIRST
      if (user?.id && isFieldRole(effectiveRole)) {
        // Fetch current state for diff
        let payloadBefore: Record<string, unknown> | null = null;
        if (id) {
          const { data } = await supabase
            .from('store_brand_stickers')
            .select('*')
            .eq('id', id)
            .single();
          payloadBefore = data as Record<string, unknown> | null;
        }
        
        const payloadAfter = { sticker_type, value, brand_name };
        
        const result = await submitFieldChange(
          {
            store_id,
            entity_type: 'brand_sticker',
            action_type: id ? 'update' : 'create',
            entity_id: id,
            payload_before: payloadBefore || undefined,
            payload_after: payloadAfter,
          },
          user.id,
          effectiveRole as FieldRole
        );
        
        // In STRICT mode, do NOT execute mutation - submission only
        if (GOVERNANCE_STRICT_MODE) {
          if (!result.success) {
            throw new Error(result.error || 'Governance submission failed');
          }
          return { governed: true, submissionId: result.submissionId };
        }
      }

      // Non-field roles: execute mutation directly
      const updateData: Record<string, any> = {
        [sticker_type]: value,
        last_verified_by: user?.id || null,
        last_verified_at: new Date().toISOString(),
        last_updated_by_role: effectiveRole || 'admin',
      };
      if (value) {
        const requestedColumn = getRequestedColumnForSticker(sticker_type);
        updateData[requestedColumn] = false;
      }

      if (id) {
        const { error } = await supabase
          .from('store_brand_stickers')
          .update(updateData)
          .eq('id', id);
        if (error) throw error;
      } else {
        const brandUuid = await getBrandUuid(brand_name);
        const { error } = await supabase
          .from('store_brand_stickers')
          .insert({ store_id, brand_id: brandUuid, brand_name, ...updateData });
        if (error) throw error;
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['brand-stickers', storeId] });
      queryClient.invalidateQueries({ queryKey: ['field-submissions'] });
      if (result && typeof result === 'object' && 'governed' in result) {
        toast.info('Change submitted for review');
      } else {
        toast.success('Sticker status updated');
      }
    },
    onError: (error: Error) => {
      const parsed = parseRLSError(error);
      toast.error(parsed.title, { description: parsed.description });
    },
  });

  // Update a requested sticker field with governance
  const updateRequestedSticker = useMutation({
    mutationFn: async (payload: RequestedStickerUpdatePayload & { role?: TubeIntelRole }) => {
      const { id, store_id, brand_name, requested_type, value, role } = payload;
      const effectiveRole = role || userRole;

      // Validate store_id is a UUID
      if (!isValidUuid(store_id)) {
        throw new Error(`Invalid store_id: "${store_id}" is not a valid UUID`);
      }

      // For field roles, route through governance FIRST
      if (user?.id && isFieldRole(effectiveRole)) {
        let payloadBefore: Record<string, unknown> | null = null;
        if (id) {
          const { data } = await supabase
            .from('store_brand_stickers')
            .select('*')
            .eq('id', id)
            .single();
          payloadBefore = data as Record<string, unknown> | null;
        }
        
        const payloadAfter = { requested_type, value, brand_name };
        
        const result = await submitFieldChange(
          {
            store_id,
            entity_type: 'brand_sticker',
            action_type: id ? 'update' : 'create',
            entity_id: id,
            payload_before: payloadBefore || undefined,
            payload_after: payloadAfter,
          },
          user.id,
          effectiveRole as FieldRole
        );
        
        if (GOVERNANCE_STRICT_MODE) {
          if (!result.success) {
            throw new Error(result.error || 'Governance submission failed');
          }
          return { governed: true, submissionId: result.submissionId };
        }
      }

      // Non-field roles: execute directly
      const updateData: Record<string, any> = {
        [requested_type]: value,
        last_verified_by: user?.id || null,
        last_verified_at: new Date().toISOString(),
        last_updated_by_role: effectiveRole || 'admin',
      };

      if (id) {
        const { error } = await supabase
          .from('store_brand_stickers')
          .update(updateData)
          .eq('id', id);
        if (error) throw error;
      } else {
        const brandUuid = await getBrandUuid(brand_name);
        const { error } = await supabase
          .from('store_brand_stickers')
          .insert({ store_id, brand_id: brandUuid, brand_name, ...updateData });
        if (error) throw error;
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['brand-stickers', storeId] });
      queryClient.invalidateQueries({ queryKey: ['field-submissions'] });
      if (result && typeof result === 'object' && 'governed' in result) {
        toast.info('Change submitted for review');
      } else {
        toast.success('Requested sticker updated');
      }
    },
    onError: (error: Error) => {
      const parsed = parseRLSError(error);
      toast.error(parsed.title, { description: parsed.description });
    },
  });

  // Mark a sticker as seen (updates last_seen_at only)
  const markStickerSeen = useMutation({
    mutationFn: async (payload: MarkSeenPayload) => {
      const { id, sticker_type, role } = payload;
      const cols = getStickerDateColumns(sticker_type);

      const { error } = await supabase
        .from('store_brand_stickers')
        .update({
          [cols.lastSeenAt]: new Date().toISOString(),
          last_verified_by: user?.id || null,
          last_verified_at: new Date().toISOString(),
          last_updated_by_role: role,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand-stickers', storeId] });
      toast.success('Sticker marked as seen');
    },
    onError: (error: Error) => {
      const parsed = parseRLSError(error);
      toast.error(parsed.title, { description: parsed.description });
    },
  });

  // Update per-sticker notes
  const updateStickerNotes = useMutation({
    mutationFn: async (payload: StickerNotesPayload) => {
      const { id, sticker_type, notes, role } = payload;
      const cols = getStickerDateColumns(sticker_type);

      const { error } = await supabase
        .from('store_brand_stickers')
        .update({
          [cols.notes]: notes?.trim() || null,
          last_verified_by: user?.id || null,
          last_verified_at: new Date().toISOString(),
          last_updated_by_role: role,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand-stickers', storeId] });
      toast.success('Sticker notes saved');
    },
    onError: (error: Error) => {
      const parsed = parseRLSError(error);
      toast.error(parsed.title, { description: parsed.description });
    },
  });

  // Update general brand notes (legacy)
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
      const parsed = parseRLSError(error);
      toast.error(parsed.title, { description: parsed.description });
    },
  });

  // Calculate completion stats (installed only)
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

  // Calculate requested stats
  const getRequestedStats = (record: BrandStickerStatus) => {
    const requested = [
      record.requested_front_door_sticker,
      record.requested_brand_character_sticker,
      record.requested_authorized_retailer_sticker,
      record.requested_telephone_number_sticker,
    ].filter(Boolean).length;
    
    return {
      requested,
      total: 4,
    };
  };

  // Count stickers with notes
  const getNotesStats = (record: BrandStickerStatus) => {
    let count = 0;
    for (const type of STICKER_TYPES) {
      if (stickerHasNotes(record, type.id)) count++;
    }
    return count;
  };

  return {
    data: query.data || [],
    isLoading: query.isLoading,
    refetch: query.refetch,
    initializeBrands,
    updateSticker,
    updateRequestedSticker,
    markStickerSeen,
    updateStickerNotes,
    updateNotes,
    getCompletionStats,
    getRequestedStats,
    getNotesStats,
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
        .select(`
          store_id,
          front_door_sticker, brand_character_sticker, authorized_retailer_sticker, telephone_number_sticker,
          requested_front_door_sticker, requested_brand_character_sticker, requested_authorized_retailer_sticker, requested_telephone_number_sticker,
          front_door_sticker_notes, brand_character_sticker_notes, authorized_retailer_sticker_notes, telephone_number_sticker_notes
        `);

      if (error) throw error;

      let totalStickers = 0;
      let installedStickers = 0;
      let requestedStickers = 0;
      let notesCount = 0;
      const storesWithNotes = new Set<string>();

      data?.forEach(item => {
        totalStickers += 4;
        if (item.front_door_sticker) installedStickers++;
        if (item.brand_character_sticker) installedStickers++;
        if (item.authorized_retailer_sticker) installedStickers++;
        if (item.telephone_number_sticker) installedStickers++;
        if (item.requested_front_door_sticker) requestedStickers++;
        if (item.requested_brand_character_sticker) requestedStickers++;
        if (item.requested_authorized_retailer_sticker) requestedStickers++;
        if (item.requested_telephone_number_sticker) requestedStickers++;
        
        // Count notes
        if (item.front_door_sticker_notes) { notesCount++; storesWithNotes.add(item.store_id); }
        if (item.brand_character_sticker_notes) { notesCount++; storesWithNotes.add(item.store_id); }
        if (item.authorized_retailer_sticker_notes) { notesCount++; storesWithNotes.add(item.store_id); }
        if (item.telephone_number_sticker_notes) { notesCount++; storesWithNotes.add(item.store_id); }
      });

      return {
        totalRecords: data?.length || 0,
        totalStickers,
        installedStickers,
        requestedStickers,
        completionPercentage: totalStickers > 0 
          ? Math.round((installedStickers / totalStickers) * 100) 
          : 0,
        notesCount,
        storesWithNotesCount: storesWithNotes.size,
      };
    },
  });
}
