// Task 19b — generic "Send to Route Board" action. Funnels stores into pending_route_stops
// so they appear on the Route Command Center without forcing immediate assignment.
import { Button, type ButtonProps } from "@/components/ui/button";
import { Send } from "lucide-react";
import {
  usePromoteToRouteBoard,
  type RouteBoardSignalSource,
  type PromoteStoreInput,
} from "@/hooks/usePromoteToRouteBoard";

interface Props extends Omit<ButtonProps, "onClick"> {
  signalSource: RouteBoardSignalSource;
  stores: PromoteStoreInput[];
  defaultBusiness?: string | null;
  defaultReason?: string;
  defaultPriority?: number;
  label?: string;
}

export function SendToRouteBoardButton({
  signalSource,
  stores,
  defaultBusiness,
  defaultReason,
  defaultPriority,
  label,
  disabled,
  variant = "outline",
  size = "sm",
  ...rest
}: Props) {
  const promote = usePromoteToRouteBoard({
    signalSource,
    defaultReason,
    defaultBusiness,
    defaultPriority,
  });

  const count = stores?.length || 0;
  const isDisabled = disabled || promote.isPending || count === 0;

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={isDisabled}
      onClick={() => promote.mutate(stores)}
      {...rest}
    >
      <Send className="h-4 w-4 mr-1.5" />
      {promote.isPending
        ? "Sending…"
        : label ?? (count > 0 ? `Send ${count} to Route Board` : "Send to Route Board")}
    </Button>
  );
}
