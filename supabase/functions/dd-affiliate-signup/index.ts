// dd-affiliate-signup — public entry point for the "Become an Affiliate" page.
//
// Supabase requires email confirmation before a session exists, but
// dd_affiliate_self_signup() (the canonical creator, unchanged) needs
// auth.uid(). This function only provisions the account so the browser can
// immediately sign in and call that RPC itself.
//
// - New email  → create a confirmed auth user with the submitted password.
// - Known email→ do nothing (never touch an existing account); caller signs in.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");
    const displayName = String(body?.display_name ?? "").trim();

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return json({ error: "invalid_email" }, 400);
    }
    if (password.length < 8) {
      return json({ error: "password_too_short" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName || null, source: "affiliate_signup" },
    });

    if (createErr) {
      const msg = String(createErr.message ?? "");
      // Existing account: never mutate it — the caller signs in normally.
      if (/already|registered|exists/i.test(msg)) {
        return json({ ok: true, existed: true });
      }
      return json({ error: msg }, 400);
    }

    return json({ ok: true, existed: false, user_id: created.user?.id ?? null });
  } catch (err) {
    console.error("[dd-affiliate-signup]", err);
    return json({ error: (err as Error)?.message ?? "unknown" }, 500);
  }
});
