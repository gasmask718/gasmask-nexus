import { createContext, useContext } from "react";

export interface VACallMetadata {
  leadId?: string | null;
  leadName?: string;
  twilioNumber?: string;
  callLogId?: string | null;
  disposition?: string | null;
  excitementLevel?: string | null;
  isVACall?: boolean;
  direction?: "inbound" | "outbound";
}

export interface ActiveCallInfo {
  callSid: string;
  callLogId: string;
  destinationPhone: string;
  entityName?: string;
  status: string;
  startedAt: Date;
}

export interface CallParams {
  destinationPhone: string;
  businessId?: string;
  entityType?: "store" | "customer" | "wholesaler" | "driver" | "ambassador" | "other";
  entityId?: string;
  entityName?: string;
  notes?: string;
  agentId?: string;
  isTestCall?: boolean;
}

export interface CallContextValue {
  initiateCall: (params: CallParams) => void;
  placeCallNow: (params: CallParams) => Promise<any>;
  isCallModalOpen: boolean;
  activeCall: ActiveCallInfo | null;
  formatPhoneDisplay: (phone: string) => string;
  callDuration: number;
  isMuted: boolean;
  isMinimized: boolean;
  vaCallMetadata: VACallMetadata | null;
  setVACallMetadata: (meta: VACallMetadata | null) => void;
  minimizeCall: () => void;
  expandCall: () => void;
  endActiveCall: () => void;
  toggleMuteGlobal: () => void;
}

export const CallContext = createContext<CallContextValue | null>(null);

export function useCall() {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error("useCall must be used within CallProvider");
  }
  return context;
}
