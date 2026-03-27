import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TerritoryJob {
  id: string;
  state: string;
  city: string;
  category: string;
  source: string;
  status: string;
  priority: number;
  leads_found: number;
  duplicates_skipped: number;
  enriched_count: number;
  failed_reason: string | null;
  started_at: string | null;
  finished_at: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StateCoverage {
  id: string;
  state: string;
  status: string;
  priority_tier: string;
  total_leads: number;
  total_onboarded: number;
  categories_searched: number;
  cities_covered: number;
  duplicate_count: number;
  last_run_at: string | null;
  next_run_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useStateCoverage() {
  return useQuery({
    queryKey: ["ut-state-coverage"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("ut_state_coverage" as any) as any)
        .select("*")
        .order("state");
      if (error) throw error;
      return (data || []) as StateCoverage[];
    },
    staleTime: 30_000,
  });
}

export function useTerritoryJobs(filters?: { state?: string; status?: string; category?: string }) {
  return useQuery({
    queryKey: ["ut-territory-jobs", filters],
    queryFn: async () => {
      let query = (supabase.from("ut_territory_jobs" as any) as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (filters?.state) query = query.eq("state", filters.state);
      if (filters?.status) query = query.eq("status", filters.status);
      if (filters?.category) query = query.eq("category", filters.category);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as TerritoryJob[];
    },
    staleTime: 15_000,
  });
}

export function useCreateTerritoryJobs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (jobs: Array<{ state: string; city: string; category: string; source?: string; priority?: number }>) => {
      const rows = jobs.map(j => ({
        state: j.state,
        city: j.city,
        category: j.category,
        source: j.source || "google_places",
        status: "queued",
        priority: j.priority || 5,
      }));
      const { data, error } = await (supabase.from("ut_territory_jobs" as any) as any).insert(rows).select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ut-territory-jobs"] });
      toast.success("Territory jobs queued");
    },
  });
}

export function useUpdateJobStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, extras }: { id: string; status: string; extras?: Record<string, any> }) => {
      const update: any = { status, updated_at: new Date().toISOString(), ...extras };
      if (status === "running") update.started_at = new Date().toISOString();
      if (status === "completed" || status === "failed") update.finished_at = new Date().toISOString();
      const { error } = await (supabase.from("ut_territory_jobs" as any) as any).update(update).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ut-territory-jobs"] });
      qc.invalidateQueries({ queryKey: ["ut-state-coverage"] });
    },
  });
}

export function useUpdateStateCoverage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ state, updates }: { state: string; updates: Partial<StateCoverage> }) => {
      const { error } = await (supabase.from("ut_state_coverage" as any) as any)
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("state", state);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ut-state-coverage"] });
    },
  });
}

export function useTerritoryStats() {
  return useQuery({
    queryKey: ["ut-territory-stats"],
    queryFn: async () => {
      const { data: jobs, error: jErr } = await (supabase.from("ut_territory_jobs" as any) as any)
        .select("status, leads_found, duplicates_skipped, enriched_count");
      if (jErr) throw jErr;

      const { data: states, error: sErr } = await (supabase.from("ut_state_coverage" as any) as any)
        .select("status, total_leads, total_onboarded, categories_searched");
      if (sErr) throw sErr;

      const allJobs = (jobs || []) as TerritoryJob[];
      const allStates = (states || []) as StateCoverage[];

      const totalLeads = allJobs.reduce((s, j) => s + (j.leads_found || 0), 0);
      const totalDupes = allJobs.reduce((s, j) => s + (j.duplicates_skipped || 0), 0);
      const totalEnriched = allJobs.reduce((s, j) => s + (j.enriched_count || 0), 0);
      const statesCovered = allStates.filter(s => s.status === "completed" || s.status === "in_progress").length;
      const categoriesCovered = new Set(allJobs.filter(j => j.status === "completed").map((j: any) => j.category)).size;

      return {
        totalLeads,
        totalDupes,
        totalEnriched,
        statesCovered,
        categoriesCovered,
        totalJobs: allJobs.length,
        completedJobs: allJobs.filter(j => j.status === "completed").length,
        failedJobs: allJobs.filter(j => j.status === "failed").length,
        queuedJobs: allJobs.filter(j => j.status === "queued").length,
        runningJobs: allJobs.filter(j => j.status === "running").length,
        dupeRate: totalLeads > 0 ? Math.round((totalDupes / (totalLeads + totalDupes)) * 100) : 0,
      };
    },
    staleTime: 15_000,
  });
}
