/**
 * Column definitions + coercion rules for the funding lender bulk importer.
 *
 * The importer is intentionally schema-driven: the VA uploads whatever shape
 * their workbook tab is in, and maps their headers onto these fields. Adding a
 * new importable column means adding one entry here — no UI changes.
 */

export type FieldKind = 'text' | 'number' | 'integer' | 'boolean' | 'array' | 'enum';

export interface ImportField {
  key: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  /** Allowed values for enum fields (must match the DB CHECK constraints). */
  options?: string[];
  /** Lowercased header fragments used to auto-detect this field in a workbook. */
  aliases: string[];
  hint?: string;
}

export const CATEGORIES = [
  'personal_card',
  'business_card',
  'credit_union',
  'fintech',
  'personal_loan',
  'sba',
  'net30_vendor',
  'auto',
  'shelf_corp',
  'other',
] as const;

export const SUBMISSION_METHODS = ['api', 'browser', 'manual'] as const;
export const ENTITY_TYPES = ['personal', 'llc', 'aged_ein', 'either'] as const;
export const INQUIRY_SENSITIVITY = ['low', 'medium', 'high', 'extreme'] as const;

/** The 11 funding lanes. Free text in the DB so the playbook can evolve. */
export const FUNDING_LANES = [
  'personal_credit',
  'business_credit',
  'credit_union',
  'fintech_revenue',
  'sba',
  'vendor_net30',
  'auto',
  'real_estate',
  'equipment',
  'shelf_corp',
  'grants',
] as const;

