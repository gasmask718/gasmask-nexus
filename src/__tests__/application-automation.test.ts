import { describe, it, expect } from 'vitest';
import {
  buildCanonical, validateAndFormat, redact, CANONICAL_FIELDS, isCanonicalField,
  type MappingRow,
} from '../../supabase/functions/_shared/automation/canonical';
import {
  normalizeApiResponse, normalizePageText, toHubApplicationStatus,
} from '../../supabase/functions/_shared/automation/normalize';

const application = { id: 'app-1', client_id: 'c-1', requested_amount: 50000, lender_name: 'Example Lender' };
const client = {
  first_name: 'John', last_name: 'Doe', email: 'john@doe.com', phone: '(555) 010-2030',
  business_name: 'Doe LLC', ssn_last4: '1234', monthly_revenue: 20000, time_in_business_months: 30,
  city: 'Newark', state: 'NJ', zip_code: '07102', address: '1 Main St',
};
const profile = {
  legal_business_name: 'Doe Holdings LLC', annual_revenue: 250000, business_email: 'ops@doe.com',
  business_phone: '5550102030', formation_date: '2019-04-01', entity_type: 'LLC', owner_ssn_last4: '1234',
};

describe('canonical field mapping', () => {
  it('derives canonical fields from Funding Hub records without inventing data', () => {
    const c = buildCanonical({ application, client, profile });
    expect(c.legal_name).toBe('Doe Holdings LLC');
    expect(c.annual_revenue).toBe(250000);
    expect(c.requested_amount).toBe(50000);
    expect(c.time_in_business).toBe(2.5);
    expect(c.business_website).toBeNull();
  });

  it('falls back to client record when the profile is absent', () => {
    const c = buildCanonical({ application, client, profile: null });
    expect(c.legal_name).toBe('Doe LLC');
    expect(c.annual_revenue).toBe(240000);
  });

  it('exposes only known canonical keys', () => {
    expect(isCanonicalField('annual_revenue')).toBe(true);
    expect(isCanonicalField('not_a_field')).toBe(false);
    expect(CANONICAL_FIELDS.length).toBeGreaterThan(20);
  });
});

describe('field validation', () => {
  const mappings: MappingRow[] = [
    { lender_field_label: 'Annual Gross Revenue', canonical_field: 'annual_revenue', field_kind: 'currency', required: true, allowed_values: null },
    { lender_field_label: 'Business Email', canonical_field: 'business_email', field_kind: 'email', required: true, allowed_values: null },
    { lender_field_label: 'Business Phone', canonical_field: 'business_phone', field_kind: 'phone', required: true, allowed_values: null },
    { lender_field_label: 'Formation Date', canonical_field: 'formation_date', field_kind: 'date', required: true, allowed_values: null },
    { lender_field_label: 'Entity Type', canonical_field: 'entity_type', field_kind: 'select', required: true, allowed_values: ['LLC', 'Corp'] },
  ];

  it('formats valid data correctly', () => {
    const v = validateAndFormat(buildCanonical({ application, client, profile }), mappings);
    expect(v.ok).toBe(true);
    expect(v.values['Annual Gross Revenue']).toBe(250000);
    expect(v.values['Business Phone']).toBe('5550102030');
    expect(v.values['Formation Date']).toBe('2019-04-01');
  });

  it('reports missing required fields instead of submitting', () => {
    const v = validateAndFormat(buildCanonical({ application, client: {}, profile: null }), mappings);
    expect(v.ok).toBe(false);
    expect(v.missing).toContain('formation_date');
  });

  it('rejects invalid dropdown values', () => {
    const v = validateAndFormat({ ...buildCanonical({ application, client, profile }), entity_type: 'Sole Prop' }, mappings);
    expect(v.ok).toBe(false);
    expect(v.invalid.join()).toMatch(/not an allowed option/);
  });

  it('rejects malformed emails', () => {
    const v = validateAndFormat({ ...buildCanonical({ application, client, profile }), business_email: 'nope' }, mappings);
    expect(v.invalid.join()).toMatch(/bad email/);
  });
});

describe('sensitive value redaction', () => {
  it('never lets secrets into logs', () => {
    const out = redact({ ssn: '123-45-6789', otp_code: '998811', nested: { api_key: 'sk-x', ok: 1 }, safe: 'yes' });
    expect(out.ssn).toBe('[REDACTED]');
    expect(out.otp_code).toBe('[REDACTED]');
    expect((out.nested as any).api_key).toBe('[REDACTED]');
    expect(out.safe).toBe('yes');
  });
});

describe('response normalization', () => {
  it('normalizes an explicit API approval', () => {
    const r = normalizeApiResponse({ status: 'APPROVED', approved_amount: 50000, reference_id: 'REF-991' });
    expect(r.status).toBe('APPROVED');
    expect(r.approved_amount).toBe(50000);
    expect(r.lender_reference).toBe('REF-991');
  });

  it('escalates unknown API statuses instead of guessing', () => {
    const r = normalizeApiResponse({ status: 'WEIRD_STATE' });
    expect(r.status).toBe('NEEDS_HUMAN_REVIEW');
    expect(r.confidence).toBe('low');
  });

  it('reads a clear browser approval with amount', () => {
    const r = normalizePageText('Congratulations! You are approved for $50,000. Reference Number: AB12345');
    expect(r.status).toBe('APPROVED');
    expect(r.approved_amount).toBe(50000);
    expect(r.lender_reference).toBe('AB12345');
  });

  it('never fabricates a result from ambiguous text', () => {
    expect(normalizePageText('Thanks. Something happened.').status).toBe('NEEDS_HUMAN_REVIEW');
  });

  it('escalates conflicting signals', () => {
    const r = normalizePageText('You are approved. Unfortunately your application was declined.');
    expect(r.status).toBe('NEEDS_HUMAN_REVIEW');
    expect(r.next_action).toMatch(/Conflicting/);
  });

  it('never approves without an amount signal', () => {
    expect(normalizePageText('Your application is under review.').status).toBe('PENDING');
  });
});

describe('funding hub status mapping', () => {
  it('maps decisive results only', () => {
    expect(toHubApplicationStatus('APPROVED')).toBe('Approved');
    expect(toHubApplicationStatus('DECLINED')).toBe('Denied');
    expect(toHubApplicationStatus('SUBMITTED')).toBe('Applied');
    expect(toHubApplicationStatus('NEEDS_HUMAN_REVIEW')).toBeNull();
    expect(toHubApplicationStatus('UNKNOWN')).toBeNull();
    expect(toHubApplicationStatus('FAILED')).toBeNull();
  });
});
