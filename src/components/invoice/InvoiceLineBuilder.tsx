/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SHARED INVOICE LINE BUILDER — the ONE line-entry UI for every write path
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Used by: CreateStoreInvoiceModal, EditStoreInvoiceModal, BillingInvoiceNew,
 * and the field visit order section. Multi-line, live math, and a first-class
 * unit selector: Full Box / Half Box / Pack / Loose Tube.
 *
 * All math is delegated to @/lib/invoice/lineMath — never inline here.
 */

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, X, Package, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  availableUnitKinds,
  halfBoxBlockReason,
  buildLine,
  listPriceForUnit,
  summarize,
  tubesPerBox,
  withDiscount,
  withPrice,
  withQuantity,
  UNIT_KIND_ICONS,
  UNIT_KIND_LABELS,
  type BuilderBrand,
  type BuilderLine,
  type BuilderProduct,
  type DiscountType,
  type SaleChannel,
  type SaleUnitKind,
} from '@/lib/invoice/lineMath';

const PRODUCT_COLUMNS =
  'id, name, sku, store_price, wholesale_price, suggested_retail_price, street_price, cost, units_per_box, unit_type, track_by, sale_unit_default, price_per_box, price_per_unit, price_per_tube, pack_size, packs_per_box';

export interface InvoiceLineBuilderProps {
  lines: BuilderLine[];
  onLinesChange: (lines: BuilderLine[]) => void;
  saleChannel?: SaleChannel;
  onSaleChannelChange?: (channel: SaleChannel) => void;
  /** Show the retail / wholesale / street toggle */
  showChannelSelector?: boolean;
  /** Allow inline unit-price overrides on committed lines */
  allowPriceOverride?: boolean;
  /** Restrict the brand dropdown */
  brandFilterIds?: string[];
  /** Lock the builder to a single brand */
  lockedBrandId?: string;
  disabled?: boolean;
  className?: string;
}

