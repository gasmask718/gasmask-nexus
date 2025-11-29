import { ReactNode, ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface HudButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'default' | 'cyan' | 'green' | 'amber' | 'purple' | 'red';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
}

const variantStyles = {
  default: 'border-border hover:border-foreground hover:bg-muted',
  cyan: 'border-hud-cyan/50 hover:border-hud-cyan hover:bg-hud-cyan/10 text-hud-cyan',
  green: 'border-hud-green/50 hover:border-hud-green hover:bg-hud-green/10 text-hud-green',
  amber: 'border-hud-amber/50 hover:border-hud-amber hover:bg-hud-amber/10 text-hud-amber',
  purple: 'border-hud-purple/50 hover:border-hud-purple hover:bg-hud-purple/10 text-hud-purple',
  red: 'border-primary/50 hover:border-primary hover:bg-primary/10 text-primary',
};

const sizeStyles = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export function HudButton({
  children,
  variant = 'cyan',
  size = 'md',
  icon,
  className,
  ...props
}: HudButtonProps) {
  return (
    <button
      className={cn(
        'relative flex items-center justify-center gap-2 font-medium uppercase tracking-wider',
        'border rounded-md bg-transparent transition-all duration-200',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
