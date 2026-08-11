import { describe, expect, it } from 'vitest';
import {
  buildApplicationPackage,
  type PackageClient,
  type PackageLender,
  type PackageProfile,
} from '@/lib/funding/applicationPackage';

const fullClient: PackageClient = {
  id: 'c1',
  first_name: 'Ada',
  last_name: 'Lovelace',
  email: 'ada@example.com',
  phone: '+15555550100',
  business_name: 'Analytical Engines LLC',
  ein: '12-3456789',
  ssn_last4: '1234',
  time_in_business_months: 36,
  monthly_revenue: 40000,
  credit_score_estimate: 720,
  funding_target: 100000,
  consent_signed: true,
  consent_signed_at: '2026-08-01T00:00:00Z',
};

const fullProfile: PackageProfile = {
  legal_business_name: 'Analytical Engines LLC',
  entity_type: 'LLC',
  formation_state: 'DE',
  ein: '12-3456789',
  business_address_line1: '1 Difference Way',
  business_city: 'Wilmington',
  business_state: 'DE',
  business_zip: '19801',
  business_phone: '+15555550111',
  monthly_revenue: 40000,
  requested_amount: 100000,
  use_of_funds: 'Working capital',
  owner_first_name: 'Ada',
  owner_last_name: 'Lovelace',
  owner_email: 'ada@example.com',
  owner_phone: '+15555550100',
  owner_dob: '1815-12-10',
  owner_ssn_last4: '1234',
  owner_home_address: '2 Byron St',
  owner_home_city: 'London',
  owner_home_state: 'NY',
  owner_home_zip: '10001',
};

const apiLender: PackageLender = {
  lender_id: 'l1',
  lender_name: 'Test Capital',
  product_name: 'Line of Credit',
  submission_method: 'API',
  automation_allowed: true,
  docs_required: [],
  match_verdict: 'MATCHED',
  match_reasons: ['Credit score: 720 meets required 680'],
};

describe('buildApplicationPackage', () => {
  it('returns READY when every required field, document and consent is on file', () => {
    const pkg = buildApplicationPackage({
      client: fullClient,
      profile: fullProfile,
      documents: [],
      lender: apiLender,
    });
    expect(pkg.missing_fields).toEqual([]);
    expect(pkg.status).toBe('READY');
    expect(pkg.submission_method).toBe('API');
  });

  it('is BLOCKED when client authorization is not signed, even with complete data', () => {
    const pkg = buildApplicationPackage({
      client: { ...fullClient, consent_signed: false },
      profile: fullProfile,
      lender: apiLender,
    });
    expect(pkg.status).toBe('BLOCKED');
    expect(pkg.notes.join(' ')).toContain('authorization');
  });

  it('reports MISSING_INFORMATION and names each absent required field', () => {
    const pkg = buildApplicationPackage({
      client: fullClient,
      profile: { ...fullProfile, use_of_funds: null, business_zip: null },
      lender: apiLender,
    });
    expect(pkg.status).toBe('MISSING_INFORMATION');
    expect(pkg.missing_fields).toContain('Use of funds');
    expect(pkg.missing_fields).toContain('Business ZIP');
  });

  it('never invents a value — absent fields carry null, not a placeholder', () => {
    const pkg = buildApplicationPackage({
      client: { id: 'c2', consent_signed: true },
      profile: null,
      lender: apiLender,
    });
    const all = pkg.sections.flatMap((s) => s.fields);
    expect(all.every((f) => f.present || f.value === null)).toBe(true);
    expect(pkg.status).toBe('MISSING_INFORMATION');
  });

  it('flags required documents that are not on file', () => {
    const pkg = buildApplicationPackage({
      client: fullClient,
      profile: fullProfile,
      documents: [{ document_type: 'bank_statement', file_name: 'jan.pdf' }],
      lender: { ...apiLender, docs_required: ['bank_statement', 'tax_return'] },
    });
    expect(pkg.missing_documents).toEqual(['tax_return']);
    expect(pkg.status).toBe('MISSING_INFORMATION');
  });

  it('falls to MANUAL_REVIEW when the lender has no valid submission method', () => {
    const pkg = buildApplicationPackage({
      client: fullClient,
      profile: fullProfile,
      lender: { ...apiLender, submission_method: null },
    });
    expect(pkg.submission_method).toBe('UNKNOWN');
    expect(pkg.status).toBe('MANUAL_REVIEW');
  });

  it('never reports READY for a non-MATCHED verdict', () => {
    const pkg = buildApplicationPackage({
      client: fullClient,
      profile: fullProfile,
      lender: { ...apiLender, match_verdict: 'REQUIRES_PREREQUISITE' },
    });
    expect(pkg.status).toBe('MANUAL_REVIEW');
  });

  it('warns when browser submission is not authorized for the lender', () => {
    const pkg = buildApplicationPackage({
      client: fullClient,
      profile: fullProfile,
      lender: { ...apiLender, submission_method: 'BROWSER', automation_allowed: false },
    });
    expect(pkg.notes.join(' ')).toContain('not authorized');
  });
});
