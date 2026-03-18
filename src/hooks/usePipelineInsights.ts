import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface InsightLead {
  id: string;
  business_name: string | null;
  phone_number: string | null;
  city: string | null;
  industry: string | null;
  pipeline_stage: string;
  updated_at?: string;
  priority_score: number;
  engagement_score?: number;
}

export function usePipelineInsights() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["pipeline-insights"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("brandaro-pipeline-automator", {
        body: { action: "get_insights" },
      });
      if (error) throw error;
      return data as {
        stuck: InsightLead[];
        needsFollowup: InsightLead[];
        hot: InsightLead[];
      };
    },
    refetchInterval: 60000,
  });

  const autoMove = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("brandaro-pipeline-automator", {
        body: { action: "auto_move" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      toast.success(`Auto-moved ${data.leads_moved} leads`);
      queryClient.invalidateQueries({ queryKey: ["brandaro-pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline-insights"] });
    },
    onError: () => toast.error("Auto-move failed"),
  });

  const recordEvent = useMutation({
    mutationFn: async (params: { lead_id: string; event_type: string; message_content?: string }) => {
      const { data, error } = await supabase.functions.invoke("brandaro-pipeline-automator", {
        body: { action: "record_event", ...params },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brandaro-pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline-insights"] });
    },
  });

  return {
    stuck: data?.stuck || [],
    needsFollowup: data?.needsFollowup || [],
    hot: data?.hot || [],
    isLoading,
    autoMove,
    recordEvent,
  };
}
