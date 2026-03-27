import { useState, useRef, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Execute a single territory job via edge function
async function executeJob(jobId: string) {
  const { data, error } = await supabase.functions.invoke("ut-run-territory-job", {
    body: { job_id: jobId },
  });
  if (error) throw new Error(error.message || "Job execution failed");
  if (data?.error) throw new Error(data.error);
  return data as { success: boolean; leads_found: number; duplicates_skipped: number; enriched_count: number };
}

// Single job execution hook
export function useRunSingleJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: executeJob,
    onSuccess: (data) => {
      toast.success(`Job complete: ${data.leads_found} leads found, ${data.duplicates_skipped} dupes skipped`);
      qc.invalidateQueries({ queryKey: ["ut-territory-jobs"] });
      qc.invalidateQueries({ queryKey: ["ut-state-coverage"] });
      qc.invalidateQueries({ queryKey: ["ut-partner-leads"] });
      qc.invalidateQueries({ queryKey: ["ut-territory-stats"] });
      qc.invalidateQueries({ queryKey: ["ut-lead-stats"] });
    },
    onError: (err: Error) => {
      toast.error(`Job failed: ${err.message}`);
    },
  });
}

// Queue processor: runs all queued jobs sequentially
export function useProcessQueue() {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, currentJob: "" });
  const abortRef = useRef(false);
  const qc = useQueryClient();

  const start = useCallback(async () => {
    setIsRunning(true);
    abortRef.current = false;

    try {
      // Fetch all queued jobs
      const { data: queuedJobs, error } = await (supabase.from("ut_territory_jobs" as any) as any)
        .select("id, state, city, category")
        .eq("status", "queued")
        .order("priority", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) throw error;
      if (!queuedJobs || queuedJobs.length === 0) {
        toast.info("No queued jobs to process");
        setIsRunning(false);
        return;
      }

      setProgress({ current: 0, total: queuedJobs.length, currentJob: "" });
      toast.info(`Starting queue: ${queuedJobs.length} jobs`);

      for (let i = 0; i < queuedJobs.length; i++) {
        if (abortRef.current) {
          toast.info("Queue paused");
          break;
        }

        const job = queuedJobs[i];
        setProgress({ current: i + 1, total: queuedJobs.length, currentJob: `${job.city}, ${job.state} — ${job.category}` });

        try {
          await executeJob(job.id);
        } catch (err) {
          console.error(`Job ${job.id} failed:`, err);
          // Continue to next job
        }

        // Invalidate queries to show live updates
        qc.invalidateQueries({ queryKey: ["ut-territory-jobs"] });
        qc.invalidateQueries({ queryKey: ["ut-partner-leads"] });
        qc.invalidateQueries({ queryKey: ["ut-lead-stats"] });
        qc.invalidateQueries({ queryKey: ["ut-territory-stats"] });
        qc.invalidateQueries({ queryKey: ["ut-state-coverage"] });

        // Delay between jobs to avoid rate limits
        if (i < queuedJobs.length - 1 && !abortRef.current) {
          await new Promise(r => setTimeout(r, 2000));
        }
      }

      toast.success("Queue processing complete!");
    } catch (err) {
      toast.error("Queue processing failed");
      console.error(err);
    } finally {
      setIsRunning(false);
      setProgress({ current: 0, total: 0, currentJob: "" });
    }
  }, [qc]);

  const pause = useCallback(() => {
    abortRef.current = true;
  }, []);

  return { start, pause, isRunning, progress };
}
