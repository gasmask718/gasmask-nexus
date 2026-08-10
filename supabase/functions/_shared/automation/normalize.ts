// Response normalization for the Dynasty Application Automation Engine.
// RULE: never fabricate a result. Ambiguity => NEEDS_HUMAN_REVIEW.

export type NormalizedStatus =
  | 'SUBMITTED' | 'PENDING' | 'APPROVED' | 'DECLINED'
  | 'NEEDS_DOCUMENTS' | 'NEEDS_HUMAN_REVIEW' | 'FAILED' | 'UNKNOWN';

export interface NormalizedResult {
  status: NormalizedStatus;
  lender_reference: string | null;
  approved_amount: number | null;
  next_action: string | null;
  decision_date: string | null;
  confidence: 'high' | 'low';
}

const AMOUNT_RE = /\$\s?([\d,]+(?:\.\d{2})?)/;
const REF_RE = /(?:reference|application|confirmation|case)\s*(?:id|number|#|no\.?)?\s*[:#]?\s*([A-Z0-9][A-Z0-9-]{4,})/i;

function parseAmount(text: string): number | null {
  const m = text.match(AMOUNT_RE);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** Structured (API) responses: trust explicit fields only. */
export function normalizeApiResponse(body: Record<string, any>): NormalizedResult {
  const rawStatus = String(body.status ?? body.decision ?? body.application_status ?? '').toUpperCase();
  const map: Record<string, NormalizedStatus> = {
    APPROVED: 'APPROVED', ACCEPTED: 'APPROVED', FUNDED: 'APPROVED',
    DECLINED: 'DECLINED', DENIED: 'DECLINED', REJECTED: 'DECLINED',
    PENDING: 'PENDING', IN_REVIEW: 'PENDING', UNDER_REVIEW: 'PENDING', PROCESSING: 'PENDING',
    SUBMITTED: 'SUBMITTED', RECEIVED: 'SUBMITTED',
    NEEDS_DOCUMENTS: 'NEEDS_DOCUMENTS', DOCUMENTS_REQUIRED: 'NEEDS_DOCUMENTS', INCOMPLETE: 'NEEDS_DOCUMENTS',
  };
  const status = map[rawStatus];
  const approved = body.approved_amount ?? body.approvedAmount ?? body.amount_approved ?? null;
  return {
    status: status ?? 'NEEDS_HUMAN_REVIEW',
    lender_reference: body.lender_reference ?? body.reference_id ?? body.application_id ?? body.id ?? null,
    approved_amount: status === 'APPROVED' && approved != null && Number.isFinite(Number(approved))
      ? Number(approved) : null,
    next_action: body.next_action ?? body.nextStep ?? null,
    decision_date: body.decision_date ?? null,
    confidence: status ? 'high' : 'low',
  };
}

/** Unstructured (browser page text) responses: conservative, single-signal only. */
export function normalizePageText(text: string): NormalizedResult {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  const lower = t.toLowerCase();

  const signals: NormalizedStatus[] = [];
  if (/\b(approved|congratulations,? you'?re approved|you have been approved)\b/.test(lower)) signals.push('APPROVED');
  if (/\b(declined|denied|unable to approve|not approved)\b/.test(lower)) signals.push('DECLINED');
  if (/\b(under review|in review|pending review|we are reviewing)\b/.test(lower)) signals.push('PENDING');
  if (/\b(upload|additional documents?|documents? required|we need)\b/.test(lower)) signals.push('NEEDS_DOCUMENTS');
  if (/\b(application (received|submitted)|thank you for (your )?applying|successfully submitted)\b/.test(lower)) signals.push('SUBMITTED');

  const unique = Array.from(new Set(signals));
  const reference = t.match(REF_RE)?.[1] ?? null;

  // Conflicting or absent signals => escalate to a human. Never guess.
  if (unique.length !== 1) {
    return {
      status: 'NEEDS_HUMAN_REVIEW',
      lender_reference: reference,
      approved_amount: null,
      next_action: unique.length > 1 ? 'Conflicting response signals detected' : 'Response could not be interpreted',
      decision_date: null,
      confidence: 'low',
    };
  }

  const status = unique[0];
  return {
    status,
    lender_reference: reference,
    approved_amount: status === 'APPROVED' ? parseAmount(t) : null,
    next_action: null,
    decision_date: null,
    confidence: 'high',
  };
}

/** Map a normalized automation result onto the Funding Hub application status vocabulary. */
export function toHubApplicationStatus(status: NormalizedStatus): string | null {
  switch (status) {
    case 'APPROVED': return 'Approved';
    case 'DECLINED': return 'Denied';
    case 'PENDING': return 'Under Review';
    case 'SUBMITTED': return 'Applied';
    case 'NEEDS_DOCUMENTS': return 'Under Review';
    default: return null; // FAILED / UNKNOWN / NEEDS_HUMAN_REVIEW never mutate Hub status
  }
}
