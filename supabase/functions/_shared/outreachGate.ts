// OUTREACH GATE — every customer-contacting automation must call this first.
//
// The owner's rule (2026-08-23): nothing reaches a customer unless a human
// flipped a switch. outreach_switches holds one row per automation, ALL
// default OFF. outreach_allowed(key) returns false for a disabled switch,
// false for an UNKNOWN key, and self-disables when auto_disable_at passes.
//
// Disabling the cron only stops the clock — the function can still be invoked
// from the UI or another function. This gate is the real protection.
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Returns true only when the named outreach switch is ON and not expired.
 * Fails CLOSED: any error checking the switch means "not allowed".
 * Best-effort logs the block to dialer_call_events so a blocked automation
 * is visible rather than silently absent.
 */
export async function outreachAllowed(key: string): Promise<boolean> {
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data, error } = await admin.rpc("outreach_allowed", { p_key: key });
    if (error) {
      console.error(`outreach_gate_error key=${key}:`, error.message);
      return false;
    }
    const allowed = data === true;
    if (!allowed) {
      try {
        await admin.from("dialer_call_events").insert({
          event_type: "outreach.switch_blocked",
          source: "outreach_gate",
          severity: "info",
          payload: { switch_key: key },
        });
      } catch (_) { /* logging is best-effort */ }
    }
    return allowed;
  } catch (e) {
    console.error(`outreach_gate_threw key=${key}:`, e);
    return false;
  }
}
