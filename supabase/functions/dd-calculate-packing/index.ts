import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';

const ItemSchema = z.object({
  product_id: z.string().min(1),
  quantity: z.number().int().positive().max(10000),
  length_in: z.number().positive().max(200),
  width_in: z.number().positive().max(200),
  height_in: z.number().positive().max(200),
  weight_oz: z.number().positive().max(50000),
  is_fragile: z.boolean().optional(),
  stackable: z.boolean().optional(),
});
const BodySchema = z.object({
  items: z.array(ItemSchema).min(1),
  carrier_preference: z.enum(['any', 'ups', 'fedex', 'usps']).optional(),
  prefer_flat_rate: z.boolean().optional(),
});

interface InputItem {
  product_id: string;
  quantity: number;
  length_in: number;
  width_in: number;
  height_in: number;
  weight_oz: number;
  is_fragile?: boolean;
  stackable?: boolean;
}

interface Unit {
  product_id: string;
  length_in: number;
  width_in: number;
  height_in: number;
  weight_oz: number;
  volume: number;
  is_fragile: boolean;
  stackable: boolean;
}

interface Box {
  id: string;
  box_name: string;
  carrier: string;
  length_in: number;
  width_in: number;
  height_in: number;
  max_weight_oz: number | null;
  is_flat_rate: boolean;
  flat_rate_price: number | null;
  cost_per_box: number | null;
  volume: number;
}

interface PackedBox {
  box_id: string;
  box_name: string;
  carrier: string;
  is_flat_rate: boolean;
  flat_rate_price: number | null;
  dimensions: { length_in: number; width_in: number; height_in: number };
  items: Array<{ product_id: string; quantity: number }>;
  actual_weight_oz: number;
  dim_weight_oz: number;
  billable_weight_oz: number;
  fill_percentage: number;
  fragile_only: boolean;
}

const FILL_FACTOR = 0.85;
const DIM_DIVISOR = 139;

function dimWeightOz(l: number, w: number, h: number): number {
  return ((l * w * h) / DIM_DIVISOR) * 16;
}

