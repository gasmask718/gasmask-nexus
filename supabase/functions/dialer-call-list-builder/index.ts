// DIALER CALL LIST BUILDER — the missing link: store book → campaign → queue.
//
// The power dialer engine only ever dials outbound_call_queue rows for the
// ARMED campaign, but nothing populated that queue from the actual store
// book — the console showed 126 hand-loaded numbers while 1,358 callable
// stores sat in v_store_summary / v_store_who_to_contact.
//
// This function closes that gap:
//
//   presets → live counts for each filterable calling set
//   preview → how many stores a filter yields BEFORE committing
//             ("This list has 255 stores. Start calling?")
//   create  → inserts a dialer_campaigns row and loads
//             outbound_call_queue from it, so the existing engine
//             (arm → power-dialer-tick → human bridge) can dial it.
//
// Calling sets (all drawn from the store book, never a hand-built list):
//   owes_money    v_store_summary owed > 0, biggest balance first
//   needs_product v_restock_alerts (OUT OF STOCK / RESTOCK NOW)
//   lapsed        v_store_summary days_since_last_order > 365
//   never_ordered v_store_summary last_order_date IS NULL (prospects)
//   no_answer     v_store_who_to_contact contacts never successfully reached
//   wave          v_text_campaign segment (A ACTIVE / B SLOWED / C LAPSED / D PROSPECT)
//   area          v_store_summary by corridor / neighborhood / borough
//
// Who to ring: v_store_who_to_contact best-ranked contact per store
// (lowest try_this_first, responsive_by_call preferred), falling back to
// the store's own phone when no contact row exists.
//
// Suppression is applied at BUILD time (dnc_list + opt_out_events, last-10
// normalized) and reported as its own count — and the engine re-checks
// isSuppressed() at dial time, fail-closed. Numbers already sitting in a
// live queue are skipped and reported as already_dialing.
//
// This function only CREATES the campaign + queue. Arming the engine on
// the campaign stays a separate, deliberate operator action.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Grabba R Us is the dialer home for the shared GasMask/Grabba store book
// (all 15 existing dialer campaigns live under it). GasMask is the same
// company; the console shows campaigns from both.
const GRABBA_BUSINESS_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const GASMASK_BUSINESS_ID = "c3d4e5f6-a7b8-9012-cdef-123456789012";
const FAMILY_BUSINESS_IDS = [GRABBA_BUSINESS_ID, GASMASK_BUSINESS_ID];

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const digits = (p: string | null | undefined) => (p || "").replace(/\D/g, "");
const last10 = (p: string | null | undefined) => digits(p).slice(-10);
const toE164 = (p: string | null | undefined): string | null => {
  const d = digits(p);
  const t = d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
  return t.length === 10 ? `+1${t}` : null;
};

