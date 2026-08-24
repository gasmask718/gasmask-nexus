/**
 * INBOUND NUMBER → BRAND RESOLUTION
 *
 * communication_logs.business_id carries a hardcoded DEFAULT of the GasMask
 * UUID. Any inbound writer that omits the column silently files the row as
 * GasMask no matter which number the message arrived on. Every inbound path
 * must resolve the *To* number through dc_phone_numbers and write the columns
 * explicitly — including an explicit NULL when the number is unknown.
 *
 * A visible null is better than a silent mis-filing.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export interface NumberBrand {
  /** businesses.id for the slug, or null when unmapped/unknown. */
  business_id: string | null;
  /** dc_phone_numbers.business slug, or null when the number is off-book. */
  brand: string | null;
  source_business: string | null;
}

const UNKNOWN: NumberBrand = { business_id: null, brand: null, source_business: null };

const last10 = (p: string) => (p || "").replace(/\D/g, "").slice(-10);

/**
 * Resolve the owning brand of an inbound Twilio `To` number.
 * Never throws and never falls back to a default brand.
 */
export async function resolveNumberBrand(
  sb: SupabaseClient,
  to: string,
  tag = "inbound",
): Promise<NumberBrand> {
  const l10 = last10(to);
  if (l10.length !== 10) {
    console.warn(`[${tag}][brand] unusable To number "${to}" — business_id left NULL`);
    return UNKNOWN;
  }

  try {
    const { data: row, error } = await sb
      .from("dc_phone_numbers")
      .select("business")
      .ilike("phone_number", `%${l10}`)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(`[${tag}][brand] dc_phone_numbers lookup failed: ${error.message} — business_id left NULL`);
      return UNKNOWN;
    }
    if (!row?.business) {
      console.warn(`[${tag}][brand] no active dc_phone_numbers row for To=${to} — business_id left NULL (NOT defaulted to GasMask)`);
      return UNKNOWN;
    }

    const slug = row.business as string;
    const { data: biz } = await sb
      .from("businesses")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (!biz?.id) {
      console.warn(`[${tag}][brand] brand "${slug}" has no businesses row — business_id NULL, brand tagged`);
    }

    return { business_id: biz?.id ?? null, brand: slug, source_business: slug };
  } catch (e) {
    console.error(`[${tag}][brand] resolution error: ${(e as Error).message} — business_id left NULL`);
    return UNKNOWN;
  }
}