export const LENDER_FIELDS: ImportField[] = [
  {
    key: 'lender_name',
    label: 'Lender name',
    kind: 'text',
    required: true,
    aliases: ['lender', 'lender name', 'name', 'institution', 'bank', 'credit union', 'company', 'issuer', 'vendor'],
  },
  {
    key: 'product_name',
    label: 'Product name',
    kind: 'text',
    aliases: ['product', 'product name', 'card', 'card name', 'offering', 'loan'],
  },
  {
    key: 'category',
    label: 'Category',
    kind: 'enum',
    options: [...CATEGORIES],
    aliases: ['category', 'type', 'lender type', 'source type', 'product category'],
    hint: 'personal_card, credit_union, fintech, sba, net30_vendor…',
  },
  {
    key: 'funding_lane',
    label: 'Funding lane',
    kind: 'text',
    aliases: ['lane', 'funding lane', 'track', 'bucket', 'stage'],
  },
  {
    key: 'entity_required',
    label: 'Entity required',
    kind: 'enum',
    options: [...ENTITY_TYPES],
    aliases: ['entity', 'entity required', 'entity type', 'requires entity', 'business type'],
  },
  {
    key: 'min_credit_score',
    label: 'Min credit score',
    kind: 'integer',
    aliases: ['min credit score', 'credit score', 'min score', 'fico', 'min fico', 'score'],
  },
  {
    key: 'min_time_in_business_months',
    label: 'Min time in business (months)',
    kind: 'integer',
    aliases: ['time in business', 'tib', 'min tib', 'months in business', 'min time in business', 'age of business'],
  },
  {
    key: 'min_revenue',
    label: 'Min annual revenue',
    kind: 'number',
    aliases: ['min revenue', 'revenue', 'annual revenue', 'minimum revenue', 'gross revenue'],
  },
  {
    key: 'min_amount',
    label: 'Min amount',
    kind: 'number',
    aliases: ['min amount', 'minimum', 'min funding', 'low', 'from'],
  },
  {
    key: 'max_amount',
    label: 'Max amount',
    kind: 'number',
    aliases: ['max amount', 'maximum', 'max funding', 'limit', 'credit limit', 'high', 'up to', 'amount'],
  },
  {
    key: 'interest_rate_range',
    label: 'APR / rate notes',
    kind: 'text',
    aliases: ['apr', 'rate', 'interest', 'interest rate', 'rate range', 'apr range'],
  },
  {
    key: 'funding_speed',
    label: 'Funding speed',
    kind: 'text',
    aliases: ['speed', 'funding speed', 'time to fund', 'turnaround'],
  },
  {
    key: 'membership_method',
    label: 'Membership method (credit unions)',
    kind: 'text',
    aliases: ['membership', 'membership method', 'how to join', 'eligibility', 'join'],
  },
  {
    key: 'reports_to',
    label: 'Reports to (bureaus)',
    kind: 'array',
    aliases: ['reports to', 'bureaus', 'reporting', 'reports'],
    hint: 'Comma-separated, e.g. Experian, Equifax, Dun & Bradstreet',
  },
  {
    key: 'no_pg',
    label: 'No personal guarantee',
    kind: 'boolean',
    aliases: ['no pg', 'no personal guarantee', 'pg required', 'personal guarantee', 'without pg'],
  },
  {
    key: 'requires_collateral',
    label: 'Requires collateral',
    kind: 'boolean',
    aliases: ['collateral', 'requires collateral', 'secured'],
  },
  {
    key: 'requires_tax_returns',
    label: 'Requires tax returns',
    kind: 'boolean',
    aliases: ['tax returns', 'requires tax returns', 'taxes'],
  },
  {
    key: 'accepts_bank_statements',
    label: 'Accepts bank statements',
    kind: 'boolean',
    aliases: ['bank statements', 'accepts bank statements', 'stated income'],
  },
  {
    key: 'has_soft_pull_prequal',
    label: 'Soft-pull prequal',
    kind: 'boolean',
    aliases: ['soft pull', 'prequal', 'pre-qual', 'soft pull prequal', 'preapproval'],
  },
  {
    key: 'docs_required',
    label: 'Documents required',
    kind: 'array',
    aliases: ['docs', 'documents', 'docs required', 'documents required', 'requirements'],
  },
  {
    key: 'stack_priority',
    label: 'Stack priority (apply order)',
    kind: 'integer',
    aliases: ['stack priority', 'priority', 'order', 'apply order', 'sequence', 'step'],
    hint: 'Lower number = apply earlier',
  },
  {
    key: 'inquiry_sensitivity',
    label: 'Inquiry sensitivity',
    kind: 'enum',
    options: [...INQUIRY_SENSITIVITY],
    aliases: ['inquiry sensitivity', 'inquiries', 'inquiry', 'sensitivity', 'inquiry tolerance'],
  },
  {
    key: 'best_paired_with',
    label: 'Best paired with',
    kind: 'array',
    aliases: ['best paired with', 'pairs with', 'pair with', 'stack with', 'combine with'],
  },
  {
    key: 'submission_method',
    label: 'Submission method',
    kind: 'enum',
    options: [...SUBMISSION_METHODS],
    aliases: ['submission', 'submission method', 'how to apply', 'apply method', 'automation'],
    hint: 'api, browser or manual — defaults to manual',
  },
  {
    key: 'automation_allowed',
    label: 'Automation allowed by ToS',
    kind: 'boolean',
    aliases: ['automation allowed', 'tos allows', 'allows automation', 'tos'],
  },
  {
    key: 'application_url',
    label: 'Application URL',
    kind: 'text',
    aliases: ['url', 'link', 'application url', 'apply url', 'website', 'application link'],
  },
  {
    key: 'prequal_url',
    label: 'Prequal URL',
    kind: 'text',
    aliases: ['prequal url', 'prequal link', 'soft pull url'],
  },
  {
    key: 'notes',
    label: 'Notes',
    kind: 'text',
    aliases: ['notes', 'note', 'comments', 'detail', 'details', 'strategy'],
  },
  {
    key: 'external_ref',
    label: 'External reference / ID',
    kind: 'text',
    aliases: ['id', 'ref', 'reference', 'external id', 'external ref', 'key', 'code'],
    hint: 'Optional stable ID. Re-importing the same ref updates the row instead of duplicating it.',
  },
];

export const FIELD_BY_KEY: Record<string, ImportField> = Object.fromEntries(
  LENDER_FIELDS.map((f) => [f.key, f]),
);

