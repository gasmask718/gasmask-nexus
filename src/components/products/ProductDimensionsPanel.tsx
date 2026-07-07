import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Ruler, AlertTriangle, PackageCheck } from 'lucide-react';

const GOLD = '#C9A84C';

export type ProductDimensions = {
  length_in: number | null;
  width_in: number | null;
  height_in: number | null;
  weight_oz: number | null;
  is_fragile: boolean;
  stackable: boolean;
  units_per_case: number | null;
  case_length_in: number | null;
  case_width_in: number | null;
  case_height_in: number | null;
  case_weight_oz: number | null;
};

export const productDimensionsSchema = z.object({
  length_in: z.number().positive().max(200),
  width_in: z.number().positive().max(200),
  height_in: z.number().positive().max(200),
  weight_oz: z.number().positive().max(50000),
  is_fragile: z.boolean(),
  stackable: z.boolean(),
  units_per_case: z.number().int().positive().max(10000).nullable(),
  case_length_in: z.number().positive().max(200).nullable(),
  case_width_in: z.number().positive().max(200).nullable(),
  case_height_in: z.number().positive().max(200).nullable(),
  case_weight_oz: z.number().positive().max(50000).nullable(),
});

export const REQUIRED_SHIP_FIELDS = ['length_in', 'width_in', 'height_in', 'weight_oz'] as const;

export function isShippable(p: {
  length_in?: number | null;
  width_in?: number | null;
  height_in?: number | null;
  weight_oz?: number | null;
}): boolean {
  return REQUIRED_SHIP_FIELDS.every((f) => {
    const v = p[f as keyof typeof p];
    return typeof v === 'number' && v > 0;
  });
}

export function missingShipFields(p: {
  length_in?: number | null;
  width_in?: number | null;
  height_in?: number | null;
  weight_oz?: number | null;
}): string[] {
  return REQUIRED_SHIP_FIELDS.filter((f) => {
    const v = p[f as keyof typeof p];
    return !(typeof v === 'number' && v > 0);
  });
}

export function validateProductsForShipping(
  products: Array<{
    id: string; product_name: string;
    length_in?: number | null; width_in?: number | null;
    height_in?: number | null; weight_oz?: number | null;
  }>,
): { ok: boolean; errors: Array<{ product_id: string; product_name: string; missing: string[] }> } {
  const errors = products
    .filter((p) => !isShippable(p))
    .map((p) => ({ product_id: p.id, product_name: p.product_name, missing: missingShipFields(p) }));
  return { ok: errors.length === 0, errors };
}

type Props = {
  value: ProductDimensions;
  onChange: (next: ProductDimensions) => void;
  disabled?: boolean;
};

const num = (v: string): number | null => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export function ProductDimensionsPanel({ value, onChange, disabled }: Props) {
  const set = <K extends keyof ProductDimensions>(k: K, v: ProductDimensions[K]) =>
    onChange({ ...value, [k]: v });

  const ready = isShippable(value);
  const missing = missingShipFields(value);

  return (
    <Card style={{ borderColor: GOLD, borderWidth: 1 }}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Ruler className="w-5 h-5" style={{ color: GOLD }} />
            Dimensions & Shipping Attributes
          </CardTitle>
          {ready ? (
            <span className="text-xs flex items-center gap-1" style={{ color: GOLD }}>
              <PackageCheck className="w-4 h-4" /> Shippable
            </span>
          ) : (
            <span className="text-xs text-destructive flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" /> Not shippable
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Required for packing &amp; label generation. Length, width, height, and weight
          must all be greater than zero.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!ready && (
          <Alert variant="destructive">
            <AlertTriangle className="w-4 h-4" />
            <AlertTitle>Cannot be shipped or packed</AlertTitle>
            <AlertDescription>
              Missing required field{missing.length === 1 ? '' : 's'}:{' '}
              <strong>{missing.join(', ')}</strong>
            </AlertDescription>
          </Alert>
        )}

        <div>
          <Label className="text-xs uppercase text-muted-foreground">Per-unit</Label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
            <Field label="Length (in) *" required>
              <Input type="number" min={0} step="0.01" disabled={disabled}
                value={value.length_in ?? ''}
                onChange={(e) => set('length_in', num(e.target.value))} />
            </Field>
            <Field label="Width (in) *" required>
              <Input type="number" min={0} step="0.01" disabled={disabled}
                value={value.width_in ?? ''}
                onChange={(e) => set('width_in', num(e.target.value))} />
            </Field>
            <Field label="Height (in) *" required>
              <Input type="number" min={0} step="0.01" disabled={disabled}
                value={value.height_in ?? ''}
                onChange={(e) => set('height_in', num(e.target.value))} />
            </Field>
            <Field label="Weight (oz) *" required>
              <Input type="number" min={0} step="0.01" disabled={disabled}
                value={value.weight_oz ?? ''}
                onChange={(e) => set('weight_oz', num(e.target.value))} />
            </Field>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center justify-between border rounded p-3">
            <div>
              <div className="text-sm font-medium">Fragile</div>
              <div className="text-xs text-muted-foreground">Packed alone, never with other items</div>
            </div>
            <Switch checked={value.is_fragile} onCheckedChange={(v) => set('is_fragile', v)} disabled={disabled} />
          </div>
          <div className="flex items-center justify-between border rounded p-3">
            <div>
              <div className="text-sm font-medium">Stackable</div>
              <div className="text-xs text-muted-foreground">May be stacked with similar units</div>
            </div>
            <Switch checked={value.stackable} onCheckedChange={(v) => set('stackable', v)} disabled={disabled} />
          </div>
        </div>

        <div>
          <Label className="text-xs uppercase text-muted-foreground">Case pack (optional)</Label>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-2">
            <Field label="Units / case">
              <Input type="number" min={1} step="1" disabled={disabled}
                value={value.units_per_case ?? ''}
                onChange={(e) => set('units_per_case', num(e.target.value))} />
            </Field>
            <Field label="Case L (in)">
              <Input type="number" min={0} step="0.01" disabled={disabled}
                value={value.case_length_in ?? ''}
                onChange={(e) => set('case_length_in', num(e.target.value))} />
            </Field>
            <Field label="Case W (in)">
              <Input type="number" min={0} step="0.01" disabled={disabled}
                value={value.case_width_in ?? ''}
                onChange={(e) => set('case_width_in', num(e.target.value))} />
            </Field>
            <Field label="Case H (in)">
              <Input type="number" min={0} step="0.01" disabled={disabled}
                value={value.case_height_in ?? ''}
                onChange={(e) => set('case_height_in', num(e.target.value))} />
            </Field>
            <Field label="Case wt (oz)">
              <Input type="number" min={0} step="0.01" disabled={disabled}
                value={value.case_weight_oz ?? ''}
                onChange={(e) => set('case_weight_oz', num(e.target.value))} />
            </Field>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className={`text-xs ${required ? 'font-semibold' : ''}`}>{label}</Label>
      {children}
    </div>
  );
}
