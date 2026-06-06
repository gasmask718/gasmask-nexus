// Dynasty Direct — Stripe checkout creator (HOSTED + EXPRESS PAY)
// Adapted to the real qalaaroashbggynpvqct schema.
//   products_all       → product_name, retail_price, store_price, inventory_qty, status
//   marketplace_orders → total, subtotal, shipping_cost, tax_amount, customer_email
//   marketplace_order_items → qty, price_each, wholesaler_id
// Reserve RPCs: reserve_marketplace_inventory(product_id, wholesaler_id, qty)
//               release_marketplace_inventory(product_id, wholesaler_id, qty)
// Supplier picker: dd_pick_supplier_for_item(product_id, qty, state, lat, lng)
//
// Webhook contract chosen: PRE-CREATE a pending marketplace_order in this
// function and pass its id in PaymentIntent.metadata.order_id. This mirrors
// the existing hosted path (orders already exist before checkout) and
// dd-stripe-connect-webhook.processSplits() which already keys off
// pi.metadata.order_id. The split engine, geo-routing rows, and fulfillments
// path therefore fire identically for express and hosted orders, with zero
// changes required to the connect webhook.
//
// Key-ready: missing STRIPE_SECRET_KEY → { mode: 'pending' }.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PUBLIC_ORIGIN =
  Deno.env.get("PUBLIC_SITE_ORIGIN") ?? "https://dynastydirect.com";

