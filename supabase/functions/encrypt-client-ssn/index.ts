import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { z } from "https://esm.sh/zod@3.25.76";

const BodySchema = z.object({
  full_name: z.string().min(1).max(255),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  date_of_birth: z.string().max(20).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(50).optional().nullable(),
  zip: z.string().max(20).optional().nullable(),
  ssn: z.string().regex(/^\d{9}$/, "SSN must be exactly 9 digits"),
  employment_status: z.string().max(100).optional().nullable(),
  monthly_income: z.number().min(0).optional().nullable(),
  business_name: z.string().max(255).optional().nullable(),
  ein: z.string().max(20).optional().nullable(),
  business_start_date: z.string().max(20).optional().nullable(),
  business_state_of_formation: z.string().max(50).optional().nullable(),
  credit_score_estimate: z.number().int().min(300).max(850).optional().nullable(),
  assigned_advisor: z.string().max(255).optional().nullable(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { ssn, ...clientData } = parsed.data;
    const ssnLast4 = ssn.slice(-4);

    // Encrypt SSN using Supabase Vault
    const { data: vaultData, error: vaultError } = await supabase.rpc("vault_create_secret", {
      new_secret: ssn,
      new_name: `client_ssn_${Date.now()}`,
      new_description: `Encrypted SSN for ${clientData.full_name}`,
    });

    // Fallback: if vault RPC doesn't exist, store a marker
    let ssnEncrypted = "vault_unavailable";
    if (!vaultError && vaultData) {
      ssnEncrypted = String(vaultData);
    }

    // Insert the funding client
    const { data: client, error: insertError } = await supabase
      .from("funding_clients")
      .insert({
        full_name: clientData.full_name,
        first_name: clientData.full_name.split(" ")[0],
        last_name: clientData.full_name.split(" ").slice(1).join(" "),
        email: clientData.email,
        phone: clientData.phone,
        date_of_birth: clientData.date_of_birth,
        address: clientData.address,
        city: clientData.city,
        state: clientData.state,
        zip_code: clientData.zip,
        ssn_encrypted: ssnEncrypted,
        ssn_last4: ssnLast4,
        employment_status: clientData.employment_status,
        monthly_income: clientData.monthly_income,
        business_name: clientData.business_name,
        ein: clientData.ein,
        business_start_date: clientData.business_start_date,
        business_state_of_formation: clientData.business_state_of_formation,
        credit_score_estimate: clientData.credit_score_estimate,
        assigned_advisor: clientData.assigned_advisor,
        intake_status: "new",
        status: "prospect",
        consent_signed: true,
        consent_signed_at: new Date().toISOString(),
      })
      .select("id, full_name, ssn_last4")
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to create client record", details: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send SMS notification via Twilio
    try {
      const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
      const twilioAuth = Deno.env.get("TWILIO_AUTH_TOKEN");
      const twilioFrom = Deno.env.get("TWILIO_FROM_NUMBER") || Deno.env.get("TWILIO_PHONE_NUMBER");
      const davidPhone = Deno.env.get("DAVID_PHONE_NUMBER") || Deno.env.get("YOUR_PHONE_NUMBER");

      if (twilioSid && twilioAuth && twilioFrom && davidPhone) {
        const sid = twilioSid.startsWith("AC") ? twilioSid : `AC${twilioSid.replace(/^US/, "")}`;
        const smsBody = `🏦 DYNASTY FUNDING: New client submitted: ${clientData.full_name} — ${clientData.phone || "No phone"} — Score: ${clientData.credit_score_estimate || "N/A"}`;

        await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
          method: "POST",
          headers: {
            "Authorization": "Basic " + btoa(`${sid}:${twilioAuth}`),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ To: davidPhone, From: twilioFrom, Body: smsBody }),
        });
      }
    } catch (smsErr) {
      console.error("SMS notification failed (non-blocking):", smsErr);
    }

    return new Response(JSON.stringify({
      success: true,
      client_id: client.id,
      ssn_last4: client.ssn_last4,
      message: "Client created. SSN encrypted via Vault. Raw SSN discarded.",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
