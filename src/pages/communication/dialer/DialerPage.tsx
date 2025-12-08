import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ManualCallingPanel } from "@/components/communication/ManualCallingPanel";
import { toast } from "sonner";

export default function DialerPage() {
  const [selectedBusinessId] = useState<string>("all");

  const { data: stores = [] } = useQuery({
    queryKey: ["stores-for-calling", selectedBusinessId],
    queryFn: async () => {
      let query = supabase
        .from("store_master")
        .select("id, store_name, owner_name, phone, address")
        .is("deleted_at", null)
        .order("store_name");

      if (selectedBusinessId !== "all") {
        query = query.or(`brand_id.eq.${selectedBusinessId},business_id.eq.${selectedBusinessId}`);
      }

      const { data } = await query.limit(100);
      return data || [];
    },
  });

  const handleCall = (storeId: string, phone: string) => {
    toast.info(`Initiating call to ${phone}`);
  };

  const handleLogOutcome = (callId: string, outcome: string, notes: string) => {
    toast.success("Call logged successfully");
  };

  const handleScheduleFollowUp = (storeId: string, date: string) => {
    toast.success("Follow-up scheduled");
  };

  return (
    <div className="w-full min-h-full space-y-6">
      <h2 className="text-2xl font-bold mb-6">Dialer</h2>
      <ManualCallingPanel
        stores={stores}
        recentCalls={[]}
        onCall={handleCall}
        onLogOutcome={handleLogOutcome}
        onScheduleFollowUp={handleScheduleFollowUp}
      />
    </div>
  );
}