export function InvoiceLineBuilder({
  lines,
  onLinesChange,
  saleChannel = 'retail',
  onSaleChannelChange,
  showChannelSelector = true,
  allowPriceOverride = true,
  brandFilterIds,
  lockedBrandId,
  disabled = false,
  className = '',
}: InvoiceLineBuilderProps) {
  const [selectedBrandId, setSelectedBrandId] = useState<string>(lockedBrandId || '');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [unitKind, setUnitKind] = useState<SaleUnitKind>('full_box');
  const [quantity, setQuantity] = useState<number>(1);

  useEffect(() => {
    if (lockedBrandId) setSelectedBrandId(lockedBrandId);
  }, [lockedBrandId]);

  const { data: brands = [], isLoading: brandsLoading } = useQuery({
    queryKey: ['invoice-builder-brands'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brands')
        .select('id, name, color')
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return (data || []) as BuilderBrand[];
    },
  });

  const visibleBrands = useMemo(
    () => (brandFilterIds?.length ? brands.filter((b) => brandFilterIds.includes(b.id)) : brands),
    [brands, brandFilterIds],
  );

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['invoice-builder-products', selectedBrandId],
    queryFn: async () => {
      if (!selectedBrandId) return [];
      const { data, error } = await supabase
        .from('products')
        .select(PRODUCT_COLUMNS)
        .eq('brand_id', selectedBrandId)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('name');
      if (error) throw error;
      return (data || []) as unknown as BuilderProduct[];
    },
    enabled: !!selectedBrandId,
  });

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const unitKinds = selectedProduct ? availableUnitKinds(selectedProduct) : [];

  // Keep the selected unit valid for the chosen product
  useEffect(() => {
    if (!selectedProduct) return;
    const kinds = availableUnitKinds(selectedProduct);
    if (!kinds.includes(unitKind)) setUnitKind(kinds[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProductId]);

  const previewUnitPrice = selectedProduct
    ? listPriceForUnit(selectedProduct, saleChannel, unitKind)
    : 0;
  const previewTotal = previewUnitPrice * (quantity || 0);

  const handleAdd = () => {
    const brand = visibleBrands.find((b) => b.id === selectedBrandId);
    if (!brand || !selectedProduct || quantity <= 0) {
      toast.error('Select a brand, product, and quantity');
      return;
    }

    // Merge into an identical existing line (same product + unit + channel)
    const existingIndex = lines.findIndex(
      (l) =>
        l.product_id === selectedProduct.id &&
        l.unit_kind === unitKind &&
        l.sale_channel === saleChannel &&
        l.discount_type === 'none',
    );

    if (existingIndex >= 0) {
      const updated = [...lines];
      updated[existingIndex] = withQuantity(
        updated[existingIndex],
        updated[existingIndex].quantity + quantity,
      );
      onLinesChange(updated);
    } else {
      onLinesChange([
        ...lines,
        buildLine({ brand, product: selectedProduct, channel: saleChannel, kind: unitKind, quantity }),
      ]);
    }

    setSelectedProductId('');
    setQuantity(1);
  };

  const updateLine = (id: string, next: BuilderLine) =>
    onLinesChange(lines.map((l) => (l.id === id ? next : l)));

  const removeLine = (id: string) => onLinesChange(lines.filter((l) => l.id !== id));

  const totals = summarize(lines);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* ── Pricing channel ─────────────────────────────────────────── */}
      {showChannelSelector && onSaleChannelChange && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Pricing</Label>
          <div className="grid grid-cols-3 gap-2">
            {(['retail', 'wholesale', 'street'] as SaleChannel[]).map((ch) => (
              <Button
                key={ch}
                type="button"
                size="sm"
                variant={saleChannel === ch ? 'default' : 'outline'}
                disabled={disabled}
                onClick={() => onSaleChannelChange(ch)}
                className="capitalize"
              >
                {ch}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* ── Product picker ──────────────────────────────────────────── */}
      <div className="space-y-3 rounded-lg border border-border/60 bg-secondary/20 p-3">
        {!lockedBrandId && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Brand</Label>
            <Select
              value={selectedBrandId}
              onValueChange={(v) => {
                setSelectedBrandId(v);
                setSelectedProductId('');
              }}
              disabled={disabled || brandsLoading}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder={brandsLoading ? 'Loading brands…' : 'Select brand'} />
              </SelectTrigger>
              <SelectContent>
                {visibleBrands.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: b.color || 'hsl(var(--primary))' }}
                      />
                      {b.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {selectedBrandId && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Product</Label>
            <Select
              value={selectedProductId}
              onValueChange={setSelectedProductId}
              disabled={disabled || productsLoading}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder={productsLoading ? 'Loading products…' : 'Select product'} />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                    {p.sku ? ` · ${p.sku}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* ── Unit selector ─────────────────────────────────────────── */}
        {selectedProduct && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Selling As</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {unitKinds.map((kind) => {
                const price = listPriceForUnit(selectedProduct, saleChannel, kind);
                return (
                  <Button
                    key={kind}
                    type="button"
                    variant={unitKind === kind ? 'default' : 'outline'}
                    size="sm"
                    disabled={disabled}
                    onClick={() => setUnitKind(kind)}
                    className="h-auto flex-col gap-0.5 py-2"
                  >
                    <span className="text-xs font-medium">
                      {UNIT_KIND_ICONS[kind]} {UNIT_KIND_LABELS[kind]}
                    </span>
                    <span className="font-mono text-[10px] opacity-80">${price.toFixed(2)}</span>
                  </Button>
                );
              })}
            </div>
            {halfBoxBlockReason(selectedProduct) && (
              <p className="text-[11px] text-destructive">
                {halfBoxBlockReason(selectedProduct)}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground">
              {tubesPerBox(selectedProduct)} {selectedProduct.unit_type || 'tubes'} per box
              {(selectedProduct.pack_size || 1) > 1
                ? ` · ${selectedProduct.pack_size} per pack`
                : ''}
            </p>
          </div>
        )}

        {/* ── Quantity + add ────────────────────────────────────────── */}
        {selectedProduct && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Quantity ({UNIT_KIND_LABELS[unitKind].toLowerCase()}s)
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="1"
                step="1"
                value={quantity}
                disabled={disabled}
                onChange={(e) => setQuantity(Math.max(parseInt(e.target.value, 10) || 1, 1))}
                className="bg-background"
              />
              <div className="whitespace-nowrap rounded-md bg-background px-3 py-2 font-mono text-sm">
                ${previewTotal.toFixed(2)}
              </div>
            </div>
            <Button
              type="button"
              className="w-full"
              disabled={disabled || quantity <= 0}
              onClick={handleAdd}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add to Invoice
            </Button>
          </div>
        )}

        {selectedBrandId && productsLoading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading catalog…
          </div>
        )}
      </div>

      {/* ── Line items ─────────────────────────────────────────────── */}
      {lines.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Invoice Items</Label>
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {lines.map((line) => (
              <div
                key={line.id}
                className="space-y-2 rounded-lg border bg-secondary/30 p-3"
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{line.product_name}</p>
                    <p className="text-xs text-muted-foreground">{line.brand_name}</p>
                  </div>
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    {UNIT_KIND_ICONS[line.unit_kind]} {UNIT_KIND_LABELS[line.unit_kind]}
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    disabled={disabled}
                    onClick={() => removeLine(line.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="number"
                    min="1"
                    value={line.quantity}
                    disabled={disabled}
                    onChange={(e) =>
                      updateLine(
                        line.id,
                        withQuantity(line, Math.max(parseInt(e.target.value, 10) || 1, 1)),
                      )
                    }
                    className="h-8 w-16 text-sm"
                  />
                  <span className="text-xs text-muted-foreground">×</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.unit_price_used}
                    disabled={disabled || !allowPriceOverride}
                    onChange={(e) =>
                      updateLine(line.id, withPrice(line, parseFloat(e.target.value) || 0))
                    }
                    className="h-8 w-24 font-mono text-sm"
                  />
                  <span className="ml-auto w-24 text-right font-mono text-sm font-medium">
                    ${line.line_subtotal.toFixed(2)}
                  </span>
                </div>

                <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Package className="h-3 w-3" />
                  {line.computed_tubes_total} tubes
                  {line.quantity_boxes ? ` · ${line.quantity_boxes} box` : ''}
                  {line.unit_price_used !== line.list_unit_price
                    ? ` · list $${line.list_unit_price.toFixed(2)}`
                    : ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Live totals ────────────────────────────────────────────── */}
      {lines.length > 0 && (
        <div className="space-y-1.5 rounded-lg border border-primary/20 bg-primary/10 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Items</span>
            <span className="font-mono">{totals.lineCount}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total tubes</span>
            <span className="font-mono">{totals.totalTubes.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between border-t border-primary/20 pt-2">
            <span className="font-medium">Subtotal</span>
            <span className="font-mono text-xl font-bold">${totals.subtotal.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default InvoiceLineBuilder;
