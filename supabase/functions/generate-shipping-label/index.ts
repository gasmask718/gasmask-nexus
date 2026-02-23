import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const userId = claimsData.claims.sub;

    // Service client for writes
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { fulfillment_id } = await req.json();
    if (!fulfillment_id) {
      return new Response(
        JSON.stringify({ error: "fulfillment_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify wholesaler owns this fulfillment
    const { data: profile } = await supabase
      .from("wholesaler_profiles")
      .select("id, warehouse_address, company_name")
      .eq("user_id", userId)
      .single();

    if (!profile) {
      return new Response(
        JSON.stringify({ error: "No wholesaler profile found" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: fulfillment, error: fErr } = await supabase
      .from("marketplace_fulfillments")
      .select("*, order:marketplace_orders(id, shipping_address, total, subtotal)")
      .eq("id", fulfillment_id)
      .eq("wholesaler_id", profile.id)
      .single();

    if (fErr || !fulfillment) {
      return new Response(
        JSON.stringify({ error: "Fulfillment not found or access denied" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (fulfillment.status !== "pending") {
      return new Response(
        JSON.stringify({ error: `Cannot generate label for status: ${fulfillment.status}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Guard: check payment status on parent order
    const order = fulfillment.order;
    if (!order) {
      return new Response(
        JSON.stringify({ error: "Parent order not found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for existing active label (DB trigger also enforces this)
    const { data: existingLabel } = await supabase
      .from("shipping_labels")
      .select("id")
      .eq("fulfillment_id", fulfillment_id)
      .eq("status", "created")
      .maybeSingle();

    if (existingLabel) {
      return new Response(
        JSON.stringify({ error: "An active label already exists for this fulfillment. Void it first." }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ═══════════════════════════════════════════════
    // MOCK LABEL GENERATION
    // Replace this block with Shippo/EasyPost API call
    // ═══════════════════════════════════════════════
    const mockTrackingNumber = `MOCK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const mockLabelUrl = `https://labels.mock-shipping.com/${mockTrackingNumber}.pdf`;
    const mockCarrier = "USPS";
    // ═══════════════════════════════════════════════

    // Insert shipping_labels record (triggers guard + auto-event-log)
    const { error: labelErr } = await supabase
      .from("shipping_labels")
      .insert({
        fulfillment_id,
        wholesaler_id: profile.id,
        order_id: fulfillment.order_id,
        carrier: mockCarrier,
        service: "Priority",
        label_format: "PDF",
        label_url: mockLabelUrl,
        tracking_number: mockTrackingNumber,
        mode: "mock",
        status: "created",
      });

    if (labelErr) throw labelErr;

    // Update fulfillment with label data
    const { error: updateErr } = await supabase
      .from("marketplace_fulfillments")
      .update({
        status: "label_generated",
        shipping_label_url: mockLabelUrl,
        tracking_number: mockTrackingNumber,
        carrier: mockCarrier,
        updated_at: new Date().toISOString(),
      })
      .eq("id", fulfillment_id);

    if (updateErr) throw updateErr;

    return new Response(
      JSON.stringify({
        success: true,
        fulfillment_id,
        tracking_number: mockTrackingNumber,
        label_url: mockLabelUrl,
        carrier: mockCarrier,
        note: "MOCK LABEL — swap for Shippo/EasyPost in production",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
