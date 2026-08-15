import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";
import { errText } from "../_shared/errText.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { vendor_id } = await req.json();
    if (!vendor_id) return new Response(JSON.stringify({ error: "vendor_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: reviews } = await supabase.from("ut_reviews").select("rating").eq("vendor_id", vendor_id);
    const avgRating = reviews && reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;

    await supabase.from("ut_vendors").update({
      rating: Math.round(avgRating * 100) / 100,
      review_count: reviews?.length || 0,
    }).eq("id", vendor_id);

    return new Response(JSON.stringify({ success: true, rating: avgRating, review_count: reviews?.length || 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("update-vendor-rating error:", errText(error));
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
