/**
 * GASMASK VOICE — shared helpers for inbound call routing + unified logging.
 *
 * Every inbound call writes ONE row into `communication_logs` with
 * channel='call'. The row is created when the call arrives and then
 * progressively updated (answered → recording → completed/missed/voicemail)
 * keyed on twilio_call_sid, so the phone log always has a single entry
 * per call, interleaved with SMS from the same table.
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { resolveNumberBrand } from "./inboundNumberBrand.ts";

export interface VoiceRoutingSettings {
  id: string;
  business: string;
  owner_forward_number: string | null;
  ring_model: "simultaneous" | "sequential" | "owner_first";
  va_ring_timeout_seconds: number;
  owner_ring_timeout_seconds: number;
  hours_timezone: string;
  hours_start_minute: number;
  hours_end_minute: number;
  hours_days: number[];
  recording_enabled: boolean;
  disclosure_text: string;
  voicemail_greeting: string;
  voicemail_enabled: boolean;
  sms_transcript_to_owner: boolean;
  is_active: boolean;
  /** What happens when no human answers: hand off to the AI phone agent (legacy
   *  inbound behaviour) or go straight to voicemail. */
  no_answer_action: "ai_agent" | "voicemail";
  ai_agent_timeout_seconds: number;
}

export function svcClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export function normalizePhone(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return "+1" + digits;
  if (digits.length === 11 && digits[0] === "1") return "+" + digits;
  return "+" + digits;
}

export function last10(raw: string): string {
  return (raw || "").replace(/\D/g, "").slice(-10);
}

export async function loadRoutingSettings(
  supabase: SupabaseClient,
  business = "gasmask",
): Promise<VoiceRoutingSettings | null> {
  const { data, error } = await supabase
    .from("voice_routing_settings")
    .select("*")
    .eq("business", business)
    .maybeSingle();
  if (error) console.error("[gasmaskVoice] settings load failed:", error.message);
  return (data as VoiceRoutingSettings) || null;
}

/** Minutes-since-midnight + ISO weekday (1=Mon..7=Sun) in the configured tz. */
export function nowInTimezone(tz: string): { minute: number; isoDay: number } {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  const hour = parseInt(parts.hour ?? "0", 10) % 24;
  const minute = parseInt(parts.minute ?? "0", 10);
  const dayMap: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return { minute: hour * 60 + minute, isoDay: dayMap[parts.weekday ?? "Mon"] ?? 1 };
}

export function isWithinBusinessHours(s: VoiceRoutingSettings): boolean {
  const { minute, isoDay } = nowInTimezone(s.hours_timezone);
  if (!s.hours_days?.includes(isoDay)) return false;
  return minute >= s.hours_start_minute && minute < s.hours_end_minute;
}

export interface ForwardTarget {
  display_name: string;
  forward_number: string;
  ring_order: number;
}

/** Available VA forward numbers, honouring the manual availability toggle. */
export async function loadAvailableVas(
  supabase: SupabaseClient,
  business = "gasmask",
): Promise<ForwardTarget[]> {
  const { data, error } = await supabase
    .from("voice_va_forwarding")
    .select("display_name, forward_number, ring_order")
    .eq("business", business)
    .eq("is_active", true)
    .eq("is_available", true)
    .order("ring_order", { ascending: true });
  if (error) {
    console.error("[gasmaskVoice] VA load failed:", error.message);
    return [];
  }
  return (data || []).filter((v) => !!v.forward_number) as ForwardTarget[];
}

/** Resolve a business UUID from its slug (e.g. 'gasmask'). */
export async function resolveBusinessId(
  supabase: SupabaseClient,
  slug = "gasmask",
): Promise<string | null> {
  const { data, error } = await supabase
    .from("businesses")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (error) console.error("[gasmaskVoice] business lookup failed:", error.message);
  return data?.id ?? null;
}

export interface OwnerContact {
  display_name: string | null;
  phone_e164: string;
  contact_type: string;
  ring_order: number;
}

/**
 * Owner / escalation numbers for a business, from public.business_owner_contacts.
 * Config-driven — never hardcode a personal number in source.
 */
export async function loadOwnerContacts(
  supabase: SupabaseClient,
  businessId: string | null,
): Promise<OwnerContact[]> {
  if (!businessId) return [];
  const { data, error } = await supabase
    .from("business_owner_contacts")
    .select("display_name, phone_e164, contact_type, ring_order")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .order("ring_order", { ascending: true });
  if (error) {
    console.error("[gasmaskVoice] owner contacts load failed:", error.message);
    return [];
  }
  return (data || []).filter((c) => !!c.phone_e164) as OwnerContact[];
}

export interface OnShiftAgent {
  client_identity: string;
  display_name: string | null;
  phone_number: string | null;
}

/**
 * VAs currently on shift for a business, read from the existing presence table
 * public.human_agent_line_status. Only rows carrying a browser softphone
 * identity can be rung with <Client>.
 */
export async function loadOnShiftClients(
  supabase: SupabaseClient,
  businessId: string | null,
): Promise<OnShiftAgent[]> {
  if (!businessId) return [];
  const { data, error } = await supabase
    .from("human_agent_line_status")
    .select("client_identity, display_name, phone_number, status")
    .eq("business_id", businessId)
    .eq("status", "available")
    .not("client_identity", "is", null);
  if (error) {
    console.error("[gasmaskVoice] on-shift agents load failed:", error.message);
    return [];
  }
  return (data || []).filter((a) => !!a.client_identity) as OnShiftAgent[];
}

