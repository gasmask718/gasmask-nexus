import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useNumberPool(businessId?: string) {
  return useQuery({
    queryKey: ["brandaro-number-pool", businessId],
    queryFn: async () => {
      let q = supabase
        .from("brandaro_number_pool")
        .select("*")
        .order("daily_call_count", { ascending: true });
      if (businessId) q = q.eq("business_id", businessId);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
    enabled: true,
  });
}

export function useNumberAlerts() {
  return useQuery({
    queryKey: ["brandaro-number-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brandaro_number_alerts")
        .select("*, brandaro_number_pool(phone_number, area_code)")
        .eq("acknowledged", false)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as any[];
    },
    refetchInterval: 15000,
  });
}

export function useNumberAnalytics(businessId?: string) {
  return useQuery({
    queryKey: ["brandaro-number-analytics", businessId],
    queryFn: async () => {
      let q = supabase
        .from("brandaro_number_pool")
        .select("*")
        .order("total_calls", { ascending: false });
      if (businessId) q = q.eq("business_id", businessId);
      const { data, error } = await q;
      if (error) throw error;

      const numbers = data || [];
      const active = numbers.filter((n: any) => n.status === "active");
      const cooldown = numbers.filter((n: any) => n.status === "cooldown");
      const flagged = numbers.filter((n: any) => n.status === "flagged");
      const topPerformers = numbers
        .filter((n: any) => n.total_calls > 0)
        .sort((a: any, b: any) => {
          const rateA = a.total_answered / (a.total_calls || 1);
          const rateB = b.total_answered / (b.total_calls || 1);
          return rateB - rateA;
        })
        .slice(0, 5);

      return {
        total: numbers.length,
        active: active.length,
        cooldown: cooldown.length,
        flagged: flagged.length,
        topPerformers,
        allNumbers: numbers,
      };
    },
  });
}

export function useAssignNumber() {
  return useMutation({
    mutationFn: async (params: {
      target_phone: string;
      target_state?: string;
      business_id?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke(
        "brandaro-number-assign",
        { body: params }
      );
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Assignment failed");
      return data;
    },
    onError: (err: any) => {
      toast.error(`Number assignment failed: ${err.message}`);
    },
  });
}

export function useLogCallOutcome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      number_id: string;
      lead_phone: string;
      lead_name?: string;
      lead_location?: string;
      area_code_matched?: boolean;
      outcome: string;
      notes?: string;
      call_duration_seconds?: number;
      business_id?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("brandaro_call_outcomes").insert({
        ...params,
        va_id: user?.id,
      });
      if (error) throw error;

      // Update answer stats on the number
      if (params.outcome === "interested" || params.outcome === "callback") {
        await supabase.rpc("bump_number_usage" as any, { p_number_id: params.number_id });
      }
    },
    onSuccess: () => {
      toast.success("Call outcome logged");
      qc.invalidateQueries({ queryKey: ["brandaro-number-pool"] });
      qc.invalidateQueries({ queryKey: ["brandaro-number-analytics"] });
    },
    onError: (err: any) => {
      toast.error(`Failed to log outcome: ${err.message}`);
    },
  });
}
