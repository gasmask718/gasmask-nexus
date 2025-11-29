import { cn } from '@/lib/utils';

interface HudProgressProps {
  value: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  variant?: 'default' | 'cyan' | 'green' | 'amber' | 'purple' | 'red';
  size?: 'sm' | 'md' | 'lg';
}

const barStyles = {
  default: 'bg-muted-foreground',
  cyan: 'bg-hud-cyan',
  green: 'bg-hud-green',
  amber: 'bg-hud-amber',
  purple: 'bg-hud-purple',
  red: 'bg-primary',
};

const glowStyles = {
  default: '',
  cyan: 'shadow-[0_0_10px_hsla(180,100%,50%,0.5)]',
  green: 'shadow-[0_0_10px_hsla(142,100%,50%,0.5)]',
  amber: 'shadow-[0_0_10px_hsla(38,100%,50%,0.5)]',
  purple: 'shadow-[0_0_10px_hsla(270,100%,60%,0.5)]',
  red: 'shadow-[0_0_10px_hsla(0,100%,50%,0.5)]',
};

const sizeStyles = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
};

export function HudProgress({
  value,
  max = 100,
  label,
  showValue = true,
  variant = 'cyan',
  size = 'md'
}: HudProgressProps) {
  const percentage = Math.min((value / max) * 100, 100);
  
  return (
    <div className="space-y-1">
      {(label || showValue) && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{label}</span>
          {showValue && <span className="font-mono">{Math.round(percentage)}%</span>}
        </div>
      )}
      <div className={cn('w-full bg-muted rounded-full overflow-hidden', sizeStyles[size])}>
        <div 
          className={cn(
            'h-full rounded-full transition-all duration-500',
            barStyles[variant],
            glowStyles[variant]
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
