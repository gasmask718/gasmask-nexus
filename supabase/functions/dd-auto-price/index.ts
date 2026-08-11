import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { logDdError } from "../_shared/ddAlert.ts";

// ---------------------------------------------------------------------------
// Category pricing rules
// target_store / target_dtc = default target margins
// map_enforced = MAP price is an absolute floor if set
// Per-product min_store_margin_pct / min_dtc_margin_pct come from the row.
// ---------------------------------------------------------------------------
const CATEGORY_RULES: Record<
  string,
  { target_store: number; target_dtc: number; map_enforced: boolean }
> = {
  disposable_vape: { target_store: 50, target_dtc: 72, map_enforced: true },
  nicotine_pouch:  { target_store: 50, target_dtc: 72, map_enforced: true },
  tobacco_grabba:  { target_store: 45, target_dtc: 70, map_enforced: false },
  rolling_papers:  { target_store: 55, target_dtc: 75, map_enforced: true },
  lighters:        { target_store: 60, target_dtc: 78, map_enforced: false },
  grinders:        { target_store: 70, target_dtc: 80, map_enforced: false },
  glass:           { target_store: 70, target_dtc: 82, map_enforced: false },
  vape_hardware:   { target_store: 55, target_dtc: 70, map_enforced: false },
  cbd_hemp:        { target_store: 65, target_dtc: 78, map_enforced: false },
  accessories:     { target_store: 72, target_dtc: 80, map_enforced: false },
};

// Round UP to nearest .49 or .99. Whole-dollar edge -> .49
function roundToCharm(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  const whole = Math.floor(raw);
  const frac = raw - whole;
  if (frac === 0) return whole + 0.49;
  if (frac <= 0.49) return whole + 0.49;
  if (frac <= 0.99) return whole + 0.99;
  return whole + 1 + 0.49;
}

function priceFromMargin(cost: number, marginPct: number): number {
  return cost / (1 - marginPct / 100);
}

interface AutoPriceInput {
  product_id?: string;
  supplier_cost?: number;
  category?: string;
  map_price?: number | null;
  market_avg_retail?: number | null;
  min_store_margin_pct?: number | null;
  min_dtc_margin_pct?: number | null;
  persist?: boolean; // when true, write back to products_all
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: AutoPriceInput & { healthcheck?: boolean } = await req.json();
    if (body?.healthcheck === true) {
      return new Response(JSON.stringify({ ok: true, fn: "dd-auto-price" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Hydrate from DB if product_id provided
    let row: AutoPriceInput = { ...body };
    if (body.product_id) {
      const { data, error } = await supabase
        .from("products_all")
        .select(
          "id, supplier_cost, category, map_price, market_avg_retail, min_store_margin_pct, min_dtc_margin_pct",
        )
        .eq("id", body.product_id)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error(`product ${body.product_id} not found`);
      row = { ...data, persist: body.persist ?? true };
    }

    const cost = Number(row.supplier_cost);
    const category = String(row.category ?? "");
    if (!Number.isFinite(cost) || cost <= 0) {
      throw new Error("supplier_cost must be > 0");
    }
    const rules = CATEGORY_RULES[category];
    if (!rules) throw new Error(`no pricing rules for category "${category}"`);

    // Per-product floors (tunable). Fall back to target - 0 (i.e. target itself)
    // only if the column is genuinely null; the DB defaults these to 25/50.
    const minStore = Number(row.min_store_margin_pct ?? rules.target_store);
    const minDtc = Number(row.min_dtc_margin_pct ?? rules.target_dtc);

    // Target prices
    let storePrice = roundToCharm(priceFromMargin(cost, rules.target_store));
    let dtcPrice = roundToCharm(priceFromMargin(cost, rules.target_dtc));

    // Floor from per-product min margin
    const storeFloor = roundToCharm(priceFromMargin(cost, minStore));
    const dtcFloor = roundToCharm(priceFromMargin(cost, minDtc));

    const warnings: string[] = [];
    const errors: string[] = [];

    if (storePrice < storeFloor) {
      errors.push(
        `store_price_a ${storePrice.toFixed(2)} below min-margin floor ${storeFloor.toFixed(2)} (${minStore}%)`,
      );
    }
    if (dtcPrice < dtcFloor) {
      errors.push(
        `dtc_price_b ${dtcPrice.toFixed(2)} below min-margin floor ${dtcFloor.toFixed(2)} (${minDtc}%)`,
      );
    }

    // MAP is an absolute floor when enforced
    const map = row.map_price != null ? Number(row.map_price) : null;
    if (rules.map_enforced && map && map > 0) {
      if (storePrice < map) storePrice = roundToCharm(map);
      if (dtcPrice < map) dtcPrice = roundToCharm(map);
    }

    // Ceiling: 1.15x market average — flag only, do not block
    const mkt = row.market_avg_retail != null ? Number(row.market_avg_retail) : null;
    if (mkt && mkt > 0) {
      const ceiling = mkt * 1.15;
      if (storePrice > ceiling) {
        warnings.push(
          `store_price_a ${storePrice.toFixed(2)} exceeds 1.15x market ${ceiling.toFixed(2)}`,
        );
      }
      if (dtcPrice > ceiling) {
        warnings.push(
          `dtc_price_b ${dtcPrice.toFixed(2)} exceeds 1.15x market ${ceiling.toFixed(2)}`,
        );
      }
    }

    if (storePrice >= dtcPrice) {
      errors.push(
        `store_price_a (${storePrice.toFixed(2)}) must be less than dtc_price_b (${dtcPrice.toFixed(2)})`,
      );
    }

    const blocked = errors.length > 0;

    // Persist back to products_all when requested and safe
    if (!blocked && row.persist && body.product_id) {
      const { error: upErr } = await supabase
        .from("products_all")
        .update({ store_price_a: storePrice, dtc_price_b: dtcPrice })
        .eq("id", body.product_id);
      if (upErr) throw upErr;
    }

    return new Response(
      JSON.stringify({
        product_id: body.product_id ?? null,
        category,
        supplier_cost: cost,
        store_price_a: storePrice,
        dtc_price_b: dtcPrice,
        min_store_margin_pct: minStore,
        min_dtc_margin_pct: minDtc,
        map_enforced: rules.map_enforced,
        warnings,
        errors,
        blocked,
        persisted: !blocked && !!row.persist && !!body.product_id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (e) {
    await logDdError({
      source: "dd-auto-price",
      message: e instanceof Error ? e.message : String(e),
    });
    // Contract: always return 200 with { error }
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  }
});
