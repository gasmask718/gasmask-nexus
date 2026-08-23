/**
 * INBOUND HUMANS-FIRST ROUTING — shared engine behind dc-inbound-call,
 * twilio-inbound-call, inbound-dial-complete and the concierge pair.
 *
 * Owner's rule: ring HUMANS first (VA softphones + forwarded cells/desks from
 * public.inbound_ring_targets). Only when nobody answers inside ring_seconds
 * — or outside business hours — does the call fall through to the AI
 * concierge (a conversation, not a voicemail).
 *
 * Resolution: dc_phone_numbers.va_company_id → inbound_policy → ring targets.
 * Numbers with no va_company_id keep the LEGACY behaviour (Bland DID from
 * v_phone_directory / per-business env var / global env var).
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { escapeXml } from "./dialer.ts";

/** All ops businesses are NYC-area; the policy table carries no tz column. */
export const HOURS_TZ = "America/New_York";

export interface InboundPolicy {
  va_company_id: string;
  ring_humans_first: boolean;
  ring_strategy: "simultaneous" | "sequential";
  ring_seconds: number;
  ai_fallback: boolean;
  ai_agent_id: string | null;
  ai_greeting: string | null;
  after_hours_ai_only: boolean;
  business_hours_start: string; // 'HH:MM:SS'
  business_hours_end: string;
}

export interface InboundCompany {
  id: string;
  slug: string;
  name: string;
  policy: InboundPolicy | null;
}

export interface RingLeg {
  kind: "number" | "client";
  value: string;
  label: string;
  ring_order: number;
}

/** business slug → VA company slug, for the legacy ?biz= fallback. */
const BIZ_TO_COMPANY: Record<string, string> = {
  gasmask: "gasmask_grabba",
  grabba_r_us: "gasmask_grabba",
  hot_scolatti: "gasmask_grabba",
  hot_mama: "gasmask_grabba",
  brandaro: "brandaro",
  surplus_funds: "surplus_funds",
  real_estate: "real_estate",
  toptier: "toptier",
  unforgettable_times: "unforgettable_times",
  brightsun_solar: "brightsun_solar",
  dynasty_connect: "dynasty_connect",
  dynasty_direct: "dynasty_direct",
};

function minutesOfDay(tz: string): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
  return (parseInt(parts.hour ?? "0", 10) % 24) * 60 + parseInt(parts.minute ?? "0", 10);
}

function toMinutes(hms: string | null | undefined, fallback: number): number {
  if (!hms) return fallback;
  const [h, m] = hms.split(":").map((x) => parseInt(x, 10));
  if (Number.isNaN(h)) return fallback;
  return h * 60 + (Number.isNaN(m) ? 0 : m);
}

export function withinPolicyHours(p: InboundPolicy | null): boolean {
  if (!p) return false;
  const now = minutesOfDay(HOURS_TZ);
  const start = toMinutes(p.business_hours_start, 9 * 60);
  const end = toMinutes(p.business_hours_end, 21 * 60);
  return now >= start && now < end;
}

/** Resolve the called number → VA company (+ policy). Null = legacy path. */
export async function resolveInboundCompany(
  supabase: SupabaseClient,
  toNumber: string,
  bizHint: string | null,
): Promise<InboundCompany | null> {
  const last10 = (toNumber || "").replace(/\D/g, "").slice(-10);
  let companyId: string | null = null;

  if (last10) {
    const { data, error } = await supabase
      .from("dc_phone_numbers")
      .select("va_company_id")
      .eq("is_active", true)
      .ilike("phone_number", `%${last10}`)
      .limit(1)
      .maybeSingle();
    if (error) console.error("[inboundRouting] number lookup failed:", error.message);
    companyId = data?.va_company_id ?? null;
  }

  if (!companyId && bizHint) {
    const slug = BIZ_TO_COMPANY[bizHint] ?? bizHint;
    const { data } = await supabase
      .from("va_companies")
      .select("id")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();
    companyId = data?.id ?? null;
  }

  if (!companyId) return null;

  const { data: company } = await supabase
    .from("va_companies")
    .select("id, slug, name")
    .eq("id", companyId)
    .maybeSingle();
  if (!company) return null;

  const { data: policy } = await supabase
    .from("inbound_policy")
    .select("*")
    .eq("va_company_id", companyId)
    .maybeSingle();

  return { id: company.id, slug: company.slug, name: company.name, policy: (policy as InboundPolicy) || null };
}

