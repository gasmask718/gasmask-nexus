// T4 single-use bootstrap. Delete immediately after use.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { password, bootstrap_token } = await req.json();
    if (bootstrap_token !== Deno.env.get("T4_BOOTSTRAP_TOKEN")) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!password || typeof password !== "string" || password.length < 16) {
      return new Response(JSON.stringify({ error: "bad password" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const email = "dev-test@brandarodigital.com";

    // Idempotent: if user exists, reuse; else create.
    let userId: string | null = null;
    const { data: existing } = await admin.auth.admin.listUsers();
    const found = existing?.users?.find((u: any) => u.email === email);
    if (found) {
      userId = found.id;
      await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
      });
      if (error) throw error;
      userId = data.user!.id;
    }

    // Ensure profile row exists
    await admin.from("profiles").upsert({ id: userId, email }, { onConflict: "id" });

    // Ensure developer role
    const { error: roleErr } = await admin
      .from("user_roles")
      .upsert({ user_id: userId, role: "developer" }, { onConflict: "user_id,role" });
    if (roleErr) throw roleErr;

    return new Response(JSON.stringify({ user_id: userId, email }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
