// TEMPORARY QA harness — mints an admin session server-side and drives the
// clipper approval bridge end to end. Delete after verification.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  try {
    const { admin_email, application_id, decision = "approved", login_base, clipper_email } =
      await req.json();
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    // 1. mint an admin session via magiclink + verifyOtp
    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink", email: admin_email,
    });
    if (linkErr) throw linkErr;
    const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
    const { data: sess, error: otpErr } = await anon.auth.verifyOtp({
      type: "magiclink", token_hash: link.properties.hashed_token,
    });
    if (otpErr) throw otpErr;
    const jwt = sess.session!.access_token;

    // 2. call the real approval function exactly as the OS UI does
    const res = await fetch(`${SUPABASE_URL}/functions/v1/clipper-approve-application`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ANON_KEY,
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({ application_id, decision, login_base }),
    });
    const approval = await res.json();

    // 3. mint a login session for the clipper (proves portal login works)
    let clipper_login: unknown = null;
    if (clipper_email && approval?.success && decision === "approved") {
      const { data: cl, error: clErr } = await admin.auth.admin.generateLink({
        type: "magiclink", email: clipper_email,
      });
      if (clErr) {
        clipper_login = { error: clErr.message };
      } else {
        const c = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
        const { data: cs, error: cErr } = await c.auth.verifyOtp({
          type: "magiclink", token_hash: cl.properties.hashed_token,
        });
        if (cErr) clipper_login = { error: cErr.message };
        else {
          const authed = createClient(SUPABASE_URL, ANON_KEY, {
            global: { headers: { Authorization: `Bearer ${cs.session!.access_token}` } },
            auth: { persistSession: false },
          });
          const { data: acct, error: aErr } = await authed
            .from("clipper_accounts")
            .select("id, full_name, email, status")
            .eq("user_id", cs.user!.id)
            .maybeSingle();
          clipper_login = {
            signed_in_user: cs.user!.id,
            portal_row_visible_to_clipper: acct ?? null,
            rls_error: aErr?.message ?? null,
            session_access_token: cs.session!.access_token.slice(0, 12) + "...",
            refresh_token: cs.session!.refresh_token,
            access_token_full: cs.session!.access_token,
          };
        }
      }
    }

    return new Response(JSON.stringify({ approval_status: res.status, approval, clipper_login }, null, 2), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message) }), { status: 500 });
  }
});
