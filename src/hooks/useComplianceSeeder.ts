import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SeedResult {
  success: boolean;
  message: string;
  already_seeded?: boolean;
  data?: {
    simulations: string[];
    runs: string[];
    replay_sessions: string[];
    evidence_packs: string[];
    frames_created: number;
    findings_created: number;
  };
  compliance_status?: string;
  error?: string;
}

export function useComplianceSeeder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      businessId, 
      forceReseed = false 
    }: { 
      businessId?: string; 
      forceReseed?: boolean;
    }): Promise<SeedResult> => {
      const { data, error } = await supabase.functions.invoke("compliance-data-seeder", {
        body: { 
          business_id: businessId,
          force_reseed: forceReseed,
        },
      });

      if (error) throw error;
      return data as SeedResult;
    },
    onSuccess: (data) => {
      if (data.already_seeded) {
        toast.info("Canonical simulations already exist", {
          description: "Use force reseed to regenerate data",
        });
      } else {
        toast.success("Compliance data seeded successfully", {
          description: `Created ${data.data?.simulations.length || 0} simulations, ${data.data?.frames_created || 0} frames`,
        });
      }
      
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ["incident-simulations"] });
      queryClient.invalidateQueries({ queryKey: ["simulation-runs"] });
      queryClient.invalidateQueries({ queryKey: ["forensic-replay-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["evidence-packs"] });
      queryClient.invalidateQueries({ queryKey: ["compliance-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["latest-compliance-status"] });
      queryClient.invalidateQueries({ queryKey: ["compliance-alerts"] });
    },
    onError: (error: Error) => {
      toast.error("Failed to seed compliance data", {
        description: error.message,
      });
    },
  });
}