function fitsInBox(unit: Unit, box: Box): boolean {
  const u = [unit.length_in, unit.width_in, unit.height_in].sort((a, b) => b - a);
  const b = [box.length_in, box.width_in, box.height_in].sort((a, b) => b - a);
  return u[0] <= b[0] && u[1] <= b[1] && u[2] <= b[2];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      // Name offending items so callers can surface a per-product error.
      const issues = parsed.error.issues.map((iss) => {
        const path = iss.path.join('.');
        const idxMatch = /^items\.(\d+)/.exec(path);
        const itemIdx = idxMatch ? Number(idxMatch[1]) : null;
        const productId = itemIdx != null ? raw?.items?.[itemIdx]?.product_id ?? null : null;
        return { path, message: iss.message, product_id: productId };
      });
      return new Response(
        JSON.stringify({
          error: 'Invalid packing request: one or more items are missing required positive numeric dimensions (length_in, width_in, height_in, weight_oz).',
          issues,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const body = parsed.data;

    const carrierPref: string = body.carrier_preference || 'any';
    const preferFlatRate: boolean = !!body.prefer_flat_rate;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    let boxQuery = supabase.from('dd_box_sizes').select('*').eq('is_active', true);
    if (carrierPref !== 'any') {
      boxQuery = boxQuery.in('carrier', [carrierPref, 'any']);
    }
    const { data: boxRows, error: boxErr } = await boxQuery;
    if (boxErr) {
      return new Response(JSON.stringify({ error: `Failed to load boxes: ${boxErr.message}` }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!boxRows || boxRows.length === 0) {
      return new Response(JSON.stringify({ error: 'No active boxes available' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const boxes: Box[] = boxRows.map((b: any) => ({
      id: b.id,
      box_name: b.box_name,
      carrier: b.carrier,
      length_in: Number(b.length_in),
      width_in: Number(b.width_in),
      height_in: Number(b.height_in),
      max_weight_oz: b.max_weight_oz != null ? Number(b.max_weight_oz) : null,
      is_flat_rate: !!b.is_flat_rate,
      flat_rate_price: b.flat_rate_price != null ? Number(b.flat_rate_price) : null,
      cost_per_box: b.cost_per_box != null ? Number(b.cost_per_box) : null,
      volume: Number(b.length_in) * Number(b.width_in) * Number(b.height_in),
    }));

    // Sort: prefer flat-rate first (if requested), then smallest volume
    boxes.sort((a, b) => {
      if (preferFlatRate && a.is_flat_rate !== b.is_flat_rate) return a.is_flat_rate ? -1 : 1;
      return a.volume - b.volume;
    });

    const warnings: string[] = [];
    const units: Unit[] = [];

    for (const it of body.items as InputItem[]) {
      const qty = Number(it.quantity) || 0;
      const L = Number(it.length_in);
      const W = Number(it.width_in);
      const H = Number(it.height_in);
      const wt = Number(it.weight_oz);
      if (!it.product_id || qty <= 0 || !L || !W || !H || !wt) {
        warnings.push(`Skipped item ${it.product_id ?? '(no id)'}: missing dimensions/weight/quantity`);
        continue;
      }
      for (let i = 0; i < qty; i++) {
        units.push({
          product_id: it.product_id,
          length_in: L,
          width_in: W,
          height_in: H,
          weight_oz: wt,
          volume: L * W * H,
          is_fragile: !!it.is_fragile,
          stackable: it.stackable !== false,
        });
      }
    }

    if (units.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No packable units after validating items', warnings }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Largest volume first
    units.sort((a, b) => b.volume - a.volume);

    interface OpenBox {
      box: Box;
      units: Unit[];
      usedVolume: number;
      actualWeight: number;
      fragile: boolean;
    }

    const openBoxes: OpenBox[] = [];

    const openNewBoxFor = (unit: Unit): OpenBox | null => {
      // pick smallest box that fits this unit and respects weight
      for (const box of boxes) {
        if (!fitsInBox(unit, box)) continue;
        const dw = dimWeightOz(box.length_in, box.width_in, box.height_in);
        const billable = Math.max(unit.weight_oz, dw);
        if (box.max_weight_oz != null && billable > box.max_weight_oz) continue;
        return { box, units: [unit], usedVolume: unit.volume, actualWeight: unit.weight_oz, fragile: unit.is_fragile };
      }
      return null;
    };

    for (const unit of units) {
      let placed = false;
      for (const ob of openBoxes) {
        // fragile isolation
        if (ob.fragile !== unit.is_fragile) continue;
        // capacity by fill factor
        const capacity = ob.box.volume * FILL_FACTOR;
        if (ob.usedVolume + unit.volume > capacity) continue;
        // must physically fit (approx: unit fits in box shell)
        if (!fitsInBox(unit, ob.box)) continue;
        // weight check on billable weight (dim weight of box vs cumulative actual)
        const newActual = ob.actualWeight + unit.weight_oz;
        const dw = dimWeightOz(ob.box.length_in, ob.box.width_in, ob.box.height_in);
        const billable = Math.max(newActual, dw);
        if (ob.box.max_weight_oz != null && billable > ob.box.max_weight_oz) continue;
        ob.units.push(unit);
        ob.usedVolume += unit.volume;
        ob.actualWeight = newActual;
        placed = true;
        break;
      }
      if (!placed) {
        const nb = openNewBoxFor(unit);
        if (!nb) {
          warnings.push(
            `Unit of product ${unit.product_id} (${unit.length_in}x${unit.width_in}x${unit.height_in}, ${unit.weight_oz}oz) does not fit any available box`,
          );
          continue;
        }
        openBoxes.push(nb);
      }
    }

    const packed: PackedBox[] = openBoxes.map((ob) => {
      const dw = dimWeightOz(ob.box.length_in, ob.box.width_in, ob.box.height_in);
      const billable = Math.max(ob.actualWeight, dw);
      const counts = new Map<string, number>();
      for (const u of ob.units) counts.set(u.product_id, (counts.get(u.product_id) || 0) + 1);
      return {
        box_id: ob.box.id,
        box_name: ob.box.box_name,
        carrier: ob.box.carrier,
        is_flat_rate: ob.box.is_flat_rate,
        flat_rate_price: ob.box.flat_rate_price,
        dimensions: { length_in: ob.box.length_in, width_in: ob.box.width_in, height_in: ob.box.height_in },
        items: Array.from(counts.entries()).map(([product_id, quantity]) => ({ product_id, quantity })),
        actual_weight_oz: Number(ob.actualWeight.toFixed(2)),
        dim_weight_oz: Number(dw.toFixed(2)),
        billable_weight_oz: Number(billable.toFixed(2)),
        fill_percentage: Number(((ob.usedVolume / ob.box.volume) * 100).toFixed(2)),
        fragile_only: ob.fragile,
      };
    });

    return new Response(
      JSON.stringify({
        box_count: packed.length,
        boxes: packed,
        warnings,
        total_units_packed: openBoxes.reduce((s, ob) => s + ob.units.length, 0),
        total_units_input: units.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
