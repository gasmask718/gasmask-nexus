import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BodySchema = z.object({
  full_name: z.string().min(1).max(255),
  email: z.string().email(),
  phone: z.string().max(30).default(""),
  state: z.string().max(100).default(""),
  referral_source: z.string().optional(),
  motivation: z.string().optional(),
  city: z.string().optional(),
  experience: z.string().optional(),
});

function generateReferralCode(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
  const rand = Math.random().toString(36).slice(2, 8);
  return `ut-${slug}-${rand}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("Incoming UT ambassador submission:", JSON.stringify(body));

    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      console.error("Validation failed:", parsed.error.flatten().fieldErrors);
      return new Response(
        JSON.stringify({ error: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { full_name, email, phone, state, referral_source } = parsed.data;
    const referral_code = generateReferralCode(full_name);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check for duplicate email
    const { data: existing } = await supabase
      .from("unforgettable_ambassadors")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      console.log("Duplicate email detected:", email);
      return new Response(
        JSON.stringify({ error: "An application with this email already exists." }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data, error } = await supabase
      .from("unforgettable_ambassadors")
      .insert({
        full_name,
        email,
        phone: phone || null,
        state: state || null,
        referral_code,
        status: "pending",
        source: referral_source ? `referral:${referral_source}` : "public_form",
      })
      .select()
      .single();

    if (error) {
      console.error("DB insert error:", error);
      throw error;
    }

    console.log("Ambassador created successfully:", data.id);

    return new Response(
      JSON.stringify({ success: true, ambassador: { id: data.id, full_name: data.full_name } }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("submit-ut-ambassador error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
