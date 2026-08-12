// Pure, deterministic lender-matching rules.
//
// No Deno/Supabase imports live here on purpose: the edge function imports it
// at runtime, and the vitest suite imports the exact same file so the tested
// logic and the deployed logic can never drift.

export type Verdict = "MATCHED" | "REQUIRES_PREREQUISITE" | "MANUAL_REVIEW" | "NOT_MATCHED";
export type Outcome = "pass" | "fail" | "unknown" | "n/a";

export interface RuleResult {
  rule: string;
  outcome: Outcome;
  /** Human-readable: client value vs lender requirement vs result. */
  detail: string;
}

export interface LenderRow {
  id: string;
  lender_name: string | null;
  /** funding_lender_products.id when this row came from a product record. */
  product_id?: string | null;
  product_name?: string | null;
  category?: string | null;
  product_type?: string | null;
  funding_lane?: string | null;
  max_amount?: number | string | null;
  min_credit_score?: number | null;
  min_revenue?: number | string | null;
  min_time_in_business_months?: number | null;
  entity_required?: string | null;
  no_pg?: boolean | null;
  docs_required?: string[] | null;
  has_soft_pull_prequal?: boolean | null;
  stack_priority?: number | null;
  submission_method?: string | null;
  automation_allowed?: boolean | null;
  application_url?: string | null;
  is_active?: boolean | null;
  is_qa_fixture?: boolean | null;
}

export interface ClientProfile {
  credit_score_estimate?: number | null;
  monthly_revenue?: number | string | null;
  time_in_business_months?: number | null;
  business_name?: string | null;
  ein?: string | null;
  /** Personal guarantee consented to by the client. null = unknown. */
  personal_guarantee_ok?: boolean | null;
  /** Document keys already on file for the client. */
  documents_on_file?: string[];
}

export interface MatchResult {
  lender_id: string;
  /** Set when the evaluated requirements came from a funding_lender_products row. */
  product_id: string | null;
  lender_name: string | null;
  product_name: string | null;
  category: string | null;
  funding_lane: string | null;
  max_amount: number | string | null;
  submission_method: string;
  automation_allowed: boolean;
  application_url: string | null;
  stack_priority: number | null;
  is_qa_fixture: boolean;
  verdict: Verdict;
  match_score: number;
  rules: RuleResult[];
  missing_prerequisites: string[];
}

const num = (v: number | string | null | undefined): number | null =>
  v === null || v === undefined || v === "" ? null : Number(v);

/**
 * Evaluate one lender against one client.
 *
 * Rules are hard gates. A required client value that is not on file yields
 * `unknown` and forces MANUAL_REVIEW — it is never treated as a pass.
 */
