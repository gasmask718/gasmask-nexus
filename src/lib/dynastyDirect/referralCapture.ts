// Referral capture helpers — store the inbound ?ref= code and apply it when a
// store account is created.
import { supabase } from "@/integrations/supabase/client";

const KEY = "dd_store_ref";

export function captureReferralFromUrl(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  const code = url.searchParams.get("ref") || url.searchParams.get("store_ref");
  if (code) {
    try { localStorage.setItem(KEY, code); } catch { /* ignore */ }
  }
}

export function getStoredReferralCode(): string | null {
  if (typeof window === "undefined") return null;
  try { return localStorage.getItem(KEY); } catch { return null; }
}

export function clearReferralCode(): void {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

/** Call once a new store_account row exists; binds the referral + applies the
 * 10% first-order discount. Safe to call when there's no stored code. */
export async function applyStoreReferralIfAny(storeAccountId: string): Promise<void> {
  const code = getStoredReferralCode();
  if (!code) return;
  try {
    await supabase.rpc("dd_apply_store_referral_signup", {
      p_referral_code: code,
      p_store_account_id: storeAccountId,
    });
    clearReferralCode();
  } catch (e) {
    console.warn("[referral] apply failed", e);
  }
}
