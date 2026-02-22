import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // POST /marketplace-order-engine?action=create-test-order
    if (req.method === "POST" && action === "create-test-order") {
      const body = await req.json();
      const { customer_email, items } = body;
      // items: [{ product_id, qty }]

      if (!items || !Array.isArray(items) || items.length === 0) {
        return new Response(
          JSON.stringify({ error: "items array required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fetch products to get prices and vendor IDs
      const productIds = items.map((i: any) => i.product_id);
      const { data: products, error: pErr } = await supabase
        .from("products_all")
        .select("id, product_name, wholesale_price, store_price, retail_price, wholesaler_id, inventory_qty")
        .in("id", productIds);

      if (pErr) throw pErr;
      if (!products || products.length === 0) {
        return new Response(
          JSON.stringify({ error: "No valid products found" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const productMap = new Map(products.map((p: any) => [p.id, p]));

      // Build order items with calculated prices
      let subtotal = 0;
      const orderItems: any[] = [];

      for (const item of items) {
        const product = productMap.get(item.product_id);
        if (!product) continue;

        const price = product.wholesale_price || product.store_price || product.retail_price || 0;
        const qty = item.qty || 1;
        const itemSubtotal = price * qty;
        subtotal += itemSubtotal;

        orderItems.push({
          product_id: item.product_id,
          wholesaler_id: product.wholesaler_id,
          qty,
          price_each: price,
        });
      }

      // Create order (use a service-level user_id placeholder for test orders)
      const { data: order, error: oErr } = await supabase
        .from("marketplace_orders")
        .insert({
          user_id: "00000000-0000-0000-0000-000000000000", // test placeholder
          subtotal,
          total: subtotal,
          payment_status: "pending",
          fulfillment_status: "pending",
          order_type: "customer",
          notes: `Test order — ${customer_email || "no-email"}`,
        })
        .select()
        .single();

      if (oErr) throw oErr;

      // Insert order items
      const itemsToInsert = orderItems.map((oi) => ({
        ...oi,
        order_id: order.id,
      }));

      const { error: iErr } = await supabase
        .from("marketplace_order_items")
        .insert(itemsToInsert);

      if (iErr) throw iErr;

      return new Response(
        JSON.stringify({
          success: true,
          order_id: order.id,
          subtotal,
          items_count: orderItems.length,
          vendors_involved: [...new Set(orderItems.map((i) => i.wholesaler_id))],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /marketplace-order-engine?action=mark-paid
    if (req.method === "POST" && action === "mark-paid") {
      const body = await req.json();
      const { order_id } = body;

      if (!order_id) {
        return new Response(
          JSON.stringify({ error: "order_id required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // This triggers the process_paid_order function via the database trigger
      const { error: uErr } = await supabase
        .from("marketplace_orders")
        .update({ payment_status: "paid" })
        .eq("id", order_id);

      if (uErr) throw uErr;

      // Fetch the result
      const { data: order } = await supabase
        .from("marketplace_orders")
        .select("id, payment_status, fulfillment_status, subtotal, total")
        .eq("id", order_id)
        .single();

      const { data: fulfillments } = await supabase
        .from("marketplace_fulfillments")
        .select("*")
        .eq("order_id", order_id);

      const { data: payouts } = await supabase
        .from("wholesaler_payouts")
        .select("*")
        .eq("order_id", order_id);

      return new Response(
        JSON.stringify({
          success: true,
          order,
          fulfillments,
          payouts,
          summary: {
            fulfillments_created: fulfillments?.length || 0,
            payout_entries_created: payouts?.length || 0,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET /marketplace-order-engine?action=vendor-orders&vendor_id=xxx
    if (req.method === "GET" && action === "vendor-orders") {
      const vendorId = url.searchParams.get("vendor_id");
      if (!vendorId) {
        return new Response(
          JSON.stringify({ error: "vendor_id required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase
        .from("marketplace_fulfillments")
        .select(`
          *,
          order:marketplace_orders(id, payment_status, fulfillment_status, subtotal, total, created_at)
        `)
        .eq("wholesaler_id", vendorId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return new Response(
        JSON.stringify({ vendor_id: vendorId, fulfillments: data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET /marketplace-order-engine?action=vendor-payouts&vendor_id=xxx
    if (req.method === "GET" && action === "vendor-payouts") {
      const vendorId = url.searchParams.get("vendor_id");
      if (!vendorId) {
        return new Response(
          JSON.stringify({ error: "vendor_id required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase
        .from("wholesaler_payouts")
        .select("*")
        .eq("wholesaler_id", vendorId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return new Response(
        JSON.stringify({ vendor_id: vendorId, payouts: data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        error: "Unknown action",
        available_actions: [
          "POST ?action=create-test-order  body: { customer_email, items: [{ product_id, qty }] }",
          "POST ?action=mark-paid  body: { order_id }",
          "GET  ?action=vendor-orders&vendor_id=xxx",
          "GET  ?action=vendor-payouts&vendor_id=xxx",
        ],
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
