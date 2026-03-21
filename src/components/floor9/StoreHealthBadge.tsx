import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface StoreHealthBadgeProps {
  score: number;
  status: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function StoreHealthBadge({ score, status, size = 'sm', showLabel = true }: StoreHealthBadgeProps) {
  const colorClass = score >= 80 ? 'bg-green-500/15 text-green-500 border-green-500/30'
    : score >= 60 ? 'bg-amber-500/15 text-amber-500 border-amber-500/30'
    : score >= 40 ? 'bg-orange-500/15 text-orange-500 border-orange-500/30'
    : 'bg-red-500/15 text-red-500 border-red-500/30';

  const sizeClass = size === 'lg' ? 'text-base px-3 py-1' : size === 'md' ? 'text-sm px-2.5 py-0.5' : 'text-[10px] px-2 py-0.5';

  return (
    <Badge variant="outline" className={cn(colorClass, sizeClass)}>
      {score}{showLabel && ` · ${status}`}
    </Badge>
  );
}
