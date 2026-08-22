import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSms } from "../_shared/sendSms.ts";

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
    const body = await req.json();

    // Expected payload from Make.com webhook:
    // { order_id, line_items, total_price, customer_email, customer_name, ref_code, customer_state }
    const {
      order_id,
      line_items,
      total_price,
      customer_email,
      customer_name,
      ref_code,
      customer_state,
      source,
    } = body;

    if (!ref_code) {
      return new Response(
        JSON.stringify({ error: "No referral code provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!order_id || !total_price) {
      return new Response(
        JSON.stringify({ error: "Missing order_id or total_price" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Look up ambassador by referral code
    const { data: ambassador, error: ambError } = await supabase
      .from("ambassadors")
      .select("id, user_id, full_name, phone, commission_rate, total_earnings, total_sales, tier")
      .eq("referral_code", ref_code)
      .eq("status", "active")
      .single();

    if (ambError || !ambassador) {
      return new Response(
        JSON.stringify({ error: "Ambassador not found or inactive", ref_code }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Check for duplicate order
    const { data: existing } = await supabase
      .from("ambassador_sales")
      .select("id")
      .eq("order_id", order_id)
      .eq("ambassador_id", ambassador.id)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ message: "Sale already recorded", order_id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Calculate commission based on tier rate
    const saleAmount = Number(total_price);
    const commissionRate = ambassador.commission_rate || 15;
    const commissionAmount = Math.round(saleAmount * (commissionRate / 100) * 100) / 100;

    // Build product name from line items
    const productName = Array.isArray(line_items)
      ? line_items.map((i: any) => i.title || i.name).filter(Boolean).join(", ")
      : "Shopify Order";

    // 4. Insert sale record
    const { error: saleError } = await supabase
      .from("ambassador_sales")
      .insert({
        ambassador_id: ambassador.id,
        order_id: String(order_id),
        product_name: productName.substring(0, 255),
        sale_amount: saleAmount,
        commission_amount: commissionAmount,
        status: "pending",
        customer_state: customer_state || null,
        source: source || "direct",
      });

    if (saleError) {
      console.error("Failed to insert sale:", saleError);
      return new Response(
        JSON.stringify({ error: "Failed to record sale", details: saleError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Update ambassador totals
    const newTotalEarnings = (ambassador.total_earnings || 0) + commissionAmount;
    const newTotalSales = (ambassador.total_sales || 0) + 1;

    // Determine tier based on earnings
    let newTier = "starter";
    if (newTotalEarnings >= 10000) newTier = "legend";
    else if (newTotalEarnings >= 2500) newTier = "elite";
    else if (newTotalEarnings >= 500) newTier = "rising";

    // Update commission rate based on tier
    const tierRates: Record<string, number> = {
      starter: 15,
      rising: 17,
      elite: 20,
      legend: 22,
    };

    await supabase
      .from("ambassadors")
      .update({
        total_earnings: newTotalEarnings,
        total_sales: newTotalSales,
        tier: newTier,
        commission_rate: tierRates[newTier] || 15,
      })
      .eq("id", ambassador.id);

    // 6. Send SMS notification via the send-sms chokepoint (suppression +
    // legal-STOP, idempotency, outbound_messages). Transactional class:
    // commission-earned notice for a sale that already happened.
    // NOTE: sections 1-5 reference ambassador_sales and
    // ambassadors.status/commission_rate/full_name — a schema that lives in
    // UT's own backend project, not Nexus. This function cannot currently
    // succeed in Nexus. See docs/comms/AMBASSADOR-SMS-CONVERSION-2026-08-22.md.
    // Do not "repair" by pointing at Nexus's ambassadors table — same name,
    // different entity (Grabba/dispatch ambassadors).
    const fromNumber = Deno.env.get("TWILIO_FROM_NUMBER");

    let smsSent = false;

    if (fromNumber && ambassador.phone) {
      const smsBody = `🎉 You just earned $${commissionAmount.toFixed(2)} commission from a sale! Your total earnings: $${newTotalEarnings.toFixed(2)}. Check your dashboard: https://unforgettable-times-usa.myshopify.com/ambassador/dashboard`;

      const sms = await sendSms({
        to: ambassador.phone,
        body: smsBody,
        from: fromNumber,
        idempotencyKey: `amb-sale-${order_id}-${ambassador.id}`,
        sendClass: "transactional",
        skipCooldown: true,
        purpose: "ambassador_sale_commission",
        metadata: { order_id, ambassador_id: ambassador.id },
      });

      smsSent = sms.success;
      if (!sms.success) {
        // blocked (suppression/STOP) and failed both land here; the
        // outbound_messages row written by send-sms carries the reason.
        console.error("SMS via send-sms:", sms.status, sms.errorMessage);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        ambassador_id: ambassador.id,
        ambassador_name: ambassador.full_name,
        order_id,
        sale_amount: saleAmount,
        commission_amount: commissionAmount,
        commission_rate: commissionRate,
        new_tier: newTier,
        sms_sent: smsSent,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", message: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
