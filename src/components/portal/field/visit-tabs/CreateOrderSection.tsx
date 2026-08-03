import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ShoppingCart, Package, Zap } from 'lucide-react';
import { InvoiceModeSelector, InvoiceMode } from '@/components/invoice/InvoiceModeSelector';
import { InvoiceLineBuilder } from '@/components/invoice/InvoiceLineBuilder';
import { summarize, type BuilderLine } from '@/lib/invoice/lineMath';

/** Field order line — canonical builder line plus the legacy unit_type label. */
export interface OrderLineItem extends BuilderLine {
  unit_type: string;
}

export interface FieldOrder {
  brand_id: string;
  brand_name: string;
  line_items: OrderLineItem[];
  subtotal: number;
  notes: string;
  is_historical: boolean;
}

interface CreateOrderSectionProps {
  orders: FieldOrder[];
  onOrdersChange: (orders: FieldOrder[]) => void;
  invoiceMode: InvoiceMode;
  onInvoiceModeChange: (mode: InvoiceMode) => void;
}

export function CreateOrderSection({
  orders,
  onOrdersChange,
  invoiceMode,
  onInvoiceModeChange,
}: CreateOrderSectionProps) {
  // Flatten brand-grouped orders into the builder's line list
  const lines = useMemo<BuilderLine[]>(
    () => orders.flatMap((o) => o.line_items),
    [orders],
  );

  /** Re-group builder lines back into one order per brand, preserving notes. */
  const handleLinesChange = (nextLines: BuilderLine[]) => {
    const notesByBrand = new Map(orders.map((o) => [o.brand_id, o.notes]));
    const grouped = new Map<string, FieldOrder>();

    for (const line of nextLines) {
      const item: OrderLineItem = {
        ...line,
        unit_type:
          line.unit_kind === 'loose_tube' ? 'TUBE' : line.unit_kind === 'pack' ? 'PACK' : 'BOX',
      };
      const existing = grouped.get(line.brand_id);
      if (existing) {
        existing.line_items.push(item);
        existing.subtotal += line.line_subtotal;
      } else {
        grouped.set(line.brand_id, {
          brand_id: line.brand_id,
          brand_name: line.brand_name,
          line_items: [item],
          subtotal: line.line_subtotal,
          notes: notesByBrand.get(line.brand_id) || '',
          is_historical: invoiceMode === 'historical',
        });
      }
    }

    onOrdersChange(Array.from(grouped.values()));
  };

  const handleUpdateNotes = (brandId: string, newNotes: string) => {
    onOrdersChange(
      orders.map((order) => (order.brand_id === brandId ? { ...order, notes: newNotes } : order)),
    );
  };

  const totals = summarize(lines);

  return (
    <div className="space-y-4">
      {/* Invoice Mode Selector - CRITICAL for automation control */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Invoice Mode
          </CardTitle>
          <CardDescription>Choose how this order should be processed</CardDescription>
        </CardHeader>
        <CardContent>
          <InvoiceModeSelector mode={invoiceMode} onModeChange={onInvoiceModeChange} />
        </CardContent>
      </Card>

      {/* Canonical line builder */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Create Field Order
          </CardTitle>
          <CardDescription>
            Full Box, Half Box, Pack, or Loose Tube — totals update live
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InvoiceLineBuilder lines={lines} onLinesChange={handleLinesChange} />
        </CardContent>
      </Card>

      {/* Per-brand order notes */}
      {orders.length > 0 && (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order.brand_id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    {order.brand_name} Order
                  </CardTitle>
                  <Badge variant="outline">${order.subtotal.toFixed(2)}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <Label htmlFor={`notes-${order.brand_id}`}>Order Notes</Label>
                <Textarea
                  id={`notes-${order.brand_id}`}
                  placeholder="Add notes for this order..."
                  value={order.notes}
                  onChange={(e) => handleUpdateNotes(order.brand_id, e.target.value)}
                  rows={2}
                />
              </CardContent>
            </Card>
          ))}

          <Card className="bg-muted/50">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between text-lg font-semibold">
                <span>Total Order Value</span>
                <span>${totals.subtotal.toFixed(2)}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {orders.length} brand order(s) • {totals.lineCount} line item(s) •{' '}
                {totals.totalTubes} tubes
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {orders.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground">
            <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No items added yet</p>
            <p className="text-sm">Select a brand and product above to create a field order</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
