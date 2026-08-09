/**
 * Funding Machine PII helpers.
 *
 * The encrypted SSN column is never fetched by the browser. Use
 * FUNDING_CLIENT_SAFE_COLUMNS instead of select('*') on funding_clients so the
 * ciphertext never crosses the wire, and maskSsn() wherever an SSN is rendered.
 */

export const FUNDING_CLIENT_SAFE_COLUMNS =
  'id, user_id, first_name, last_name, email, phone, ssn_last4, date_of_birth, address, city, state, zip_code, business_name, business_type, business_state, ein, duns_number, time_in_business_months, monthly_revenue, funding_goal, target_funding_amount, current_dfs_score, current_funding_ceiling, projected_funding_ceiling, status, assigned_operator, notes, created_at, updated_at, portal_invite_sent_at, portal_user_id, full_name, email_access_method, employment_status, monthly_income, business_start_date, business_state_of_formation, credit_score_estimate, intake_status, assigned_advisor, consent_signed, consent_signed_at, grant_eligible, grant_checked_at, minority_owned, women_owned, veteran_owned, stage, target_credit_score, score_tu, score_eq, score_ex, score_updated_at, funding_target, funding_received, ai_last_analysis, ai_analysis_date';

/**
 * Render an SSN as last-4 only: •••-••-1234
 * Accepts either a raw 9-digit value or an already-truncated last-4 value.
 */
export function maskSsn(value?: string | null): string {
  if (!value) return '—';
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return '—';
  return `•••-••-${digits.slice(-4)}`;
}
