import { describe, it, expect } from 'vitest';
import {
  evaluateLender,
  matchLenders,
  isSubmittable,
  expandLenderProducts,
  type LenderRow,
  type ClientProfile,
} from '../../supabase/functions/lender-matching-engine/lenderMatch';

const lender = (over: Partial<LenderRow> = {}): LenderRow => ({
  id: over.id ?? 'l1',
  lender_name: 'Test Lender',
  min_credit_score: null,
  min_revenue: null,
  min_time_in_business_months: null,
  entity_required: null,
  no_pg: true,
  docs_required: null,
  is_active: true,
  is_qa_fixture: false,
  ...over,
});

const client = (over: Partial<ClientProfile> = {}): ClientProfile => ({
  credit_score_estimate: 720,
  monthly_revenue: 50000,
  time_in_business_months: 36,
  business_name: 'Acme LLC',
  ein: '12-3456789',
  personal_guarantee_ok: true,
  documents_on_file: [],
  ...over,
});

describe('lender matching rules', () => {
  it('matches a client that clears every published gate', () => {
    const r = evaluateLender(lender({ min_credit_score: 650 }), client());
    expect(r.verdict).toBe('MATCHED');
    expect(isSubmittable(r)).toBe(true);
  });

  it('fails a client below the credit floor and says why', () => {
    const r = evaluateLender(lender({ min_credit_score: 700 }), client({ credit_score_estimate: 610 }));
    expect(r.verdict).toBe('NOT_MATCHED');
    expect(r.rules.find((x) => x.rule === 'Credit score')?.detail).toContain('FAIL');
  });

  it('fails a client below the revenue floor', () => {
    const r = evaluateLender(lender({ min_revenue: 20000 }), client({ monthly_revenue: 5000 }));
    expect(r.verdict).toBe('NOT_MATCHED');
  });

  it('fails a client below the time-in-business floor', () => {
    const r = evaluateLender(lender({ min_time_in_business_months: 24 }), client({ time_in_business_months: 6 }));
    expect(r.verdict).toBe('NOT_MATCHED');
  });

  it('never treats an unknown client value as a pass', () => {
    const r = evaluateLender(lender({ min_credit_score: 680 }), client({ credit_score_estimate: null }));
    expect(r.verdict).toBe('MANUAL_REVIEW');
    expect(isSubmittable(r)).toBe(false);
    expect(r.rules.find((x) => x.rule === 'Credit score')?.outcome).toBe('unknown');
  });

  it('requires a registered entity with EIN when the lender demands one', () => {
    const r = evaluateLender(
      lender({ entity_required: 'llc' }),
      client({ business_name: null, ein: null }),
    );
    expect(r.verdict).toBe('NOT_MATCHED');
  });

  it('fails a PG lender when the client refuses a personal guarantee', () => {
    const r = evaluateLender(lender({ no_pg: false }), client({ personal_guarantee_ok: false }));
    expect(r.verdict).toBe('NOT_MATCHED');
  });

  it('sends a PG lender to manual review when the PG position is unknown', () => {
    const r = evaluateLender(lender({ no_pg: false }), client({ personal_guarantee_ok: null }));
    expect(r.verdict).toBe('MANUAL_REVIEW');
  });

  it('skips the PG rule entirely for no-PG lenders', () => {
    const r = evaluateLender(lender({ no_pg: true }), client({ personal_guarantee_ok: null }));
    expect(r.verdict).toBe('MATCHED');
  });

  it('flags missing documents as a prerequisite, not a match', () => {
    const r = evaluateLender(
      lender({ docs_required: ['bank_statements', 'tax_return'] }),
      client({ documents_on_file: ['bank_statements'] }),
    );
    expect(r.verdict).toBe('REQUIRES_PREREQUISITE');
    expect(r.missing_prerequisites).toContain('Document: tax_return');
    expect(isSubmittable(r)).toBe(false);
  });

  it('passes the document rule when every required doc is on file', () => {
    const r = evaluateLender(
      lender({ docs_required: ['Bank_Statements'] }),
      client({ documents_on_file: ['bank_statements'] }),
    );
    expect(r.verdict).toBe('MATCHED');
  });

  it('marks an incomplete business foundation as REQUIRES_PREREQUISITE', () => {
    const r = evaluateLender(lender(), client(), ['EIN registration']);
    expect(r.verdict).toBe('REQUIRES_PREREQUISITE');
    expect(r.missing_prerequisites).toEqual(['EIN registration']);
  });

  it('never matches an inactive lender', () => {
    const r = evaluateLender(lender({ is_active: false }), client());
    expect(r.verdict).toBe('NOT_MATCHED');
  });

  it('excludes QA fixtures by default and includes them only on request', () => {
    const rows = [lender({ id: 'real' }), lender({ id: 'fake', is_qa_fixture: true })];
    const def = matchLenders(rows, client());
    expect(def.results.map((r) => r.lender_id)).toEqual(['real']);
    expect(def.excluded_qa_fixtures).toBe(1);

    const withFixtures = matchLenders(rows, client(), [], { includeQaFixtures: true });
    expect(withFixtures.results).toHaveLength(2);
    expect(withFixtures.results.every(isSubmittable)).toBe(false);
  });

  it('never reports a QA fixture as submittable even when it matches', () => {
    const r = evaluateLender(lender({ is_qa_fixture: true }), client());
    expect(r.verdict).toBe('MATCHED');
    expect(isSubmittable(r)).toBe(false);
  });

  it('ranks stronger profiles above marginal ones', () => {
    const rows = [
      lender({ id: 'tight', min_credit_score: 715 }),
      lender({ id: 'loose', min_credit_score: 600, has_soft_pull_prequal: true }),
    ];
    const { results } = matchLenders(rows, client());
    expect(results[0].lender_id).toBe('loose');
  });

  it('returns an empty result set for an empty lender universe', () => {
    const { results, excluded_qa_fixtures } = matchLenders([], client());
    expect(results).toEqual([]);
    expect(excluded_qa_fixtures).toBe(0);
  });
});

