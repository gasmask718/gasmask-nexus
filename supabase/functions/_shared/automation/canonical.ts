// Canonical application field layer for the Dynasty Application Automation Engine.
// Source of truth = Funding Hub (funding_application_profile + funding_clients +
// funding_applications). Nothing here stores a second copy of client data.

export type CanonicalKind =
  | 'text' | 'number' | 'currency' | 'date' | 'email' | 'phone'
  | 'select' | 'checkbox' | 'radio' | 'file';

export interface CanonicalField {
  key: string;
  kind: CanonicalKind;
  label: string;
  sensitive?: boolean;
}

/** The canonical schema is DERIVED from the existing Funding Hub columns. */
export const CANONICAL_FIELDS: CanonicalField[] = [
  { key: 'legal_name', kind: 'text', label: 'Legal Business Name' },
  { key: 'business_name', kind: 'text', label: 'DBA / Business Name' },
  { key: 'entity_type', kind: 'text', label: 'Entity Type' },
  { key: 'formation_state', kind: 'text', label: 'State of Formation' },
  { key: 'formation_date', kind: 'date', label: 'Formation Date' },
  { key: 'ein', kind: 'text', label: 'EIN', sensitive: true },
  { key: 'duns_number', kind: 'text', label: 'DUNS Number' },
  { key: 'naics', kind: 'text', label: 'NAICS Code' },
  { key: 'industry', kind: 'text', label: 'Industry' },
  { key: 'business_address', kind: 'text', label: 'Business Address' },
  { key: 'business_city', kind: 'text', label: 'Business City' },
  { key: 'business_state', kind: 'text', label: 'Business State' },
  { key: 'business_zip', kind: 'text', label: 'Business ZIP' },
  { key: 'business_phone', kind: 'phone', label: 'Business Phone' },
  { key: 'business_email', kind: 'email', label: 'Business Email' },
  { key: 'business_website', kind: 'text', label: 'Business Website' },
  { key: 'annual_revenue', kind: 'currency', label: 'Annual Gross Revenue' },
  { key: 'monthly_revenue', kind: 'currency', label: 'Monthly Revenue' },
  { key: 'average_bank_balance', kind: 'currency', label: 'Average Bank Balance' },
  { key: 'time_in_business', kind: 'number', label: 'Time in Business (years)' },
  { key: 'number_of_employees', kind: 'number', label: 'Number of Employees' },
  { key: 'requested_amount', kind: 'currency', label: 'Requested Amount' },
  { key: 'use_of_funds', kind: 'text', label: 'Use of Funds' },
  { key: 'first_name', kind: 'text', label: 'Owner First Name' },
  { key: 'last_name', kind: 'text', label: 'Owner Last Name' },
  { key: 'owner_title', kind: 'text', label: 'Owner Title' },
  { key: 'owner_dob', kind: 'date', label: 'Owner Date of Birth', sensitive: true },
  { key: 'owner_ssn_last4', kind: 'text', label: 'Owner SSN (last 4)', sensitive: true },
  { key: 'owner_home_address', kind: 'text', label: 'Owner Home Address', sensitive: true },
  { key: 'owner_home_city', kind: 'text', label: 'Owner Home City' },
  { key: 'owner_home_state', kind: 'text', label: 'Owner Home State' },
  { key: 'owner_home_zip', kind: 'text', label: 'Owner Home ZIP' },
  { key: 'owner_phone', kind: 'phone', label: 'Owner Phone' },
  { key: 'owner_email', kind: 'email', label: 'Owner Email' },
  { key: 'ownership_percentage', kind: 'number', label: 'Ownership Percentage' },
  { key: 'bank_name', kind: 'text', label: 'Bank Name' },
];

const FIELD_INDEX = new Map(CANONICAL_FIELDS.map((f) => [f.key, f]));
export const isCanonicalField = (k: string) => FIELD_INDEX.has(k);
export const canonicalField = (k: string) => FIELD_INDEX.get(k);

/** Values considered secret and never allowed into logs/events/worker payloads. */
const NEVER_LOG = ['ssn', 'social_security', 'password', 'otp', 'code', 'token', 'secret', 'api_key', 'card_number'];

export function redact<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj ?? {})) {
    const lower = k.toLowerCase();
    if (NEVER_LOG.some((n) => lower.includes(n))) { out[k] = '[REDACTED]'; continue; }
    out[k] = v && typeof v === 'object' && !Array.isArray(v)
      ? redact(v as Record<string, unknown>)
      : v;
  }
  return out;
}

export interface HubRecords {
  application: Record<string, any>;
  client: Record<string, any> | null;
  profile: Record<string, any> | null;
}

