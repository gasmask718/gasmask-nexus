import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface TopTierKPICardProps {
  name: string;
  value: number;
  icon: LucideIcon;
  color: 'cyan' | 'green' | 'amber' | 'purple' | 'red' | 'default';
  onClick?: () => void;
  isActive?: boolean;
  isLoading?: boolean;
  description?: string;
  size?: 'sm' | 'md' | 'lg';
}

const colorStyles = {
  cyan: {
    border: 'border-hud-cyan/30 hover:border-hud-cyan/60',
    icon: 'text-hud-cyan',
    value: 'text-hud-cyan',
    glow: 'hover:shadow-[0_0_20px_rgba(0,255,255,0.15)]',
  },
  green: {
    border: 'border-hud-green/30 hover:border-hud-green/60',
    icon: 'text-hud-green',
    value: 'text-hud-green',
    glow: 'hover:shadow-[0_0_20px_rgba(0,255,0,0.15)]',
  },
  amber: {
    border: 'border-hud-amber/30 hover:border-hud-amber/60',
    icon: 'text-hud-amber',
    value: 'text-hud-amber',
    glow: 'hover:shadow-[0_0_20px_rgba(255,191,0,0.15)]',
  },
  purple: {
    border: 'border-hud-purple/30 hover:border-hud-purple/60',
    icon: 'text-hud-purple',
    value: 'text-hud-purple',
    glow: 'hover:shadow-[0_0_20px_rgba(168,85,247,0.15)]',
  },
  red: {
    border: 'border-destructive/30 hover:border-destructive/60',
    icon: 'text-destructive',
    value: 'text-destructive',
    glow: 'hover:shadow-[0_0_20px_rgba(255,0,0,0.15)]',
  },
  default: {
    border: 'border-border hover:border-border/80',
    icon: 'text-muted-foreground',
    value: 'text-foreground',
    glow: 'hover:shadow-md',
  },
};

const sizeStyles = {
  sm: {
    container: 'p-3',
    icon: 'h-4 w-4',
    value: 'text-xl',
    label: 'text-xs',
  },
  md: {
    container: 'p-4',
    icon: 'h-5 w-5',
    value: 'text-2xl',
    label: 'text-xs',
  },
  lg: {
    container: 'p-5',
    icon: 'h-6 w-6',
    value: 'text-3xl',
    label: 'text-sm',
  },
};

export function TopTierKPICard({
  name,
  value,
  icon: Icon,
  color,
  onClick,
  isActive = false,
  isLoading = false,
  description,
  size = 'md',
}: TopTierKPICardProps) {
  const colors = colorStyles[color];
  const sizes = sizeStyles[size];

  if (isLoading) {
    return (
      <div className={cn(
        'rounded-lg border bg-card/50 backdrop-blur-sm',
        sizes.container
      )}>
        <div className="flex items-center gap-2 mb-2">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-8 w-12" />
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full rounded-lg border bg-card/50 backdrop-blur-sm transition-all duration-300 text-left',
        colors.border,
        colors.glow,
        sizes.container,
        onClick && 'cursor-pointer',
        isActive && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn(sizes.icon, colors.icon)} />
        <span className={cn('uppercase tracking-wider text-muted-foreground font-medium', sizes.label)}>
          {name}
        </span>
      </div>
      <div className={cn('font-mono font-bold', sizes.value, colors.value)}>
        {value.toLocaleString()}
      </div>
      {description && (
        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{description}</p>
      )}
    </button>
  );
}
