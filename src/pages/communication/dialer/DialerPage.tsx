import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ManualCallingPanel } from "@/components/communication/ManualCallingPanel";
import { toast } from "sonner";

export default function DialerPage() {
  const [selectedBusinessId] = useState<string>("all");
  const queryClient = useQueryClient();

  // Fetch stores from store_master
  const { data: stores = [], isLoading: storesLoading } = useQuery({
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

      const { data, error } = await query.limit(100);
      if (error) {
        console.error("Error fetching stores:", error);
        throw error;
      }
      return data || [];
    },
  });

  // Fetch recent calls from manual_call_logs
  const { data: recentCalls = [] } = useQuery({
    queryKey: ["recent-manual-calls"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("manual_call_logs")
        .select("id, store_id, outcome, notes, created_at")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) {
        console.error("Error fetching recent calls:", error);
        return [];
      }

      // Map to the expected CallLog interface
      return (data || []).map((call) => ({
        id: call.id,
        store_id: call.store_id || "",
        outcome: call.outcome || "unknown",
        transcription: call.notes || undefined,
        created_at: call.created_at || new Date().toISOString(),
      }));
    },
  });

  // Mutation to log a call
  const logCallMutation = useMutation({
    mutationFn: async ({
      storeId,
      phone,
      outcome,
      notes,
    }: {
      storeId: string;
      phone: string;
      outcome: string;
      notes: string;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("manual_call_logs")
        .insert({
          store_id: storeId,
          phone_number: phone,
          outcome,
          notes,
          direction: "outbound",
          status: "completed",
          caller_id: userData?.user?.id,
          related_entity_type: "store",
          related_entity_id: storeId,
          started_at: new Date().toISOString(),
          ended_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recent-manual-calls"] });
      toast.success("Call logged successfully");
    },
    onError: (error) => {
      console.error("Error logging call:", error);
      toast.error("Failed to log call");
    },
  });

  // Mutation to schedule follow-up
  const scheduleFollowUpMutation = useMutation({
    mutationFn: async ({ storeId, date }: { storeId: string; date: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("follow_ups")
        .insert({
          related_entity_type: "store",
          related_entity_id: storeId,
          due_date: date.split("T")[0], // Extract date part
          note: "Follow-up from dialer call",
          completed: false,
          assigned_to: userData?.user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Follow-up scheduled");
    },
    onError: (error) => {
      console.error("Error scheduling follow-up:", error);
      toast.error("Failed to schedule follow-up");
    },
  });

  // Track current call for logging
  const [currentCall, setCurrentCall] = useState<{
    storeId: string;
    phone: string;
  } | null>(null);

  const handleCall = (storeId: string, phone: string) => {
    setCurrentCall({ storeId, phone });
    toast.info(`Initiating call to ${phone}`);
  };

  const handleLogOutcome = (callId: string, outcome: string, notes: string) => {
    if (currentCall) {
      logCallMutation.mutate({
        storeId: currentCall.storeId,
        phone: currentCall.phone,
        outcome,
        notes,
      });
      setCurrentCall(null);
    }
  };

  const handleScheduleFollowUp = (storeId: string, date: string) => {
    scheduleFollowUpMutation.mutate({ storeId, date });
  };

  return (
    <div className="w-full min-h-full space-y-6">
      <h2 className="text-2xl font-bold mb-6">Dialer</h2>
      <ManualCallingPanel
        stores={stores}
        recentCalls={recentCalls}
        onCall={handleCall}
        onLogOutcome={handleLogOutcome}
        onScheduleFollowUp={handleScheduleFollowUp}
        isLoading={storesLoading}
      />
    </div>
  );
}
