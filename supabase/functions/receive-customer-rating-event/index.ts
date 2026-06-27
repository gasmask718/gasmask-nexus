// Cross-project webhook receiver: Public Site customer_ratings INSERT trigger
// posts here whenever rating <= 2 OR flags is non-empty. We forward to
// admin-notify with event_type=customer_flagged.
//
// Path: Public Site DB trigger -> receive-customer-rating-event -> admin-notify
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      booking_id,
      customer_name,
      rating,
      flags,
      partner_id,
      reason,
    } = body ?? {};

    const flagList: string[] = Array.isArray(flags) ? flags : [];
    const numericRating = typeof rating === "number" ? rating : Number(rating);

    // Only fire if rating <= 2 OR any flags present
    if ((isNaN(numericRating) || numericRating > 2) && flagList.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, skipped: "not_actionable" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const shortId = typeof booking_id === "string" ? booking_id.slice(0, 8) : "UNKNOWN";

    const { error } = await supabase.functions.invoke("admin-notify", {
      body: {
        event_type: "customer_flagged",
        related_id: booking_id,
        related_table: "customer_ratings",
        data: {
          customer_name: customer_name ?? "Unknown",
          rating: numericRating,
          flags: flagList,
          reason: reason ?? flagList.join(", ") || `rating ${numericRating}`,
          booking_id_short: shortId,
          partner_id,
        },
      },
    });

    if (error) throw new Error(error.message);

    return new Response(JSON.stringify({ ok: true, forwarded: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[receive-customer-rating-event] error", err);
    return new Response(
      JSON.stringify({ ok: false, error: err?.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
