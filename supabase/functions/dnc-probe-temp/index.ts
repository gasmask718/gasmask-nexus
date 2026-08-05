// TEMPORARY probe for verifying isOnDNC(). Delete after verification.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { isOnDNC } from "../_shared/dnc.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const phone = url.searchParams.get("phone") || "";

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const result = await isOnDNC(supabase, phone);
  return new Response(JSON.stringify({ phone, result }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
