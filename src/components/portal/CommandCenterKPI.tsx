import { ReactNode, MouseEventHandler } from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SimulationBadge } from '@/contexts/SimulationModeContext';

interface CommandCenterKPIProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
  onClick?: MouseEventHandler<HTMLDivElement>;
  isActive?: boolean;
  isSimulated?: boolean;
  variant?: 'default' | 'cyan' | 'green' | 'amber' | 'purple' | 'red';
  className?: string;
}

const variantStyles = {
  default: {
    border: 'border-border/50',
    icon: 'text-muted-foreground',
    glow: '',
  },
  cyan: {
    border: 'border-hud-cyan/40',
    icon: 'text-hud-cyan',
    glow: 'shadow-[0_0_15px_hsla(180,100%,50%,0.2)]',
  },
  green: {
    border: 'border-hud-green/40',
    icon: 'text-hud-green',
    glow: 'shadow-[0_0_15px_hsla(142,100%,50%,0.2)]',
  },
  amber: {
    border: 'border-hud-amber/40',
    icon: 'text-hud-amber',
    glow: 'shadow-[0_0_15px_hsla(38,100%,50%,0.2)]',
  },
  purple: {
    border: 'border-hud-purple/40',
    icon: 'text-hud-purple',
    glow: 'shadow-[0_0_15px_hsla(270,100%,60%,0.2)]',
  },
  red: {
    border: 'border-primary/40',
    icon: 'text-primary',
    glow: 'shadow-[0_0_15px_hsla(0,100%,50%,0.2)]',
  },
};

export function CommandCenterKPI({
  label,
  value,
  icon: Icon,
  trend,
  trendDirection = 'neutral',
  onClick,
  isActive = false,
  isSimulated = false,
  variant = 'default',
  className,
}: CommandCenterKPIProps) {
  const styles = variantStyles[variant];
  
  const trendColors = {
    up: 'text-hud-green',
    down: 'text-destructive',
    neutral: 'text-muted-foreground',
  };

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick(e as any);
        }
      }}
      className={cn(
        'relative rounded-lg border bg-card/80 backdrop-blur-sm p-4 transition-all duration-200',
        styles.border,
        onClick && 'cursor-pointer hover:scale-[1.02] hover:bg-card/90',
        isActive && [styles.glow, 'ring-2 ring-primary/50'],
        className
      )}
    >
      {/* Corner accents */}
      <div className="absolute top-0 left-0 w-2 h-2 border-l-2 border-t-2 border-current opacity-40 rounded-tl"
           style={{ color: isActive ? 'hsl(var(--primary))' : undefined }} />
      <div className="absolute top-0 right-0 w-2 h-2 border-r-2 border-t-2 border-current opacity-40 rounded-tr"
           style={{ color: isActive ? 'hsl(var(--primary))' : undefined }} />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-l-2 border-b-2 border-current opacity-40 rounded-bl"
           style={{ color: isActive ? 'hsl(var(--primary))' : undefined }} />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-r-2 border-b-2 border-current opacity-40 rounded-br"
           style={{ color: isActive ? 'hsl(var(--primary))' : undefined }} />

      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground truncate mb-1">
            {label}
          </p>
          <p className="text-2xl font-bold text-foreground">
            {value}
          </p>
          {trend && (
            <p className={cn('text-xs mt-1', trendColors[trendDirection])}>
              {trend}
            </p>
          )}
        </div>
        
        {Icon && (
          <div className={cn('p-2 rounded-lg bg-muted/50', styles.icon)}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>

      {isSimulated && (
        <div className="absolute top-1 right-1">
          <SimulationBadge text="Sim" className="text-[10px] px-1.5 py-0" />
        </div>
      )}

      {onClick && (
        <div className="absolute bottom-1 right-2 text-[10px] text-muted-foreground uppercase tracking-wider opacity-60">
          Click for details
        </div>
      )}
    </div>
  );
}
