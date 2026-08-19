/**
 * Session isolation primitives for the Dynasty Application Automation worker.
 *
 * These are pure, unit-testable functions. They contain NO evasion logic:
 * no fingerprint fabrication, no proxy/IP rotation, no CAPTCHA handling,
 * no user-agent spoofing. Their only job is to guarantee that one automation
 * job === one client === one throwaway browser context === one workspace.
 */

export interface SessionIdentity {
  session_id: string;
  automation_job_id: string;
  application_id: string;
  funding_client_id: string;
}

export interface JobIdentity {
  id: string;
  application_id: string;
  funding_client_id: string;
}

export class SessionIsolationError extends Error {
  constructor(public code: SessionViolationCode, message: string) {
    super(message);
    this.name = 'SessionIsolationError';
  }
}

export type SessionViolationCode =
  | 'SESSION_CLIENT_MISMATCH'
  | 'SESSION_REUSE_VIOLATION'
  | 'SESSION_TERMINATED_REUSE_REJECTED';

const TERMINAL = ['COMPLETED', 'FAILED', 'CLOSED'];

/**
 * Hard gate run before any lender page is opened.
 * job.application_id → application.funding_client_id → session.funding_client_id
 * must all line up, or the job stops before any client data is typed anywhere.
 */
export function assertSessionOwnership(
  session: SessionIdentity & { status?: string },
  job: JobIdentity,
): void {
  if (session.automation_job_id !== job.id) {
    throw new SessionIsolationError(
      'SESSION_REUSE_VIOLATION',
      `Session ${session.session_id} belongs to job ${session.automation_job_id}, not ${job.id}`,
    );
  }
  if (session.application_id !== job.application_id) {
    throw new SessionIsolationError(
      'SESSION_CLIENT_MISMATCH',
      `Session application ${session.application_id} does not match job application ${job.application_id}`,
    );
  }
  if (session.funding_client_id !== job.funding_client_id) {
    throw new SessionIsolationError(
      'SESSION_CLIENT_MISMATCH',
      `Session client ${session.funding_client_id} does not match job client ${job.funding_client_id}`,
    );
  }
  if (session.status && TERMINAL.includes(session.status)) {
    throw new SessionIsolationError(
      'SESSION_TERMINATED_REUSE_REJECTED',
      `Session ${session.session_id} is ${session.status} and must never be reused`,
    );
  }
}

/** Per-job workspace. Never a shared directory. */
export function workspacePathFor(jobId: string, root = 'automation-runs'): string {
  if (!/^[0-9a-fA-F-]{16,}$/.test(jobId)) throw new Error('Refusing to build a workspace for a non-uuid job id');
  return `${root}/${jobId}`;
}

/**
 * Playwright context options for a single job.
 * Deliberately plain: default Chromium identity, no proxy, no stored state,
 * downloads pinned inside the job's own workspace.
 */
export function contextOptionsFor(jobId: string, root?: string) {
  const workspace = workspacePathFor(jobId, root);
  return {
    // No storageState → zero inherited cookies / localStorage / sessionStorage.
    storageState: undefined as undefined,
    acceptDownloads: true,
    // No proxy, no userAgent override, no viewport/device fabrication.
    workspace,
    downloadsPath: `${workspace}/downloads`,
    tracePath: `${workspace}/trace.zip`,
    screenshotDir: `${workspace}/screenshots`,
  };
}

/** Sensitive material that must never reach a session audit row or log line. */
const FORBIDDEN_SESSION_KEYS = [
  'password', 'passwd', 'secret', 'token', 'cookie', 'cookies', 'ssn', 'social_security',
  'mfa', 'otp', 'authorization', 'api_key', 'apikey', 'access_token', 'storage_state',
  'session_cookie', 'credential', 'credentials',
];

export function assertNoSensitiveSessionFields(record: Record<string, unknown>): void {
  for (const key of Object.keys(record)) {
    const k = key.toLowerCase();
    if (FORBIDDEN_SESSION_KEYS.some((f) => k.includes(f))) {
      throw new Error(`Refusing to persist sensitive session field: ${key}`);
    }
  }
}
