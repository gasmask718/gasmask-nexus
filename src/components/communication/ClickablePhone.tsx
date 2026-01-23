import { useCall } from "./CallProvider";
import { Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ClickablePhoneProps {
  phone: string;
  entityName?: string;
  entityType?: "store" | "customer" | "wholesaler" | "driver" | "ambassador" | "other";
  entityId?: string;
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
 * A clickable phone number component that triggers the global call modal
 * instead of opening tel: links
 */
export function ClickablePhone({
  phone,
  entityName,
  entityType = "other",
  entityId,
  businessId,
  className,
  showIcon = false,
  children,
  onClick,
  variant = "inline",
}: ClickablePhoneProps) {
  const { initiateCall } = useCall();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClick?.(e);
    initiateCall({
      destinationPhone: phone,
      entityType,
      entityId,
      entityName,
      businessId,
    });
  };

  if (variant === "icon") {
    return (
      <Button 
        size="sm" 
        variant="ghost" 
        onClick={handleClick}
        aria-label={`Call ${entityName || phone}`}
      >
        <Phone className="h-4 w-4" />
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
      {showIcon && <Phone className="h-3 w-3" />}
      {children || phone}
    </button>
  );
}
