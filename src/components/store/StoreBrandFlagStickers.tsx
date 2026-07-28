// ════════════════════════════════════════════════════════════════════
// PER-BRAND FLAG STICKERS — shared control used by BOTH the store
// quick-view KPI card and the full store profile.
// Tap a brand chip to toggle "needs order" / "bring samples" for that brand.
// ════════════════════════════════════════════════════════════════════
import { PackagePlus, Sparkles, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
  useFlagBrands,
  useStoreBrandFlags,
  useToggleStoreBrandFlag,
  type StoreFlagType,
  type FlagBrand,
} from '@/hooks/useStoreBrandFlags';

interface Props {
  storeId: string;
  /** compact = quick-view KPI card sizing */
  compact?: boolean;
  className?: string;
}

const ROWS: Array<{ type: StoreFlagType; label: string; icon: typeof PackagePlus; accent: string }> = [
  { type: 'needs_order', label: 'Needs order', icon: PackagePlus, accent: 'text-orange-600' },
  { type: 'bring_samples', label: 'Bring samples', icon: Sparkles, accent: 'text-indigo-600' },
];

export function StoreBrandFlagStickers({ storeId, compact = false, className }: Props) {
  const { user } = useAuth();
  const { data: brands = [], isLoading: brandsLoading, error: brandsError } = useFlagBrands();
  const { data: flags = [], isLoading: flagsLoading, error: flagsError } = useStoreBrandFlags(storeId);
  const toggle = useToggleStoreBrandFlag(storeId);

  const isOn = (brandId: string, type: StoreFlagType) =>
    flags.some(f => f.brand_id === brandId && f.flag_type === type);

  const handleTap = (brand: FlagBrand, type: StoreFlagType) => {
    toggle.mutate(
      { brand, flagType: type, next: !isOn(brand.id, type), userId: user?.id ?? null },
      {
        onError: (e: any) => toast.error(e?.message || 'Failed to save brand flag'),
      }
    );
  };

  const err = (brandsError || flagsError) as Error | null;
  if (err) {
    return (
      <p className={cn('text-xs text-destructive', className)}>{err.message}</p>
    );
  }

  return (
    <div className={cn('space-y-2 border-t border-border/50 pt-2', className)}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Brand flags
        </p>
        {toggle.isPending ? (
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Saving
          </span>
        ) : toggle.isSuccess ? (
          <span className="flex items-center gap-1 text-[10px] text-emerald-600">
            <Check className="h-3 w-3" /> Saved
          </span>
        ) : null}
      </div>

      {ROWS.map(({ type, label, icon: Icon, accent }) => {
        const selected = brands.filter(b => isOn(b.id, type));
        return (
          <div key={type} className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium">
              <Icon className={cn('h-3.5 w-3.5', accent)} />
              <span>{label}:</span>
              <span className="text-muted-foreground truncate">
                {selected.length ? selected.map(b => b.name).join(', ') : 'none'}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {brandsLoading || flagsLoading ? (
                <span className="text-[11px] text-muted-foreground">Loading brands…</span>
              ) : (
                brands.map(brand => {
                  const on = isOn(brand.id, type);
                  return (
                    <button
                      key={brand.id}
                      type="button"
                      onClick={() => handleTap(brand, type)}
                      aria-pressed={on}
                      aria-label={`${label} — ${brand.name}`}
                      className={cn(
                        'rounded-full border font-medium transition-colors select-none',
                        compact ? 'px-2.5 py-1.5 text-[11px]' : 'px-3 py-2 text-xs',
                        on
                          ? 'text-white border-transparent shadow-sm'
                          : 'border-border/70 text-muted-foreground hover:bg-muted/60'
                      )}
                      style={on ? { backgroundColor: brand.color || 'hsl(var(--primary))' } : undefined}
                    >
                      {brand.name}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