export function evaluateLender(
  lender: LenderRow,
  client: ClientProfile,
  missingPrerequisites: string[] = [],
): MatchResult {
  const rules: RuleResult[] = [];
  let failed = false;
  let unknown = false;

  const numeric = (
    label: string,
    required: number | null,
    actual: number | null,
    unit = "",
  ) => {
    if (required == null) {
      rules.push({ rule: label, outcome: "n/a", detail: "No requirement published" });
      return;
    }
    if (actual == null) {
      unknown = true;
      rules.push({
        rule: label,
        outcome: "unknown",
        detail: `Client: unknown | Requirement: ${unit}${required} | Result: UNKNOWN`,
      });
      return;
    }
    if (actual < required) {
      failed = true;
      rules.push({
        rule: label,
        outcome: "fail",
        detail: `Client: ${unit}${actual} | Requirement: ${unit}${required} | Result: FAIL`,
      });
      return;
    }
    rules.push({
      rule: label,
      outcome: "pass",
      detail: `Client: ${unit}${actual} | Requirement: ${unit}${required} | Result: PASS`,
    });
  };

  // Inactive lenders are never matchable.
  if (lender.is_active === false) {
    failed = true;
    rules.push({
      rule: "Lender active",
      outcome: "fail",
      detail: "Lender is marked inactive | Result: FAIL",
    });
  }

  numeric("Credit score", lender.min_credit_score ?? null, client.credit_score_estimate ?? null);
  numeric("Monthly revenue", num(lender.min_revenue), num(client.monthly_revenue), "$");
  numeric(
    "Time in business (months)",
    lender.min_time_in_business_months ?? null,
    client.time_in_business_months ?? null,
  );

  // Entity requirement.
  if (lender.entity_required && lender.entity_required !== "personal") {
    if (client.business_name && client.ein) {
      rules.push({
        rule: "Entity requirement",
        outcome: "pass",
        detail: `Client: ${client.business_name} with EIN | Requirement: ${lender.entity_required} | Result: PASS`,
      });
    } else {
      failed = true;
      rules.push({
        rule: "Entity requirement",
        outcome: "fail",
        detail: `Client: no registered entity/EIN on file | Requirement: ${lender.entity_required} | Result: FAIL`,
      });
    }
  } else {
    rules.push({ rule: "Entity requirement", outcome: "n/a", detail: "No entity requirement" });
  }

  // Personal guarantee. no_pg = true means the lender does NOT require a PG.
  if (lender.no_pg === true) {
    rules.push({
      rule: "Personal guarantee",
      outcome: "n/a",
      detail: "Lender does not require a personal guarantee",
    });
  } else {
    if (client.personal_guarantee_ok === true) {
      rules.push({
        rule: "Personal guarantee",
        outcome: "pass",
        detail: "Client: PG accepted | Requirement: PG required | Result: PASS",
      });
    } else if (client.personal_guarantee_ok === false) {
      failed = true;
      rules.push({
        rule: "Personal guarantee",
        outcome: "fail",
        detail: "Client: PG declined | Requirement: PG required | Result: FAIL",
      });
    } else {
      unknown = true;
      rules.push({
        rule: "Personal guarantee",
        outcome: "unknown",
        detail: "Client: PG position unknown | Requirement: PG required | Result: UNKNOWN",
      });
    }
  }

  // Required documents.
  const docs = lender.docs_required ?? [];
  if (docs.length === 0) {
    rules.push({ rule: "Documents", outcome: "n/a", detail: "No documents published" });
  } else {
    const onFile = new Set((client.documents_on_file ?? []).map((d) => d.toLowerCase().trim()));
    const missingDocs = docs.filter((d) => !onFile.has(String(d).toLowerCase().trim()));
    if (missingDocs.length === 0) {
      rules.push({
        rule: "Documents",
        outcome: "pass",
        detail: `Client: all ${docs.length} on file | Requirement: ${docs.join(", ")} | Result: PASS`,
      });
    } else {
      rules.push({
        rule: "Documents",
        outcome: "unknown",
        detail: `Client: missing ${missingDocs.join(", ")} | Requirement: ${docs.join(", ")} | Result: MISSING`,
      });
      missingPrerequisites = [
        ...missingPrerequisites,
        ...missingDocs.map((d) => `Document: ${d}`),
      ];
    }
  }

  let verdict: Verdict;
  if (failed) verdict = "NOT_MATCHED";
  else if (unknown) verdict = "MANUAL_REVIEW";
  else if (missingPrerequisites.length > 0) verdict = "REQUIRES_PREREQUISITE";
  else verdict = "MATCHED";

  let matchScore = 0;
  if (verdict === "MATCHED" || verdict === "REQUIRES_PREREQUISITE") {
    matchScore = 50;
    const score = client.credit_score_estimate ?? null;
    const revenue = num(client.monthly_revenue);
    const tib = client.time_in_business_months ?? null;
    if (lender.min_credit_score != null && score != null && score > lender.min_credit_score + 50) matchScore += 20;
    if (num(lender.min_revenue) != null && revenue != null && revenue > num(lender.min_revenue)! * 1.5) matchScore += 15;
    if (lender.min_time_in_business_months != null && tib != null && tib > lender.min_time_in_business_months * 2) matchScore += 10;
    if (lender.has_soft_pull_prequal) matchScore += 5;
    if (verdict === "REQUIRES_PREREQUISITE") matchScore = Math.round(matchScore * 0.6);
  }

  return {
    lender_id: lender.id,
    product_id: lender.product_id ?? null,
    lender_name: lender.lender_name ?? null,
    product_name: lender.product_name ?? null,
    category: lender.category ?? null,
    funding_lane: lender.funding_lane ?? null,
    max_amount: lender.max_amount ?? null,
    submission_method: (lender.submission_method ?? "manual").toLowerCase(),
    automation_allowed: lender.automation_allowed === true,
    application_url: lender.application_url ?? null,
    stack_priority: lender.stack_priority ?? null,
    is_qa_fixture: lender.is_qa_fixture === true,
    verdict,
    match_score: matchScore,
    rules,
    missing_prerequisites: verdict === "REQUIRES_PREREQUISITE" ? missingPrerequisites : [],
  };
}

