import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Hook to auto-create pipeline entries and trigger follow-up sequences
export function useAutoClosePipeline() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      leadId,
      triggerEvent = "demo_requested",
    }: {
      leadId: string;
      triggerEvent?: string;
    }) => {
      // Create pipeline entry
      const { error: pipeErr } = await (supabase as any)
        .from("brandaro_close_pipeline")
        .upsert({
          lead_id: leadId,
          stage: "demo_sent",
          demo_sent_at: new Date().toISOString(),
          priority_score: triggerEvent === "hot_lead_auto" ? 90 : 50,
        }, { onConflict: "lead_id" });

      if (pipeErr) console.error("Pipeline upsert error:", pipeErr);

      // Create follow-up sequence (SMS at 2min, 2hr, 24hr, 3d)
      const delays = [
        { step: 1, minutes: 2, msg: "Hey! Just sent over a quick demo for your business — check it out when you get a sec 🔥" },
        { step: 2, minutes: 120, msg: "Quick follow-up — did you get a chance to look at the demo? Happy to walk you through it." },
        { step: 3, minutes: 1440, msg: "Hey! Just wanted to make sure you saw what we put together for your business. It's ready whenever you are." },
        { step: 4, minutes: 4320, msg: "Last check-in — your custom demo is still available. Want me to get this set up for you?" },
      ];

      for (const d of delays) {
        const scheduledAt = new Date(Date.now() + d.minutes * 60000).toISOString();
        await (supabase as any).from("brandaro_followup_sequences").insert({
          lead_id: leadId,
          trigger_event: triggerEvent,
          sequence_step: d.step,
          channel: "sms",
          message_content: d.msg,
          scheduled_at: scheduledAt,
          status: "pending",
        });
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brandaro-close-pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["brandaro-pending-followups"] });
    },
    onError: (err) => {
      console.error("Auto-close pipeline error:", err);
      toast.error("Failed to create pipeline entry");
    },
  });
}

// Hook for pipeline stage metrics
export function usePipelineMetrics() {
  return useQuery({
    queryKey: ["brandaro-pipeline-metrics"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("brandaro_close_pipeline")
        .select("stage, payment_amount, package_tier, days_in_pipeline");

      if (error) throw error;
      const items = data || [];

      const stages = ["demo_sent", "demo_viewed", "interested", "negotiating", "closed", "lost"];
      const counts: Record<string, number> = {};
      stages.forEach(s => { counts[s] = items.filter((i: any) => i.stage === s).length; });

      const closed = items.filter((i: any) => i.stage === "closed");
      const totalRevenue = closed.reduce((s: number, i: any) => s + (i.payment_amount || 0), 0);
      const avgDays = items.length > 0
        ? Math.round(items.reduce((s: number, i: any) => s + (i.days_in_pipeline || 0), 0) / items.length)
        : 0;

      return {
        stageCounts: counts,
        totalDeals: items.length,
        totalRevenue,
        avgDaysInPipeline: avgDays,
        closeRate: items.length > 0 ? Math.round((closed.length / items.length) * 100) : 0,
      };
    },
  });
}