/** Build the canonical bundle from Funding Hub rows. No invented data. */
export function buildCanonical({ application, client, profile }: HubRecords): Record<string, unknown> {
  const p = profile ?? {};
  const c = client ?? {};
  const yearsFromMonths = c.time_in_business_months != null
    ? Number(c.time_in_business_months) / 12 : null;

  return {
    legal_name: p.legal_business_name ?? c.business_name ?? null,
    business_name: p.dba ?? c.business_name ?? null,
    entity_type: p.entity_type ?? c.business_type ?? null,
    formation_state: p.formation_state ?? c.business_state_of_formation ?? c.business_state ?? null,
    formation_date: p.formation_date ?? null,
    ein: p.ein ?? c.ein ?? null,
    duns_number: p.duns_number ?? c.duns_number ?? null,
    naics: p.naics_code ?? null,
    industry: p.industry ?? null,
    business_address: p.business_address_line1 ?? c.address ?? null,
    business_city: p.business_city ?? c.city ?? null,
    business_state: p.business_state ?? c.business_state ?? c.state ?? null,
    business_zip: p.business_zip ?? c.zip_code ?? null,
    business_phone: p.business_phone ?? c.phone ?? null,
    business_email: p.business_email ?? c.email ?? null,
    business_website: p.business_website ?? null,
    annual_revenue: p.annual_revenue ?? (c.monthly_revenue != null ? Number(c.monthly_revenue) * 12 : null),
    monthly_revenue: p.monthly_revenue ?? c.monthly_revenue ?? null,
    average_bank_balance: p.average_bank_balance ?? null,
    time_in_business: p.years_in_business ?? yearsFromMonths,
    number_of_employees: p.number_of_employees ?? null,
    requested_amount: application?.requested_amount ?? p.requested_amount ?? c.target_funding_amount ?? null,
    use_of_funds: p.use_of_funds ?? c.funding_goal ?? null,
    first_name: p.owner_first_name ?? c.first_name ?? null,
    last_name: p.owner_last_name ?? c.last_name ?? null,
    owner_title: p.owner_title ?? null,
    owner_dob: p.owner_dob ?? c.date_of_birth ?? null,
    owner_ssn_last4: p.owner_ssn_last4 ?? c.ssn_last4 ?? null,
    owner_home_address: p.owner_home_address ?? c.address ?? null,
    owner_home_city: p.owner_home_city ?? c.city ?? null,
    owner_home_state: p.owner_home_state ?? c.state ?? null,
    owner_home_zip: p.owner_home_zip ?? c.zip_code ?? null,
    owner_phone: p.owner_phone ?? c.phone ?? null,
    owner_email: p.owner_email ?? c.email ?? null,
    ownership_percentage: p.ownership_percent ?? null,
    bank_name: p.bank_name ?? null,
  };
}

export interface MappingRow {
  lender_field_label: string;
  canonical_field: string;
  field_kind: CanonicalKind;
  required: boolean;
  allowed_values: string[] | null;
}

export interface ValidationResult {
  ok: boolean;
  missing: string[];
  invalid: string[];
  /** lender_field_label -> formatted value (safe to hand to the worker) */
  values: Record<string, string | number | boolean>;
}

const isISODate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Type/format validation. Never submits an incomplete application. */
export function validateAndFormat(
  canonical: Record<string, unknown>,
  mappings: MappingRow[],
): ValidationResult {
  const missing: string[] = [];
  const invalid: string[] = [];
  const values: Record<string, string | number | boolean> = {};

  for (const m of mappings) {
    if (!isCanonicalField(m.canonical_field)) { invalid.push(`${m.lender_field_label}: unknown canonical field`); continue; }
    const raw = canonical[m.canonical_field];
    if (raw === null || raw === undefined || raw === '') {
      if (m.required) missing.push(m.canonical_field);
      continue;
    }
    switch (m.field_kind) {
      case 'number':
      case 'currency': {
        const n = Number(raw);
        if (!Number.isFinite(n)) { invalid.push(`${m.canonical_field}: not numeric`); continue; }
        values[m.lender_field_label] = m.field_kind === 'currency' ? Number(n.toFixed(2)) : n;
        break;
      }
      case 'date': {
        const s = String(raw).slice(0, 10);
        if (!isISODate(s)) { invalid.push(`${m.canonical_field}: bad date format`); continue; }
        values[m.lender_field_label] = s;
        break;
      }
      case 'email': {
        const s = String(raw).trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)) { invalid.push(`${m.canonical_field}: bad email`); continue; }
        values[m.lender_field_label] = s;
        break;
      }
      case 'phone': {
        const digits = String(raw).replace(/\D/g, '');
        if (digits.length < 10) { invalid.push(`${m.canonical_field}: bad phone`); continue; }
        values[m.lender_field_label] = digits.slice(-10);
        break;
      }
      case 'select':
      case 'radio': {
        const s = String(raw);
        if (m.allowed_values?.length && !m.allowed_values.includes(s)) {
          invalid.push(`${m.canonical_field}: "${s}" not an allowed option`); continue;
        }
        values[m.lender_field_label] = s;
        break;
      }
      case 'checkbox':
        values[m.lender_field_label] = Boolean(raw);
        break;
      default:
        values[m.lender_field_label] = String(raw);
    }
  }

  return { ok: missing.length === 0 && invalid.length === 0, missing, invalid, values };
}
