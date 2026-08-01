// TEMPORARY probe: proves VA tenancy scoping with real authenticated sessions.
// Creates two throwaway VA users (one scoped to GasMask+Brandaro, one with no
// business membership), signs each in, reads the 15 audited tables through
// PostgREST with their real JWTs, then deletes them.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

const GASMASK = "c3d4e5f6-a7b8-9012-cdef-123456789012";

const TABLES = [
  "brandaro_campaigns",
  "call_revenue_attribution",
  "call_revenue_events",
  "comm_provider_audit_log",
  "comm_threads",
  "communication_threads",
  "live_call_sessions",
  "market_lines",
  "ops_inbox_threads",
  "opt_out_events",
  "outbound_messages",
  "store_call_intelligence",
  "store_inventory_leads",
  "store_tube_intel_audit",
  "store_tube_switches",
];

async function probe(token: string | null) {
  const headers: Record<string, string> = { apikey: ANON, "Prefer": "count=exact" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const out: Record<string, string> = {};
  for (const t of TABLES) {
    const r = await fetch(`${URL}/rest/v1/${t}?select=*&limit=0`, { headers });
    if (!r.ok) {
      out[t] = `DENIED(${r.status})`;
    } else {
      const cr = r.headers.get("content-range") ?? "";
      out[t] = `rows=${cr.split("/")[1] ?? "?"}`;
    }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
  const made: string[] = [];
  try {
    const mk = async (tag: string, businesses: string[]) => {
      const email = `rlsprobe.${tag}.${crypto.randomUUID().slice(0, 8)}@example.com`;
      const password = crypto.randomUUID() + "Aa1!";
      const { data, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
      });
      if (error) throw error;
      const uid = data.user!.id;
      made.push(uid);
      await admin.from("user_roles").insert({ user_id: uid, role: "va" });
      for (const b of businesses) {
        await admin.from("business_members").insert({ user_id: uid, business_id: b, role: "va" });
      }
      const pub = createClient(URL, ANON, { auth: { persistSession: false } });
      const { data: s, error: se } = await pub.auth.signInWithPassword({ email, password });
      if (se) throw se;
      return { uid, token: s.session!.access_token };
    };

    const scoped = await mk("scoped", [GASMASK]);
    const orphan = await mk("orphan", []);

    const result = {
      va_member_of_gasmask: await probe(scoped.token),
      va_no_business_membership: await probe(orphan.token),
      anonymous: await probe(null),
    };
    return new Response(JSON.stringify(result, null, 2), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  } finally {
    for (const uid of made) {
      await admin.from("business_members").delete().eq("user_id", uid);
      await admin.from("user_roles").delete().eq("user_id", uid);
      await admin.auth.admin.deleteUser(uid);
    }
  }
});
