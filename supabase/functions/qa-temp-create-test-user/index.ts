// TEMPORARY QA helper — creates a confirmed non-admin test user. Delete after use.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const { email, password, del } = await req.json();
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  if (del) {
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const u = data.users.find((x) => x.email === email);
    if (u) await admin.auth.admin.deleteUser(u.id);
    return new Response(JSON.stringify({ deleted: !!u }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  return new Response(JSON.stringify({ id: data?.user?.id, error: error?.message }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
