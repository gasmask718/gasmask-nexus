import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type CloserAction = "sms" | "call" | "payment_link";

interface CloserActionParams {
  action: CloserAction;
  phone: string;
  message?: string;
  leadId?: string;
  sessionId?: string;
  paymentUrl?: string;
}

export function useCloserAction() {
  return useMutation({
    mutationFn: async (params: CloserActionParams) => {
      const { data, error } = await supabase.functions.invoke("brandaro-closer-action", {
        body: {
          action: params.action,
          phone: params.phone,
          message: params.message,
          lead_id: params.leadId,
          session_id: params.sessionId,
          payment_url: params.paymentUrl,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Action failed");
      return data;
    },
    onSuccess: (_, vars) => {
      const labels: Record<CloserAction, string> = {
        sms: "SMS sent",
        call: "Call initiated",
        payment_link: "Payment link sent",
      };
      toast.success(labels[vars.action]);
    },
    onError: (err: any) => {
      toast.error(`Action failed: ${err.message}`);
    },
  });
}
