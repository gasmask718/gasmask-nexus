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
import { logDdError } from "../_shared/ddAlert.ts";
import { quoteShipping } from "../_shared/ddShipping.ts";

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

/** Resolve an inbound referral code (?ref= / dd_store_ref) to a live affiliate.
 * Only 'active' affiliates earn commission; unknown/pending codes are ignored. */
async function resolveAffiliate(
  supabase: any,
  rawCode: unknown,
): Promise<{ id: string; code: string; commission_rate: number } | null> {
  const code = typeof rawCode === "string" ? rawCode.trim() : "";
  if (!code) return null;
  const { data, error } = await supabase
    .from("dd_affiliates")
    .select("id, code, commission_rate, status")
    .ilike("code", code)
    .maybeSingle();
  if (error || !data || data.status !== "active") return null;
  return {
    id: data.id as string,
    code: data.code as string,
    commission_rate: Number(data.commission_rate) || 0,
  };
}

/** Create the pending commission event for an attributed order. The existing
 * dd_affiliate_lifecycle trigger flips pending→earned on payment and
 * →reversed on refund/failure, so this is the only insert needed. */
async function recordPendingCommission(
  supabase: any,
  affiliate: { id: string; code: string; commission_rate: number },
  orderId: string,
  orderAmount: number,
  meta: Record<string, unknown> = {},
): Promise<void> {
  const amount = Math.max(0, Number(orderAmount) || 0);
  const commission = Math.round(amount * affiliate.commission_rate * 100) / 100;
  const { data: existing } = await supabase
    .from("dd_affiliate_events")
    .select("id")
    .eq("order_id", orderId)
    .eq("kind", "order")
    .maybeSingle();
  if (existing) return; // idempotent — never double-credit an order
  const { error } = await supabase.from("dd_affiliate_events").insert({
    affiliate_id: affiliate.id,
    kind: "order",
    status: "pending",
    order_id: orderId,
    amount,
    commission_rate: affiliate.commission_rate,
    commission_amount: commission,
    meta: { code: affiliate.code, ...meta },
  });
  if (error) console.error("[dd-create-checkout] commission_event_failed", error);
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

  // Health probe — proves the function is running, does no Stripe work.
  if (body?.healthcheck === true) {
    return json({ ok: true, fn: "dd-create-checkout", stripe: "configured" }, 200);
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
      // Express pay from the public surface charges retail (DTC) price.
      // Prefer authoritative dtc_price_b (Dynasty Direct pricing engine),
      // fall back to legacy retail_price for older products not yet repriced.
      const ids = items.map((i) => i.product_id);
      const { data: prodRows, error: prodErr } = await supabase
        .from("products_all")
        .select("id, product_name, retail_price, dtc_price_b, inventory_qty, status")
        .in("id", ids);
      if (prodErr) throw prodErr;
      const byId = new Map((prodRows ?? []).map((p: any) => [p.id, p]));

      // Geo hints for supplier picking
      const shipping: ExpressShipping = body.shipping ?? null;
      const shipState = (shipping?.region ?? "").toString().toUpperCase().slice(0, 2) || null;
      const shipLat = typeof shipping?.lat === "number" ? shipping.lat : null;
      const shipLng = typeof shipping?.lng === "number" ? shipping.lng : null;

      // Resolve campaign routing BEFORE picking suppliers. When the campaign
      // defines a wholesaler SET (dd_campaign_wholesalers), the picker restricts
      // candidates to that set; preferred_wholesaler_id stays as the legacy
      // scalar for backward compatibility.
      let campaignId: string | null = null;
      let campaignWholesalerId: string | null = null;
      const campaignCode: string | null = body?.campaign_code ?? null;
      if (campaignCode) {
        const { data: camp } = await supabase
          .from("dd_campaigns")
          .select("id, preferred_wholesaler_id, status, ends_at")
          .eq("campaign_code", campaignCode)
          .maybeSingle();
        if (camp && camp.status === "active" && (!camp.ends_at || new Date(camp.ends_at) > new Date())) {
          campaignId = camp.id as string;
          campaignWholesalerId = (camp.preferred_wholesaler_id as string | null) ?? null;
        }
      }

      // Pick supplier per item AND reserve inventory. On any failure, release
      // everything we successfully reserved before bubbling the error up.
      const picks: Array<{ product_id: string; wholesaler_id: string; qty: number; unit_cents: number; product_name: string }> = [];
      const reservedForRollback: Array<{ product_id: string; wholesaler_id: string; qty: number }> = [];

      try {
        for (const it of items) {
          const p: any = byId.get(it.product_id);
          if (!p || p.status !== "active") throw new Error(`unavailable:${it.product_id}`);
          const effectiveRetail = Number(p.dtc_price_b) || Number(p.retail_price) || 0;
          let unitCents = Math.round(effectiveRetail * 100);
          if (unitCents <= 0) throw new Error(`bad_price:${it.product_id}`);

          // Flash sale: server-side discount enforcement (never trust client price).
          const { data: fs } = await supabase.rpc("dd_active_flash_sale_for_product", {
            p_product_id: it.product_id,
          });
          const fsRow: any = Array.isArray(fs) ? fs[0] : fs;
          if (fsRow?.discount_pct) {
            const pct = Math.max(0, Math.min(100, Number(fsRow.discount_pct) || 0));
            unitCents = Math.max(0, Math.round(unitCents * (1 - pct / 100)));
          }

          // Geo-aware supplier pick (same RPC the hosted path / split engine uses).
          // p_campaign_id restricts candidates to the campaign's wholesaler set
          // when one exists; different items may land on different set members.
          const { data: pickRows, error: pickErr } = await supabase.rpc(
            "dd_pick_supplier_for_item",
            {
              p_product_id: it.product_id,
              p_qty: it.qty,
              p_ship_state: shipState,
              p_ship_lat: shipLat,
              p_ship_lng: shipLng,
              p_campaign_id: campaignId,
            },
          );
          if (pickErr) throw pickErr;
          const pickRow: any = Array.isArray(pickRows) ? pickRows[0] : pickRows;
          const supplierId: string | null = pickRow?.wholesaler_id ?? null;
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
          try {
            await supabase.rpc("release_marketplace_inventory", {
              p_product_id: r.product_id,
              p_wholesaler_id: r.wholesaler_id,
              p_qty: r.qty,
            });
          } catch (_e) { /* best-effort release */ }
        }
        throw e;
      }

      // Amount integrity — recompute from retail_price (cents-safe).
      const subtotalCents = picks.reduce((acc, p) => acc + p.unit_cents * p.qty, 0);
      // Tax & shipping: accept server-passed numbers from the public site so
      // express pay does not silently skip them. Hosted path uses Stripe Tax
      // (automatic_tax), which is not available on a raw PaymentIntent, so the
      // public site must precompute these for express; default 0 is explicit.
      // Shipping integrity — recompute server-side from the real carrier rate
      // (EasyPost; flat fallback documented in ddShipping.ts). The client-passed
      // shipping_cost is a display hint only: the customer must pay what the
      // prepaid label will actually cost, so the server value wins on mismatch.
      let shippingCents = Math.max(0, Math.round(Number(body.shipping_cost ?? 0) * 100));
      const shipZip = String(shipping?.zipCode ?? shipping?.zip ?? shipping?.postal_code ?? "").trim();
      if (shipZip && picks.length > 0) {
        try {
          const quote = await quoteShipping(
            supabase,
            picks.map((p) => ({ product_id: p.product_id, quantity: p.qty })),
            shipZip,
          );
          const serverCents = Math.round(quote.shipping_cost * 100);
          if (serverCents !== shippingCents) {
            console.log(`[dd-create-checkout] shipping corrected client=${shippingCents} server=${serverCents} source=${quote.source}`);
            shippingCents = serverCents;
          }
        } catch (e) {
          console.error("[dd-create-checkout] shipping recompute failed, keeping client value:", e instanceof Error ? e.message : e);
        }
      }
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
      if (!userId) {
        // Guard: a misconfigured DD_GUEST_USER_ID (e.g. a URL) must fail loudly
        // here rather than as an opaque uuid cast error on the order insert.
        const guestId = Deno.env.get("DD_GUEST_USER_ID") ?? null;
        const isUuid = !!guestId &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(guestId);
        if (guestId && !isUuid) {
          console.error("[dd-create-checkout] DD_GUEST_USER_ID is not a uuid");
        }
        userId = isUuid ? guestId : null;
      }
      if (!userId) {
        // Roll back reserves — we cannot honor the order without a user_id.
        for (const r of reservedForRollback) {
          try {
            await supabase.rpc("release_marketplace_inventory", {
              p_product_id: r.product_id,
              p_wholesaler_id: r.wholesaler_id,
              p_qty: r.qty,
            });
          } catch (_e) { /* best-effort release */ }
        }
        throw new Error("guest_user_not_configured");
      }

      // (campaign routing was resolved above, before supplier picking)



      // Affiliate attribution — the stored ?ref= code travels with the request.
      const expressAffiliate = await resolveAffiliate(
        supabase,
        body?.ref_code ?? body?.referral_code ?? body?.store_ref ?? null,
      );

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
        campaign_id: campaignId,
        campaign_wholesaler_id: campaignWholesalerId,
        affiliate_id: expressAffiliate?.id ?? null,
        affiliate_code: expressAffiliate?.code ?? null,
      };



      const { data: orderRow, error: orderErr } = await supabase
        .from("marketplace_orders")
        .insert(orderInsert)
        .select("id")
        .single();
      if (orderErr || !orderRow) {
        for (const r of reservedForRollback) {
          try {
            await supabase.rpc("release_marketplace_inventory", {
              p_product_id: r.product_id,
              p_wholesaler_id: r.wholesaler_id,
              p_qty: r.qty,
            });
          } catch (_e) { /* best-effort release */ }
        }
        throw orderErr ?? new Error("order_insert_failed");
      }
      const orderId = orderRow.id as string;

      // Pending commission event — lifecycle trigger promotes it on payment.
      if (expressAffiliate) {
        await recordPendingCommission(
          supabase,
          expressAffiliate,
          orderId,
          amountCents / 100,
          { channel: "express_pay" },
        );
      }



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
          try {
            await supabase.rpc("release_marketplace_inventory", {
              p_product_id: r.product_id,
              p_wholesaler_id: r.wholesaler_id,
              p_qty: r.qty,
            });
          } catch (_e) { /* best-effort release */ }
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
        "id, user_id, total, subtotal, shipping_cost, tax_amount, customer_email, payment_status, discount_code, discount_amount, ordering_store_id, order_type",
      )
      .eq("id", orderId)
      .single();
    if (oErr || !order) throw new Error("order_not_found");
    if (order.payment_status === "paid") {
      return json({ error: "Order already paid" }, 400);
    }

    // ── Store account verification gate: unverified stores capped at $2,000.
    const orderTotal = Number(order.total ?? 0);
    const isStoreUser = !!(order as any).ordering_store_id || order.order_type === "store";
    let storeVerified = false;
    if ((order as any).ordering_store_id) {
      const { data: storeRow } = await supabase
        .from("store_accounts")
        .select("identity_verified")
        .eq("id", (order as any).ordering_store_id)
        .maybeSingle();
      storeVerified = !!(storeRow as any)?.identity_verified;
      if (!storeVerified && orderTotal > 2000) {
        return json(
          {
            mode: "pending",
            error: "verification_required",
            message:
              "Orders over $2,000 require store verification. Contact orders@dynastydirect.com to verify your account.",
          },
          400,
        );
      }
    }

    // ── Tiered 3DS: only force bank auth for new customers, large orders,
    // or repeat customers without a clean history. Otherwise let Stripe
    // Radar decide based on real-time risk signals (low friction).
    const userId: string | null = (order as any).user_id ?? null;
    const { count: paidOrderCount } = await supabase
      .from("marketplace_orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId ?? "")
      .eq("payment_status", "paid");
    const isNewCustomer = !userId || (paidOrderCount ?? 0) === 0;

    async function determineThreeDSMode(): Promise<"any" | "automatic"> {
      // TIER 1 — New customers (first order ever) or guest
      if (isNewCustomer) return "any";
      // TIER 2 — Large orders regardless of history
      if (orderTotal >= 500) return "any";
      // TIER 3 — Repeat customer history check
      if (userId) {
        const { data: pastOrders } = await supabase
          .from("marketplace_orders")
          .select("id, fraud_review_flag")
          .eq("user_id", userId)
          .eq("payment_status", "paid")
          .limit(5);
        const hasCleanHistory =
          !!pastOrders &&
          pastOrders.length >= 2 &&
          !pastOrders.some((o: any) => o.fraud_review_flag);
        if (hasCleanHistory) return "automatic";
      }
      // DEFAULT — Radar decides
      return "automatic";
    }

    const threeDSMode: "any" | "automatic" = await determineThreeDSMode();
    const threeDSTier: "new_customer" | "high_value" | "established_customer" =
      isNewCustomer ? "new_customer" : orderTotal >= 500 ? "high_value" : "established_customer";

    // ── Affiliate attribution (hosted). The public site forwards the stored
    // referral code; we resolve it to a live affiliate, stamp the order, and
    // create the pending commission event the lifecycle trigger acts on.
    const hostedAffiliate = await resolveAffiliate(
      supabase,
      body?.ref_code ?? body?.referral_code ?? body?.store_ref ?? null,
    );
    if (hostedAffiliate) {
      const { data: attrRow } = await supabase
        .from("marketplace_orders")
        .select("affiliate_id")
        .eq("id", order.id)
        .maybeSingle();
      if (!attrRow?.affiliate_id) {
        await supabase
          .from("marketplace_orders")
          .update({
            affiliate_id: hostedAffiliate.id,
            affiliate_code: hostedAffiliate.code,
          })
          .eq("id", order.id);
      }
      await recordPendingCommission(
        supabase,
        hostedAffiliate,
        order.id,
        Number(order.total ?? 0),
        { channel: "hosted_checkout" },
      );
    }

    // Stamp campaign on the existing order if a campaign_code was passed.

    const hostedCampaignCode: string | null = body?.campaign_code ?? null;
    if (hostedCampaignCode) {
      const { data: camp } = await supabase
        .from("dd_campaigns")
        .select("id, preferred_wholesaler_id, status, ends_at")
        .eq("campaign_code", hostedCampaignCode)
        .maybeSingle();
      if (camp && camp.status === "active" && (!camp.ends_at || new Date(camp.ends_at) > new Date())) {
        await supabase
          .from("marketplace_orders")
          .update({
            campaign_id: camp.id,
            campaign_wholesaler_id: camp.preferred_wholesaler_id ?? null,
          })
          .eq("id", order.id);
      }
    }


    const { data: items } = await supabase
      .from("marketplace_order_items")
      .select("product_id, qty, price_each, product:products_all(product_name)")
      .eq("order_id", orderId);

    const lineItems: any[] = [];
    for (const it of (items ?? []) as any[]) {
      let unitCents = Math.round(Number(it.price_each) * 100);
      // Flash sale: server-side enforcement on hosted path too.
      if (it.product_id) {
        const { data: fs } = await supabase.rpc("dd_active_flash_sale_for_product", {
          p_product_id: it.product_id,
        });
        const fsRow: any = Array.isArray(fs) ? fs[0] : fs;
        if (fsRow?.discount_pct) {
          const pct = Math.max(0, Math.min(100, Number(fsRow.discount_pct) || 0));
          unitCents = Math.max(0, Math.round(unitCents * (1 - pct / 100)));
        }
      }
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: { name: it.product?.product_name ?? "Dynasty Direct item" },
          unit_amount: unitCents,
          tax_behavior: "exclusive" as const,
        },
        quantity: it.qty ?? 1,
      });
    }

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

    // ── Discount: validate against public.discounts (never trust the client
    // for the amount). Persist code+amount on the order, then mint a one-off
    // Stripe coupon so the displayed total matches the charged total.
    let stripeDiscounts: Array<{ coupon: string }> | undefined;
    const submittedCode: string | undefined =
      body?.discount_code || order.discount_code || undefined;
    const subtotalForDiscount = Number(order.subtotal ?? 0);
    if (submittedCode && subtotalForDiscount > 0) {
      const { data: v, error: vErr } = await supabase.rpc("validate_discount_code", {
        p_code: submittedCode,
        p_subtotal: subtotalForDiscount,
      });
      const result: any = v;
      if (!vErr && result?.valid) {
        const amt = Number(result.discount_amount ?? 0);
        if (amt > 0) {
          await supabase
            .from("marketplace_orders")
            .update({ discount_code: result.code, discount_amount: amt })
            .eq("id", order.id);
          const coupon = await stripe.coupons.create({
            amount_off: Math.round(amt * 100),
            currency: "usd",
            duration: "once",
            name: `Code ${result.code}`,
          });
          stripeDiscounts = [{ coupon: coupon.id }];
        }
      } else if (body?.discount_code) {
        return json(
          { mode: "pending", error: result?.message ?? "invalid_discount_code" },
          400,
        );
      }
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
      payment_method_options: {
        card: { request_three_d_secure: threeDSMode },
      },
      metadata: {
        order_id: order.id,
        source: "dynasty_direct",
        channel: "hosted_checkout",
        three_ds_requested: threeDSMode,
        three_ds_tier: threeDSTier,
        order_total: orderTotal.toString(),
        is_store_user: isStoreUser.toString(),
      },
      payment_intent_data: {
        metadata: {
          order_id: order.id,
          source: "dynasty_direct",
          channel: "hosted_checkout",
          three_ds_requested: threeDSMode,
          three_ds_tier: threeDSTier,
          order_total: orderTotal.toString(),
          is_store_user: isStoreUser.toString(),
        },
      },
      discounts: stripeDiscounts,
    });

    await supabase
      .from("marketplace_orders")
      .update({ stripe_payment_intent_id: session.id })
      .eq("id", order.id);

    return json({ mode: "live", url: session.url, session_id: session.id });
  } catch (err: any) {
    console.error("[dd-create-checkout]", err);
    await logDdError({
      source: "dd-create-checkout",
      message: err?.message ?? "unknown",
      context: { mode: body?.mode ?? "hosted", item_count: Array.isArray(body?.items) ? body.items.length : null },
    });
    // Graceful: public site treats { mode: 'pending' } as soft no-op.
    return json({ mode: "pending", error: err?.message ?? "unknown" }, 200);
  }

});