// PostgREST caps at 1000 rows — page until exhausted.
async function fetchAll(makeQuery: () => any): Promise<any[]> {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await makeQuery().range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

interface ListEntry {
  store_id: string | null;
  store_name: string;
  contact_id: string | null;
  contact_name: string | null;
  phone: string | null; // E.164
  priority: number;
  reason: string;
  context: string;
}

function contactRank(c: any): number {
  const ttf = typeof c.try_this_first === "number" ? c.try_this_first : 99;
  return ttf * 10 + (c.responsive_by_call ? 0 : 1);
}

// Best ringable contact per store from v_store_who_to_contact.
function bestContactsByStore(contacts: any[]): Map<string, any> {
  const map = new Map<string, any>();
  for (const c of contacts) {
    const e164 = toE164(c.phone);
    if (!e164 || !c.store_id) continue;
    const cur = map.get(c.store_id);
    if (!cur || contactRank(c) < contactRank(cur)) {
      map.set(c.store_id, { ...c, e164 });
    }
  }
  return map;
}

function storeEntry(
  s: any,
  contactsByStore: Map<string, any>,
  priority: number,
  reason: string,
  context: string,
): ListEntry {
  const contact = contactsByStore.get(s.store_id);
  const phone = contact?.e164 || toE164(s.phone) || null;
  return {
    store_id: s.store_id ?? null,
    store_name: s.store_name || "Unknown store",
    contact_id: contact?.contact_id ?? null,
    contact_name: contact?.name || s.contact_name || null,
    phone,
    priority,
    reason,
    context,
  };
}

const WAVE_PRIORITY: Record<string, number> = {
  "A ACTIVE": 85,
  "B SLOWED": 70,
  "C LAPSED": 55,
  "D PROSPECT": 45,
};

function buildEntries(
  preset: string,
  base: { summaries: any[]; alerts: any[]; waves: any[]; contacts: any[] },
  contactsByStore: Map<string, any>,
  opts: { segment?: string; area_field?: string; area_value?: string },
): ListEntry[] {
  const { summaries, alerts, waves, contacts } = base;

  switch (preset) {
    case "owes_money":
      return summaries
        .filter((s) => (s.owed || 0) > 0)
        .sort((a, b) => (b.owed || 0) - (a.owed || 0))
        .map((s) =>
          storeEntry(
            s, contactsByStore,
            50 + Math.min(49, Math.round((s.owed || 0) / 20)),
            "owes_money",
            `Owes $${s.owed} across ${s.open_invoices ?? "?"} invoice(s)${s.oldest_unpaid ? `, oldest ${s.oldest_unpaid}` : ""} · ${s.neighborhood || s.borough || ""}`,
          )
        );

    case "needs_product":
      return alerts
        .sort((a, b) =>
          (a.alert_level === "OUT OF STOCK" ? 0 : 1) - (b.alert_level === "OUT OF STOCK" ? 0 : 1)
          || (b.owed || 0) - (a.owed || 0)
        )
        .map((a) =>
          storeEntry(
            a, contactsByStore,
            a.alert_level === "OUT OF STOCK" ? 95 : 80,
            "needs_product",
            `${a.alert_level} — ${a.product} (on hand ${a.on_hand}, reorder at ${a.reorder_at}, suggest ${a.suggested_order}) · owes $${a.owed || 0} · ${a.neighborhood || a.borough || ""}`,
          )
        );

    case "lapsed":
      return summaries
        .filter((s) => (s.days_since_last_order || 0) > 365)
        .sort((a, b) => (b.days_since_last_order || 0) - (a.days_since_last_order || 0))
        .map((s) =>
          storeEntry(
            s, contactsByStore, 60, "lapsed",
            `Last order ${s.last_order_date} — ${s.days_since_last_order}d ago · lifetime $${s.lifetime_value || 0} · ${s.neighborhood || s.borough || ""}`,
          )
        );

    case "never_ordered":
      return summaries
        .filter((s) => !s.last_order_date)
        .map((s) =>
          storeEntry(
            s, contactsByStore, 40, "never_ordered",
            `Prospect — never ordered · ${s.neighborhood || s.borough || ""}`,
          )
        );

    case "no_answer": {
      const byStore = new Map<string, any>();
      for (const c of contacts) {
        if ((c.total_calls_answered || 0) !== 0) continue;
        const e164 = toE164(c.phone);
        if (!e164 || !c.store_id) continue;
        const cur = byStore.get(c.store_id);
        if (!cur || contactRank(c) < contactRank(cur)) byStore.set(c.store_id, { ...c, e164 });
      }
      return [...byStore.values()].map((c) => ({
        store_id: c.store_id,
        store_name: c.store_name || "Unknown store",
        contact_id: c.contact_id ?? null,
        contact_name: c.name || null,
        phone: c.e164,
        priority: 30,
        reason: "no_answer",
        context: `Never successfully reached · ${c.line_type || "unknown line"}`,
      }));
    }

    case "wave": {
      const seg = opts.segment || "A ACTIVE";
      return waves
        .filter((w) => w.segment === seg)
        .map((w) => {
          const contact = w.store_id ? contactsByStore.get(w.store_id) : null;
          return {
            store_id: w.store_id ?? null,
            store_name: w.store_name || "Unknown store",
            contact_id: contact?.contact_id ?? null,
            contact_name: contact?.name || w.contact || null,
            phone: contact?.e164 || toE164(w.phone_e164 || w.phone10),
            priority: WAVE_PRIORITY[seg] ?? 50,
            reason: `wave:${seg}`,
            context: `${seg} · owes $${w.owed || 0}${w.last_order ? ` · last order ${w.last_order}` : ""} · ${w.neighborhood || w.borough || ""}`,
          };
        });
    }

    case "area": {
      const field = opts.area_field || "corridor";
      if (!["corridor", "neighborhood", "borough"].includes(field)) {
        throw new Error("area_field must be corridor, neighborhood or borough");
      }
      const value = opts.area_value || "";
      if (!value) throw new Error("area_value required");
      return summaries
        .filter((s) => s[field] === value)
        .sort((a, b) => (b.owed || 0) - (a.owed || 0))
        .map((s) =>
          storeEntry(
            s, contactsByStore, 50, `area:${field}`,
            `${value} · owes $${s.owed || 0}${s.last_order_date ? ` · last order ${s.last_order_date}` : " · never ordered"}`,
          )
        );
    }

    default:
      throw new Error(`unknown preset: ${preset}`);
  }
}

function finalize(
  entries: ListEntry[],
  suppressed: Set<string>,
  alreadyQueued: Set<string>,
) {
  const seen = new Set<string>();
  const ok: ListEntry[] = [];
  let suppressedCount = 0, alreadyDialing = 0, noPhone = 0;
  for (const e of entries) {
    if (!e.phone) { noPhone++; continue; }
    const l10 = last10(e.phone);
    if (suppressed.has(l10)) { suppressedCount++; continue; }
    if (alreadyQueued.has(l10)) { alreadyDialing++; continue; }
    if (seen.has(l10)) continue;
    seen.add(l10);
    ok.push(e);
  }
  return { ok, suppressed: suppressedCount, already_dialing: alreadyDialing, no_phone: noPhone };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // ── JWT + role gate: staff roles, or an active VA membership ──
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return json({ error: "auth_required" }, 401);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return json({ error: "invalid_token" }, 401);

    const { data: roleRows } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id);
    const roleSet = new Set((roleRows || []).map((r: any) => r.role));
    const isStaff = ["admin", "owner", "ceo", "staff", "employee", "csr", "manager"]
      .some((r) => roleSet.has(r));
    if (!isStaff) {
      const { data: vaRows } = await supabase
        .from("va_company_memberships").select("id")
        .eq("user_id", user.id).eq("is_active", true).limit(1);
      if (!vaRows || vaRows.length === 0) return json({ error: "forbidden" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;
    const businessId = FAMILY_BUSINESS_IDS.includes(body.business_id)
      ? body.business_id
      : GRABBA_BUSINESS_ID;

    // ── Base data (shared by every action) ──
    const [summaries, alerts, waves, contacts, dncRows, optOutRows, queuedRows] =
      await Promise.all([
        fetchAll(() => supabase.from("v_store_summary").select(
          "store_id,store_name,phone,contact_name,owed,open_invoices,oldest_unpaid,last_order_date,days_since_last_order,lifetime_value,neighborhood,borough,corridor",
        )),
        fetchAll(() => supabase.from("v_restock_alerts").select(
          "store_id,store_name,phone,contact_name,product,alert_level,on_hand,reorder_at,suggested_order,owed,neighborhood,borough,corridor",
        )),
        fetchAll(() => supabase.from("v_text_campaign").select(
          "store_name,contact,phone10,phone_e164,segment,owed,last_order,neighborhood,borough",
        )),
        fetchAll(() => supabase.from("v_store_who_to_contact").select(
          "store_id,store_name,contact_id,name,phone,line_type,is_primary,responsive_by_call,total_calls_answered,try_this_first",
        )),
        fetchAll(() => supabase.from("dnc_list").select("phone_last10")),
        fetchAll(() => supabase.from("opt_out_events").select("phone_last10")),
        fetchAll(() => supabase.from("outbound_call_queue").select("phone_number")
          .in("business_id", FAMILY_BUSINESS_IDS).eq("status", "queued")),
      ]);

    const contactsByStore = bestContactsByStore(contacts);
    const suppressed = new Set<string>(
      [...dncRows, ...optOutRows].map((r: any) => r.phone_last10).filter(Boolean),
    );
    const alreadyQueued = new Set<string>(
      queuedRows.map((r: any) => last10(r.phone_number)).filter(Boolean),
    );

    // ── presets: live counts for the picker ──
    if (action === "presets") {
      const countCallable = (entries: ListEntry[]) =>
        finalize(entries, suppressed, alreadyQueued).ok.length;

      const boroughs = new Map<string, number>();
      const corridors = new Map<string, number>();
      const neighborhoods = new Map<string, number>();
      for (const s of summaries) {
        if (s.borough) boroughs.set(s.borough, (boroughs.get(s.borough) || 0) + 1);
        if (s.corridor) corridors.set(s.corridor, (corridors.get(s.corridor) || 0) + 1);
        if (s.neighborhood) neighborhoods.set(s.neighborhood, (neighborhoods.get(s.neighborhood) || 0) + 1);
      }
      const toList = (m: Map<string, number>) =>
        [...m.entries()].map(([value, count]) => ({ value, count }))
          .sort((a, b) => b.count - a.count);

      const waveCounts = new Map<string, number>();
      for (const w of waves) {
        if (w.segment) waveCounts.set(w.segment, (waveCounts.get(w.segment) || 0) + 1);
      }

      return json({
        counts: {
          owes_money: countCallable(buildEntries("owes_money", { summaries, alerts, waves, contacts }, contactsByStore, {})),
          needs_product: countCallable(buildEntries("needs_product", { summaries, alerts, waves, contacts }, contactsByStore, {})),
          lapsed: countCallable(buildEntries("lapsed", { summaries, alerts, waves, contacts }, contactsByStore, {})),
          never_ordered: countCallable(buildEntries("never_ordered", { summaries, alerts, waves, contacts }, contactsByStore, {})),
          no_answer: countCallable(buildEntries("no_answer", { summaries, alerts, waves, contacts }, contactsByStore, {})),
        },
        waves: [...waveCounts.entries()].map(([segment, count]) => ({ segment, count })).sort(),
        areas: {
          borough: toList(boroughs),
          corridor: toList(corridors),
          neighborhood: toList(neighborhoods).slice(0, 150),
        },
        suppressed_total: suppressed.size,
        already_dialing_total: alreadyQueued.size,
      });
    }

    // ── preview / create ──
    const preset = body.preset as string;
    if (!preset) return json({ error: "preset_required" }, 400);
    const opts = {
      segment: body.segment, area_field: body.area_field, area_value: body.area_value,
    };
    const entries = buildEntries(preset, { summaries, alerts, waves, contacts }, contactsByStore, opts);
    const { ok, suppressed: supCount, already_dialing, no_phone } = finalize(entries, suppressed, alreadyQueued);

    if (action === "preview") {
      return json({
        count: ok.length,
        suppressed: supCount,
        already_dialing,
        no_phone,
        sample: ok.slice(0, 25).map((e) => ({
          store_name: e.store_name,
          contact_name: e.contact_name,
          phone: e.phone,
          context: e.context,
        })),
      });
    }

    if (action === "create") {
      if (ok.length === 0) return json({ error: "empty_list", count: 0 }, 400);

      const label = body.name?.trim() || defaultCampaignName(preset, opts);
      const { data: campaign, error: campErr } = await supabase
        .from("dialer_campaigns")
        .insert({
          business_id: businessId,
          name: label,
          description: `Built from store book · preset=${preset}${opts.segment ? ` segment=${opts.segment}` : ""}${opts.area_value ? ` ${opts.area_field}=${opts.area_value}` : ""} · ${ok.length} stores (${supCount} suppressed, ${already_dialing} already dialing, ${no_phone} no phone)`,
          status: "active",
          dial_mode: "human",
          agent_provider: "human",
          bridge_mode: "human_bridge",
          amd_enabled: true,
          amd_mode: "detect",
          max_attempts: 3,
          max_concurrent_calls: 1,
        })
        .select("id,name")
        .single();
      if (campErr) throw new Error(`campaign: ${campErr.message}`);

      const rows = ok.map((e) => ({
        business_id: businessId,
        campaign_id: campaign.id,
        store_id: e.store_id,
        contact_id: e.contact_id,
        phone_number: e.phone,
        contact_name: e.contact_name,
        entity_type: "store",
        entity_id: e.store_id,
        status: "queued",
        priority_score: e.priority,
        source_reason: e.reason,
        notes: e.context,
      }));
      for (let i = 0; i < rows.length; i += 500) {
        const { error: insErr } = await supabase
          .from("outbound_call_queue").insert(rows.slice(i, i + 500));
        if (insErr) throw new Error(`queue insert: ${insErr.message}`);
      }

      return json({
        campaign_id: campaign.id,
        name: campaign.name,
        queued: ok.length,
        suppressed: supCount,
        already_dialing,
        no_phone,
      });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error("dialer-call-list-builder error:", e);
    return json({ error: String(e?.message || e) }, 500);
  }
});

function defaultCampaignName(
  preset: string,
  opts: { segment?: string; area_field?: string; area_value?: string },
): string {
  const date = new Date().toISOString().slice(0, 10);
  switch (preset) {
    case "owes_money": return `Owes Money — ${date}`;
    case "needs_product": return `Needs Product — ${date}`;
    case "lapsed": return `Lapsed Accounts — ${date}`;
    case "never_ordered": return `Never Ordered — ${date}`;
    case "no_answer": return `No Answer Yet — ${date}`;
    case "wave": return `Wave ${opts.segment || ""} — ${date}`;
    case "area": return `${opts.area_value} — ${date}`;
    default: return `Call List — ${date}`;
  }
}
