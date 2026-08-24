// Dynasty Direct — box selection and billable (dimensional) weight.
//
// Carriers bill on the GREATER of actual weight and dimensional weight
// (L x W x H / 139 for UPS & FedEx retail, applied here to every carrier as the
// conservative case). Rating on actual weight alone loses money on every bulky
// item and nobody notices until the carrier invoice arrives.
//
// Canonical algorithm — used by dd-calculate-packing (label time) AND by
// quoteShipping (checkout). Both must agree or the customer is charged for a
// different parcel than the one we buy postage for.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2.57.2";

export const DIM_DIVISOR = 139;
export const FILL_FACTOR = 0.85;
/** Padding added around a loose (unboxed) item before it is fitted to a box. */
export const PADDING_IN = 1.0;

export interface BoxSize {
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

export interface PackItem {
  product_id: string;
  quantity: number;
  length_in: number;
  width_in: number;
  height_in: number;
  weight_oz: number;
  is_fragile?: boolean;
  stackable?: boolean;
  /** true when the item ships in its own packaging (no outer box padding). */
  ships_in_own_box?: boolean;
}

export interface PackedBox {
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

export interface PackResult {
  box_count: number;
  boxes: PackedBox[];
  warnings: string[];
  total_units_packed: number;
  total_units_input: number;
}

export function dimWeightOz(l: number, w: number, h: number): number {
  return ((l * w * h) / DIM_DIVISOR) * 16;
}

/** Billable weight for a parcel: greater of actual and dimensional. */
export function billableWeightOz(actualOz: number, l: number, w: number, h: number): number {
  return Math.max(actualOz, dimWeightOz(l, w, h));
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

function fitsInBox(u: { length_in: number; width_in: number; height_in: number }, box: BoxSize): boolean {
  const a = [u.length_in, u.width_in, u.height_in].sort((x, y) => y - x);
  const b = [box.length_in, box.width_in, box.height_in].sort((x, y) => y - x);
  return a[0] <= b[0] && a[1] <= b[1] && a[2] <= b[2];
}

export function toBoxSizes(rows: any[]): BoxSize[] {
  return (rows ?? []).map((b: any) => ({
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
}

export async function loadBoxes(
  supabase: SupabaseClient,
  carrierPreference: string = "any",
): Promise<BoxSize[]> {
  let q = supabase.from("dd_box_sizes").select("*").eq("is_active", true);
  if (carrierPreference && carrierPreference !== "any") {
    q = q.in("carrier", [carrierPreference, "any"]);
  }
  const { data, error } = await q;
  if (error) throw new Error(`box_load_failed: ${error.message}`);
  return toBoxSizes(data ?? []);
}

/**
 * Pick the smallest box(es) that hold the items, accounting for padding on
 * loose items, fragile isolation and a fill factor. Returns billable weight
 * per box so rating never uses actual weight alone.
 */
export function packItems(
  items: PackItem[],
  boxes: BoxSize[],
  opts: { preferFlatRate?: boolean } = {},
): PackResult {
  const warnings: string[] = [];
  const sorted = [...boxes].sort((a, b) => {
    if (opts.preferFlatRate && a.is_flat_rate !== b.is_flat_rate) return a.is_flat_rate ? -1 : 1;
    return a.volume - b.volume;
  });

  const units: Unit[] = [];
  for (const it of items) {
    const qty = Number(it.quantity) || 0;
    const pad = it.ships_in_own_box ? 0 : PADDING_IN;
    const L = Number(it.length_in) + pad;
    const W = Number(it.width_in) + pad;
    const H = Number(it.height_in) + pad;
    const wt = Number(it.weight_oz);
    if (!it.product_id || qty <= 0 || !(L > 0) || !(W > 0) || !(H > 0) || !(wt > 0)) {
      warnings.push(`Skipped item ${it.product_id ?? "(no id)"}: missing dimensions/weight/quantity`);
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

  units.sort((a, b) => b.volume - a.volume);

  interface OpenBox { box: BoxSize; units: Unit[]; usedVolume: number; actualWeight: number; fragile: boolean }
  const openBoxes: OpenBox[] = [];

  const openNewBoxFor = (unit: Unit): OpenBox | null => {
    for (const box of sorted) {
      if (!fitsInBox(unit, box)) continue;
      const billable = billableWeightOz(unit.weight_oz, box.length_in, box.width_in, box.height_in);
      if (box.max_weight_oz != null && billable > box.max_weight_oz) continue;
      return { box, units: [unit], usedVolume: unit.volume, actualWeight: unit.weight_oz, fragile: unit.is_fragile };
    }
    return null;
  };

  for (const unit of units) {
    let placed = false;
    for (const ob of openBoxes) {
      if (ob.fragile !== unit.is_fragile) continue;
      if (ob.usedVolume + unit.volume > ob.box.volume * FILL_FACTOR) continue;
      if (!fitsInBox(unit, ob.box)) continue;
      const newActual = ob.actualWeight + unit.weight_oz;
      const billable = billableWeightOz(newActual, ob.box.length_in, ob.box.width_in, ob.box.height_in);
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

  return {
    box_count: packed.length,
    boxes: packed,
    warnings,
    total_units_packed: openBoxes.reduce((s, ob) => s + ob.units.length, 0),
    total_units_input: units.length,
  };
}

export interface HydratedItem extends PackItem {
  wholesaler_id: string | null;
  shipping_from_city: string | null;
  shipping_from_state: string | null;
  missing_dimensions: boolean;
}

/** Conservative stand-in used ONLY when a legacy product has no dimensions on file. */
export const FALLBACK_ITEM = { length_in: 8, width_in: 6, height_in: 4, weight_oz: 16 };

/**
 * Load real per-product dimensions from products_all. Products missing them are
 * flagged (they can no longer be published, but legacy rows may exist).
 */
export async function hydrateItems(
  supabase: SupabaseClient,
  items: Array<{ product_id: string; quantity: number }>,
): Promise<HydratedItem[]> {
  const ids = Array.from(new Set(items.map((i) => i.product_id)));
  const { data, error } = await supabase
    .from("products_all")
    .select("id, wholesaler_id, weight_oz, length_in, width_in, height_in, dimensions, is_fragile, stackable, shipping_from_city, shipping_from_state")
    .in("id", ids);
  if (error) throw new Error(`product_lookup_failed: ${error.message}`);
  const map = new Map<string, any>((data ?? []).map((p: any) => [p.id, p]));

  return items.map((it) => {
    const p = map.get(it.product_id) ?? {};
    const d = (p.dimensions ?? {}) as Record<string, any>;
    const L = Number(p.length_in ?? d.length_in ?? d.length) || 0;
    const W = Number(p.width_in ?? d.width_in ?? d.width) || 0;
    const H = Number(p.height_in ?? d.height_in ?? d.height) || 0;
    const wt = Number(p.weight_oz) || 0;
    const missing = !(L > 0 && W > 0 && H > 0 && wt > 0);
    return {
      product_id: it.product_id,
      quantity: it.quantity,
      length_in: L > 0 ? L : FALLBACK_ITEM.length_in,
      width_in: W > 0 ? W : FALLBACK_ITEM.width_in,
      height_in: H > 0 ? H : FALLBACK_ITEM.height_in,
      weight_oz: wt > 0 ? wt : FALLBACK_ITEM.weight_oz,
      is_fragile: !!p.is_fragile,
      stackable: p.stackable !== false,
      wholesaler_id: p.wholesaler_id ?? null,
      shipping_from_city: p.shipping_from_city ?? null,
      shipping_from_state: p.shipping_from_state ?? null,
      missing_dimensions: missing,
    };
  });
}
