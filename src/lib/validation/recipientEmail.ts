/**
 * Canonical recipient-email normalization + validation for outbound delivery.
 * Mirrors supabase/functions/_shared/recipientEmail.ts.
 * Trim and lowercase only — never "repair" a malformed address.
 */

export function normalizeRecipientEmail(raw: string | null | undefined): string {
  return (raw ?? '').trim().toLowerCase();
}

export function isValidRecipientEmail(raw: string | null | undefined): boolean {
  const email = normalizeRecipientEmail(raw);
  if (!email || email.length > 254) return false;
  return /^[^\s@,;]+@[^\s@,;.]+(\.[^\s@,;.]+)+$/.test(email);
}
