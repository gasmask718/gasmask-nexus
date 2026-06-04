import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ManualCallingPanel } from "@/components/communication/ManualCallingPanel";
import { QuickDialModal } from "@/components/communication/QuickDialModal";
import { toast } from "sonner";
import { useOutboundCall } from "@/hooks/useOutboundCall";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Phone } from "lucide-react";
import { BusinessCompliancePanel } from "@/components/communication/BusinessCompliancePanel";

export default function DialerPage() {
  const [selectedBusinessId] = useState<string>("all");
  const [isCalling, setIsCalling] = useState(false);
  const [quickDialValue, setQuickDialValue] = useState("");
  const [isQuickDialModalOpen, setIsQuickDialModalOpen] = useState(false);
  const queryClient = useQueryClient();

  // --- 1. Fetch Stores ---
  const { data: stores = [], isLoading: storesLoading } = useQuery({
    queryKey: ["stores-for-calling", selectedBusinessId],
    queryFn: async () => {
      let query = supabase
        .from("store_master")
        .select("id, store_name, owner_name, phone, address")
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

  // --- 2. Fetch Recent Calls ---
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

      return (data || []).map((call) => ({
        id: call.id,
        store_id: call.store_id || "",
        outcome: call.outcome || "unknown",
        transcription: call.notes || undefined,
        created_at: call.created_at || new Date().toISOString(),
      }));
    },
  });

  // --- 3. Mutation: Log Call to Supabase ---
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

  // --- 4. Mutation: Schedule Follow-up ---
  const scheduleFollowUpMutation = useMutation({
    mutationFn: async ({ storeId, date }: { storeId: string; date: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("follow_ups")
        .insert({
          related_entity_type: "store",
          related_entity_id: storeId,
          due_date: date.split("T")[0],
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

  // --- State for Active Call Context ---
  const [currentCall, setCurrentCall] = useState<{
    storeId: string;
    phone: string;
  } | null>(null);

  // --- Handler: Initiate Twilio Call ---
  const { placeCallNow } = useOutboundCall();

  const handleCall = async (storeId: string, phone: string, storeName?: string) => {
    setCurrentCall({ storeId, phone });
    setIsCalling(true);
    toast.info("Placing call...");

    try {
      await placeCallNow({
        destinationPhone: phone,
        entityType: "store",
        entityId: storeId,
        entityName: storeName,
      });
    } catch (error: unknown) {
      console.error("Dialing error:", error);
      const msg = error instanceof Error ? error.message : String(error);
      toast.error(`Call failed: ${msg}`);
      setCurrentCall(null);
    } finally {
      setIsCalling(false);
    }
  };

  // --- Handler: Quick Dial Custom Number ---
  const handleQuickDialCall = async (phone: string, name?: string) => {
    setIsCalling(true);
    toast.info("Placing call...");

    try {
      await placeCallNow({
        destinationPhone: phone,
        entityType: "other",
        entityName: name || "Quick Dial",
      });
    } catch (error: unknown) {
      console.error("Dialing error:", error);
      const msg = error instanceof Error ? error.message : String(error);
      toast.error(`Call failed: ${msg}`);
    } finally {
      setIsCalling(false);
    }
  };

  // --- Handler: Save Outcome ---
  const handleLogOutcome = (callId: string, outcome: string, notes: string) => {
    if (currentCall) {
      logCallMutation.mutate({
        storeId: currentCall.storeId,
        phone: currentCall.phone,
        outcome,
        notes,
      });
      setCurrentCall(null);
    } else {
      toast.error("No active call to log");
    }
  };

  // --- Handler: Schedule Follow-up ---
  const handleScheduleFollowUp = (storeId: string, date: string) => {
    scheduleFollowUpMutation.mutate({ storeId, date });
  };

  // --- Handler: Open Quick Dial Modal ---
  const handleOpenQuickDial = () => {
    setIsQuickDialModalOpen(true);
  };

  return (
    <div className="w-full min-h-full space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Dialer</h2>
        {isCalling && (
          <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm animate-pulse font-medium">
            Dialing Agent...
          </span>
        )}
      </div>

      {/* Quick Dial */}
      <div className="flex items-center gap-2 mb-4">
        <Input
          className="w-64 font-mono"
          placeholder="Quick dial (e.g. +18484004179)"
          value={quickDialValue}
          onChange={(e) => setQuickDialValue(e.target.value.replace(/[^\d+]/g, ""))}
        />
        <Button
          onClick={handleOpenQuickDial}
          variant="default"
          disabled={isCalling}
        >
          <Phone className="h-4 w-4 mr-2" />
          Dial
        </Button>
        <div className="text-sm text-muted-foreground">
          or select a store below to call
        </div>
      </div>

      <ManualCallingPanel
        stores={stores}
        recentCalls={recentCalls}
        onCall={handleCall}
        onLogOutcome={handleLogOutcome}
        onScheduleFollowUp={handleScheduleFollowUp}
        isLoading={storesLoading}
      />

      {/* T3 K3 salvage: BusinessCompliancePanel rehomed from killed /comm-systems subtree */}
      <BusinessCompliancePanel
        businessId={selectedBusinessId === "all" ? null : selectedBusinessId}
        businessName={null}
        isAllBusinesses={selectedBusinessId === "all"}
      />



      {/* Quick Dial Modal */}
      <QuickDialModal
        isOpen={isQuickDialModalOpen}
        onClose={() => setIsQuickDialModalOpen(false)}
        onCall={handleQuickDialCall}
        initialPhone={quickDialValue}
      />
    </div>
  );
}
