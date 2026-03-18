import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Script Performance (A/B variants) ──
export function useScriptPerformance() {
  return useQuery({
    queryKey: ["brandaro-script-performance"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("brandaro_script_performance")
        .select("*")
        .eq("is_active", true)
        .order("script_type")
        .order("reply_rate", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });
}

// ── Lead Performance Stats ──
export function useLeadPerformanceStats() {
  return useQuery({
    queryKey: ["brandaro-lead-perf-stats"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("brandaro_lead_performance")
        .select("*")
        .order("lead_score", { ascending: false })
        .limit(200);
      if (error) throw error;
      const leads = data || [];
      const totalTracked = leads.length;
      const smsReplied = leads.filter((l: any) => l.sms_replied).length;
      const callsAnswered = leads.filter((l: any) => l.call_picked_up).length;
      const interested = leads.filter((l: any) => l.interested).length;
      const converted = leads.filter((l: any) => l.converted).length;
      const avgScore = totalTracked > 0 ? Math.round(leads.reduce((s: number, l: any) => s + (l.lead_score || 0), 0) / totalTracked) : 0;
      return {
        totalTracked,
        smsReplied,
        callsAnswered,
        interested,
        converted,
        avgScore,
        replyRate: totalTracked > 0 ? Math.round((smsReplied / totalTracked) * 100) : 0,
        conversionRate: totalTracked > 0 ? Math.round((converted / totalTracked) * 100) : 0,
        topLeads: leads.slice(0, 10),
      };
    },
    refetchInterval: 30000,
  });
}

// ── Record a response event ──
export function useRecordResponse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      lead_id: string;
      response_type: "sms_reply" | "call_answered" | "interested" | "converted";
      variant_key?: string;
      script_type?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("brandaro-auto-striker", {
        body: { action: "record_response", ...params },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brandaro-lead-perf-stats"] });
      qc.invalidateQueries({ queryKey: ["brandaro-script-performance"] });
      toast.success("Response recorded — intelligence updated");
    },
    onError: (err: any) => toast.error(`Failed to record: ${err.message}`),
  });
}
