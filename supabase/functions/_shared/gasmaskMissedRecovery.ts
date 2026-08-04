/**
 * GASMASK MISSED-CALL RECOVERY
 *
 * Shared side-effect for a missed inbound GasMask call:
 *   1. Auto-text the caller back from the SAME GasMask number they dialled.
 *   2. Alert whoever is on shift (on-shift VAs + owner contacts) by SMS.
 *
 * Respects opt-outs and de-dupes to one recovery text per caller per 6h.
 * Never throws — a recovery failure must not break the TwiML response.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildSmsTemplate } from "./smsTemplates.ts";
import { sendSms, loadOwnerContacts, loadOnShiftPhones, last10 } from "./gasmaskVoice.ts";

const RECOVERY_MESSAGE = buildSmsTemplate("gasmask_missed_call_callback", {});
const RECOVERY_SUMMARY = "GasMask missed-call auto-text-back";

export async function runMissedCallRecovery(
  supabase: SupabaseClient,
  args: { caller: string; businessNumber: string; businessId: string | null; callSid?: string },
): Promise<void> {
  const { caller, businessNumber, businessId, callSid } = args;
  if (!caller || !businessNumber) return;

  try {
    const { data: optOut } = await supabase
      .from("opt_out_events")
      .select("phone_number")
      .eq("phone_number", caller)
      .maybeSingle();
    if (optOut) {
      console.log(`[gasmask-missed-recovery] ${caller} opted out — no text`);
      return;
    }
  } catch (e) {
    console.error("[gasmask-missed-recovery] opt-out check failed", (e as Error).message);
  }

  try {
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const { data: recent } = await supabase
      .from("communication_logs")
      .select("id")
      .eq("recipient_phone", caller)
      .eq("summary", RECOVERY_SUMMARY)
      .gte("created_at", sixHoursAgo)
      .limit(1)
      .maybeSingle();
    if (recent) {
      console.log(`[gasmask-missed-recovery] ${caller} already recovered within 6h`);
      return;
    }
  } catch (e) {
    console.error("[gasmask-missed-recovery] dedupe check failed", (e as Error).message);
  }

  // ── 1. Text the caller back ──
  let storeId: string | null = null;
  let storeName: string | null = null;
  try {
    const tail = last10(caller);
    if (tail) {
      const { data: store } = await supabase
        .from("stores")
        .select("id, name")
        .ilike("phone", `%${tail}`)
        .limit(1)
        .maybeSingle();
      storeId = store?.id ?? null;
      storeName = store?.name ?? null;
    }
  } catch (e) {
    console.error("[gasmask-missed-recovery] store match failed", (e as Error).message);
  }

  try {
    await sendSms({ from: businessNumber, to: caller, body: RECOVERY_MESSAGE });
    await supabase.from("communication_logs").insert({
      store_id: storeId,
      channel: "sms",
      direction: "outbound",
      message_content: RECOVERY_MESSAGE,
      sender_phone: businessNumber,
      recipient_phone: caller,
      summary: RECOVERY_SUMMARY,
      delivery_status: "queued",
      performed_by: "system",
      outcome: "missed_call_recovery",
      brand: "gasmask",
      source_business: "gasmask",
      provider: "twilio",
      metadata: { missed_call_sid: callSid ?? null },
    });
    console.log(`[gasmask-missed-recovery] ✅ callback text sent to ${caller}`);
  } catch (e) {
    console.error("[gasmask-missed-recovery] callback SMS failed:", (e as Error).message);
  }

  // ── 2. Alert whoever is on shift (plus owner contacts) ──
  try {
    const [onShift, owners] = await Promise.all([
      loadOnShiftPhones(supabase, businessId),
      loadOwnerContacts(supabase, businessId),
    ]);
    const alertTargets = Array.from(
      new Set([...onShift, ...owners.map((o) => o.phone_e164)].filter((n) => n && n !== caller)),
    );
    if (!alertTargets.length) return;

    const who = storeName ? `${storeName} (${caller})` : caller;
    const alertBody = `GasMask missed call from ${who}. Auto text-back sent — call them now.`;

    for (const target of alertTargets) {
      try {
        await sendSms({ from: businessNumber, to: target, body: alertBody });
      } catch (e) {
        console.error(`[gasmask-missed-recovery] alert to ${target} failed:`, (e as Error).message);
      }
    }
    console.log(`[gasmask-missed-recovery] alerted ${alertTargets.length} on-shift/owner number(s)`);
  } catch (e) {
    console.error("[gasmask-missed-recovery] alert fan-out failed:", (e as Error).message);
  }
}