const TRUTHY = new Set(['true', 'yes', 'y', '1', 'x', 'required', 'reqd', '✓', 'checked']);
const FALSY = new Set(['false', 'no', 'n', '0', '', '-', 'none', 'n/a', 'na', 'not required']);

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[_\-/\\.]+/g, ' ').replace(/[^a-z0-9 &]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Best-effort auto-mapping of workbook headers onto import fields.
 * Exact alias match wins over a substring match; each field is claimed once.
 */
export function autoMapColumns(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const claimed = new Set<string>();

  const score = (normalized: string, field: ImportField): number => {
    let best = 0;
    for (const alias of field.aliases) {
      if (normalized === alias) return 100;
      if (normalized.startsWith(alias) || normalized.endsWith(alias)) best = Math.max(best, 70);
      else if (normalized.includes(alias)) best = Math.max(best, 50);
    }
    return best;
  };

  const candidates: Array<{ header: string; key: string; score: number }> = [];
  for (const header of headers) {
    const normalized = normalizeHeader(header);
    if (!normalized) continue;
    for (const field of LENDER_FIELDS) {
      const s = score(normalized, field);
      if (s > 0) candidates.push({ header, key: field.key, score: s });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  for (const candidate of candidates) {
    if (mapping[candidate.header] || claimed.has(candidate.key)) continue;
    mapping[candidate.header] = candidate.key;
    claimed.add(candidate.key);
  }

  return mapping;
}

export interface CoercionResult {
  value: unknown;
  error?: string;
}

/** Strips currency symbols, thousands separators, and trailing units like "k"/"mm". */
function parseNumeric(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, '').replace(/[()]/g, '');
  const multiplier = /k$/i.test(cleaned) ? 1_000 : /(m|mm)$/i.test(cleaned) ? 1_000_000 : 1;
  const numeric = parseFloat(cleaned.replace(/(k|mm|m)$/i, ''));
  if (Number.isNaN(numeric)) return null;
  const signed = /^\(/.test(raw.trim()) ? -numeric : numeric;
  return signed * multiplier;
}

export function coerceValue(field: ImportField, rawInput: unknown): CoercionResult {
  if (rawInput === null || rawInput === undefined) return { value: null };
  const raw = String(rawInput).trim();
  if (raw === '' || raw === '-' || raw.toLowerCase() === 'n/a') return { value: null };

  switch (field.kind) {
    case 'text':
      return { value: raw };

    case 'number':
    case 'integer': {
      const parsed = parseNumeric(raw);
      if (parsed === null) return { value: null, error: `"${raw}" is not a number` };
      return { value: field.kind === 'integer' ? Math.round(parsed) : parsed };
    }

    case 'boolean': {
      const lower = raw.toLowerCase();
      if (TRUTHY.has(lower)) return { value: true };
      if (FALSY.has(lower)) return { value: false };
      return { value: null, error: `"${raw}" is not a yes/no value` };
    }

    case 'array': {
      const items = raw
        .split(/[,;|\n]/)
        .map((part) => part.trim())
        .filter(Boolean);
      return { value: items };
    }

    case 'enum': {
      const normalized = raw.toLowerCase().replace(/[\s-]+/g, '_');
      const match = field.options?.find(
        (option) => option === normalized || option.replace(/_/g, '') === normalized.replace(/_/g, ''),
      );
      if (match) return { value: match };
      return { value: null, error: `"${raw}" must be one of: ${field.options?.join(', ')}` };
    }

    default:
      return { value: raw };
  }
}

export interface ParsedRow {
  rowNumber: number;
  record: Record<string, unknown>;
  errors: string[];
}

/**
 * Applies the column mapping to raw sheet rows and coerces every mapped value.
 * `no_pg` inverts when the source header describes a *required* guarantee.
 */
export function buildRows(
  rawRows: Array<Record<string, unknown>>,
  mapping: Record<string, string>,
  sourceTab: string,
): ParsedRow[] {
  const invertedHeaders = new Set(
    Object.keys(mapping).filter((header) => {
      const normalized = normalizeHeader(header);
      return (
        mapping[header] === 'no_pg' &&
        (normalized.includes('pg required') || normalized === 'personal guarantee' || normalized.includes('requires pg'))
      );
    }),
  );

  return rawRows.map((rawRow, index) => {
    const record: Record<string, unknown> = {};
    const errors: string[] = [];

    for (const [header, fieldKey] of Object.entries(mapping)) {
      if (!fieldKey) continue;
      const field = FIELD_BY_KEY[fieldKey];
      if (!field) continue;

      const { value, error } = coerceValue(field, rawRow[header]);
      if (error) {
        errors.push(`${field.label}: ${error}`);
        continue;
      }
      if (value === null || (Array.isArray(value) && value.length === 0)) continue;

      record[fieldKey] = invertedHeaders.has(header) && typeof value === 'boolean' ? !value : value;
    }

    if (!record.lender_name) errors.push('Lender name is required');

    // A lender may only be automated when its route is api/browser and ToS permits.
    if (record.submission_method === 'manual') record.automation_allowed = false;
    if (record.automation_allowed === undefined) record.automation_allowed = false;
    if (!record.submission_method) record.submission_method = 'manual';
    record.source_tab = sourceTab;
    record.is_active = true;

    return { rowNumber: index + 2, record, errors };
  });
}
