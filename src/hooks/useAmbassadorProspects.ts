/**
 * Ambassador Prospect Landscape — READ-ONLY discovery layer.
 *
 * Source: public.ambassador_visible_prospects() (SECURITY DEFINER).
 * The RPC scopes rows server-side to the signed-in ambassador's
 * ambassador_territory_coverage rows using the same territory_matches_store()
 * logic that governs operational store visibility. Rows confidently matched to
 * an existing store (phone) or already promoted are excluded by the RPC.
 *
 * Prospects are NOT owned, NOT assigned, and MUST NEVER be mixed into
 * operational metrics (assigned stores, revenue, commission).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

export interface AmbassadorProspect {
  prospect_id: string;
  candidate_id: string | null;
  store_name: string | null;
  full_address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  neighborhood: string | null;
  canonical_area: string | null;
  latitude: number | null;
  longitude: number | null;
  discovery_status: string | null;
  discovered_by: string | null;
  promotion_status: string | null;
}

export interface PromoteProspectInput {
  prospectId: string;
  candidateId?: string | null;
  storeName: string;
  contactName: string;
  phone?: string | null;
  sellsTobacco: boolean;
  sellsGrabba: boolean;
}

export function useAmbassadorProspects() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const qk = ['ambassador-prospects', user?.id];

  const prospectsQuery = useQuery({
    queryKey: qk,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ambassador_visible_prospects');
      if (error) throw error;
      return ((data || []) as any[]).map((row): AmbassadorProspect => ({
        prospect_id: row.prospect_id,
        candidate_id: row.candidate_id ?? null,
        store_name: row.store_name ?? null,
        full_address: row.full_address ?? null,
        city: row.city ?? null,
        state: row.state ?? null,
        zip: row.zip ?? null,
        phone: row.phone ?? null,
        neighborhood: row.neighborhood ?? null,
        canonical_area: row.canonical_area ?? null,
        latitude: row.latitude === null || row.latitude === undefined ? null : Number(row.latitude),
        longitude: row.longitude === null || row.longitude === undefined ? null : Number(row.longitude),
        discovery_status: row.discovery_status ?? null,
        discovered_by: row.discovered_by ?? null,
        promotion_status: row.promotion_status ?? null,
      }));
    },
    enabled: !!user?.id,
  });

  /** Canonical, approval-gated conversion path. Never creates a store directly. */
  const promoteMutation = useMutation({
    mutationFn: async (input: PromoteProspectInput) => {
      const { data, error } = await supabase.rpc('request_store_promotion', {
        p_territory_address_id: input.prospectId,
        p_candidate_id: input.candidateId ?? null,
        p_proposed_store_name: input.storeName,
        p_proposed_contact_name: input.contactName,
        p_proposed_phone: input.phone || null,
        p_verified_sells_tobacco: input.sellsTobacco,
        p_verified_sells_grabba: input.sellsGrabba,
        p_verification_method: 'visit',
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk });
      toast.success('Sent for approval — an admin reviews it before it becomes a store.');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    prospects: prospectsQuery.data || [],
    isLoading: prospectsQuery.isLoading,
    error: prospectsQuery.error as Error | null,
    promoteProspect: promoteMutation.mutateAsync,
    isPromoting: promoteMutation.isPending,
  };
}
