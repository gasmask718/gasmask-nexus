import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Queries ──

export function usePersonalities() {
  return useQuery({
    queryKey: ["brandaro-personalities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brandaro_personalities")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useStrategyFrameworks() {
  return useQuery({
    queryKey: ["brandaro-strategy-frameworks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brandaro_strategy_frameworks")
        .select("*")
        .order("success_rate", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function usePersonalityScripts(personalityId?: string) {
  return useQuery({
    queryKey: ["brandaro-personality-scripts", personalityId],
    enabled: !!personalityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brandaro_personality_scripts")
        .select("*")
        .eq("personality_id", personalityId!)
        .order("performance_score", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function usePersonalityAssignments() {
  return useQuery({
    queryKey: ["brandaro-personality-assignments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brandaro_personality_assignments")
        .select("*, brandaro_personalities(name, tone)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });
}

// ── Mutations ──

export function useCreatePersonality() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: {
      name: string;
      description?: string;
      tone: string;
      cadence: string;
      persuasion_style: string;
      objection_style: string;
      closing_style: string;
      energy_level: number;
      voice_provider?: string;
      voice_id?: string;
    }) => {
      const { data, error } = await supabase.from("brandaro_personalities").insert(p).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brandaro-personalities"] });
      toast.success("Personality created");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useCreateFramework() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (f: { name: string; description?: string; structure: any; best_use_case?: string }) => {
      const { data, error } = await supabase.from("brandaro_strategy_frameworks").insert(f).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brandaro-strategy-frameworks"] });
      toast.success("Framework created");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useCreatePersonalityScript() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (s: { personality_id: string; scenario: string; script: string }) => {
      const { data, error } = await supabase.from("brandaro_personality_scripts").insert(s).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brandaro-personality-scripts"] });
      toast.success("Script added");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useTogglePersonality() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("brandaro_personalities").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["brandaro-personalities"] }),
  });
}

// ── Generate personality response (for testing) ──

export function useGeneratePersonalityResponse() {
  return useMutation({
    mutationFn: async (params: {
      transcript_chunk: string;
      personality_id?: string;
      lead_type?: string;
      objection?: string;
      lead_heat_score?: number;
    }) => {
      const { data, error } = await supabase.functions.invoke("generate-personality-response", {
        body: params,
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Failed");
      return data;
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ── Personality Ingestion ──

export function useIngestFromTranscript() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { input_text: string; personality_name?: string; description?: string }) => {
      const { data, error } = await supabase.functions.invoke("ingest-personality", {
        body: { action: "extract-from-transcript", ...params },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Extraction failed");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brandaro-personalities"] });
      qc.invalidateQueries({ queryKey: ["brandaro-strategy-frameworks"] });
      qc.invalidateQueries({ queryKey: ["brandaro-personality-scripts"] });
      toast.success("Personality extracted from transcript");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useGenerateFromDescription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { description: string; personality_name?: string }) => {
      const { data, error } = await supabase.functions.invoke("ingest-personality", {
        body: { action: "generate-from-description", ...params },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Generation failed");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brandaro-personalities"] });
      qc.invalidateQueries({ queryKey: ["brandaro-personality-scripts"] });
      toast.success("Personality generated from description");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useSeedStarterPersonalities() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("ingest-personality", {
        body: { action: "seed-starters" },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Seeding failed");
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["brandaro-personalities"] });
      qc.invalidateQueries({ queryKey: ["brandaro-personality-scripts"] });
      const created = data.results?.filter((r: any) => r.status === "created").length || 0;
      toast.success(`${created} starter personalities deployed`);
    },
    onError: (e: any) => toast.error(e.message),
  });
}