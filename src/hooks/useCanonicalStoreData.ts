/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * CANONICAL STORE DATA ENGINE — Single Source of Truth
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * This hook resolves store data from `store_master` (canonical) with fallback
 * to legacy `stores` table. It provides a normalized CanonicalStore type that
 * ALL store profile pages consume.
 *
 * RULES:
 * - store_master is the authority
 * - Legacy stores resolve via useStoreMasterAutoCreate
 * - All child components receive the resolved storeMasterId
 * - No profile page may query store data outside this engine
 */

import { createContext, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useStoreMasterAutoCreate } from './useStoreMasterAutoCreate';

// ═══════════════════════════════════════════════════════════════════════════════
// CANONICAL STORE TYPE
// ═══════════════════════════════════════════════════════════════════════════════

export interface CanonicalStore {
  id: string;
  store_name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string | null;
  email: string | null;
  store_type: string | null;
  owner_name: string | null;
  notes: string | null;
  health_status: string | null;
  connected_group_id: string | null;
  assigned_ambassador_id: string | null;
  borough_id: string | null;
  last_visit_at: string | null;
  last_order_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  // Personality / CRM fields
  country_of_origin: string | null;
  personality_notes: string | null;
  communication_preference: string | null;
  has_expansion: boolean | null;
  expansion_notes: string | null;
  influence_level: string | null;
  loyalty_triggers: string[] | null;
  frustration_triggers: string[] | null;
  risk_score: string | null;
  nickname: string | null;
  languages: string[] | null;
  // Stickers (legacy on store_master)
  sticker_on_door: boolean | null;
  sticker_in_store: boolean | null;
  sticker_with_phone: boolean | null;
  sticker_notes: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTEXT
// ═══════════════════════════════════════════════════════════════════════════════

export interface CanonicalStoreDataContextValue {
  store: CanonicalStore | null;
  storeId: string;
  isLoading: boolean;
  isCreating: boolean;
  error: Error | null;
  refetch: () => void;
}

export const CanonicalStoreDataContext = createContext<CanonicalStoreDataContextValue>({
  store: null,
  storeId: '',
  isLoading: true,
  isCreating: false,
  error: null,
  refetch: () => {},
});

export const useCanonicalStoreData = () => useContext(CanonicalStoreDataContext);

// ═══════════════════════════════════════════════════════════════════════════════
// ENGINE HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useCanonicalStoreEngine(storeId: string | undefined) {
  const {
    storeMaster,
    isLoading: masterLoading,
    isCreating,
    error: masterError,
    legacyStore,
    refetch,
  } = useStoreMasterAutoCreate(storeId);

  // Normalize store_master record into CanonicalStore
  const store: CanonicalStore | null = storeMaster
    ? {
        id: storeMaster.id,
        store_name: storeMaster.store_name,
        address: storeMaster.address || '',
        city: storeMaster.city || '',
        state: storeMaster.state || '',
        zip: storeMaster.zip || '',
        phone: storeMaster.phone,
        email: storeMaster.email,
        store_type: storeMaster.store_type || null,
        owner_name: storeMaster.owner_name || null,
        notes: storeMaster.notes || null,
        health_status: (storeMaster as any).health_status || null,
        connected_group_id: (storeMaster as any).connected_group_id || null,
        assigned_ambassador_id: (storeMaster as any).assigned_ambassador_id || null,
        borough_id: (storeMaster as any).borough_id || null,
        last_visit_at: (storeMaster as any).last_visit_at || null,
        last_order_at: (storeMaster as any).last_order_at || null,
        created_at: storeMaster.created_at || null,
        updated_at: storeMaster.updated_at || null,
        country_of_origin: storeMaster.country_of_origin || null,
        personality_notes: storeMaster.personality_notes || null,
        communication_preference: storeMaster.communication_preference || null,
        has_expansion: storeMaster.has_expansion || null,
        expansion_notes: storeMaster.expansion_notes || null,
        influence_level: storeMaster.influence_level || null,
        loyalty_triggers: storeMaster.loyalty_triggers || null,
        frustration_triggers: storeMaster.frustration_triggers || null,
        risk_score: storeMaster.risk_score || null,
        nickname: storeMaster.nickname || null,
        languages: storeMaster.languages || null,
        sticker_on_door: (storeMaster as any).sticker_on_door || null,
        sticker_in_store: (storeMaster as any).sticker_in_store || null,
        sticker_with_phone: (storeMaster as any).sticker_with_phone || null,
        sticker_notes: (storeMaster as any).sticker_notes || null,
      }
    : null;

  return {
    store,
    storeId: storeId || '',
    isLoading: masterLoading,
    isCreating,
    error: masterError as Error | null,
    legacyStore,
    refetch,
  };
}
