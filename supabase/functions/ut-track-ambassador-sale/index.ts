import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";
import { errText } from "../_shared/errText.ts";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";
const TIER_THRESHOLDS: Record<string, { min: number; rate: number }> = {
  bronze: { min: 0, rate: 0.08 },
  silver: { min: 10, rate: 0.10 },
  gold: { min: 25, rate: 0.12 },
  platinum: { min: 50, rate: 0.15 },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { ref_code, order_id, order_amount } = await req.json();
    if (!ref_code || !order_id || !order_amount) {
      return new Response(JSON.stringify({ error: "ref_code, order_id, order_amount required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Look up ambassador
    const { data: ambassador } = await supabase.from("ut_pub_ambassadors").select("*").eq("ref_code", ref_code).single();
    if (!ambassador) throw new Error("Ambassador not found");

    // Calculate commission based on tier
    const tierData = TIER_THRESHOLDS[ambassador.tier] || TIER_THRESHOLDS.bronze;
    const commissionAmount = Math.round(order_amount * tierData.rate * 100) / 100;

    // Insert referral record. This row IS the commission owed — if it is lost,
    // the ambassador is never paid and nobody finds out.
    const { error: referralErr } = await supabase.from("ut_pub_referrals").insert({
      ambassador_id: ambassador.user_id,
      ref_code,
      order_id,
      commission_rate: tierData.rate,
      commission_amount: commissionAmount,
      status: "pending",
    });
    if (referralErr) throw new Error(`referral write failed for ${ref_code} order ${order_id}: ${errText(referralErr)}`);

    // Update ambassador totals
    const newTotalSales = (ambassador.total_sales || 0) + 1;
    const newTotalEarned = (ambassador.total_earned || 0) + commissionAmount;

    // Check for tier upgrade
    let newTier = ambassador.tier;
    if (newTotalSales >= 50) newTier = "platinum";
    else if (newTotalSales >= 25) newTier = "gold";
    else if (newTotalSales >= 10) newTier = "silver";

    // KNOWN DEFECT — see docs/architecture/known-issues-accumulated-ambassador-totals.md
    // This is a read-modify-write of a running total: racy under concurrent
    // sales, and unrecomputable when a referral row is deleted upstream. The
    // totals should be DERIVED from ut_pub_referrals, not accumulated here.
    // Failing the request on error is the lesser problem, not the fix.
    const { error: totalsErr } = await supabase.from("ut_pub_ambassadors").update({
      total_sales: newTotalSales,
      total_earned: newTotalEarned,
      tier: newTier,
    }).eq("id", ambassador.id);
    if (totalsErr) throw new Error(`ambassador totals write failed for ${ref_code} (referral row committed): ${errText(totalsErr)}`);

    // SMS notification via Twilio connector gateway
    const { data: profile } = await supabase.from("ut_profiles").select("phone").eq("id", ambassador.user_id).single();
    if (profile?.phone) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
      const TWILIO_PHONE = Deno.env.get("TWILIO_PHONE_NUMBER");
      if (LOVABLE_API_KEY && TWILIO_API_KEY && TWILIO_PHONE) {
        await fetch(`${GATEWAY_URL}/Messages.json`, {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "X-Connection-Api-Key": TWILIO_API_KEY, "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            To: profile.phone,
            From: TWILIO_PHONE,
            Body: `💰 You earned $${commissionAmount.toFixed(2)} commission! Total earned: $${newTotalEarned.toFixed(2)}${newTier !== ambassador.tier ? ` 🎉 Upgraded to ${newTier.toUpperCase()} tier!` : ""}`,
          })
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      commission_amount: commissionAmount,
      new_tier: newTier,
      tier_upgraded: newTier !== ambassador.tier,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("track-ambassador-sale error:", errText(error));
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
