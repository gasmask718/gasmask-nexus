import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-shared-secret",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate shared secret
    const secret = req.headers.get("x-shared-secret");
    const expected = Deno.env.get('UT_OS_SHARED_SECRET');
    const ok = !!expected && !!secret && secret === expected;
    if (!ok) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const {
      full_name, email, phone, state, city,
      instagram_handle, tiktok_handle, youtube_handle,
      why_ambassador, follower_range, event_types
    } = body;

    // Check for duplicate
    const { data: existing } = await supabase
      .from("unforgettable_ambassadors")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ error: "Email already exists", code: "DUPLICATE" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate referral code
    const referral_code =
      "UT-" +
      full_name.split(" ")[0].toUpperCase().slice(0, 5) +
      "-" +
      Math.random().toString(36).substring(2, 6).toUpperCase();

    // Insert ambassador
    const { error: insertError } = await supabase
      .from("unforgettable_ambassadors")
      .insert({
        full_name,
        email,
        phone,
        state,
        city,
        instagram_handle,
        tiktok_handle,
        youtube_handle,
        why_ambassador,
        follower_range,
        event_types,
        referral_code,
        status: "pending",
      });

    if (insertError) {
      return new Response(
        JSON.stringify({ error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, referral_code }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
