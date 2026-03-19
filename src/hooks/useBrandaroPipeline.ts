import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const PIPELINE_STAGES = [
  { key: "new", label: "New Leads", color: "bg-blue-500" },
  { key: "contacted", label: "Contacted", color: "bg-violet-500" },
  { key: "responded", label: "Responded", color: "bg-amber-500" },
  { key: "interested", label: "Interested", color: "bg-emerald-500" },
  { key: "booked", label: "Booked", color: "bg-cyan-500" },
  { key: "closed", label: "Closed", color: "bg-green-600" },
  { key: "lost", label: "Lost", color: "bg-gray-500" },
] as const;

export type PipelineStageKey = typeof PIPELINE_STAGES[number]["key"];

export interface PipelineLead {
  id: string;
  business_name: string | null;
  phone_number: string | null;
  city: string | null;
  state: string | null;
  industry: string | null;
  rating: number | null;
  review_count: number;
  priority_score: number;
  priority_tier: string;
  pipeline_stage: string;
  lead_status: string;
  call_attempts: number;
  last_call_at: string | null;
  call_notes: string | null;
  engagement_score: number;
  created_at: string;
  updated_at: string;
}

export function useBrandaroPipeline(filters?: {
  city?: string;
  industry?: string;
  minProbability?: number;
}) {
  const queryClient = useQueryClient();

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["brandaro-pipeline", filters],
    queryFn: async () => {
      let query = (supabase as any)
        .from("brandaro_qualified_leads")
        .select("*")
        .order("priority_score", { ascending: false })
        .limit(1000);

      if (filters?.city) query = query.ilike("city", `%${filters.city}%`);
      if (filters?.industry) query = query.ilike("industry", `%${filters.industry}%`);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as PipelineLead[];
    },
    refetchInterval: 30000,
  });

  const moveLead = useMutation({
    mutationFn: async ({ leadId, stage }: { leadId: string; stage: string }) => {
      const { error } = await (supabase as any)
        .from("brandaro_qualified_leads")
        .update({ pipeline_stage: stage, updated_at: new Date().toISOString() })
        .eq("id", leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brandaro-pipeline"] });
    },
    onError: () => toast.error("Failed to move lead"),
  });

  const updateNotes = useMutation({
    mutationFn: async ({ leadId, notes }: { leadId: string; notes: string }) => {
      const { error } = await (supabase as any)
        .from("brandaro_qualified_leads")
        .update({ call_notes: notes, updated_at: new Date().toISOString() })
        .eq("id", leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brandaro-pipeline"] });
      toast.success("Notes saved");
    },
  });

  // Group leads by pipeline stage
  const columns = PIPELINE_STAGES.map((stage) => ({
    ...stage,
    leads: leads.filter((l: PipelineLead) => l.pipeline_stage === stage.key),
  }));

  // Stats
  const stats = {
    total: leads.length,
    byStage: Object.fromEntries(columns.map((c) => [c.key, c.leads.length])),
    conversionRate:
      leads.length > 0
        ? Math.round(
            (leads.filter((l: PipelineLead) => l.pipeline_stage === "closed").length /
              leads.length) *
              100
          )
        : 0,
  };

  // Filter options
  const cities = [...new Set(leads.map((l: PipelineLead) => l.city).filter(Boolean))].sort();
  const industries = [...new Set(leads.map((l: PipelineLead) => l.industry).filter(Boolean))].sort();

  return { leads, columns, stats, cities, industries, isLoading, moveLead, updateNotes };
}
