import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { GRABBA_BRAND_IDS, GRABBA_BRAND_CONFIG, type GrabbaBrand } from '@/config/grabbaSkyscraper';
import type { BrandFilterValue } from '@/contexts/GrabbaBrandContext';

// ═══════════════════════════════════════════════════════════════════════════════
// BRAND FILTER BAR COMPONENT
// Reusable filter bar for all Grabba floors
// ═══════════════════════════════════════════════════════════════════════════════

interface BrandFilterBarProps {
  selectedBrand: BrandFilterValue;
  onBrandChange: (brand: BrandFilterValue) => void;
  showCounts?: boolean;
  counts?: Record<string, number>;
  variant?: 'default' | 'compact' | 'pills';
  className?: string;
}

export function BrandFilterBar({
  selectedBrand,
  onBrandChange,
  showCounts = false,
  counts = {},
  variant = 'default',
  className,
}: BrandFilterBarProps) {
  const allCount = showCounts 
    ? Object.values(counts).reduce((sum, c) => sum + c, 0)
    : undefined;

  if (variant === 'pills') {
    return (
      <div className={cn('flex flex-wrap gap-2', className)}>
        <Badge
          variant={selectedBrand === 'all' ? 'default' : 'outline'}
          className={cn(
            'cursor-pointer transition-all px-3 py-1.5',
            selectedBrand === 'all' && 'bg-primary text-primary-foreground'
          )}
          onClick={() => onBrandChange('all')}
        >
          All Brands {showCounts && allCount !== undefined && `(${allCount})`}
        </Badge>
      {GRABBA_BRAND_IDS.map((brand) => {
          const config = GRABBA_BRAND_CONFIG[brand];
          const isSelected = selectedBrand === brand;
          return (
            <Badge
              key={brand}
              variant="outline"
              className={cn(
                'cursor-pointer transition-all px-3 py-1.5',
                isSelected && config.pill
              )}
              onClick={() => onBrandChange(brand)}
            >
              {config.icon} {config.label}
              {showCounts && counts[brand] !== undefined && ` (${counts[brand]})`}
            </Badge>
          );
        })}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={cn('flex gap-1 flex-wrap', className)}>
        <Button
          size="sm"
          variant={selectedBrand === 'all' ? 'default' : 'ghost'}
          onClick={() => onBrandChange('all')}
          className="h-7 text-xs"
        >
          All
        </Button>
      {GRABBA_BRAND_IDS.map((brand) => {
          const config = GRABBA_BRAND_CONFIG[brand];
          return (
            <Button
              key={brand}
              size="sm"
              variant={selectedBrand === brand ? 'default' : 'ghost'}
              onClick={() => onBrandChange(brand)}
              className={cn(
                'h-7 text-xs',
                selectedBrand === brand && config.primary
              )}
            >
              {config.icon}
            </Button>
          );
        })}
      </div>
    );
  }

  // Default variant
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <Button
        variant={selectedBrand === 'all' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onBrandChange('all')}
        className={cn(
          'transition-all duration-200',
          selectedBrand === 'all' && 'shadow-lg'
        )}
      >
        All Brands
        {showCounts && allCount !== undefined && (
          <span className="ml-2 px-1.5 py-0.5 rounded-full bg-background/20 text-xs font-semibold">
            {allCount}
          </span>
        )}
      </Button>

      {GRABBA_BRAND_IDS.map((brand) => {
        const config = GRABBA_BRAND_CONFIG[brand];
        const isSelected = selectedBrand === brand;
        
        return (
          <Button
            key={brand}
            variant={isSelected ? 'default' : 'outline'}
            size="sm"
            onClick={() => onBrandChange(brand)}
            className={cn(
              'transition-all duration-200',
              isSelected && config.primary,
              isSelected && 'shadow-lg text-white'
            )}
          >
            <span className="mr-1">{config.icon}</span>
            {config.label}
            {showCounts && counts[brand] !== undefined && (
              <span className="ml-2 px-1.5 py-0.5 rounded-full bg-background/20 text-xs font-semibold">
                {counts[brand]}
              </span>
            )}
          </Button>
        );
      })}
    </div>
  );
}

// Export a simple brand badge for display purposes
export function BrandBadge({ brand, className }: { brand: GrabbaBrand; className?: string }) {
  const config = GRABBA_BRAND_CONFIG[brand];
  return (
    <Badge className={cn(config.pill, className)}>
      {config.icon} {config.label}
    </Badge>
  );
}

// Export brand badges row for showing multiple brands
export function BrandBadgesRow({ brands, className }: { brands: GrabbaBrand[]; className?: string }) {
  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {brands.map((brand) => (
        <BrandBadge key={brand} brand={brand} />
      ))}
    </div>
  );
}
