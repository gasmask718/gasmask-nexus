/**
 * Dynasty Funding Hub — Application Package Builder (Phase 9).
 *
 * Pure, deterministic assembly of the data a lender application needs, built
 * from what is actually on file. It never invents a value: a field that is not
 * present is reported as missing, and the package status degrades accordingly.
 *
 * Status meanings:
 *   READY               every required field and document is on file, client
 *                       authorization is signed, submission method is known
 *   MISSING_INFORMATION at least one required field or document is absent
 *   MANUAL_REVIEW       nothing is provably wrong but a human must decide
 *                       (unknown submission method, unverified lender record)
 *   BLOCKED             client authorization to submit is not on file
 */

export type PackageStatus = 'READY' | 'MISSING_INFORMATION' | 'MANUAL_REVIEW' | 'BLOCKED';

export interface PackageField {
  key: string;
  label: string;
  value: string | number | null;
  required: boolean;
  present: boolean;
}

export interface PackageSection {
  key: string;
  title: string;
  fields: PackageField[];
}

export interface PackageDocument {
  document_type: string;
  required: boolean;
  present: boolean;
  file_name: string | null;
}

export interface ApplicationPackage {
  lender_id: string;
  lender_name: string;
  product_name: string | null;
  submission_method: 'API' | 'BROWSER' | 'MANUAL' | 'UNKNOWN';
  automation_allowed: boolean;
  status: PackageStatus;
  sections: PackageSection[];
  documents: PackageDocument[];
  missing_fields: string[];
  missing_documents: string[];
  eligibility_evidence: string[];
  consent_signed: boolean;
  consent_signed_at: string | null;
  notes: string[];
}

export interface PackageClient {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  business_name?: string | null;
  ein?: string | null;
  ssn_last4?: string | null;
  time_in_business_months?: number | null;
  monthly_revenue?: number | null;
  credit_score_estimate?: number | null;
  funding_target?: number | null;
  consent_signed?: boolean | null;
  consent_signed_at?: string | null;
}

/** Subset of funding_application_profile the package reads. */
export interface PackageProfile {
  legal_business_name?: string | null;
  entity_type?: string | null;
  formation_state?: string | null;
  formation_date?: string | null;
  ein?: string | null;
  naics_code?: string | null;
  business_address_line1?: string | null;
  business_city?: string | null;
  business_state?: string | null;
  business_zip?: string | null;
  business_phone?: string | null;
  business_email?: string | null;
  annual_revenue?: number | null;
  monthly_revenue?: number | null;
  average_bank_balance?: number | null;
  number_of_employees?: number | null;
  industry?: string | null;
  use_of_funds?: string | null;
  requested_amount?: number | null;
  owner_first_name?: string | null;
  owner_last_name?: string | null;
  owner_ssn_last4?: string | null;
  owner_dob?: string | null;
  owner_home_address?: string | null;
  owner_home_city?: string | null;
  owner_home_state?: string | null;
  owner_home_zip?: string | null;
  owner_phone?: string | null;
  owner_email?: string | null;
  ownership_percent?: number | null;
  bank_name?: string | null;
  bank_routing_last4?: string | null;
  bank_account_last4?: string | null;
}

export interface PackageLender {
  lender_id: string;
  lender_name: string;
  product_name?: string | null;
  submission_method?: string | null;
  automation_allowed?: boolean | null;
  docs_required?: string[] | null;
  requires_tax_returns?: boolean | null;
  accepts_bank_statements?: boolean | null;
  min_credit_score?: number | null;
  min_revenue?: number | null;
  min_time_in_business_months?: number | null;
  match_verdict?: string | null;
  match_reasons?: string[] | null;
}

const has = (v: unknown): boolean =>
  v !== null && v !== undefined && String(v).trim() !== '';

function field(
  key: string,
  label: string,
  value: unknown,
  required: boolean,
): PackageField {
  const present = has(value);
  return {
    key,
    label,
    value: present ? (value as string | number) : null,
    required,
    present,
  };
}

const VALID_METHODS = ['API', 'BROWSER', 'MANUAL'] as const;

function normalizeMethod(raw?: string | null): ApplicationPackage['submission_method'] {
  const m = (raw ?? '').trim().toUpperCase();
  return (VALID_METHODS as readonly string[]).includes(m)
    ? (m as 'API' | 'BROWSER' | 'MANUAL')
    : 'UNKNOWN';
}

