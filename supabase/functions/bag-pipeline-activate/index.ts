// Bag pipeline activation — executes step 4 from docs/activate-bag-pipeline.md:
// backfills bag_sale_ledger from historical paid/partial invoices where products.track_by='bags'.
// Safe to re-run (deduped by (invoice_id, line_item_id, source) unique index).
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
      .select("id, brand_id")
      .eq("track_by", "bags");
    if (pErr) throw pErr;
    const bagProductIds = (bagProducts || []).map((p: any) => p.id);
    if (!bagProductIds.length) {
      return new Response(JSON.stringify({ inserted: 0, reason: "no bag-tracked products" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const brandByProduct: Record<string, string | null> = {};
    (bagProducts || []).forEach((p: any) => { brandByProduct[p.id] = p.brand_id ?? null; });

    // Pull bag line items from paid/partial invoices
    const { data: lines, error: lErr } = await supabase
      .from("invoice_line_items")
      .select("id, invoice_id, product_id, product_name, quantity, invoices!inner(store_id, created_at, payment_status)")
      .in("product_id", bagProductIds);
    if (lErr) throw lErr;

    const eligible = (lines || []).filter((l: any) =>
      l.invoices && ["paid", "partial"].includes(l.invoices.payment_status) && l.invoices.store_id
    );

    // Dedupe against existing backfill rows by (invoice_id, line_item_id)
    const { data: existing } = await supabase
      .from("bag_sale_ledger")
      .select("invoice_id, line_item_id")
      .eq("source", "invoice_backfill");
    const seen = new Set((existing || []).map((r: any) => `${r.invoice_id}:${r.line_item_id}`));

    const toInsert = eligible
      .filter((l: any) => !seen.has(`${l.invoice_id}:${l.id}`))
      .map((l: any) => ({
        invoice_id: l.invoice_id,
        line_item_id: l.id,
        store_id: l.invoices.store_id,
        brand_id: brandByProduct[l.product_id],
        product_id: l.product_id,
        product_name: l.product_name,
        bags_delta: -Math.abs(Number(l.quantity) || 0),
        source: "invoice_backfill",
        recorded_by: "bag-pipeline-activate",
        created_at: l.invoices.created_at,
      }))
      .filter((r) => r.bags_delta !== 0);

    let inserted = 0;
    if (toInsert.length) {
      // onConflict on the unique index keeps the run idempotent.
      const { error: insErr, count } = await supabase
        .from("bag_sale_ledger")
        .upsert(toInsert, { onConflict: "invoice_id,line_item_id,source", ignoreDuplicates: true, count: "exact" });
      if (insErr) throw insErr;
      inserted = count || 0;
    }

    return new Response(
      JSON.stringify({ ok: true, inserted, eligible: eligible.length, skipped: eligible.length - toInsert.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