/** Every phone number that should be alerted about a missed call. */
export async function loadOnShiftPhones(
  supabase: SupabaseClient,
  businessId: string | null,
): Promise<string[]> {
  if (!businessId) return [];
  const { data } = await supabase
    .from("human_agent_line_status")
    .select("phone_number")
    .eq("business_id", businessId)
    .eq("status", "available");
  return (data || [])
    .map((r: { phone_number: string | null }) => r.phone_number || "")
    // Softphone-only rows carry a `client:` sentinel, not a dialable number.
    .filter((n) => n.startsWith("+"));
}

/** Resolve a caller number to a store + contact for attribution. */
export async function matchCaller(
  supabase: SupabaseClient,
  callerNumber: string,
): Promise<{ store_id: string | null; store_name: string | null; contact_id: string | null; contact_name: string | null }> {
  const tail = last10(callerNumber);
  const out = { store_id: null as string | null, store_name: null as string | null, contact_id: null as string | null, contact_name: null as string | null };
  if (!tail) return out;

  // Contact match first — most specific attribution.
  try {
    const { data: contact } = await supabase
      .from("store_contacts")
      .select("id, name, store_id")
      .ilike("phone", `%${tail}`)
      .limit(1)
      .maybeSingle();
    if (contact) {
      out.contact_id = contact.id;
      out.contact_name = contact.name ?? null;
      out.store_id = contact.store_id ?? null;
    }
  } catch (e) {
    console.error("[gasmaskVoice] contact match failed", (e as Error).message);
  }

  if (!out.store_id) {
    try {
      const { data: store } = await supabase
        .from("stores")
        .select("id, name")
        .ilike("phone", `%${tail}`)
        .limit(1)
        .maybeSingle();
      if (store) {
        out.store_id = store.id;
        out.store_name = store.name ?? null;
      }
    } catch (e) {
      console.error("[gasmaskVoice] store match failed", (e as Error).message);
    }
  }

  if (out.store_id && !out.store_name) {
    const { data: s } = await supabase.from("stores").select("name").eq("id", out.store_id).maybeSingle();
    out.store_name = s?.name ?? null;
  }

  return out;
}

/** Create (or fetch) the single communication_logs row for this call. */
export async function upsertCallLog(
  supabase: SupabaseClient,
  args: {
    callSid: string;
    from: string;
    to: string;
    direction?: string;
    status: string;
    summary?: string;
    /** Brand / source business tag — defaults to gasmask (historical caller). */
    brand?: string;
    extra?: Record<string, unknown>;
  },
): Promise<string | null> {
  // Resolve the owning brand from the number this call landed on. Without an
  // explicit business_id, communication_logs defaults every row to GasMask.
  const numberBrand = await resolveNumberBrand(
    supabase,
    args.direction === "outbound" ? args.from : args.to,
    "call-log",
  );
  const brand = args.brand || numberBrand.brand || null;
  const { data: existing } = await supabase
    .from("communication_logs")
    .select("id")
    .eq("twilio_call_sid", args.callSid)
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    const patch: Record<string, unknown> = { status: args.status, ...(args.extra || {}) };
    if (args.summary) patch.summary = args.summary;
    const { error } = await supabase.from("communication_logs").update(patch).eq("id", existing.id);
    if (error) console.error("[gasmaskVoice] call log update failed:", error.message);
    return existing.id;
  }

  const match = await matchCaller(supabase, args.direction === "outbound" ? args.to : args.from);
  const { data, error } = await supabase
    .from("communication_logs")
    .insert({
      channel: "call",
      call_type: "voice",
      direction: args.direction || "inbound",
      status: args.status,
      twilio_call_sid: args.callSid,
      sender_phone: args.from,
      recipient_phone: args.to,
      store_id: match.store_id,
      contact_id: match.contact_id,
      business_id: numberBrand.business_id,
      brand,
      source_business: brand,
      provider: "twilio",
      // performed_by is constrained to ai|va|system — routing is a system action.
      performed_by: "system",
      started_at: new Date().toISOString(),
      summary: args.summary || `Inbound call from ${match.store_name || match.contact_name || args.from}`,
      event_type: "inbound_call",
      metadata: { store_name: match.store_name, contact_name: match.contact_name, ...(args.extra?.metadata as object || {}) },
      ...(args.extra || {}),
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[gasmaskVoice] call log insert failed:", error.message);
    return null;
  }
  return data?.id ?? null;
}

export async function patchCallLog(
  supabase: SupabaseClient,
  callSid: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase
    .from("communication_logs")
    .update(patch)
    .eq("twilio_call_sid", callSid);
  if (error) console.error("[gasmaskVoice] call log patch failed:", error.message);
}

export async function sendSms(opts: { from: string; to: string; body: string }): Promise<void> {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const token = Deno.env.get("TWILIO_AUTH_TOKEN");
  if (!sid || !token) throw new Error("twilio_credentials_missing");
  if (!sid.startsWith("AC")) throw new Error("twilio_invalid_account_sid");
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${sid}:${token}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: opts.to, From: opts.from, Body: opts.body }).toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`twilio_${res.status}: ${text}`);
  }
}