describe('expandLenderProducts', () => {
  const lender = {
    id: 'L1',
    lender_name: 'Verified Lender',
    product_name: 'Default product',
    min_credit_score: 600,
    min_revenue: 10000,
    min_time_in_business_months: 12,
    is_active: true,
  };

  it('leaves a lender with no products untouched', () => {
    const rows = expandLenderProducts([lender], []);
    expect(rows).toHaveLength(1);
    expect(rows[0].product_id ?? null).toBeNull();
    expect(rows[0].min_credit_score).toBe(600);
  });

  it('evaluates one row per active product with product thresholds winning', () => {
    const rows = expandLenderProducts([lender], [
      { id: 'P1', lender_id: 'L1', product_name: 'Term loan', min_credit_score: 680, is_active: true },
      { id: 'P2', lender_id: 'L1', product_name: 'Line of credit', min_revenue: 25000, is_active: true },
      { id: 'P3', lender_id: 'L1', product_name: 'Retired', is_active: false },
    ]);
    expect(rows).toHaveLength(2);
    const term = rows.find((r) => r.product_id === 'P1')!;
    expect(term.min_credit_score).toBe(680);
    // Unpublished product thresholds fall back to the lender record.
    expect(term.min_revenue).toBe(10000);
    const loc = rows.find((r) => r.product_id === 'P2')!;
    expect(loc.min_revenue).toBe(25000);
    expect(loc.min_credit_score).toBe(600);
  });

  it('carries the product id into the match result', () => {
    const rows = expandLenderProducts([lender], [
      { id: 'P1', lender_id: 'L1', product_name: 'Term loan', is_active: true },
    ]);
    const result = evaluateLender(rows[0], {
      credit_score_estimate: 700,
      monthly_revenue: 50000,
      time_in_business_months: 36,
      business_name: 'Acme LLC',
      ein: '12-3456789',
      personal_guarantee_ok: true,
    });
    expect(result.product_id).toBe('P1');
    expect(result.verdict).toBe('MATCHED');
  });
});
