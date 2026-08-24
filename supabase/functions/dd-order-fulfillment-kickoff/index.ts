// dd-order-fulfillment-kickoff — paid order → prepaid label → supplier notified → pickup scheduled.
//
// The dropship loop, automated:
//   1. Group order items by fulfilling wholesaler.
//   2. Buy a prepaid EasyPost label per wholesaler (dd-create-shipment) using the
//      shipping money the customer paid at checkout.
//   3. Record label/tracking on marketplace_fulfillments.
//   4. Email the wholesaler the order + ship-to + label (dd-notify-supplier-order).
//   5. Auto-request a carrier pickup at the wholesaler's address for the next
//      business day (dd-schedule-pickup) so the supplier never buys postage
//      and never drives to a drop-off.
//
// Idempotent: a wholesaler group with an existing purchased label is skipped,
// so Stripe webhook retries are safe. Per-group failures are recorded and
// returned, never thrown past the loop — one bad supplier must not block the rest.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2.57.2";
import { nextBusinessDay } from "../_shared/ddShipping.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FN_BASE = `${Deno.env.get("SUPABASE_URL") ?? ""}/functions/v1`;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

async function callFn(name: string, payload: Record<string, unknown>): Promise<{ ok: boolean; status: number; body: any }> {
  const res = await fetch(`${FN_BASE}/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let body: any = null;
  try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 500) }; }
  return { ok: res.ok, status: res.status, body };
}

function mapToAddress(order: any): Record<string, string> | null {
  const a = (order?.shipping_address ?? {}) as Record<string, any>;
  const street1 = a.line1 ?? a.street ?? a.address ?? null;
  const zip = a.postal_code ?? a.zip ?? a.zipCode ?? null;
  if (!street1 || !a.city || !a.state || !zip) return null;
  return {
    name: a.name ?? a.fullName ?? order.customer_email ?? "Customer",
    street1,
    street2: a.line2 ?? undefined,
    city: a.city,
    state: a.state,
    zip: String(zip),
    country: "US",
    phone: order.customer_phone ?? undefined,
    email: order.customer_email ?? undefined,
  };
}

async function resolveOrigin(supabase: SupabaseClient, wholesalerId: string | null): Promise<Record<string, string>> {
  if (wholesalerId) {
    const { data: sa } = await supabase
      .from("dd_shipping_accounts")
      .select("pickup_address")
      .eq("wholesaler_id", wholesalerId)
      .eq("is_active", true)
      .maybeSingle();
    const pa = (sa as any)?.pickup_address;
    if (pa?.street1 && pa?.zip) {
      return {
        name: pa.name ?? "Dynasty Direct Supplier",
        company: pa.company ?? undefined,
        street1: pa.street1,
        street2: pa.street2 ?? undefined,
        city: pa.city,
        state: pa.state,
        zip: String(pa.zip),
        country: "US",
        phone: pa.phone ?? undefined,
      };
    }
  }
  const { data: cfg } = await supabase.from("dd_config").select("pickup_address").eq("id", true).maybeSingle();
  const pa = (cfg as any)?.pickup_address ?? {};
  return {
    name: "Dynasty Direct",
    street1: pa.street1 ?? pa.street ?? "PO Box",
    city: pa.city ?? "New York",
    state: pa.state ?? "NY",
    zip: String(pa.zip ?? "11201"),
    country: "US",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const orderId = String(body?.order_id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(orderId)) {
      return new Response(JSON.stringify({ error: "order_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      SERVICE_KEY,
      { auth: { persistSession: false } },
    );

    const { data: order, error: orderErr } = await supabase
      .from("marketplace_orders")
      .select("id, payment_status, fulfillment_status, customer_email, customer_phone, shipping_address")
      .eq("id", orderId)
      .single();
    if (orderErr || !order) throw new Error(`order_not_found: ${orderErr?.message ?? orderId}`);

    if ((order as any).payment_status !== "paid") {
      return new Response(JSON.stringify({ skipped: true, reason: "order_not_paid", payment_status: (order as any).payment_status }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const toAddress = mapToAddress(order);
    if (!toAddress) {
      return new Response(JSON.stringify({ skipped: true, reason: "missing_shipping_address" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: items, error: itemsErr } = await supabase
      .from("marketplace_order_items")
      .select("product_id, qty, price_each, wholesaler_id, products_all(wholesaler_id)")
      .eq("order_id", orderId);
    if (itemsErr) throw new Error(`items_lookup_failed: ${itemsErr.message}`);

    // Group by fulfilling wholesaler
    const groups = new Map<string, Array<{ product_id: string; quantity: number }>>();
    for (const it of items ?? []) {
      const wid = (it as any).wholesaler_id ?? (it as any).products_all?.wholesaler_id ?? null;
      const key = wid ?? "platform";
      const arr = groups.get(key) ?? [];
      arr.push({ product_id: (it as any).product_id, quantity: Number((it as any).qty) || 1 });
      groups.set(key, arr);
    }

    const results: any[] = [];

    for (const [key, groupItems] of groups) {
      const wholesalerId = key === "platform" ? null : key;
      const result: any = { wholesaler_id: wholesalerId, items: groupItems.length };

      try {
        // Idempotency — already has a purchased label?
        let existingQ = supabase
          .from("dd_shipments")
          .select("id, label_status, tracking_number")
          .eq("order_id", orderId)
          .eq("label_status", "purchased");
        existingQ = wholesalerId ? existingQ.eq("wholesaler_id", wholesalerId) : existingQ.is("wholesaler_id", null);
        const { data: existing } = await existingQ.maybeSingle();

        if (existing) {
          result.skipped = "label_already_purchased";
          result.tracking_number = (existing as any).tracking_number;
          results.push(result);
          continue;
        }

        const fromAddress = await resolveOrigin(supabase, wholesalerId);

        // 1) Buy prepaid label
        const ship = await callFn("dd-create-shipment", {
          order_id: orderId,
          wholesaler_id: wholesalerId,
          items: groupItems,
          to_address: toAddress,
          from_address: fromAddress,
        });
        result.shipment = { ok: ship.ok, status: ship.status, tracking: ship.body?.tracking_number ?? null, carrier: ship.body?.carrier ?? null };
        if (!ship.ok) {
          result.error = `create-shipment failed [${ship.status}]: ${JSON.stringify(ship.body).slice(0, 300)}`;
          results.push(result);
          continue;
        }

        // 2) Record on marketplace_fulfillments (wholesaler portal reads this)
        const fulfillmentRow = {
          order_id: orderId,
          wholesaler_id: wholesalerId,
          status: "processing",
          shipping_label_url: ship.body?.label_url ?? null,
          tracking_number: ship.body?.tracking_number ?? null,
          carrier: ship.body?.carrier ?? null,
          items_snapshot: groupItems,
          easypost_shipment_id: ship.body?.shipment_id ?? null,
          shipping_mode: "prepaid_label",
          updated_at: new Date().toISOString(),
        };
        const { data: existingFf } = await supabase
          .from("marketplace_fulfillments")
          .select("id")
          .eq("order_id", orderId)
          .eq("wholesaler_id", wholesalerId)
          .maybeSingle();
        if (existingFf) {
          await supabase.from("marketplace_fulfillments").update(fulfillmentRow).eq("id", (existingFf as any).id);
        } else {
          await supabase.from("marketplace_fulfillments").insert(fulfillmentRow);
        }

        // 3) Notify supplier (email with order, ship-to, label link)
        const notify = await callFn("dd-notify-supplier-order", { order_id: orderId, wholesaler_id: wholesalerId });
        result.notify = { ok: notify.ok, status: notify.status };

        // 4) Auto-schedule carrier pickup for next business day
        const pickup = await callFn("dd-schedule-pickup", { order_id: orderId, pickup_date: nextBusinessDay() });
        result.pickup = { ok: pickup.ok, status: pickup.status, pickup_id: pickup.body?.pickup_id ?? null };

        // 5) Order-level status
        await supabase.from("marketplace_orders").update({ fulfillment_status: "processing" }).eq("id", orderId);

        result.ok = true;
      } catch (e) {
        result.error = e instanceof Error ? e.message : String(e);
        console.error(`[dd-order-fulfillment-kickoff] group ${key} failed:`, result.error);
      }
      results.push(result);
    }

    const anyOk = results.some((r) => r.ok || r.skipped);
    console.log(`[dd-order-fulfillment-kickoff] order=${orderId} groups=${results.length} ok=${results.filter((r) => r.ok).length}`);
    return new Response(JSON.stringify({ order_id: orderId, any_ok: anyOk, results }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[dd-order-fulfillment-kickoff] ERROR:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