type ExpressItem = { product_id: string; qty: number };
type ExpressShipping = {
  recipient?: string | null;
  addressLine?: (string | null)[] | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
  lat?: number | null;
  lng?: number | null;
} | null;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Key-ready guard — public site treats { mode: 'pending' } as a soft no-op.
  const stripeKey =
    Deno.env.get("STRIPE_SECRET_KEY_DD") ?? Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) {
    return json({ mode: "pending", error: "stripe_key_not_configured" }, 200);
  }
  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ mode: "pending", error: "invalid_body" }, 400);
  }

  try {
    // ────────────────────────────────────────────────────────────────────
    // EXPRESS PAY
    // ────────────────────────────────────────────────────────────────────
    if (body?.mode === "express_pay") {
      const items = Array.isArray(body.items) ? (body.items as ExpressItem[]) : [];
      if (items.length === 0) throw new Error("no_items");
      if (!body.payment_method_id) throw new Error("missing_payment_method");

      // Server-side price recompute against products_all — never trust client.
      // Express pay from the public surface charges retail_price.
      const ids = items.map((i) => i.product_id);
      const { data: prodRows, error: prodErr } = await supabase
        .from("products_all")
        .select("id, product_name, retail_price, inventory_qty, status")
        .in("id", ids);
      if (prodErr) throw prodErr;
      const byId = new Map((prodRows ?? []).map((p: any) => [p.id, p]));

      // Geo hints for supplier picking
      const shipping: ExpressShipping = body.shipping ?? null;
      const shipState = (shipping?.region ?? "").toString().toUpperCase().slice(0, 2) || null;
      const shipLat = typeof shipping?.lat === "number" ? shipping.lat : null;
      const shipLng = typeof shipping?.lng === "number" ? shipping.lng : null;

      // Pick supplier per item AND reserve inventory. On any failure, release
      // everything we successfully reserved before bubbling the error up.
      const picks: Array<{ product_id: string; wholesaler_id: string; qty: number; unit_cents: number; product_name: string }> = [];
      const reservedForRollback: Array<{ product_id: string; wholesaler_id: string; qty: number }> = [];

      try {
        for (const it of items) {
          const p: any = byId.get(it.product_id);
          if (!p || p.status !== "active") throw new Error(`unavailable:${it.product_id}`);
          const unitCents = Math.round(Number(p.retail_price ?? 0) * 100);
          if (unitCents <= 0) throw new Error(`bad_price:${it.product_id}`);

          // Geo-aware supplier pick (same RPC the hosted path / split engine uses)
          const { data: supplierId, error: pickErr } = await supabase.rpc(
            "dd_pick_supplier_for_item",
            {
              p_product_id: it.product_id,
              p_qty: it.qty,
              p_ship_state: shipState,
              p_ship_lat: shipLat,
              p_ship_lng: shipLng,
            },
          );
          if (pickErr) throw pickErr;
          if (!supplierId) throw new Error(`oversold:${it.product_id}`);

          const { error: resErr } = await supabase.rpc("reserve_marketplace_inventory", {
            p_product_id: it.product_id,
            p_wholesaler_id: supplierId,
            p_qty: it.qty,
          });
          if (resErr) throw new Error(`oversold:${it.product_id}`);

          reservedForRollback.push({
            product_id: it.product_id,
            wholesaler_id: supplierId as string,
            qty: it.qty,
          });
          picks.push({
            product_id: it.product_id,
            wholesaler_id: supplierId as string,
            qty: it.qty,
            unit_cents: unitCents,
            product_name: p.product_name ?? "Dynasty Direct item",
          });
        }
      } catch (e) {
        // Release whatever we DID reserve — never release anything we didn't.
        for (const r of reservedForRollback) {
          await supabase.rpc("release_marketplace_inventory", {
            p_product_id: r.product_id,
            p_wholesaler_id: r.wholesaler_id,
            p_qty: r.qty,
          }).catch(() => {});
        }
        throw e;
      }

      // Amount integrity — recompute from retail_price (cents-safe).
      const subtotalCents = picks.reduce((acc, p) => acc + p.unit_cents * p.qty, 0);
      // Tax & shipping: accept server-passed numbers from the public site so
      // express pay does not silently skip them. Hosted path uses Stripe Tax
      // (automatic_tax), which is not available on a raw PaymentIntent, so the
      // public site must precompute these for express; default 0 is explicit.
      const shippingCents = Math.max(0, Math.round(Number(body.shipping_cost ?? 0) * 100));
      const taxCents = Math.max(0, Math.round(Number(body.tax_amount ?? 0) * 100));
      const amountCents = subtotalCents + shippingCents + taxCents;
      if (amountCents <= 0) throw new Error("zero_total");

      // Resolve user_id (NOT NULL on marketplace_orders).
      // 1) authenticated express pay → claims.sub
      // 2) guest express pay → DD_GUEST_USER_ID env (a real auth.users row that
      //    represents the public-site guest bucket; configure once).
      let userId: string | null = null;
      const authHeader = req.headers.get("Authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const { data: claimRes } = await supabase.auth.getClaims(
          authHeader.replace("Bearer ", ""),
        );
        userId = (claimRes?.claims?.sub as string) ?? null;
      }
      if (!userId) userId = Deno.env.get("DD_GUEST_USER_ID") ?? null;
      if (!userId) {
        // Roll back reserves — we cannot honor the order without a user_id.
        for (const r of reservedForRollback) {
          await supabase.rpc("release_marketplace_inventory", {
            p_product_id: r.product_id,
            p_wholesaler_id: r.wholesaler_id,
            p_qty: r.qty,
          }).catch(() => {});
        }
        throw new Error("guest_user_not_configured");
      }

      // PRE-CREATE pending order (mirrors hosted path; matches connect-webhook
      // expectation that pi.metadata.order_id resolves to an existing order).
      const wholesalerIds = Array.from(new Set(picks.map((p) => p.wholesaler_id)));
      const orderInsert = {
        user_id: userId,
        wholesaler_id: wholesalerIds.length === 1 ? wholesalerIds[0] : null,
        order_type: "customer",
        payment_status: "pending",
        fulfillment_status: "pending",
        subtotal: subtotalCents / 100,
        shipping_cost: shippingCents / 100,
        tax_amount: taxCents / 100,
        total: amountCents / 100,
        customer_email: body.payer?.email ?? null,
        customer_phone: body.payer?.phone ?? null,
        shipping_address: shipping ?? null,
      };

      const { data: orderRow, error: orderErr } = await supabase
        .from("marketplace_orders")
        .insert(orderInsert)
        .select("id")
        .single();
      if (orderErr || !orderRow) {
        for (const r of reservedForRollback) {
          await supabase.rpc("release_marketplace_inventory", {
            p_product_id: r.product_id,
            p_wholesaler_id: r.wholesaler_id,
            p_qty: r.qty,
          }).catch(() => {});
        }
        throw orderErr ?? new Error("order_insert_failed");
      }
      const orderId = orderRow.id as string;

      // Item rows
      const { error: itemsErr } = await supabase.from("marketplace_order_items").insert(
        picks.map((p) => ({
          order_id: orderId,
          product_id: p.product_id,
          wholesaler_id: p.wholesaler_id,
          qty: p.qty,
          price_each: p.unit_cents / 100,
        })),
      );
      if (itemsErr) {
        // Roll back reserves + the order row
        for (const r of reservedForRollback) {
          await supabase.rpc("release_marketplace_inventory", {
            p_product_id: r.product_id,
            p_wholesaler_id: r.wholesaler_id,
            p_qty: r.qty,
          }).catch(() => {});
        }
        await supabase.from("marketplace_orders").delete().eq("id", orderId);
        throw itemsErr;
      }

      // Confirm the PaymentIntent so Apple/Google Pay flows resolve in one round-trip.
      const intent = await stripe.paymentIntents.create({
        amount: amountCents,
        currency: "usd",
        payment_method: body.payment_method_id,
        confirmation_method: "automatic",
        confirm: true,
        metadata: {
          order_id: orderId,
          source: "dd_public",
          channel: "express_pay",
          surface: body.surface ?? "cart",
        },
        shipping: shipping
          ? {
              name: body.payer?.name ?? shipping.recipient ?? "Express Pay",
              address: {
                line1: shipping.addressLine?.[0] ?? "",
                line2: shipping.addressLine?.[1] ?? "",
                city: shipping.city ?? "",
                state: shipping.region ?? "",
                postal_code: shipping.postalCode ?? "",
                country: shipping.country ?? "US",
              },
            }
          : undefined,
      });

      // Stash the intent id on the order so the webhook (which keys by
      // metadata.order_id) and our admin UIs share the same handle.
      await supabase
        .from("marketplace_orders")
        .update({ stripe_payment_intent_id: intent.id })
        .eq("id", orderId);

      return json({
        mode: "live",
        order_id: orderId,
        payment_intent_id: intent.id,
        client_secret: intent.client_secret,
        status: intent.status,
      });
    }

    // ────────────────────────────────────────────────────────────────────
    // HOSTED CHECKOUT (existing path, schema-corrected)
    // ────────────────────────────────────────────────────────────────────
    const orderId: string | undefined = body?.order_id;
    if (!orderId) throw new Error("order_id required");

    const { data: order, error: oErr } = await supabase
      .from("marketplace_orders")
      .select(
        "id, total, subtotal, shipping_cost, tax_amount, customer_email, payment_status",
      )
      .eq("id", orderId)
      .single();
    if (oErr || !order) throw new Error("order_not_found");
    if (order.payment_status === "paid") {
      return json({ error: "Order already paid" }, 400);
    }

    const { data: items } = await supabase
      .from("marketplace_order_items")
      .select("qty, price_each, product:products_all(product_name)")
      .eq("order_id", orderId);

    const lineItems = (items ?? []).map((it: any) => ({
      price_data: {
        currency: "usd",
        product_data: { name: it.product?.product_name ?? "Dynasty Direct item" },
        unit_amount: Math.round(Number(it.price_each) * 100),
        tax_behavior: "exclusive" as const,
      },
      quantity: it.qty ?? 1,
    }));

    if (Number(order.shipping_cost) > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: { name: "Shipping" },
          unit_amount: Math.round(Number(order.shipping_cost) * 100),
          tax_behavior: "exclusive" as const,
        },
        quantity: 1,
      });
    }

    if (lineItems.length === 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: { name: `Dynasty Direct Order ${order.id.slice(0, 8)}` },
          unit_amount: Math.round(Number(order.total) * 100),
          tax_behavior: "exclusive" as const,
        },
        quantity: 1,
      });
    }

    const origin = req.headers.get("origin") || PUBLIC_ORIGIN;
    const email = body?.customer_email || order.customer_email || undefined;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      customer_email: email,
      automatic_tax: { enabled: true },
      success_url: `${origin}/order/${order.id}?paid=true`,
      cancel_url: `${origin}/order/${order.id}?cancelled=true`,
      metadata: { order_id: order.id, source: "dynasty_direct", channel: "hosted_checkout" },
      payment_intent_data: {
        metadata: { order_id: order.id, source: "dynasty_direct", channel: "hosted_checkout" },
      },
      discounts: body?.discount_code ? [{ coupon: body.discount_code }] : undefined,
    });

    await supabase
      .from("marketplace_orders")
      .update({ stripe_payment_intent_id: session.id })
      .eq("id", order.id);

    return json({ mode: "live", url: session.url, session_id: session.id });
  } catch (err: any) {
    console.error("[dd-create-checkout]", err);
    // Graceful: public site treats { mode: 'pending' } as soft no-op.
    return json({ mode: "pending", error: err?.message ?? "unknown" }, 200);
  }
});
