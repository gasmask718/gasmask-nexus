import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useTwilioHealth() {
  return useQuery({
    queryKey: ["twilio-health"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("check-twilio-health");
      if (error) return { status: "error", message: error.message };
      return data;
    },
    refetchInterval: 60000,
    staleTime: 30000,
  });
}
