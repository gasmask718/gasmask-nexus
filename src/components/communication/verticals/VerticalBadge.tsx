// ═══════════════════════════════════════════════════════════════════════════════
// VERTICAL BADGE COMPONENT
// Visual indicator for brand verticals
// ═══════════════════════════════════════════════════════════════════════════════

import { Badge } from '@/components/ui/badge';
import { 
  VERTICALS, 
  type VerticalSlug,
  getVerticalForBrand 
} from '@/config/verticals';
import { cn } from '@/lib/utils';

interface VerticalBadgeProps {
  verticalSlug?: VerticalSlug;
  brandId?: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

export function VerticalBadge({
  verticalSlug,
  brandId,
  size = 'md',
  showIcon = true,
  className,
}: VerticalBadgeProps) {
  // Get vertical from slug or brand
  let vertical = verticalSlug ? VERTICALS[verticalSlug] : null;
  
  if (!vertical && brandId) {
    vertical = getVerticalForBrand(brandId);
  }
  
  if (!vertical) {
    return null;
  }
  
  const Icon = vertical.icon;
  
  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-base px-3 py-1.5',
  };
  
  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };
  
  return (
    <Badge
      variant="outline"
      className={cn(
        'inline-flex items-center gap-1 font-medium',
        `bg-gradient-to-r ${vertical.gradient} bg-clip-text text-transparent`,
        'border-current',
        sizeClasses[size],
        className
      )}
      style={{ borderColor: vertical.color }}
    >
      {showIcon && <Icon className={cn(iconSizes[size])} style={{ color: vertical.color }} />}
      <span style={{ color: vertical.color }}>{vertical.name}</span>
    </Badge>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VERTICAL INDICATOR (small dot with tooltip)
// ═══════════════════════════════════════════════════════════════════════════════

interface VerticalIndicatorProps {
  verticalSlug?: VerticalSlug;
  brandId?: string;
  className?: string;
}

export function VerticalIndicator({
  verticalSlug,
  brandId,
  className,
}: VerticalIndicatorProps) {
  let vertical = verticalSlug ? VERTICALS[verticalSlug] : null;
  
  if (!vertical && brandId) {
    vertical = getVerticalForBrand(brandId);
  }
  
  if (!vertical) {
    return null;
  }
  
  return (
    <div
      className={cn('w-2 h-2 rounded-full', className)}
      style={{ backgroundColor: vertical.color }}
      title={vertical.name}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CROSS-PROMOTION INDICATOR
// ═══════════════════════════════════════════════════════════════════════════════

interface CrossPromotionIndicatorProps {
  brands: string[];
  className?: string;
}

export function CrossPromotionIndicator({
  brands,
  className,
}: CrossPromotionIndicatorProps) {
  if (brands.length <= 1) {
    return null;
  }
  
  // Check if all brands are in the same vertical
  const verticals = brands.map(b => getVerticalForBrand(b)).filter(Boolean);
  const uniqueVerticals = new Set(verticals.map(v => v?.slug));
  
  if (uniqueVerticals.size > 1) {
    return (
      <Badge variant="destructive" className={cn('text-xs', className)}>
        ⚠️ Cross-Vertical Warning
      </Badge>
    );
  }
  
  return (
    <Badge variant="secondary" className={cn('text-xs', className)}>
      ✓ Same Vertical - Can Cross-Promote
    </Badge>
  );
}

export default VerticalBadge;
