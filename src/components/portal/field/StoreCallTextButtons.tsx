import { Button } from "@/components/ui/button";
import { Phone, MessageSquare } from "lucide-react";
import { useCall } from "@/components/communication/CallProvider";
import { useMessage } from "@/components/communication/MessageProvider";
import { toast } from "sonner";

interface StoreCallTextButtonsProps {
  phone?: string | null;
  storeId: string;
  storeName: string;
  /** Visual size for the buttons. */
  size?: "sm" | "default";
  /** When true, render icon-only compact buttons. */
  compact?: boolean;
  /** Label suffix for context, e.g. "Recipient". */
  label?: string;
}

/**
 * Reusable Call + Text button pair for Driver/Biker portals.
 *
 * Both actions flow through the same global providers used by the
 * Ambassador portal and CRM:
 *   - Call → useCall().initiateCall  → CallModal → place-outbound-call
 *            → communication_logs (with driver/biker profile as actor).
 *   - Text → useMessage().initiateMessage → DraftMessageModal → send-sms
 *            → communication_logs / communication_messages.
 *
 * Attribution to the acting driver/biker is captured server-side from the
 * authenticated Supabase user, so every call/text threads into the store's
 * contact history and the Account Activity feed.
 */
export function StoreCallTextButtons({
  phone,
  storeId,
  storeName,
  size = "sm",
  compact = false,
  label,
}: StoreCallTextButtonsProps) {
  const { initiateCall } = useCall();
  const { initiateMessage } = useMessage();

  const disabled = !phone;

  const handleCall = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!phone) return toast.error("No phone number on file");
    initiateCall({
      destinationPhone: phone,
      entityType: "store",
      entityId: storeId,
      entityName: storeName,
    });
  };

  const handleText = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!phone) return toast.error("No phone number on file");
    initiateMessage({
      destinationPhone: phone,
      entityType: "store",
      entityId: storeId,
      storeId,
      entityName: storeName,
      channel: "sms",
    });
  };

  return (
    <div className="flex gap-2">
      <Button
        size={size}
        variant="outline"
        onClick={handleCall}
        disabled={disabled}
        aria-label={`Call ${storeName}`}
      >
        <Phone className="h-3.5 w-3.5" />
        {!compact && <span className="ml-1">Call{label ? ` ${label}` : ""}</span>}
      </Button>
      <Button
        size={size}
        variant="outline"
        onClick={handleText}
        disabled={disabled}
        aria-label={`Text ${storeName}`}
      >
        <MessageSquare className="h-3.5 w-3.5" />
        {!compact && <span className="ml-1">Text{label ? ` ${label}` : ""}</span>}
      </Button>
    </div>
  );
}
