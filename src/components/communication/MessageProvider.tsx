import { createContext, useContext, ReactNode, useState } from "react";
import { DraftMessageModal } from "./DraftMessageModal";

/**
 * GLOBAL MESSAGE PROVIDER (DRAFT-FIRST)
 * 
 * This context provider wraps the entire application and provides
 * a unified messaging interface. All messages are created as DRAFTS first
 * and require human approval before sending.
 * 
 * HARD RULES:
 * - NO automatic sending
 * - ALL messages start as drafts
 * - Human must review and approve before send
 * - Only Owner/Admin/Accountant can approve & send
 */

export interface MessageParams {
  destinationPhone: string;
  businessId?: string;
  storeId?: string;
  entityType?: "store" | "customer" | "wholesaler" | "driver" | "ambassador" | "other";
  entityId?: string;
  entityName?: string;
  channel?: "sms" | "whatsapp";
  source?: string;
  // Context for collections/invoices
  contextData?: {
    invoiceIds?: string[];
    totalAmount?: number;
    daysOverdue?: number;
    isVip?: boolean;
    isDisputed?: boolean;
  };
}

interface MessageContextValue {
  initiateMessage: (params: MessageParams) => void;
  isMessageModalOpen: boolean;
  pendingMessage: MessageParams | null;
}

const MessageContext = createContext<MessageContextValue | null>(null);

export function useMessage() {
  const context = useContext(MessageContext);
  if (!context) {
    throw new Error("useMessage must be used within MessageProvider");
  }
  return context;
}

interface MessageProviderProps {
  children: ReactNode;
}

export function MessageProvider({ children }: MessageProviderProps) {
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<MessageParams | null>(null);

  const initiateMessage = (params: MessageParams) => {
    setPendingMessage(params);
    setIsMessageModalOpen(true);
  };

  const handleClose = () => {
    setIsMessageModalOpen(false);
    setPendingMessage(null);
  };

  const handleMessageSent = () => {
    setIsMessageModalOpen(false);
    setPendingMessage(null);
  };

  return (
    <MessageContext.Provider
      value={{
        initiateMessage,
        isMessageModalOpen,
        pendingMessage,
      }}
    >
      {children}
      
      {/* Global Draft Message Modal - Draft-First Flow */}
      <DraftMessageModal
        isOpen={isMessageModalOpen}
        onClose={handleClose}
        onMessageSent={handleMessageSent}
        destinationPhone={pendingMessage?.destinationPhone || ""}
        entityName={pendingMessage?.entityName}
        entityType={pendingMessage?.entityType}
        entityId={pendingMessage?.entityId}
        storeId={pendingMessage?.storeId}
        businessId={pendingMessage?.businessId}
        channel={pendingMessage?.channel || "sms"}
        contextData={pendingMessage?.contextData}
      />
    </MessageContext.Provider>
  );
}
