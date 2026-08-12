// Provider-neutral lender webhook event normalization.
// RULE: never invent a status. Anything unrecognised is rejected (400) or
// escalated to a human — it must NEVER silently mutate an application.

export type WebhookNormalizedStatus =
  | 'Preparing' | 'Applied' | 'Under Review' | 'Needs Information'
  | 'Approved' | 'Denied' | 'Funded' | 'Cancelled';

/** External lender vocabulary -> Dynasty's existing application status model. */
const STATUS_MAP: Record<string, WebhookNormalizedStatus> = {
  PREPARING: 'Preparing',
  SUBMITTED: 'Applied',
  APPLIED: 'Applied',
  RECEIVED: 'Applied',
  UNDER_REVIEW: 'Under Review',
  'UNDER REVIEW': 'Under Review',
  IN_REVIEW: 'Under Review',
  REVIEWING: 'Under Review',
  PENDING: 'Under Review',
  PROCESSING: 'Under Review',
  NEEDS_INFORMATION: 'Needs Information',
  'NEEDS INFORMATION': 'Needs Information',
  NEEDS_DOCUMENTS: 'Needs Information',
  DOCUMENTS_REQUIRED: 'Needs Information',
  INCOMPLETE: 'Needs Information',
  APPROVED: 'Approved',
  ACCEPTED: 'Approved',
  DECLINED: 'Denied',
  DENIED: 'Denied',
  REJECTED: 'Denied',
  FUNDED: 'Funded',
  DISBURSED: 'Funded',
  CANCELLED: 'Cancelled',
  CANCELED: 'Cancelled',
  WITHDRAWN: 'Cancelled',
};

export function normalizeWebhookStatus(raw: unknown): WebhookNormalizedStatus | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const key = raw.trim().toUpperCase().replace(/[-\s]+/g, '_');
  return STATUS_MAP[key] ?? STATUS_MAP[raw.trim().toUpperCase()] ?? null;
}

/** Statuses that carry a decision date when the provider omits one. */
export function isDecisionStatus(s: WebhookNormalizedStatus): boolean {
  return s === 'Approved' || s === 'Denied' || s === 'Funded';
}

/** Client-safe headline for the portal "recent updates" feed. */
export function clientUpdateTitle(s: WebhookNormalizedStatus): string {
  switch (s) {
    case 'Approved': return 'Your application was approved';
    case 'Denied': return 'A lender decision was received';
    case 'Funded': return 'Your funding has been disbursed';
    case 'Needs Information': return 'Additional information is needed';
    case 'Under Review': return 'Your application is under review';
    case 'Applied': return 'Your application was submitted';
    case 'Cancelled': return 'An application was cancelled';
    default: return 'Application update';
  }
}
