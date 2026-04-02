import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUREAU_ADDRESSES: Record<string, { name: string; line1: string; city: string; state: string; zip: string }> = {
  Equifax: { name: "Equifax Dispute Department", line1: "PO Box 740256", city: "Atlanta", state: "GA", zip: "30374" },
  Experian: { name: "Experian", line1: "PO Box 4500", city: "Allen", state: "TX", zip: "75013" },
  TransUnion: { name: "TransUnion Consumer Solutions", line1: "PO Box 2000", city: "Chester", state: "PA", zip: "19016" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const POSTGRID_API_KEY = Deno.env.get("POSTGRID_API_KEY");
    if (!POSTGRID_API_KEY) {
      return new Response(JSON.stringify({
        error: true,
        code: "NO_API_KEY",
        message: "PostGrid API key not configured. Add your key in Funding Machine Settings to enable certified mail dispatch.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
    }

    const { letter_content, client_name, client_address, client_city, client_state, client_zip, bureau, mailing_log_id } = await req.json();

    const bureauAddr = BUREAU_ADDRESSES[bureau];
    if (!bureauAddr) throw new Error(`Unknown bureau: ${bureau}`);

    // Call PostGrid Letters API
    const pgRes = await fetch("https://api.postgrid.com/print-mail/v1/letters", {
      method: "POST",
      headers: {
        "x-api-key": POSTGRID_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: {
          firstName: bureauAddr.name,
          addressLine1: bureauAddr.line1,
          city: bureauAddr.city,
          provinceOrState: bureauAddr.state,
          postalOrZip: bureauAddr.zip,
          countryCode: "US",
        },
        from: {
          firstName: client_name,
          addressLine1: client_address,
          city: client_city,
          provinceOrState: client_state,
          postalOrZip: client_zip,
          countryCode: "US",
        },
        html: `<html><body><pre style="font-family: monospace; font-size: 12px; white-space: pre-wrap;">${letter_content}</pre></body></html>`,
        doubleSided: false,
      }),
    });

    const pgData = await pgRes.json();
    if (!pgRes.ok) throw new Error(pgData?.error?.message || "PostGrid API error");

    const letterId = pgData.id;
    const expectedDelivery = pgData.expectedDeliveryDate;

    // Update mailing log
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    await supabase.from("funding_mailing_log").update({
      tracking_number: letterId,
      postgrid_letter_id: letterId,
      delivery_status: "dispatched",
    }).eq("id", mailing_log_id);

    return new Response(JSON.stringify({
      success: true,
      letter_id: letterId,
      expected_delivery: expectedDelivery,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: true, message: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