/**
 * A lender may only be pursued for a real submission when it is a real,
 * active, non-QA record whose verdict is MATCHED.
 */
export function isSubmittable(result: MatchResult): boolean {
  return result.verdict === "MATCHED" && !result.is_qa_fixture;
}

export function matchLenders(
  lenders: LenderRow[],
  client: ClientProfile,
  missingPrerequisites: string[] = [],
  opts: { includeQaFixtures?: boolean } = {},
): { results: MatchResult[]; excluded_qa_fixtures: number } {
  const usable = lenders.filter((l) =>
    opts.includeQaFixtures ? true : l.is_qa_fixture !== true,
  );
  const results = usable
    .map((l) => evaluateLender(l, client, [...missingPrerequisites]))
    .sort((a, b) => b.match_score - a.match_score);
  return { results, excluded_qa_fixtures: lenders.length - usable.length };
}

/** A funding_lender_products row as stored in the database. */
export interface LenderProductRow {
  id: string;
  lender_id: string;
  product_name?: string | null;
  product_type?: string | null;
  funding_lane?: string | null;
  min_credit_score?: number | null;
  min_revenue?: number | string | null;
  min_time_in_business_months?: number | null;
  max_amount?: number | string | null;
  no_pg?: boolean | null;
  docs_required?: string[] | null;
  stack_priority?: number | null;
  application_url?: string | null;
  is_active?: boolean | null;
}

const pick = <T,>(product: T | null | undefined, lender: T | null | undefined): T | null =>
  product === null || product === undefined ? (lender ?? null) : product;

/**
 * Expands the lender universe into the rows the engine actually evaluates.
 *
 * A lender with published products is evaluated once per active product, with
 * product-level requirements overriding the lender-level defaults. A lender
 * with no products is evaluated as a single row exactly as before, so nothing
 * disappears from the universe when the products table is empty.
 */
export function expandLenderProducts(
  lenders: LenderRow[],
  products: LenderProductRow[] = [],
): LenderRow[] {
  const byLender = new Map<string, LenderProductRow[]>();
  for (const p of products) {
    if (p.is_active === false) continue;
    const list = byLender.get(p.lender_id) ?? [];
    list.push(p);
    byLender.set(p.lender_id, list);
  }

  return lenders.flatMap((lender) => {
    const own = byLender.get(lender.id) ?? [];
    if (own.length === 0) return [lender];
    return own.map((p) => ({
      ...lender,
      product_id: p.id,
      product_name: p.product_name ?? lender.product_name ?? null,
      product_type: p.product_type ?? lender.product_type ?? null,
      funding_lane: p.funding_lane ?? lender.funding_lane ?? null,
      min_credit_score: pick(p.min_credit_score, lender.min_credit_score),
      min_revenue: pick(p.min_revenue, lender.min_revenue),
      min_time_in_business_months: pick(
        p.min_time_in_business_months,
        lender.min_time_in_business_months,
      ),
      max_amount: pick(p.max_amount, lender.max_amount),
      no_pg: pick(p.no_pg, lender.no_pg),
      docs_required: p.docs_required ?? lender.docs_required ?? null,
      stack_priority: pick(p.stack_priority, lender.stack_priority),
      application_url: p.application_url ?? lender.application_url ?? null,
    }));
  });
}
