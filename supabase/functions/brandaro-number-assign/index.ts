import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { target_phone, target_state, business_id, action } = await req.json();

    // Dry run support
    if (action === "dry_run") {
      return new Response(JSON.stringify({ success: true, status: "healthy" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!target_phone) {
      return new Response(
        JSON.stringify({ success: false, error: "target_phone required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract area code from target phone
    const cleaned = target_phone.replace(/\D/g, "");
    const areaCode = cleaned.length >= 10 ? cleaned.slice(cleaned.length - 10, cleaned.length - 7) : null;

    if (!areaCode) {
      return new Response(
        JSON.stringify({ success: false, error: "Cannot extract area code" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call the smart assignment function
    const { data: numberId, error: assignError } = await supabase.rpc(
      "assign_best_number",
      {
        p_target_area_code: areaCode,
        p_target_state: target_state || null,
        p_business_id: business_id || null,
      }
    );

    if (assignError) throw assignError;

    if (!numberId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "No available numbers. All numbers at capacity or in cooldown.",
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the assigned number details
    const { data: numberData, error: fetchError } = await supabase
      .from("brandaro_number_pool")
      .select("*")
      .eq("id", numberId)
      .single();

    if (fetchError) throw fetchError;

    // Bump usage
    await supabase.rpc("bump_number_usage", { p_number_id: numberId });

    const areaCodeMatched = numberData.area_code === areaCode;

    return new Response(
      JSON.stringify({
        success: true,
        number: numberData,
        area_code_matched: areaCodeMatched,
        target_area_code: areaCode,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Number assign error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
