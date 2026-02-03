import { useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * GLOBAL OUTBOUND CALLING HOOK
 * 
 * This hook provides a unified interface for placing outbound calls
 * across the entire Dynasty OS. It replaces all tel: links with
 * proper Twilio-backed calls.
 * 
 * Features:
 * - Business-aware caller ID selection
 * - Permission checking
 * - Call status tracking
 * - Complete call logging
 */

interface PlaceCallParams {
  destinationPhone: string;
  businessId?: string;
  entityType?: "store" | "customer" | "wholesaler" | "driver" | "ambassador" | "other";
  entityId?: string;
  entityName?: string;
  notes?: string;
}

interface CallResult {
  success: boolean;
  callSid?: string;
  callLogId?: string;
  from?: string;
  to?: string;
  error?: string;
}

interface ActiveCall {
  callSid: string;
  callLogId: string;
  destinationPhone: string;
  entityName?: string;
  status: string;
  startedAt: Date;
}

export function useOutboundCall() {
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [pendingCall, setPendingCall] = useState<PlaceCallParams | null>(null);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const queryClient = useQueryClient();

  // Fetch available businesses with phone numbers
  const { data: businessPhoneNumbers = [] } = useQuery({
    queryKey: ["business-phone-numbers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_phone_numbers")
        .select(`
          id,
          phone_number,
          type,
          label,
          is_default,
          business_id,
          businesses (
            id,
            name,
            primary_color
          )
        `)
        .eq("is_active", true)
        .in("type", ["call", "both"])
        .order("is_default", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Get default business for calling
  const getDefaultBusiness = useCallback(() => {
    const defaultNumber = businessPhoneNumbers.find(bp => bp.is_default);
    return defaultNumber || businessPhoneNumbers[0];
  }, [businessPhoneNumbers]);

  // Place call mutation
  const placeCallMutation = useMutation({
    mutationFn: async (params: PlaceCallParams): Promise<CallResult> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/place-outbound-call`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            destination_phone: params.destinationPhone,
            business_id: params.businessId,
            entity_type: params.entityType,
            entity_id: params.entityId,
            entity_name: params.entityName,
            notes: params.notes,
          }),
        }
      );

      const result = await response.json();
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to place call");
      }

      return {
        success: true,
        callSid: result.call_sid,
        callLogId: result.call_log_id,
        from: result.from,
        to: result.to,
      };
    },
    onSuccess: (result, variables) => {
      if (result.success && result.callSid) {
        setActiveCall({
          callSid: result.callSid,
          callLogId: result.callLogId || "",
          destinationPhone: variables.destinationPhone,
          entityName: variables.entityName,
          status: "initiated",
          startedAt: new Date(),
        });
        toast.success("Call initiated successfully");
        queryClient.invalidateQueries({ queryKey: ["manual-call-logs"] });
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to place call: ${error.message}`);
      setActiveCall(null);
    },
  });

  // Open call modal with pre-filled data
  const initiateCall = useCallback((params: PlaceCallParams) => {
    // If no businessId provided, use default
    if (!params.businessId) {
      const defaultBusiness = getDefaultBusiness();
      params.businessId = defaultBusiness?.business_id;
    }
    
    setPendingCall(params);
    setIsCallModalOpen(true);
  }, [getDefaultBusiness]);

  // Place a call immediately (used by the Dialer page to avoid modal/state races)
  const placeCallNow = useCallback(async (params: PlaceCallParams) => {
    const callParams: PlaceCallParams = { ...params };
    if (!callParams.businessId) {
      const defaultBusiness = getDefaultBusiness();
      callParams.businessId = defaultBusiness?.business_id;
    }
    return await placeCallMutation.mutateAsync(callParams);
  }, [getDefaultBusiness, placeCallMutation]);

  // Confirm and place the call
  const confirmCall = useCallback(async (overrideBusinessId?: string) => {
    if (!pendingCall) return;

    const callParams: PlaceCallParams = {
      ...pendingCall,
      businessId: overrideBusinessId || pendingCall.businessId,
    };

    await placeCallMutation.mutateAsync(callParams);
    setIsCallModalOpen(false);
  }, [pendingCall, placeCallMutation]);

  // Cancel call modal
  const cancelCall = useCallback(() => {
    setIsCallModalOpen(false);
    setPendingCall(null);
  }, []);

  // End active call tracking
  const clearActiveCall = useCallback(() => {
    setActiveCall(null);
    queryClient.invalidateQueries({ queryKey: ["manual-call-logs"] });
  }, [queryClient]);

  // Format phone number for display
  const formatPhoneDisplay = useCallback((phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    } else if (cleaned.length === 11 && cleaned.startsWith("1")) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  }, []);

  return {
    // State
    isCallModalOpen,
    pendingCall,
    activeCall,
    isPlacingCall: placeCallMutation.isPending,
    businessPhoneNumbers,
    
    // Actions
    initiateCall,
    placeCallNow,
    confirmCall,
    cancelCall,
    clearActiveCall,
    
    // Utilities
    formatPhoneDisplay,
    getDefaultBusiness,
  };
}

// Export a simpler hook for components that just need to trigger calls
export function useQuickCall() {
  const { initiateCall, formatPhoneDisplay } = useOutboundCall();

  const quickCall = useCallback((
    phone: string,
    options?: {
      entityName?: string;
      entityType?: PlaceCallParams["entityType"];
      entityId?: string;
      businessId?: string;
    }
  ) => {
    if (!phone) {
      toast.error("No phone number available");
      return;
    }

    initiateCall({
      destinationPhone: phone,
      entityName: options?.entityName,
      entityType: options?.entityType,
      entityId: options?.entityId,
      businessId: options?.businessId,
    });
  }, [initiateCall]);

  return { quickCall, formatPhoneDisplay };
}
