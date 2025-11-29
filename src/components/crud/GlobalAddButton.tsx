import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface GlobalAddButtonProps {
  label?: string;
  onClick: () => void;
  className?: string;
  variant?: 'floating' | 'inline' | 'header';
}

export function GlobalAddButton({
  label = "Add New",
  onClick,
  className,
  variant = 'floating',
}: GlobalAddButtonProps) {
  if (variant === 'floating') {
    return (
      <Button
        onClick={onClick}
        className={cn(
          "fixed bottom-6 right-6 h-14 rounded-full shadow-lg gap-2 z-50",
          "bg-primary hover:bg-primary/90 text-primary-foreground",
          className
        )}
      >
        <Plus className="h-5 w-5" />
        <span className="hidden sm:inline">{label}</span>
      </Button>
    );
  }

  if (variant === 'header') {
    return (
      <Button onClick={onClick} size="sm" className={cn("gap-2", className)}>
        <Plus className="h-4 w-4" />
        {label}
      </Button>
    );
  }

  return (
    <Button onClick={onClick} variant="outline" className={cn("gap-2", className)}>
      <Plus className="h-4 w-4" />
      {label}
    </Button>
  );
}
