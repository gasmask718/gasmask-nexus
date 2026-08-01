// TEMPORARY verification probe for funding_* RLS scoping. Delete after use.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const USA_FUNDING = "e54443eb-5004-4e23-a468-475d12442846";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function mkUser(email: string, password: string) {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`createUser ${email}: ${error.message}`);
  return data.user!.id;
}

async function tokenFor(email: string, password: string) {
  const c = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`signIn ${email}: ${error.message}`);
  return data.session!.access_token;
}

function asUser(token: string) {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

Deno.serve(async () => {
  const stamp = Date.now();
  const pw = `Probe!${stamp}aA1`;
  const selfEmail = `probe-self-${stamp}@example.com`;
  const staffEmail = `probe-staff-${stamp}@example.com`;
  const outsiderEmail = `probe-outsider-${stamp}@example.com`;
  const created: string[] = [];
  let tempClientId: string | null = null;
  let tempFapId: string | null = null;
  let tempDocId: string | null = null;
  const results: Record<string, unknown> = {};

  try {
    // seed a temp funding client owned by the "self" email
    const { data: fc, error: fcErr } = await admin
      .from("funding_clients")
      .insert({ email: selfEmail, first_name: "Probe", last_name: "Self", status: "active" })
      .select("id").single();
    if (fcErr) throw new Error(`seed client: ${fcErr.message}`);
    tempClientId = fc.id;

    const { data: fap } = await admin.from("funding_application_profile")
      .insert({ client_id: tempClientId, legal_business_name: "Probe LLC" }).select("id").single();
    tempFapId = fap?.id ?? null;
    const { data: doc } = await admin.from("funding_client_documents")
      .insert({ client_id: tempClientId, document_type: "probe", file_name: "probe.pdf" }).select("id").single();
    tempDocId = doc?.id ?? null;

    const selfId = await mkUser(selfEmail, pw); created.push(selfId);
    const staffId = await mkUser(staffEmail, pw); created.push(staffId);
    const outsiderId = await mkUser(outsiderEmail, pw); created.push(outsiderId);

    await admin.from("business_members").insert({ business_id: USA_FUNDING, user_id: staffId, role: "va" });

    const totals = {
      clients: (await admin.from("funding_clients").select("id", { count: "exact", head: true })).count,
      fap: (await admin.from("funding_application_profile").select("id", { count: "exact", head: true })).count,
      docs: (await admin.from("funding_client_documents").select("id", { count: "exact", head: true })).count,
    };
    results.service_role_totals = totals;

    for (const [label, email] of [["self", selfEmail], ["staff", staffEmail], ["outsider", outsiderEmail]] as const) {
      const c = asUser(await tokenFor(email, pw));
      const clients = await c.from("funding_clients").select("id,email");
      const faps = await c.from("funding_application_profile").select("id,client_id");
      const docs = await c.from("funding_client_documents").select("id,client_id");
      const ins = await c.from("funding_clients").insert({ email: `x-${label}-${stamp}@example.com`, first_name: "X" }).select("id");
      if (ins.data?.[0]?.id) await admin.from("funding_clients").delete().eq("id", ins.data[0].id);
      const upd = await c.from("funding_clients").update({ notes: `probe-${label}` }).eq("id", tempClientId).select("id");
      results[label] = {
        clients_visible: clients.data?.length ?? 0,
        clients_emails: clients.data?.map((r: any) => r.email) ?? [],
        clients_error: clients.error?.message ?? null,
        fap_visible: faps.data?.length ?? 0,
        docs_visible: docs.data?.length ?? 0,
        insert_client_allowed: (ins.data?.length ?? 0) > 0,
        insert_error: ins.error?.message ?? null,
        update_temp_client_allowed: (upd.data?.length ?? 0) > 0,
      };
    }

    // anonymous
    const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
    const a = await anon.from("funding_clients").select("id");
    results.anonymous = { rows: a.data?.length ?? 0, error: a.error?.message ?? null };

    return new Response(JSON.stringify(results, null, 2), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e), partial: results }, null, 2), { status: 500, headers: { "Content-Type": "application/json" } });
  } finally {
    if (tempDocId) await admin.from("funding_client_documents").delete().eq("id", tempDocId);
    if (tempFapId) await admin.from("funding_application_profile").delete().eq("id", tempFapId);
    if (tempClientId) await admin.from("funding_clients").delete().eq("id", tempClientId);
    for (const id of created) {
      await admin.from("business_members").delete().eq("user_id", id);
      await admin.auth.admin.deleteUser(id);
    }
  }
});
