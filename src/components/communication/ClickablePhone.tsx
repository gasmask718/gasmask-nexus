import { useCall } from "./CallProvider";
import { Phone } from "lucide-react";
import { cn } from "@/lib/utils";

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
