// dd-shipping-quote — real-time shipping rate for checkout.
// The customer pays the actual carrier rate (EasyPost) so the platform can
// buy the prepaid label with that money. Falls back to a documented flat
// rate when EasyPost is unreachable. Read-only: never buys a label.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { quoteShipping } from "../_shared/ddShipping.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const rawItems: any[] = Array.isArray(body?.items) ? body.items : [];
    const toZip = String(body?.to_zip ?? "").trim();

    if (!/^\d{5}(-\d{4})?$/.test(toZip)) {
      return new Response(JSON.stringify({ error: "valid to_zip is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (rawItems.length === 0 || rawItems.length > 50) {
      return new Response(JSON.stringify({ error: "items must be 1-50 entries" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const items = rawItems.map((it: any) => ({
      product_id: String(it?.product_id ?? ""),
      quantity: Math.max(1, Math.min(999, Math.round(Number(it?.quantity ?? it?.qty ?? 1)))),
    }));
    if (items.some((i) => !/^[0-9a-f-]{36}$/i.test(i.product_id))) {
      return new Response(JSON.stringify({ error: "invalid product_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const quote = await quoteShipping(supabase, items, toZip);

    return new Response(JSON.stringify(quote), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[dd-shipping-quote] ERROR:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
