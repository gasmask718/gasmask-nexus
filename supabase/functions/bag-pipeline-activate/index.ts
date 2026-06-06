// Bag pipeline activation — executes step 4 from docs/activate-bag-pipeline.md:
// backfills bag_sale_ledger from historical invoices where products.track_by='bags'.
// Safe to re-run (dedupes by (invoice line + source='invoice_backfill')).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Discover bag-tracked products
    const { data: bagProducts, error: pErr } = await supabase
      .from("products")
      .select("id")
      .eq("track_by", "bags");
    if (pErr) throw pErr;
    const bagProductIds = (bagProducts || []).map((p: any) => p.id);
    if (!bagProductIds.length) {
      return new Response(JSON.stringify({ inserted: 0, reason: "no bag-tracked products" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pull paid/partial invoice line items for bag products
    const { data: lines, error: lErr } = await supabase
      .from("invoice_line_items")
      .select("id, invoice_id, product_id, product_name, quantity, brand, invoices!inner(store_id, created_at, payment_status)")
      .in("product_id", bagProductIds);
    if (lErr) throw lErr;

    const eligible = (lines || []).filter((l: any) =>
      l.invoices && ["paid", "partial"].includes(l.invoices.payment_status) && l.invoices.store_id
    );

    // Dedupe against existing backfill rows by source_id = line_item_id (when column exists)
    const { data: existing } = await supabase
      .from("bag_sale_ledger")
      .select("source_id")
      .eq("source", "invoice_backfill");
    const seen = new Set((existing || []).map((r: any) => r.source_id).filter(Boolean));

    const toInsert = eligible
      .filter((l: any) => !seen.has(l.id))
      .map((l: any) => ({
        store_id: l.invoices.store_id,
        product_id: l.product_id,
        product_name: l.product_name,
        brand_id: l.brand ? String(l.brand).toLowerCase() : null,
        bags_delta: Number(l.quantity) || 0,
        source: "invoice_backfill",
        source_id: l.id,
        created_at: l.invoices.created_at,
      }))
      .filter((r) => r.bags_delta !== 0);

    let inserted = 0;
    if (toInsert.length) {
      const { error: insErr, count } = await supabase
        .from("bag_sale_ledger")
        .insert(toInsert, { count: "exact" });
      if (insErr) throw insErr;
      inserted = count || toInsert.length;
    }

    return new Response(
      JSON.stringify({ ok: true, inserted, eligible: eligible.length, skipped: eligible.length - toInsert.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
