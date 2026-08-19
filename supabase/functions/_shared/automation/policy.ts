// Pure policy decisions for the Application Automation API.
// Kept out of index.ts so the rules that decide what a worker or an operator is
// allowed to do to a job are unit-testable without a live function.

/**
 * Progress states a worker may set through `report-event`.
 * Decisive states are deliberately excluded: COMPLETED is only reachable through
 * `submit-result` (which records a normalized lender result and updates Funding
 * Hub); failure, checkpoint and cancellation states belong to `report-failure`,
 * `raise-checkpoint` and the operator endpoints. Without this list a lease holder
 * could walk a job to COMPLETED with no lender result at all — a false green on
 * an application that was never submitted.
 */
export const REPORTABLE_STATUSES = [
  'RUNNING', 'FORM_DETECTED', 'FILLING', 'DOCUMENT_UPLOAD',
  'READY_TO_SUBMIT', 'SUBMITTING', 'READING_RESPONSE',
] as const;

/** States an operator may resume a checkpointed job into. Never a result state. */
export const RESUMABLE_STATUSES = [
  'FILLING', 'DOCUMENT_UPLOAD', 'READY_TO_SUBMIT', 'NEEDS_HUMAN_REVIEW',
] as const;

export function isReportableStatus(status: unknown): boolean {
  return (REPORTABLE_STATUSES as readonly string[]).includes(String(status));
}

export function isResumableStatus(status: unknown): boolean {
  return (RESUMABLE_STATUSES as readonly string[]).includes(String(status));
}

export type OpenJobProbe = {
  data: Array<{ id: string; status: string }> | null;
  error: { message: string } | null;
};

export type OpenJobDecision =
  | { allow: true }
  | { allow: false; reason: 'QUERY_FAILED' | 'JOB_ALREADY_OPEN'; detail: string; job_id?: string; status?: string; count?: number };

/**
 * Duplicate-submission guard for `create-job`, decided fail CLOSED.
 * A read that errors (for example more than one open row through a single-row
 * fetch) must never be read as "no open job" — that silently permits a second
 * live job, and therefore a second submission, against the same application.
 */
export function decideOpenJob(probe: OpenJobProbe): OpenJobDecision {
  if (probe.error) {
    return { allow: false, reason: 'QUERY_FAILED', detail: `Could not verify existing jobs: ${probe.error.message}` };
  }
  const rows = probe.data ?? [];
  if (rows.length) {
    return {
      allow: false, reason: 'JOB_ALREADY_OPEN',
      detail: 'An automation job is already open for this application',
      job_id: rows[0].id, status: rows[0].status, count: rows.length,
    };
  }
  return { allow: true };
}
