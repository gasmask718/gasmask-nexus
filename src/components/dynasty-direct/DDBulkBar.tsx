/**
 * DDBulkBar — sticky bulk-action bar that pops up when 1+ rows are selected.
 * Pattern mirrors the ambassador payouts "mark-all-paid" experience.
 */
import { Button } from '@/components/ui/button';
import { X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

export interface DDBulkAction {
  key: string;
  label: string;
  icon?: LucideIcon;
  variant?: 'default' | 'outline' | 'secondary' | 'destructive' | 'ghost';
  /** When provided, the bar asks for confirmation in-place before firing. */
  confirmLabel?: string;
  onRun: () => void | Promise<void>;
  disabled?: boolean;
}

interface DDBulkBarProps {
  count: number;
  total?: number;
  onClear: () => void;
  busy?: string | null;          // action key currently running
  actions: DDBulkAction[];
  className?: string;
}

export function DDBulkBar({ count, total, onClear, busy, actions, className }: DDBulkBarProps) {
  if (count === 0) return null;
  return (
    <div
      className={cn(
        'sticky top-2 z-30 flex items-center gap-3 flex-wrap rounded-lg border bg-card/95 backdrop-blur px-4 py-2 shadow-md',
        className,
      )}
    >
      <div className="text-sm font-medium">
        {count} selected
        {total != null && <span className="text-muted-foreground"> / {total}</span>}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {actions.map((a) => {
          const Icon = a.icon;
          const isBusy = busy === a.key;
          return (
            <Button
              key={a.key}
              size="sm"
              variant={a.variant ?? 'outline'}
              disabled={a.disabled || !!busy}
              onClick={() => void a.onRun()}
            >
              {isBusy ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : Icon ? (
                <Icon className="h-3.5 w-3.5 mr-1.5" />
              ) : null}
              {a.label}
            </Button>
          );
        })}
      </div>
      <Button size="sm" variant="ghost" onClick={onClear} className="ml-auto h-7 w-7 p-0">
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
