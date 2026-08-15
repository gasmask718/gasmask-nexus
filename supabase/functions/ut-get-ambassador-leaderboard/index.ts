import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";
import { errText } from "../_shared/errText.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const DYNASTY_OS_API_KEY = Deno.env.get("DYNASTY_OS_API_KEY");
    if (!DYNASTY_OS_API_KEY || !authHeader || authHeader !== `Bearer ${DYNASTY_OS_API_KEY}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await supabase.from("dynasty_os_api_logs").insert({ endpoint: "get-ambassador-leaderboard", method: "GET" });

    const { data: ambassadors } = await supabase.from("ut_pub_ambassadors").select("*, ut_profiles(full_name, email)").order("total_earned", { ascending: false }).limit(20);

    return new Response(JSON.stringify({ leaderboard: ambassadors || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("get-ambassador-leaderboard error:", errText(error));
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
