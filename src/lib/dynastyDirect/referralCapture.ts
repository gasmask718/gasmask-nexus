// Referral capture helpers — store the inbound ?ref= code and apply it when a
// store account is created. Also captures ?campaign= + ?supplier= for the
// ambassador-wholesaler partner-campaign system.
import { supabase } from "@/integrations/supabase/client";

const KEY = "dd_store_ref";
const CAMPAIGN_KEY = "dd_campaign";
const SUPPLIER_KEY = "dd_campaign_supplier";

export function captureReferralFromUrl(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  const code = url.searchParams.get("ref") || url.searchParams.get("store_ref");
  if (code) {
    try { localStorage.setItem(KEY, code); } catch { /* ignore */ }
  }
  const campaign = url.searchParams.get("campaign");
  const supplier = url.searchParams.get("supplier");
  if (campaign) {
    try { localStorage.setItem(CAMPAIGN_KEY, campaign); } catch { /* ignore */ }
  }
  if (supplier) {
    try { localStorage.setItem(SUPPLIER_KEY, supplier); } catch { /* ignore */ }
  }
  if (code || campaign) {
    try {
      supabase.functions.invoke("dd-affiliate-track", {
        body: {
          code: code ?? campaign,
          ref_code: code,
          campaign_code: campaign,
          supplier_id: supplier,
          meta: { page: url.pathname, search: url.search },
        },
      }).catch(() => { /* ignore */ });
    } catch { /* ignore */ }
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

export function getStoredCampaignCode(): string | null {
  if (typeof window === "undefined") return null;
  try { return localStorage.getItem(CAMPAIGN_KEY); } catch { return null; }
}

export function clearCampaignCode(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(CAMPAIGN_KEY);
    localStorage.removeItem(SUPPLIER_KEY);
  } catch { /* ignore */ }
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
