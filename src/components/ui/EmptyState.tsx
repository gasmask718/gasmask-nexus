import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LucideIcon, Inbox } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
  disabledReason?: string;
  children?: ReactNode;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  onAction,
  actionDisabled = false,
  disabledReason,
  children,
}: EmptyStateProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Icon className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="font-semibold text-lg mb-1">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground max-w-sm mb-4">
            {description}
          </p>
        )}
        {actionLabel && onAction && (
          <Button 
            onClick={onAction} 
            disabled={actionDisabled}
            title={actionDisabled ? disabledReason : undefined}
          >
            {actionLabel}
          </Button>
        )}
        {actionDisabled && disabledReason && (
          <p className="text-xs text-muted-foreground mt-2">{disabledReason}</p>
        )}
        {children}
      </CardContent>
    </Card>
  );
}