export function buildApplicationPackage(input: {
  client: PackageClient;
  profile?: PackageProfile | null;
  documents?: Array<{ document_type: string | null; file_name: string | null }>;
  lender: PackageLender;
}): ApplicationPackage {
  const { client, lender } = input;
  const p = input.profile ?? {};
  const docs = input.documents ?? [];
  const notes: string[] = [];

  const businessName = p.legal_business_name ?? client.business_name ?? null;
  const ein = p.ein ?? client.ein ?? null;
  const requested = p.requested_amount ?? client.funding_target ?? null;
  const monthlyRevenue = p.monthly_revenue ?? client.monthly_revenue ?? null;

  const sections: PackageSection[] = [
    {
      key: 'applicant',
      title: 'Applicant',
      fields: [
        field('owner_name', 'Owner name',
          [p.owner_first_name ?? client.first_name, p.owner_last_name ?? client.last_name]
            .filter(Boolean).join(' ') || client.full_name, true),
        field('owner_email', 'Owner email', p.owner_email ?? client.email, true),
        field('owner_phone', 'Owner phone', p.owner_phone ?? client.phone, true),
        field('owner_dob', 'Date of birth', p.owner_dob, true),
        field('owner_ssn_last4', 'SSN (last 4)', p.owner_ssn_last4 ?? client.ssn_last4, true),
        field('owner_address', 'Home address', p.owner_home_address, true),
        field('owner_city', 'Home city', p.owner_home_city, true),
        field('owner_state', 'Home state', p.owner_home_state, true),
        field('owner_zip', 'Home ZIP', p.owner_home_zip, true),
        field('ownership_percent', 'Ownership %', p.ownership_percent, false),
      ],
    },
    {
      key: 'business',
      title: 'Business',
      fields: [
        field('legal_business_name', 'Legal business name', businessName, true),
        field('entity_type', 'Entity type', p.entity_type, true),
        field('formation_state', 'Formation state', p.formation_state, true),
        field('formation_date', 'Formation date', p.formation_date, false),
        field('ein', 'EIN', ein, true),
        field('naics_code', 'NAICS code', p.naics_code, false),
        field('industry', 'Industry', p.industry, false),
        field('business_address', 'Business address', p.business_address_line1, true),
        field('business_city', 'Business city', p.business_city, true),
        field('business_state', 'Business state', p.business_state, true),
        field('business_zip', 'Business ZIP', p.business_zip, true),
        field('business_phone', 'Business phone', p.business_phone, true),
        field('business_email', 'Business email', p.business_email, false),
        field('employees', 'Employees', p.number_of_employees, false),
      ],
    },
    {
      key: 'request',
      title: 'Funding request',
      fields: [
        field('requested_amount', 'Requested amount', requested, true),
        field('use_of_funds', 'Use of funds', p.use_of_funds, true),
      ],
    },
    {
      key: 'financials',
      title: 'Financials',
      fields: [
        field('monthly_revenue', 'Monthly revenue', monthlyRevenue, true),
        field('annual_revenue', 'Annual revenue', p.annual_revenue, false),
        field('average_bank_balance', 'Average bank balance', p.average_bank_balance, false),
        field('time_in_business_months', 'Time in business (months)', client.time_in_business_months, true),
        field('credit_score', 'Credit score', client.credit_score_estimate, true),
        field('bank_name', 'Bank name', p.bank_name, false),
        field('bank_routing_last4', 'Routing (last 4)', p.bank_routing_last4, false),
        field('bank_account_last4', 'Account (last 4)', p.bank_account_last4, false),
      ],
    },
  ];

  const missing_fields = sections
    .flatMap((s) => s.fields)
    .filter((f) => f.required && !f.present)
    .map((f) => f.label);

  // Documents the lender record actually asks for — nothing is assumed.
  const requiredDocTypes = new Set<string>((lender.docs_required ?? []).filter(Boolean));
  if (lender.requires_tax_returns) requiredDocTypes.add('tax_return');
  if (lender.accepts_bank_statements) notes.push('Lender accepts bank statements in place of full financials.');

  const heldTypes = new Set(
    docs.map((d) => (d.document_type ?? '').trim().toLowerCase()).filter(Boolean),
  );

  const documents: PackageDocument[] = [
    ...Array.from(requiredDocTypes).map((t) => {
      const key = t.trim().toLowerCase();
      const hit = docs.find((d) => (d.document_type ?? '').trim().toLowerCase() === key);
      return {
        document_type: t,
        required: true,
        present: heldTypes.has(key),
        file_name: hit?.file_name ?? null,
      };
    }),
    ...docs
      .filter((d) => !requiredDocTypes.has(d.document_type ?? ''))
      .map((d) => ({
        document_type: d.document_type ?? 'document',
        required: false,
        present: true,
        file_name: d.file_name ?? null,
      })),
  ];

  const missing_documents = documents.filter((d) => d.required && !d.present).map((d) => d.document_type);

  const eligibility_evidence = [
    ...(lender.match_verdict ? [`Match verdict: ${lender.match_verdict}`] : []),
    ...(lender.match_reasons ?? []),
  ];

  const submission_method = normalizeMethod(lender.submission_method);
  if (submission_method === 'UNKNOWN') {
    notes.push('Lender record has no valid submission method (API / BROWSER / MANUAL) — a human must choose the channel.');
  }

  const automation_allowed = lender.automation_allowed === true;
  if (submission_method === 'BROWSER' && !automation_allowed) {
    notes.push('Browser submission is not authorized for this lender — package must be submitted manually.');
  }

  const consent_signed = client.consent_signed === true;
  if (!consent_signed) {
    notes.push('Client authorization to submit applications is not on file. Nothing may be submitted.');
  }

  let status: PackageStatus;
  if (!consent_signed) status = 'BLOCKED';
  else if (missing_fields.length > 0 || missing_documents.length > 0) status = 'MISSING_INFORMATION';
  else if (submission_method === 'UNKNOWN' || (lender.match_verdict && lender.match_verdict !== 'MATCHED'))
    status = 'MANUAL_REVIEW';
  else status = 'READY';

  return {
    lender_id: lender.lender_id,
    lender_name: lender.lender_name,
    product_name: lender.product_name ?? null,
    submission_method,
    automation_allowed,
    status,
    sections,
    documents,
    missing_fields,
    missing_documents,
    eligibility_evidence,
    consent_signed,
    consent_signed_at: client.consent_signed_at ?? null,
    notes,
  };
}
