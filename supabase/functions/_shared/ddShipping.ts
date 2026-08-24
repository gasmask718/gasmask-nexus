// Shared Dynasty Direct shipping quoting.
// Used by dd-shipping-quote (checkout display) and dd-create-checkout
// (server-side amount integrity). The customer pays a real carrier rate
// when EasyPost is reachable; otherwise a documented flat fallback.
// NEVER trust a client-passed shipping_cost for the charge amount.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2.57.2";
import { hydrateItems, loadBoxes, packItems, type PackedBox } from "./ddBoxing.ts";

export interface QuoteItem {
  product_id: string;
  quantity: number;
}

export interface OriginGroupQuote {
  wholesaler_id: string | null;
  from: { city: string; state: string; zip: string };
  /** Billable weight (greater of actual and dimensional) across this origin's boxes. */
  weight_oz: number;
  cost: number;
  carrier: string | null;
  service: string | null;
  source: "easypost" | "flat_fallback";
  boxes: Array<{ box_name: string; length_in: number; width_in: number; height_in: number; billable_weight_oz: number }>;
}

export interface ShippingQuote {
  shipping_cost: number;
  currency: string;
  source: "easypost" | "flat_fallback" | "mixed";
  groups: OriginGroupQuote[];
  /** Products with no weight/dimensions on file — rated on a fallback parcel. */
  warnings: string[];
}

const FLAT_FIRST_ITEM = 8.99;
const FLAT_PER_EXTRA_ITEM = 1.0;

function flatFallback(totalQty: number): number {
  return Math.round((FLAT_FIRST_ITEM + FLAT_PER_EXTRA_ITEM * Math.max(0, totalQty - 1)) * 100) / 100;
}

export async function getEasyPostKey(supabase: SupabaseClient): Promise<string | null> {
  // db-first (runtime-editable), env second
  try {
    const { data } = await supabase
      .from("dd_ai_config")
      .select("config_value")
      .eq("config_key", "easypost_api_key")
      .maybeSingle();
    const v = String((data as any)?.config_value ?? "").trim();
    if (v) return v;
  } catch (_e) { /* fall through to env */ }
  const env = Deno.env.get("EASYPOST_API_KEY");
  return env && env.trim() ? env.trim() : null;
}

/**
 * Quote shipping for a set of items to a destination zip.
 * Groups items by fulfilling wholesaler (one parcel per origin) and sums rates.
 */
