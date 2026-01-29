import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Clock, LucideIcon } from "lucide-react";
import { ReactNode } from "react";

interface ComingSoonButtonProps {
  children: ReactNode;
  icon?: LucideIcon;
  tooltip?: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export function ComingSoonButton({
  children,
  icon: Icon,
  tooltip = "This feature is coming soon",
  variant = "outline",
  size = "default",
  className,
}: ComingSoonButtonProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={variant}
            size={size}
            disabled
            className={`opacity-60 cursor-not-allowed ${className}`}
          >
            {Icon && <Icon className="h-4 w-4 mr-2" />}
            {children}
            <Badge variant="secondary" className="ml-2 text-xs">
              <Clock className="h-3 w-3 mr-1" />
              Soon
            </Badge>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface ComingSoonBadgeProps {
  label?: string;
}

export function ComingSoonBadge({ label = "Coming Soon" }: ComingSoonBadgeProps) {
  return (
    <Badge variant="secondary" className="text-xs">
      <Clock className="h-3 w-3 mr-1" />
      {label}
    </Badge>
  );
}
