import { cn } from '@/lib/utils';

interface HudStatusBadgeProps {
  status: 'active' | 'pending' | 'completed' | 'warning' | 'error' | 'offline';
  label?: string;
  pulse?: boolean;
}

const statusConfig = {
  active: { color: 'bg-hud-green', text: 'text-hud-green', label: 'Active' },
  pending: { color: 'bg-hud-amber', text: 'text-hud-amber', label: 'Pending' },
  completed: { color: 'bg-hud-cyan', text: 'text-hud-cyan', label: 'Completed' },
  warning: { color: 'bg-hud-amber', text: 'text-hud-amber', label: 'Warning' },
  error: { color: 'bg-destructive', text: 'text-destructive', label: 'Error' },
  offline: { color: 'bg-muted-foreground', text: 'text-muted-foreground', label: 'Offline' },
};

export function HudStatusBadge({ status, label, pulse = false }: HudStatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <div className={cn('w-2 h-2 rounded-full', config.color)} />
        {pulse && (
          <div className={cn(
            'absolute inset-0 w-2 h-2 rounded-full animate-ping opacity-75',
            config.color
          )} />
        )}
      </div>
      <span className={cn('text-xs uppercase tracking-wider', config.text)}>
        {label || config.label}
      </span>
    </div>
  );
}
