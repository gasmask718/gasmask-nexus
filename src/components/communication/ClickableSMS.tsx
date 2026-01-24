import { useMessage } from "./MessageProvider";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ClickableSMSProps {
  phone: string;
  entityName?: string;
  entityType?: "store" | "customer" | "wholesaler" | "driver" | "ambassador" | "other";
  entityId?: string;
  storeId?: string;
  businessId?: string;
  className?: string;
  showIcon?: boolean;
  children?: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  /** 
   * Display variant:
   * - "inline" (default): renders as a styled text button
   * - "icon": renders as a small ghost icon button
   */
  variant?: "inline" | "icon";
}

/**
 * A clickable SMS component that triggers the global message modal
 * instead of opening native sms: links (which would trigger "Pick an app")
 * 
 * This ensures all SMS actions go through Dynasty OS Communication Layer
 * with proper:
 * - Business context
 * - Audit logging
 * - Sender number resolution
 * - Compliance checks
 */
export function ClickableSMS({
  phone,
  entityName,
  entityType = "other",
  entityId,
  storeId,
  businessId,
  className,
  showIcon = false,
  children,
  onClick,
  variant = "inline",
}: ClickableSMSProps) {
  const { initiateMessage } = useMessage();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClick?.(e);
    initiateMessage({
      destinationPhone: phone,
      entityType,
      entityId,
      entityName,
      storeId,
      businessId,
      channel: "sms",
    });
  };

  if (variant === "icon") {
    return (
      <Button 
        size="sm" 
        variant="ghost" 
        onClick={handleClick}
        aria-label={`Text ${entityName || phone}`}
      >
        <MessageSquare className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "inline-flex items-center gap-1 text-primary hover:underline cursor-pointer",
        className
      )}
    >
      {showIcon && <MessageSquare className="h-3 w-3" />}
      {children || "Send Message"}
    </button>
  );
}
