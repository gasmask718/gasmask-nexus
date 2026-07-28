// ════════════════════════════════════════════════════════════════════
// PER-PRODUCT FLAG STICKERS — shared control used by BOTH the store
// quick-view KPI card and the full store profile / Tube Intelligence.
//
// Brand chip = rollup (ON if any product under it is ON) + expander.
// Expand a brand to tap its individual PRODUCTS / TUBE TYPES.
// Every tap writes the canonical per-SKU row in
// public.store_tube_inventory_status — no second copy.
// ════════════════════════════════════════════════════════════════════
import { useState } from 'react';
import { PackagePlus, Sparkles, Loader2, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
  useFlagBrands,
  useStoreBrandFlags,
  useToggleStoreBrandFlag,
  isProductOn,
  isBrandOn,
  flaggedProducts,
  type StoreFlagType,
  type FlagBrand,
  type FlagProduct,
} from '@/hooks/useStoreBrandFlags';
import { useStoreInventoryStamps } from '@/hooks/useStoreInventoryStamps';
import { dynastyStamp } from '@/lib/dates';


interface Props {
  storeId: string;
  /** compact = quick-view KPI card sizing */
  compact?: boolean;
  className?: string;
  /** How this state was captured — 'in_person' (default) or 'call' */
  updateMethod?: 'in_person' | 'call' | 'brand_sticker';
}

const ROWS: Array<{ type: StoreFlagType; label: string; icon: typeof PackagePlus; accent: string }> = [
  { type: 'needs_order', label: 'Needs order', icon: PackagePlus, accent: 'text-orange-600' },
  { type: 'bring_samples', label: 'Bring samples', icon: Sparkles, accent: 'text-indigo-600' },
];

export function StoreBrandFlagStickers({ storeId, compact = false, className, updateMethod = 'in_person' }: Props) {
  const { user } = useAuth();
  const { data: brands = [], isLoading: brandsLoading, error: brandsError } = useFlagBrands();
  const { data: flags = [], isLoading: flagsLoading, error: flagsError } = useStoreBrandFlags(storeId);
  const toggle = useToggleStoreBrandFlag(storeId);
  const { data: stamps } = useStoreInventoryStamps(storeId);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});


  const runToggle = (products: FlagProduct[], type: StoreFlagType, next: boolean) => {
    toggle.mutate(
      { products, flagType: type, next, userId: user?.id ?? null, updateMethod },
      { onError: (e: any) => toast.error(e?.message || 'Failed to save flag') }
    );
  };

  const tapBrand = (brand: FlagBrand, type: StoreFlagType) =>
    runToggle(brand.products, type, !isBrandOn(flags, brand, type));

  const tapProduct = (product: FlagProduct, type: StoreFlagType) =>
    runToggle([product], type, !isProductOn(flags, product.skuKey, type));

  const err = (brandsError || flagsError) as Error | null;
  if (err) {
    return <p className={cn('text-xs text-destructive', className)}>{err.message}</p>;
  }

  return (
    <div className={cn('space-y-2 border-t border-border/50 pt-2', className)}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Product flags
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
        const selected = flaggedProducts(flags, brands, type);
        return (
          <div key={type} className="space-y-1">
            <div className="flex items-start gap-1.5 text-xs font-medium">
              <Icon className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', accent)} />
              <span className="shrink-0">{label}:</span>
              <span className="text-muted-foreground">
                {selected.length ? selected.map(p => p.label).join(', ') : 'none'}
              </span>
            </div>

            <div className="space-y-1">
              {brandsLoading || flagsLoading ? (
                <span className="text-[11px] text-muted-foreground">Loading products…</span>
              ) : (
                brands.map(brand => {
                  const key = `${type}:${brand.id}`;
                  const open = !!expanded[key];
                  const on = isBrandOn(flags, brand, type);
                  const onCount = brand.products.filter(p => isProductOn(flags, p.skuKey, type)).length;
                  return (
                    <div key={brand.id} className="space-y-1">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => tapBrand(brand, type)}
                          aria-pressed={on}
                          aria-label={`${label} — ${brand.name} (all products)`}
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
                          {onCount > 0 && (
                            <span className="ml-1 opacity-90">
                              ({onCount}/{brand.products.length})
                            </span>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setExpanded(s => ({ ...s, [key]: !open }))}
                          aria-expanded={open}
                          aria-label={`${open ? 'Hide' : 'Show'} ${brand.name} products`}
                          className="flex items-center gap-0.5 rounded px-1.5 py-1 text-[10px] text-muted-foreground hover:bg-muted/60"
                        >
                          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          {brand.products.length} products
                        </button>
                      </div>

                      {open && (
                        <div className="flex flex-wrap gap-1.5 pl-3 border-l-2 border-border/50 ml-1 py-1">
                          {brand.products.map(product => {
                            const pOn = isProductOn(flags, product.skuKey, type);
                            const checkedAt =
                              stamps?.perSku?.[product.skuKey]?.lastChecked ?? stamps?.lastChecked ?? null;
                            return (
                              <button
                                key={product.skuKey}
                                type="button"
                                onClick={() => tapProduct(product, type)}
                                aria-pressed={pOn}
                                aria-label={`${label} — ${product.label}`}
                                title={
                                  checkedAt
                                    ? `${product.label} — inventory checked ${dynastyStamp(checkedAt)}`
                                    : `${product.label} — inventory never checked`
                                }
                                className={cn(
                                  'rounded-full border transition-colors select-none flex flex-col items-center leading-tight',
                                  compact ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1.5 text-[11px]',
                                  pOn
                                    ? 'text-white border-transparent shadow-sm'
                                    : 'border-dashed border-border/70 text-muted-foreground hover:bg-muted/60'
                                )}
                                style={pOn ? { backgroundColor: product.color || 'hsl(var(--primary))' } : undefined}
                              >
                                <span>{product.shortName}</span>
                                {checkedAt && (
                                  <span className={cn('text-[8px]', pOn ? 'opacity-90' : 'opacity-70')}>
                                    {dynastyStamp(checkedAt)}
                                  </span>
                                )}
                              </button>
                            );
                          })}

                        </div>
                      )}
                    </div>
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
