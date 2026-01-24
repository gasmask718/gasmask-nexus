import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface RegulatoryEvidencePack {
  id: string;
  business_id: string | null;
  pack_type: string;
  generated_at: string;
  generated_by: string | null;
  date_range_start: string | null;
  date_range_end: string | null;
  session_ids: string[] | null;
  pack_data: any;
  log_hashes: string[] | null;
  policy_version: string | null;
  system_mode_at_generation: string | null;
  approver_signatures: any;
  pdf_url: string | null;
  json_url: string | null;
  csv_url: string | null;
  is_certified: boolean;
  certified_by: string | null;
  certified_at: string | null;
  row_hash: string | null;
  created_at: string;
}

export const PACK_TYPES = [
  { value: 'ai_speech_permission', label: 'AI Speech Permission Proof' },
  { value: 'kill_switch_proof', label: 'Kill Switch Operation Proof' },
  { value: 'human_override_proof', label: 'Human Override Availability' },
  { value: 'confidence_enforcement', label: 'Confidence Enforcement Proof' },
  { value: 'training_source_disclosure', label: 'Training Source Disclosure' },
  { value: 'human_approval_records', label: 'Human Approval Records' },
  { value: 'full_compliance_pack', label: 'Full Compliance Pack' }
];

export function useEvidencePacks(businessId: string | null) {
  return useQuery({
    queryKey: ['evidence-packs', businessId],
    queryFn: async () => {
      let query = supabase
        .from('regulatory_evidence_packs')
        .select('*')
        .order('generated_at', { ascending: false });
      
      if (businessId) {
        query = query.eq('business_id', businessId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as RegulatoryEvidencePack[];
    },
    enabled: true
  });
}

export function useGenerateEvidencePack() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      businessId, 
      packType,
      dateRangeStart,
      dateRangeEnd
    }: { 
      businessId: string; 
      packType: string;
      dateRangeStart?: string;
      dateRangeEnd?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('regulatory-evidence-generator', {
        body: {
          business_id: businessId,
          pack_type: packType,
          date_range_start: dateRangeStart,
          date_range_end: dateRangeEnd
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['evidence-packs'] });
      toast.success(`Evidence pack generated with ${data.record_count} records`);
    },
    onError: (error) => {
      toast.error(`Failed to generate evidence pack: ${error.message}`);
    }
  });
}

export function useCertifyEvidencePack() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ packId, certifiedBy }: { packId: string; certifiedBy?: string }) => {
      const { data, error } = await supabase
        .from('regulatory_evidence_packs')
        .update({
          is_certified: true,
          certified_by: certifiedBy,
          certified_at: new Date().toISOString()
        })
        .eq('id', packId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence-packs'] });
      toast.success('Evidence pack certified');
    },
    onError: (error) => {
      toast.error(`Failed to certify: ${error.message}`);
    }
  });
}