/**
 * Build the dial legs for a company.
 *  - browser targets ring the Twilio Voice SDK client ONLY when that user is
 *    currently 'available' in human_agent_line_status (on shift).
 *  - mobile/desk targets ring their phone_e164.
 *  - only_business_hours targets are skipped outside hours.
 */
export async function buildRingLegs(
  supabase: SupabaseClient,
  companyId: string,
  withinHours: boolean,
): Promise<RingLeg[]> {
  const { data: targets, error } = await supabase
    .from("inbound_ring_targets")
    .select("label, target_type, phone_e164, user_id, ring_order")
    .eq("va_company_id", companyId)
    .eq("active", true)
    .order("ring_order", { ascending: true });
  if (error) {
    console.error("[inboundRouting] ring targets load failed:", error.message);
    return [];
  }

  // Keep rows unless they are flagged only_business_hours AND we are outside hours.
  const usable = (targets || []).filter((t) => withinHours || !t.only_business_hours);

  // Which browser-target users are actually on shift?
  const browserUserIds = usable.filter((t) => t.target_type === "browser" && t.user_id).map((t) => t.user_id as string);
  const onShift = new Set<string>();
  if (browserUserIds.length) {
    const { data: status } = await supabase
      .from("human_agent_line_status")
      .select("user_id")
      .in("user_id", browserUserIds)
      .eq("status", "available");
    for (const r of status || []) if (r.user_id) onShift.add(r.user_id as string);
  }

  const legs: RingLeg[] = [];
  const seen = new Set<string>();
  for (const t of usable) {
    if (t.target_type === "browser") {
      if (!t.user_id || !onShift.has(t.user_id)) continue;
      const identity = `user_${(t.user_id as string).replace(/-/g, "")}`;
      if (seen.has(identity)) continue;
      seen.add(identity);
      legs.push({ kind: "client", value: identity, label: t.label, ring_order: t.ring_order ?? 1 });
    } else {
      const num = (t.phone_e164 || "").trim();
      if (!num.startsWith("+") || seen.has(num)) continue;
      seen.add(num);
      legs.push({ kind: "number", value: num, label: t.label, ring_order: t.ring_order ?? 1 });
    }
  }
  return legs;
}

/** Group legs into sequential stages by ring_order (same order = same stage). */
export function groupLegs(legs: RingLeg[]): RingLeg[][] {
  const byOrder = new Map<number, RingLeg[]>();
  for (const l of legs) {
    const arr = byOrder.get(l.ring_order) || [];
    arr.push(l);
    byOrder.set(l.ring_order, arr);
  }
  return [...byOrder.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
}

export function legsToTwiml(legs: RingLeg[]): string {
  return legs
    .map((l) => l.kind === "client"
      ? `<Client>${escapeXml(l.value)}</Client>`
      : `<Number>${escapeXml(l.value)}</Number>`)
    .join("");
}

export interface LegLogEntry {
  stage: string;
  legs: { label: string; kind: string; value: string }[];
  result?: string;
  at: string;
}

/** Append a ring-leg entry to the call's communication_logs metadata. */
export async function logRingLeg(
  supabase: SupabaseClient,
  callSid: string,
  entry: LegLogEntry,
): Promise<void> {
  const { data: row } = await supabase
    .from("communication_logs")
    .select("id, metadata")
    .eq("twilio_call_sid", callSid)
    .maybeSingle();
  if (!row?.id) return;
  const meta = (row.metadata as Record<string, unknown>) || {};
  const legs = Array.isArray(meta.ring_legs) ? meta.ring_legs : [];
  legs.push(entry as unknown as never);
  await supabase
    .from("communication_logs")
    .update({ metadata: { ...meta, ring_legs: legs } })
    .eq("id", row.id);
}

export function clampRingSeconds(n: number | null | undefined): number {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 20;
  return Math.min(30, Math.max(10, v));
}
