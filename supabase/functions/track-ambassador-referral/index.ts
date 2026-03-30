// CRITICAL: This function ONLY writes to ut_ambassador_referrals + unforgettable_ambassadors
// Do NOT use global ambassador tables
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.22.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TrackSchema = z.object({
  referral_code: z.string().min(1),
  business_slug: z.string().default("unforgettable-times"),
  landing_page: z.string().optional(),
  visitor_session_id: z.string().optional(),
  lead_name: z.string().optional(),
  lead_email: z.string().email().optional().or(z.literal("")),
  lead_phone: z.string().optional(),
  referral_source: z.string().optional(),
  // For conversion events
  event_type: z.enum(["click", "lead", "converted"]).default("click"),
  revenue_amount: z.number().optional(),
  order_id: z.string().optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawText = await req.text();
    let body: unknown = {};
    try { body = JSON.parse(rawText); } catch { body = {}; }

    const parsed = TrackSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      referral_code, business_slug, landing_page, visitor_session_id,
      lead_name, lead_email, lead_phone, referral_source,
      event_type, revenue_amount, order_id,
    } = parsed.data;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Look up ambassador by referral_code
    const { data: ambassador, error: ambErr } = await supabase
      .from("unforgettable_ambassadors")
      .select("id, full_name, commission_rate, total_referrals, total_converted_referrals, total_revenue, total_commissions")
      .eq("referral_code", referral_code)
      .eq("status", "active")
      .maybeSingle();

    if (ambErr || !ambassador) {
      console.warn("Ambassador not found for code:", referral_code);
      return new Response(JSON.stringify({ error: "Ambassador not found or inactive" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate commission if conversion
    let commissionAmount = 0;
    if (event_type === "converted" && revenue_amount) {
      const rate = ambassador.commission_rate || 10;
      commissionAmount = Math.round(revenue_amount * (rate / 100) * 100) / 100;
    }

    // Determine status mapping
    const statusMap: Record<string, string> = {
      click: "clicked",
      lead: "lead",
      converted: "converted",
    };

    // Insert referral record
    const { error: refErr } = await supabase
      .from("ut_ambassador_referrals")
      .insert({
        ambassador_id: ambassador.id,
        referral_code,
        business_slug,
        visitor_session_id: visitor_session_id || null,
        lead_name: lead_name || null,
        lead_email: lead_email || null,
        lead_phone: lead_phone || null,
        referral_source: referral_source || null,
        landing_page: landing_page || null,
        status: statusMap[event_type] || "clicked",
        converted_at: event_type === "converted" ? new Date().toISOString() : null,
        revenue_amount: revenue_amount || 0,
        commission_amount: commissionAmount,
      });

    if (refErr) {
      console.error("Failed to insert referral:", refErr);
      return new Response(JSON.stringify({ error: "Failed to record referral", details: refErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update ambassador aggregate totals
    const updates: Record<string, unknown> = {};

    if (event_type === "click") {
      updates.total_referrals = (ambassador.total_referrals || 0) + 1;
    } else if (event_type === "lead") {
      updates.total_referrals = (ambassador.total_referrals || 0) + 1;
    } else if (event_type === "converted") {
      updates.total_converted_referrals = (ambassador.total_converted_referrals || 0) + 1;
      updates.total_revenue = (ambassador.total_revenue || 0) + (revenue_amount || 0);
      updates.total_commissions = (ambassador.total_commissions || 0) + commissionAmount;
      updates.last_conversion_at = new Date().toISOString();

      // Also update total_earnings and total_sales for backward compatibility
      updates.total_earnings = (ambassador.total_revenue || 0) + commissionAmount;
      updates.total_sales = (ambassador.total_converted_referrals || 0) + 1;
    }

    if (Object.keys(updates).length > 0) {
      await supabase
        .from("unforgettable_ambassadors")
        .update(updates)
        .eq("id", ambassador.id);
    }

    // Send SMS notification for conversions using existing Twilio secrets
    let smsSent = false;
    if (event_type === "converted" && revenue_amount) {
      try {
        await supabase.functions.invoke("ambassador-notify", {
          body: {
            event: "conversion",
            ambassador_id: ambassador.id,
            commission_amount: commissionAmount,
            revenue_amount,
          },
        });
        smsSent = true;
      } catch (e) {
        console.warn("Notification failed:", e);
      }
    }

    console.log(`REFERRAL TRACKED: code=${referral_code} type=${event_type} ambassador=${ambassador.full_name}`);

    return new Response(JSON.stringify({
      success: true,
      ambassador_id: ambassador.id,
      event_type,
      commission_amount: commissionAmount,
      sms_sent: smsSent,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("track-ambassador-referral error:", err);
    return new Response(JSON.stringify({ error: "Internal server error", message: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
