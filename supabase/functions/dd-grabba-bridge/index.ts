// Dynasty Direct → GasMask grabba sync bridge.
// Routes a paid marketplace_order to the correct wholesaler group(s)
// and records sync state in public.dd_grabba_sync.
//
// Note: dd_wholesaler_grabba_orders is a read-only VIEW owned by the
// GasMask pipeline and is intentionally NOT written to from here.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { order_id, force_resync = false } = await req.json();
    if (!order_id) {
      return json({ error: "order_id required" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) Fetch order
    const { data: order, error: orderErr } = await supabase
      .from("marketplace_orders")
      .select("*")
      .eq("id", order_id)
      .maybeSingle();
    if (orderErr) throw orderErr;
    if (!order) return json({ error: "order not found" }, 404);

    // 2) Already synced?
    const { data: existing } = await supabase
      .from("dd_grabba_sync")
      .select("id, status")
      .eq("marketplace_order_id", order_id);

    const alreadySynced = (existing ?? []).some((r) => r.status === "synced");
    if (alreadySynced && !force_resync) {
      return json({ success: true, already_synced: true });
    }

    // 3) Fetch items joined with wholesaler
    const { data: items, error: itemsErr } = await supabase
      .from("marketplace_order_items")
      .select("id, product_id, wholesaler_id, qty, price_each, products_all(product_name)")
      .eq("order_id", order_id);
    if (itemsErr) throw itemsErr;
    if (!items || items.length === 0) {
      return json({ error: "order has no items" }, 400);
    }

    // 4) Group by wholesaler. If the order has a campaign_wholesaler_id, ALL
    //    items route to that supplier (partner campaign override).
    const campaignWid = (order as any).campaign_wholesaler_id as string | null | undefined;
    const groups: Record<string, any[]> = {};
    for (const it of items) {
      const wid = campaignWid || ((it as any).wholesaler_id ?? "unassigned");
      groups[wid] = groups[wid] ?? [];
      groups[wid].push({
        product_id: (it as any).product_id,
        product_name: (it as any).products_all?.product_name,
        qty: (it as any).qty,
        price_each: (it as any).price_each,
      });
    }


    const customerName =
      (order.shipping_address as any)?.name ?? order.customer_email ?? "Unknown";

    const created: string[] = [];
    const createdSyncRows: { id: string; wholesaler_id: string }[] = [];

    for (const [wid, groupedItems] of Object.entries(groups)) {
      // Upsert (replace existing sync row for that order+wholesaler if resync)
      const { data: prior } = await supabase
        .from("dd_grabba_sync")
        .select("id, attempt_count")
        .eq("marketplace_order_id", order_id)
        .eq("wholesaler_id", wid === "unassigned" ? null : wid)
        .maybeSingle();

      const payload = {
        marketplace_order_id: order_id,
        wholesaler_id: wid === "unassigned" ? null : wid,
        items: groupedItems,
        customer_name: customerName,
        delivery_address: order.shipping_address,
        status: "synced", // Direct mark as synced since insert into log is the sync action
        attempt_count: (prior?.attempt_count ?? 0) + 1,
        last_error: null,
        synced_at: new Date().toISOString(),
      };

      let syncId: string | undefined;
      if (prior?.id) {
        const { error } = await supabase
          .from("dd_grabba_sync")
          .update(payload)
          .eq("id", prior.id);
        if (error) throw error;
        syncId = prior.id;
      } else {
        const { data: ins, error } = await supabase
          .from("dd_grabba_sync")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        syncId = ins.id;
      }
      if (syncId) {
        created.push(syncId);
        if (wid !== "unassigned") {
          createdSyncRows.push({ id: syncId, wholesaler_id: wid });
        }
      }
    }

    // 5) Update order's fulfillment status to routed
    await supabase
      .from("marketplace_orders")
      .update({ fulfillment_status: "routed" })
      .eq("id", order_id)
      .neq("fulfillment_status", "delivered");

    // 6) Auto-generate a Purchase Order for each supplier group
    for (const [wid] of Object.entries(groups)) {
      if (wid === "unassigned") continue;
      try {
        await supabase.functions.invoke("dd-generate-po", {
          body: {
            order_id,
            wholesaler_id: wid,
            send_to_supplier: true,
          },
        });
      } catch (e) {
        console.error("[dd-grabba-bridge] PO generation failed for", wid, e);
      }
    }

    // 7) Notify each supplier by email (non-blocking)
    for (const syncRow of createdSyncRows) {
      await supabase.functions
        .invoke("dd-notify-supplier-order", {
          body: {
            grabba_sync_id: syncRow.id,
            wholesaler_id: syncRow.wholesaler_id,
            order_id,
          },
        })
        .catch((err) => console.error("Supplier notification failed:", err));
    }

    // 8) Notify customer that their order is processing (non-blocking)
    supabase.functions
      .invoke("dd-notify-customer-order-update", {
        body: { order_id, event_type: "processing" },
      })
      .catch((err) => console.error("Customer 'processing' notification failed:", err));

    return json({
      success: true,
      synced_order_id: order_id,
      wholesaler_count: Object.keys(groups).length,
      grabba_orders_created: created,
    });
  } catch (err: any) {
    console.error("[dd-grabba-bridge] error", err);
    return json({ error: err?.message ?? String(err) }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
