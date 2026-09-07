// DC LEAD → CANONICAL ACCOUNT → POWER DIALER BRIDGE (Option B).
//
// Dynasty Connect leads (dc_unified_leads) cannot be dialed directly: every
// step of the caller workflow after the ring keys on a canonical store_master
// id (Full account tab, numbers-worked completion gate, phone verification,
// DNC disposition). So a lead is MATCHED or PROMOTED into the store book
// FIRST, then handed to the existing dialer-call-list-builder (preset
// store_ids), which owns campaign creation, suppression and the queue insert.
//
// Nothing here is bulk: the operator passes an explicit list of leads.
//
// Dedupe order (audited): normalized last-10 phone → normalized address →
// name + city + state. The unified lead view exposes NO street address, so
// the address step reports as unavailable rather than silently passing.
//
// Idempotent: dc_lead_store_links is unique on (source_table, lead_id); a
// re-run reuses the existing account instead of creating another one.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const GRABBA_BUSINESS_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const GASMASK_BUSINESS_ID = "c3d4e5f6-a7b8-9012-cdef-123456789012";
const FAMILY_BUSINESS_IDS = [GRABBA_BUSINESS_ID, GASMASK_BUSINESS_ID];

// The canonical account layer (store book) is the GasMask/Grabba family only.
// Leads from other verticals have no canonical account layer to be promoted
// into — they are rejected, never misfiled into the store book.
const SUPPORTED_UNITS: Record<string, string> = {
  gasmask: GASMASK_BUSINESS_ID,
};

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const digits = (p?: string | null) => (p || "").replace(/\D/g, "");
const last10 = (p?: string | null) => digits(p).slice(-10);
const toE164 = (p?: string | null): string | null => {
  const d = digits(p);
  const t = d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
  return t.length === 10 ? `+1${t}` : null;
};
const normText = (s?: string | null) =>
  (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

interface LeadKey { lead_id: string; source_table: string }

interface Outcome {
  lead_id: string;
  source_table: string;
  lead_name: string | null;
  phone: string | null;
  status: "linked" | "created" | "already_linked" | "rejected";
  matched_by?: string;
  store_id?: string;
  contact_id?: string;
  reason?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── JWT + role gate (same shape as dialer-call-list-builder) ──
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return json({ error: "auth_required" }, 401);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return json({ error: "invalid_token" }, 401);
    const { data: roleRows } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id);
    const roleSet = new Set((roleRows || []).map((r: any) => r.role));
    const isStaff = ["admin", "owner", "ceo", "staff", "employee", "csr", "manager"]
      .some((r) => roleSet.has(r));
    if (!isStaff) return json({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = (body.action as string) || "preview";
    const leadKeys: LeadKey[] = Array.isArray(body.leads) ? body.leads : [];
    if (leadKeys.length === 0) return json({ error: "leads_required" }, 400);
    if (leadKeys.length > 100) return json({ error: "too_many_leads", max: 100 }, 400);

    // ── Load the selected leads only ──
    const ids = [...new Set(leadKeys.map((l) => l.lead_id))];
    const { data: leadRows, error: leadErr } = await supabase
      .from("dc_unified_leads")
      .select("lead_id,source_table,business_unit_key,lead_name,contact_name,phone,email,city,state,notes,compliance_hold,phone_invalid")
      .in("lead_id", ids);
    if (leadErr) throw new Error(`leads: ${leadErr.message}`);
    const leadByKey = new Map<string, any>();
    for (const r of leadRows || []) leadByKey.set(`${r.source_table}|${r.lead_id}`, r);

    // ── Suppression sets (dnc + opt-outs, last-10 normalized) ──
    const [{ data: dncRows }, { data: optRows }] = await Promise.all([
      supabase.from("dnc_list").select("phone_last10"),
      supabase.from("opt_out_events").select("phone_last10"),
    ]);
    const suppressed = new Set<string>(
      [...(dncRows || []), ...(optRows || [])].map((r: any) => r.phone_last10).filter(Boolean),
    );

    // ── Existing links (idempotency) ──
    const { data: linkRows } = await supabase
      .from("dc_lead_store_links")
      .select("lead_id,source_table,store_id,contact_id,matched_by,match_status")
      .in("lead_id", ids);
    const linkByKey = new Map<string, any>();
    for (const r of linkRows || []) linkByKey.set(`${r.source_table}|${r.lead_id}`, r);

    const outcomes: Outcome[] = [];
    const resolvedStoreIds: string[] = [];

    for (const key of leadKeys) {
      const k = `${key.source_table}|${key.lead_id}`;
      const lead = leadByKey.get(k);
      const base = {
        lead_id: key.lead_id,
        source_table: key.source_table,
        lead_name: lead?.lead_name ?? null,
        phone: lead?.phone ?? null,
      };

      if (!lead) { outcomes.push({ ...base, status: "rejected", reason: "lead_not_found" }); continue; }

      const businessId = SUPPORTED_UNITS[lead.business_unit_key];
      if (!businessId) {
        outcomes.push({ ...base, status: "rejected", reason: `unsupported_business_unit:${lead.business_unit_key} — no canonical account layer` });
        continue;
      }
      if (lead.compliance_hold) { outcomes.push({ ...base, status: "rejected", reason: "compliance_hold" }); continue; }
      if (lead.phone_invalid) { outcomes.push({ ...base, status: "rejected", reason: "phone_invalid" }); continue; }

      const e164 = toE164(lead.phone);
      if (!e164) { outcomes.push({ ...base, status: "rejected", reason: "no_usable_phone" }); continue; }
      const l10 = last10(e164);
      if (suppressed.has(l10)) { outcomes.push({ ...base, status: "rejected", reason: "suppressed_dnc_or_optout" }); continue; }

      // ── Idempotency: existing mapping wins ──
      const existing = linkByKey.get(k);
      if (existing) {
        outcomes.push({
          ...base, status: "already_linked", matched_by: existing.matched_by,
          store_id: existing.store_id, contact_id: existing.contact_id ?? undefined,
        });
        resolvedStoreIds.push(existing.store_id);
        continue;
      }

      // ── 1. normalized last-10 phone ──
      let matchedBy: string | null = null;
      let store: any = null;
      const { data: phoneMatch } = await supabase
        .from("store_master")
        .select("id,store_name,business_id")
        .eq("phone_last10", l10)
        .in("business_id", FAMILY_BUSINESS_IDS)
        .is("deleted_at", null)
        .limit(2);
      if (phoneMatch && phoneMatch.length === 1) { store = phoneMatch[0]; matchedBy = "phone_last10"; }
      else if (phoneMatch && phoneMatch.length > 1) {
        outcomes.push({ ...base, status: "rejected", reason: "ambiguous_phone_match — resolve by hand" });
        continue;
      }

      // ── 2. normalized address — unavailable: dc_unified_leads exposes none ──

      // ── 3. name + city + state ──
      if (!store && lead.lead_name && lead.city && lead.state) {
        const { data: nameMatches } = await supabase
          .from("store_master")
          .select("id,store_name,city,state,business_id")
          .in("business_id", FAMILY_BUSINESS_IDS)
          .is("deleted_at", null)
          .ilike("store_name", lead.lead_name.trim())
          .limit(10);
        const hits = (nameMatches || []).filter(
          (s: any) => normText(s.city) === normText(lead.city) &&
            normText(s.state) === normText(lead.state),
        );
        if (hits.length === 1) { store = hits[0]; matchedBy = "name_city_state"; }
        else if (hits.length > 1) {
          outcomes.push({ ...base, status: "rejected", reason: "ambiguous_name_match — resolve by hand" });
          continue;
        }
      }

      if (action === "preview") {
        outcomes.push({
          ...base,
          status: store ? "linked" : "created",
          matched_by: matchedBy || "created",
          store_id: store?.id,
        });
        if (store?.id) resolvedStoreIds.push(store.id);
        continue;
      }

      // ── Promote: create the minimum canonical account only when nothing matched ──
      let created = false;
      if (!store) {
        const provenance = `[PROMOTED FROM DYNASTY CONNECT LEAD ${lead.lead_id} · source ${lead.source_table} · ${new Date().toISOString().slice(0, 10)}]`;
        const { data: newStore, error: insErr } = await supabase
          .from("store_master")
          .insert({
            store_name: lead.lead_name || lead.contact_name || "Unnamed lead",
            address: "",            // unknown — never invented
            city: lead.city || "",
            state: lead.state || "",
            zip: "",                // unknown — never invented
            phone: e164,
            contact_name: lead.contact_name || null,
            email: lead.email || null,
            business_id: businessId,
            sourced_at: new Date().toISOString(),
            notes: provenance,
          })
          .select("id,store_name")
          .single();
        if (insErr) {
          outcomes.push({ ...base, status: "rejected", reason: `create_failed: ${insErr.message}` });
          continue;
        }
        store = newStore;
        matchedBy = "created";
        created = true;
      }

      // ── Contact: only add one when this number is not already on the account ──
      let contactId: string | null = null;
      const { data: existingContacts } = await supabase
        .from("store_contacts")
        .select("id,phone")
        .eq("store_id", store.id)
        .is("deleted_at", null);
      const hit = (existingContacts || []).find((c: any) => last10(c.phone) === l10);
      if (hit) contactId = hit.id;
      else {
        const { data: newContact, error: cErr } = await supabase
          .from("store_contacts")
          .insert({
            store_id: store.id,
            name: lead.contact_name || lead.lead_name || "Unnamed contact",
            phone: e164,
            email: lead.email || null,
            is_primary: (existingContacts || []).length === 0,
            source: "dc_lead_promotion",
          })
          .select("id")
          .single();
        if (cErr) {
          outcomes.push({ ...base, status: "rejected", reason: `contact_failed: ${cErr.message}`, store_id: store.id });
          continue;
        }
        contactId = newContact.id;
      }

      const { error: linkErr } = await supabase.from("dc_lead_store_links").insert({
        source_table: lead.source_table,
        lead_id: lead.lead_id,
        business_unit_key: lead.business_unit_key,
        store_id: store.id,
        contact_id: contactId,
        business_id: businessId,
        matched_by: matchedBy,
        match_status: created ? "created" : "linked",
        match_notes: created ? "no canonical match — minimum account created" : `matched existing account ${store.store_name}`,
        created_by: user.id,
      });
      if (linkErr) throw new Error(`link: ${linkErr.message}`);

      outcomes.push({
        ...base,
        status: created ? "created" : "linked",
        matched_by: matchedBy!,
        store_id: store.id,
        contact_id: contactId ?? undefined,
      });
      resolvedStoreIds.push(store.id);
    }

    const counts = {
      selected: leadKeys.length,
      linked: outcomes.filter((o) => o.status === "linked").length,
      created: outcomes.filter((o) => o.status === "created").length,
      already_linked: outcomes.filter((o) => o.status === "already_linked").length,
      rejected: outcomes.filter((o) => o.status === "rejected").length,
    };

    if (action === "preview") {
      return json({ action, counts, address_match: "unavailable — dc_unified_leads exposes no street address", outcomes });
    }

    // ── Hand the resolved accounts to the EXISTING queue builder ──
    let queue: any = { queued: 0, skipped: "no_accounts_resolved" };
    const uniqueStores = [...new Set(resolvedStoreIds)];
    if (uniqueStores.length > 0 && body.queue !== false) {
      const { data: built, error: buildErr } = await supabase.functions.invoke(
        "dialer-call-list-builder",
        {
          body: {
            action: "create",
            preset: "store_ids",
            store_ids: uniqueStores,
            business_id: body.business_id && FAMILY_BUSINESS_IDS.includes(body.business_id)
              ? body.business_id
              : GASMASK_BUSINESS_ID,
            name: body.campaign_name,
          },
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      queue = buildErr ? { error: buildErr.message } : built;
    }

    return json({
      action: "promote",
      counts,
      address_match: "unavailable — dc_unified_leads exposes no street address",
      outcomes,
      queue,
    });
  } catch (e) {
    console.error("dc-lead-promote-and-queue error:", e);
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
