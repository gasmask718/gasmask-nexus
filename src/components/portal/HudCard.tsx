import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface HudCardProps {
  title?: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'cyan' | 'green' | 'amber' | 'purple' | 'red';
  glow?: boolean;
}

const variantStyles = {
  default: 'border-border/50',
  cyan: 'border-hud-cyan/30',
  green: 'border-hud-green/30',
  amber: 'border-hud-amber/30',
  purple: 'border-hud-purple/30',
  red: 'border-primary/30',
};

const glowStyles = {
  default: '',
  cyan: 'shadow-[0_0_20px_hsla(180,100%,50%,0.15)]',
  green: 'shadow-[0_0_20px_hsla(142,100%,50%,0.15)]',
  amber: 'shadow-[0_0_20px_hsla(38,100%,50%,0.15)]',
  purple: 'shadow-[0_0_20px_hsla(270,100%,60%,0.15)]',
  red: 'shadow-[0_0_20px_hsla(0,100%,50%,0.15)]',
};

const iconStyles = {
  default: 'text-muted-foreground',
  cyan: 'text-hud-cyan',
  green: 'text-hud-green',
  amber: 'text-hud-amber',
  purple: 'text-hud-purple',
  red: 'text-primary',
};

export function HudCard({ 
  title, 
  icon, 
  children, 
  className,
  variant = 'default',
  glow = false
}: HudCardProps) {
  return (
    <div className={cn(
      'relative rounded-lg border bg-card/80 backdrop-blur-sm p-4',
      variantStyles[variant],
      glow && glowStyles[variant],
      className
    )}>
      {/* Corner accents */}
      <div className="absolute top-0 left-0 w-3 h-3 border-l-2 border-t-2 border-current opacity-50 rounded-tl" 
           style={{ color: `hsl(var(--${variant === 'default' ? 'border' : variant === 'red' ? 'primary' : `hud-${variant}`}))` }} />
      <div className="absolute top-0 right-0 w-3 h-3 border-r-2 border-t-2 border-current opacity-50 rounded-tr"
           style={{ color: `hsl(var(--${variant === 'default' ? 'border' : variant === 'red' ? 'primary' : `hud-${variant}`}))` }} />
      <div className="absolute bottom-0 left-0 w-3 h-3 border-l-2 border-b-2 border-current opacity-50 rounded-bl"
           style={{ color: `hsl(var(--${variant === 'default' ? 'border' : variant === 'red' ? 'primary' : `hud-${variant}`}))` }} />
      <div className="absolute bottom-0 right-0 w-3 h-3 border-r-2 border-b-2 border-current opacity-50 rounded-br"
           style={{ color: `hsl(var(--${variant === 'default' ? 'border' : variant === 'red' ? 'primary' : `hud-${variant}`}))` }} />
      
      {(title || icon) && (
        <div className="flex items-center gap-2 mb-3">
          {icon && <span className={iconStyles[variant]}>{icon}</span>}
          {title && (
            <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              {title}
            </h3>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