export async function quoteShipping(
  supabase: SupabaseClient,
  items: QuoteItem[],
  toZip: string,
): Promise<ShippingQuote> {
  // Real per-product weight and dimensions — never a hardcoded parcel. Carriers
  // bill on the greater of actual and dimensional weight, so a flat 6x4x2
  // assumption silently loses money on every bulky item.
  const hydrated = await hydrateItems(supabase, items);

  // Platform default origin (dd_config.pickup_address) for products with no origin on file
  let defaultOrigin = { city: "New York", state: "NY", zip: "11201" };
  try {
    const { data: cfg } = await supabase.from("dd_config").select("pickup_address").eq("id", true).maybeSingle();
    const pa = (cfg as any)?.pickup_address;
    if (pa?.zip) defaultOrigin = { city: pa.city ?? defaultOrigin.city, state: pa.state ?? defaultOrigin.state, zip: String(pa.zip) };
  } catch (_e) { /* keep default */ }

  const warnings = hydrated
    .filter((h) => h.missing_dimensions)
    .map((h) => `Product ${h.product_id} has no weight/dimensions on file — quoted on a conservative fallback parcel.`);

  // One parcel set per origin (wholesaler); unknown wholesaler → platform origin
  const groups = new Map<string, { wholesaler_id: string | null; from: { city: string; state: string; zip: string }; items: typeof hydrated; qty: number }>();
  for (const h of hydrated) {
    const key = h.wholesaler_id ?? "platform";
    const g = groups.get(key) ?? {
      wholesaler_id: h.wholesaler_id,
      from: {
        city: h.shipping_from_city ?? defaultOrigin.city,
        state: h.shipping_from_state ?? defaultOrigin.state,
        zip: defaultOrigin.zip,
      },
      items: [] as typeof hydrated,
      qty: 0,
    };
    g.items.push(h);
    g.qty += h.quantity;
    groups.set(key, g);
  }

  const boxes = await loadBoxes(supabase, "any");
  const apiKey = await getEasyPostKey(supabase);
  const groupQuotes: OriginGroupQuote[] = [];

  for (const g of groups.values()) {
    const packed = boxes.length > 0 ? packItems(g.items, boxes) : { boxes: [] as PackedBox[], warnings: [] as string[] };
    warnings.push(...packed.warnings);

    // No box fits (or none configured) — fall back to a single parcel sized to
    // the largest item so the customer still gets a real-ish rate.
    const parcels: PackedBox[] = packed.boxes.length > 0 ? packed.boxes : [{
      box_id: "", box_name: "unboxed", carrier: "any", is_flat_rate: false, flat_rate_price: null,
      dimensions: {
        length_in: Math.max(...g.items.map((i) => i.length_in)),
        width_in: Math.max(...g.items.map((i) => i.width_in)),
        height_in: Math.max(...g.items.map((i) => i.height_in)),
      },
      items: g.items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
      actual_weight_oz: g.items.reduce((s, i) => s + i.weight_oz * i.quantity, 0),
      dim_weight_oz: 0,
      billable_weight_oz: g.items.reduce((s, i) => s + i.weight_oz * i.quantity, 0),
      fill_percentage: 0,
      fragile_only: false,
    }];

    const billableTotal = parcels.reduce((s, b) => s + b.billable_weight_oz, 0);
    const boxSummary = parcels.map((b) => ({
      box_name: b.box_name,
      length_in: b.dimensions.length_in,
      width_in: b.dimensions.width_in,
      height_in: b.dimensions.height_in,
      billable_weight_oz: b.billable_weight_oz,
    }));

    let cost = 0;
    let carrier: string | null = null;
    let service: string | null = null;
    let allQuoted = apiKey != null;

    if (apiKey) {
      for (const b of parcels) {
        try {
          const res = await fetch("https://api.easypost.com/v2/shipments", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              shipment: {
                from_address: { name: "Dynasty Direct", city: g.from.city, state: g.from.state, zip: g.from.zip, country: "US" },
                to_address: { zip: toZip, country: "US" },
                parcel: {
                  // Rate on BILLABLE weight and the real box dimensions.
                  weight: Math.max(1, Math.round(b.billable_weight_oz)),
                  length: b.dimensions.length_in,
                  width: b.dimensions.width_in,
                  height: b.dimensions.height_in,
                },
              },
            }),
          });
          if (!res.ok) {
            console.error(`[ddShipping] EasyPost rate error ${res.status}: ${(await res.text()).slice(0, 300)}`);
            allQuoted = false;
            break;
          }
          const body = await res.json();
          const rates: any[] = body?.rates ?? [];
          if (rates.length === 0) { allQuoted = false; break; }
          const cheapest = rates.reduce((a: any, x: any) => (Number(a.rate) <= Number(x.rate) ? a : x));
          cost += Number(cheapest.rate);
          carrier = carrier ?? (cheapest.carrier ?? null);
          service = service ?? (cheapest.service ?? null);
        } catch (e) {
          console.error(`[ddShipping] EasyPost rate exception: ${e instanceof Error ? e.message : e}`);
          allQuoted = false;
          break;
        }
      }
    }

    groupQuotes.push(
      allQuoted
        ? {
            wholesaler_id: g.wholesaler_id,
            from: g.from,
            weight_oz: Number(billableTotal.toFixed(2)),
            cost: Math.round(cost * 100) / 100,
            carrier,
            service,
            source: "easypost",
            boxes: boxSummary,
          }
        : {
            wholesaler_id: g.wholesaler_id,
            from: g.from,
            weight_oz: Number(billableTotal.toFixed(2)),
            cost: flatFallback(g.qty),
            carrier: null,
            service: null,
            source: "flat_fallback",
            boxes: boxSummary,
          },
    );
  }

  const total = Math.round(groupQuotes.reduce((s, g) => s + g.cost, 0) * 100) / 100;
  const sources = new Set(groupQuotes.map((g) => g.source));
  return {
    shipping_cost: total,
    currency: "USD",
    source: sources.size === 1 ? (groupQuotes[0]?.source ?? "flat_fallback") : "mixed",
    groups: groupQuotes,
    warnings,
  };
}

/** Next business day (skips Sat/Sun) as YYYY-MM-DD. */
export function nextBusinessDay(from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}
