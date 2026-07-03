// Dynasty Clipper Nation — public click tracker.
// GET /functions/v1/track-click?business=gasmask&code=abc12345
// Resolves the clipper_assignment, records a click row in clipper_conversions,
// and 302-redirects the visitor to the campaign's real landing page.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const FALLBACK_URL = "https://dynastyclipper.io";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function redirect(url: string): Response {
  return new Response(null, {
    status: 302,
    headers: { ...corsHeaders, Location: url, "Cache-Control": "no-store" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const business = (url.searchParams.get("business") || "").trim().toLowerCase();
    const code = (url.searchParams.get("code") || "").trim();

    if (!business || !code || !/^[a-z0-9_-]+$/.test(business) || !/^[a-f0-9]{4,64}$/i.test(code)) {
      return redirect(FALLBACK_URL);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const fullLink = `https://dynastyclipper.io/go/${business}/${code}`;

    // 1. Find the assignment by the code suffix on tracking_link.
    const { data: assignments, error: aErr } = await (supabase as any)
      .from("clipper_assignments")
      .select(`
        id,
        clipper_id,
        campaign_id,
        tracking_link,
        clipper_campaigns:campaign_id ( tracking_base_url, dynasty_business )
      `)
      .ilike("tracking_link", `%/${code}`)
      .limit(1);

    if (aErr) console.error("[track-click] lookup error", aErr);

    const assignment = assignments?.[0];
    if (!assignment) {
      console.warn("[track-click] no assignment for", { business, code });
      return redirect(FALLBACK_URL);
    }

    // 2. Record the click. Conversion value is filled in later by record-conversion.
    const { error: iErr } = await (supabase as any)
      .from("clipper_conversions")
      .insert({
        clipper_id: assignment.clipper_id,
        campaign_id: assignment.campaign_id,
        tracking_link: fullLink,
        converted_at: new Date().toISOString(),
        order_value: null,
        commission_amount: null,
      });

    if (iErr) console.error("[track-click] insert error", iErr);

    // 3. Redirect to the campaign's real landing page.
    const dest =
      (assignment as any).clipper_campaigns?.tracking_base_url || FALLBACK_URL;
    return redirect(dest);
  } catch (e) {
    console.error("[track-click] fatal", e);
    return redirect(FALLBACK_URL);
  }
});
