// Shared Dynasty Direct shipping quoting.
// Used by dd-shipping-quote (checkout display) and dd-create-checkout
// (server-side amount integrity). The customer pays a real carrier rate
// when EasyPost is reachable; otherwise a documented flat fallback.
// NEVER trust a client-passed shipping_cost for the charge amount.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2.57.2";

export interface QuoteItem {
  product_id: string;
  quantity: number;
}

export interface OriginGroupQuote {
  wholesaler_id: string | null;
  from: { city: string; state: string; zip: string };
  weight_oz: number;
  cost: number;
  carrier: string | null;
  service: string | null;
  source: "easypost" | "flat_fallback";
}

export interface ShippingQuote {
  shipping_cost: number;
  currency: string;
  source: "easypost" | "flat_fallback" | "mixed";
  groups: OriginGroupQuote[];
}

const FLAT_FIRST_ITEM = 8.99;
const FLAT_PER_EXTRA_ITEM = 1.0;
const DEFAULT_WEIGHT_OZ = 8;
const DEFAULT_DIMS = { length: 6, width: 4, height: 2 };

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
  const ids = Array.from(new Set(items.map((i) => i.product_id)));
  const { data: products, error } = await supabase
    .from("products_all")
    .select("id, wholesaler_id, weight_oz, length_in, width_in, height_in, dimensions, shipping_from_city, shipping_from_state")
    .in("id", ids);
  if (error) throw new Error(`product_lookup_failed: ${error.message}`);

  // Platform default origin (dd_config.pickup_address) for products with no origin on file
  let defaultOrigin = { city: "New York", state: "NY", zip: "11201" };
  try {
    const { data: cfg } = await supabase.from("dd_config").select("pickup_address").eq("id", true).maybeSingle();
    const pa = (cfg as any)?.pickup_address;
    if (pa?.zip) defaultOrigin = { city: pa.city ?? defaultOrigin.city, state: pa.state ?? defaultOrigin.state, zip: String(pa.zip) };
  } catch (_e) { /* keep default */ }

  const prodMap = new Map<string, any>((products ?? []).map((p: any) => [p.id, p]));

  // Group by origin (wholesaler); unknown wholesaler → platform default origin
  const groups = new Map<string, { wholesaler_id: string | null; weight_oz: number; length: number; width: number; height: number; qty: number; from: { city: string; state: string; zip: string } }>();
  for (const it of items) {
    const p = prodMap.get(it.product_id);
    if (!p) continue;
    const key = p.wholesaler_id ?? "platform";
    const g = groups.get(key) ?? {
      wholesaler_id: p.wholesaler_id ?? null,
      weight_oz: 0,
      length: 0,
      width: 0,
      height: 0,
      qty: 0,
      from: {
        city: p.shipping_from_city ?? defaultOrigin.city,
        state: p.shipping_from_state ?? defaultOrigin.state,
        zip: defaultOrigin.zip,
      },
    };
    const dims = (p.dimensions ?? {}) as Record<string, any>;
    g.weight_oz += (Number(p.weight_oz) || DEFAULT_WEIGHT_OZ) * it.quantity;
    g.length = Math.max(g.length, Number(p.length_in ?? dims.length) || DEFAULT_DIMS.length);
    g.width = Math.max(g.width, Number(p.width_in ?? dims.width) || DEFAULT_DIMS.width);
    g.height = Math.max(g.height, Number(p.height_in ?? dims.height) || DEFAULT_DIMS.height);
    g.qty += it.quantity;
    groups.set(key, g);
  }

  const apiKey = await getEasyPostKey(supabase);
  const groupQuotes: OriginGroupQuote[] = [];

  for (const g of groups.values()) {
    let quoted: OriginGroupQuote | null = null;
    if (apiKey) {
      try {
        const res = await fetch("https://api.easypost.com/v2/shipments", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            shipment: {
              from_address: { name: "Dynasty Direct", city: g.from.city, state: g.from.state, zip: g.from.zip, country: "US" },
              to_address: { zip: toZip, country: "US" },
              parcel: { weight: Math.max(1, Math.round(g.weight_oz)), length: g.length, width: g.width, height: g.height },
            },
          }),
        });
        if (res.ok) {
          const body = await res.json();
          const rates: any[] = body?.rates ?? [];
          if (rates.length > 0) {
            const cheapest = rates.reduce((a: any, b: any) => (Number(a.rate) <= Number(b.rate) ? a : b));
            quoted = {
              wholesaler_id: g.wholesaler_id,
              from: g.from,
              weight_oz: g.weight_oz,
              cost: Math.round(Number(cheapest.rate) * 100) / 100,
              carrier: cheapest.carrier ?? null,
              service: cheapest.service ?? null,
              source: "easypost",
            };
          }
        } else {
          console.error(`[ddShipping] EasyPost rate error ${res.status}: ${(await res.text()).slice(0, 300)}`);
        }
      } catch (e) {
        console.error(`[ddShipping] EasyPost rate exception: ${e instanceof Error ? e.message : e}`);
      }
    }
    if (!quoted) {
      quoted = {
        wholesaler_id: g.wholesaler_id,
        from: g.from,
        weight_oz: g.weight_oz,
        cost: flatFallback(g.qty),
        carrier: null,
        service: null,
        source: "flat_fallback",
      };
    }
    groupQuotes.push(quoted);
  }

  const total = Math.round(groupQuotes.reduce((s, g) => s + g.cost, 0) * 100) / 100;
  const sources = new Set(groupQuotes.map((g) => g.source));
  return {
    shipping_cost: total,
    currency: "USD",
    source: sources.size === 1 ? (groupQuotes[0]?.source ?? "flat_fallback") : "mixed",
    groups: groupQuotes,
  };
}

/** Next business day (skips Sat/Sun) as YYYY-MM-DD. */
export function nextBusinessDay(from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}
