// DD email unsubscribe — HMAC token validation + suppression insert.
// POST { email, ts, sig }   OR  GET ?email=&ts=&sig=
// Token format: sig = hex(HMAC-SHA256(DD_UNSUBSCRIBE_SECRET, `${lower(email)}.${ts}`))
// ts (unix seconds) must be within 90 days; suppression is permanent.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const TTL_SECONDS = 60 * 60 * 24 * 90; // 90 days

async function hmacHex(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const secret = Deno.env.get("SHARED_SECRET");
  if (!secret) {
    return new Response(JSON.stringify({ ok: false, reason: "server_misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let email = "", ts = "", sig = "";
  try {
    if (req.method === "POST") {
      const body = await req.json();
      email = String(body.email ?? "").trim();
      ts = String(body.ts ?? "");
      sig = String(body.sig ?? "");
    } else if (req.method === "GET") {
      const u = new URL(req.url);
      email = (u.searchParams.get("email") ?? "").trim();
      ts = u.searchParams.get("ts") ?? "";
      sig = u.searchParams.get("sig") ?? "";
    } else {
      return new Response(JSON.stringify({ ok: false, reason: "method_not_allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch {
    return new Response(JSON.stringify({ ok: false, reason: "invalid" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const emailLower = email.toLowerCase();
  if (!emailLower || !ts || !sig || emailLower.length > 255) {
    return new Response(JSON.stringify({ ok: false, reason: "invalid" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) {
    return new Response(JSON.stringify({ ok: false, reason: "invalid" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (nowSec - tsNum > TTL_SECONDS) {
    return new Response(JSON.stringify({ ok: false, reason: "expired" }), {
      status: 410,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const expected = await hmacHex(secret, `${emailLower}.${ts}`);
  if (!timingSafeEq(expected, sig.toLowerCase())) {
    return new Response(JSON.stringify({ ok: false, reason: "invalid" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Mark all captures for this email unsubscribed (any source).
  await sb
    .from("email_captures")
    .update({ unsubscribed_at: new Date().toISOString() })
    .ilike("email", emailLower);

  // Permanent suppression — processor checks this before sending.
  const { error: supErr } = await sb
    .from("dd_email_suppressions")
    .upsert(
      { email_lower: emailLower, reason: "unsubscribe", source: "dd-email-unsubscribe" },
      { onConflict: "email_lower" },
    );

  if (supErr) {
    return new Response(JSON.stringify({ ok: false, reason: "db_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
