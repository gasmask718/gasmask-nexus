// TEMPORARY QA helper — deletes the QA test user. Removed after use.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const { user_id } = await req.json();
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { error } = await admin.auth.admin.deleteUser(user_id);
  return new Response(JSON.stringify({ deleted: !error, error: error?.message }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
