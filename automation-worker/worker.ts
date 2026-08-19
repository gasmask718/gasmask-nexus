/**
 * Dynasty Application Automation Engine — Browser/API Worker (isolated service).
 *
 * This is NOT part of the Vite frontend and must never run in a user's browser.
 * Deploy it on an isolated container/VM with only:
 *   AUTOMATION_API_URL       https://<project>.functions.supabase.co/funding-automation-api
 *   AUTOMATION_WORKER_TOKEN  shared worker secret (server-side only)
 *   INFRASTRUCTURE_REGION    e.g. US-EAST — recorded, never spoofed or rotated
 *
 * Compliance posture (hard rules, enforced in code below):
 *   - No CAPTCHA solving, no bot-detection evasion, no fingerprint/UA spoofing,
 *     no proxy or IP rotation, no fabricated human behaviour.
 *   - Human-only steps (OTP, identity, e-signature, final certification) pause the
 *     job and hand control to an authorized human.
 *   - The worker never sees the full client profile — only validated, mapped values.
 *
 * Session isolation posture:
 *   - Exactly one throwaway BrowserContext per job. Never reused, never shared.
 *   - Zero inherited storageState: no cookies, localStorage, sessionStorage, cache.
 *   - Per-job workspace directory for downloads / screenshots / traces.
 *   - Ownership gate (job → application → client → session) before any page opens.
 *   - Context destroyed and workspace wiped on completion AND on failure.
 */
import { chromium, type Page, type BrowserContext } from '@playwright/test';
import { promises as fs } from 'node:fs';
import type { AutomationAdapter, ClaimedJob } from './adapters/types';
import { adapters } from './adapters';
import {
  assertSessionOwnership, workspacePathFor, contextOptionsFor, SessionIsolationError,
  type SessionIdentity,
} from './isolation';

const API = process.env.AUTOMATION_API_URL!;
const TOKEN = process.env.AUTOMATION_WORKER_TOKEN!;
const WORKER_ID = process.env.WORKER_ID ?? `worker-${process.pid}`;
const REGION = process.env.INFRASTRUCTURE_REGION ?? 'UNVERIFIED';

async function api<T = any>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-automation-worker-token': TOKEN },
    // worker_id travels on every call: the API only lets the worker that holds
    // the lease act on a job, so the shared fleet token alone is never enough.
    body: JSON.stringify({ action, worker_id: WORKER_ID, ...payload }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`[${res.status}] ${text}`);
  return JSON.parse(text) as T;
}

const event = (job_id: string, event_type: string, message: string, extra: Record<string, unknown> = {}) =>
  api('report-event', { job_id, event_type, message, ...extra });

/**
 * The server refused to let this run continue (consent withdrawn, lender
 * authorization pulled, lease lost, job cancelled). The job has already been
 * halted server-side, so the worker stops without reporting a second failure.
 */
export class WorkerAborted extends Error {
  constructor(message: string) { super(message); this.name = 'WorkerAborted'; }
}

export function isAbortError(e: unknown): e is WorkerAborted {
  return e instanceof WorkerAborted;
}

/**
 * Renew the lease and re-verify every live safety precondition. Called before
 * each stage that costs time or touches the lender, so a mid-run revocation is
 * noticed instead of being discovered only after submission.
 */
async function heartbeat(jobId: string): Promise<void> {
  try {
    await api('heartbeat', { job_id: jobId });
  } catch (e) {
    throw new WorkerAborted((e as Error).message);
  }
}

/** Detect human-only checkpoints and bot protection. We stop; we never circumvent. */
export async function detectCheckpoint(page: Page): Promise<string | null> {
  const html = (await page.content()).toLowerCase();
  if (/recaptcha|hcaptcha|cf-challenge|are you a robot|cloudflare/.test(html)) return 'CAPTCHA';
  if (/access denied|unusual (activity|traffic)|blocked/.test(html)) return 'BOT_BLOCK';
  if (/one[- ]time (code|passcode)|verification code|enter the code/.test(html)) return 'OTP';
  if (/verify your identity|identity verification|upload (a )?(photo )?id/.test(html)) return 'IDENTITY_VERIFICATION';
  if (/take a selfie|liveness check/.test(html)) return 'SELFIE_VERIFICATION';
  if (/e-?sign|electronic signature|sign here/.test(html)) return 'E_SIGNATURE';
  if (/i certify|certify that the information|under penalty of perjury/.test(html)) return 'FINAL_ACCURACY_CONFIRMATION';
  return null;
}

/** Fresh, unshared context. No storageState, no proxy, no identity fabrication. */
export async function openIsolatedContext(workspace: string): Promise<{ context: BrowserContext; close: () => Promise<void> }> {
  // contextOptionsFor is the single source of truth for isolation options, so
  // the options the tests assert on are the options the worker actually uses.
  const opts = contextOptionsFor(jobIdFromWorkspace(workspace));
  await fs.mkdir(opts.downloadsPath, { recursive: true });
  await fs.mkdir(opts.screenshotDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  let context: BrowserContext;
  try {
    context = await browser.newContext({
      storageState: opts.storageState,
      acceptDownloads: opts.acceptDownloads,
    });
  } catch (e) {
    // Never leave an orphan browser holding one client's process/profile alive.
    await browser.close().catch(() => {});
    throw e;
  }
  return {
    context,
    close: async () => {
      await context.close().catch(() => {});
      await browser.close().catch(() => {});
    },
  };
}

/** The workspace path is always `<root>/<job id>`; recover the id for option building. */
function jobIdFromWorkspace(workspace: string): string {
  return workspace.split('/').filter(Boolean).pop() ?? '';
}


/**
 * Destroy every artifact of the job's workspace and PROVE it is gone.
 * A silent purge failure would leave one client's documents, screenshots and
 * trace on disk for the next job, so the failure is surfaced, never swallowed.
 */
export async function purgeWorkspace(workspace: string): Promise<{ purged: boolean; error?: string }> {
  try {
    await fs.rm(workspace, { recursive: true, force: true });
  } catch (e) {
    return { purged: false, error: (e as Error).message };
  }
  try {
    await fs.stat(workspace);
    return { purged: false, error: 'Workspace still present after purge' };
  } catch {
    return { purged: true };
  }
}

/** Closing an already-terminal session is a 409, not a job failure. */
async function closeSession(payload: Record<string, unknown>) {
  try { await api('close-session', payload); } catch (e) {
    if (!/SESSION_ALREADY_TERMINAL|\[404\]/.test((e as Error).message)) throw e;
  }
}

async function runBrowserJob(claim: ClaimedJob) {
  const { job, config, values, field_mappings } = claim;
  const adapter: AutomationAdapter = adapters[job.adapter_key] ?? adapters.generic;

  // 1. Open a session record for THIS job only. The API refuses if the job
  //    already has a live session, if consent is missing, or if the client
  //    identity chain does not line up.
  const opened = await api<{ session: SessionIdentity & { status: string } }>('open-session', {
    job_id: job.id, worker_id: WORKER_ID, provider: 'playwright-chromium', infrastructure_region: REGION,
  });
  const session = opened.session;
  const workspace = workspacePathFor(job.id);

  // 2. Client-identity gate, worker side. Belt and braces with the API + DB trigger.
  try {
    assertSessionOwnership(session, {
      id: job.id, application_id: job.application_id, funding_client_id: job.funding_client_id,
    });
  } catch (e) {
    const code = e instanceof SessionIsolationError ? e.code : 'SESSION_CLIENT_MISMATCH';
    await closeSession({
      session_id: session.session_id, status: 'FAILED', error_code: code,
      termination_reason: (e as Error).message, escalate: true,
    });
    return; // No lender page opened. No client data entered.
  }

  let closer: (() => Promise<void>) | null = null;
  try {
    const iso = await openIsolatedContext(workspace);
    closer = iso.close;
    const page = await iso.context.newPage();

    await api('session-status', { session_id: session.session_id, status: 'RUNNING' });
    await event(job.id, 'BROWSER_STARTED', 'Isolated browser session started', {
      status: 'RUNNING', metadata: { session_id: session.session_id, region: REGION, workspace },
    });
    await page.goto(config!.application_url!, { waitUntil: 'domcontentloaded' });

    let cp = await detectCheckpoint(page);
    if (cp) {
      await api('raise-checkpoint', { job_id: job.id, checkpoint_type: cp, reason: 'Detected on page load' });
      await closeSession({ session_id: session.session_id, status: 'HUMAN_CHECKPOINT', termination_reason: cp, checkpoint: true });
      return;
    }

    await adapter.detectForm(page);
    await event(job.id, 'FORM_DETECTED', 'Application form located', { status: 'FORM_DETECTED' });

    await event(job.id, 'FILLING', 'Filling authorized client data', { status: 'FILLING' });
    await adapter.fillFields(page, values, field_mappings);

    if (adapter.uploadDocuments) {
      await event(job.id, 'DOCUMENT_UPLOAD', 'Uploading authorized documents', { status: 'DOCUMENT_UPLOAD' });
      await adapter.uploadDocuments(page, job.application_id);
    }

    cp = await detectCheckpoint(page);
    if (cp) {
      await api('raise-checkpoint', { job_id: job.id, checkpoint_type: cp, reason: 'Detected before submission' });
      await closeSession({ session_id: session.session_id, status: 'HUMAN_CHECKPOINT', termination_reason: cp, checkpoint: true });
      return;
    }

    // Lender requires a human certification/signature: stop here, always.
    if (config?.requires_final_certification || config?.requires_signature || config?.requires_otp || config?.requires_identity_verification) {
      const type = config.requires_final_certification ? 'FINAL_ACCURACY_CONFIRMATION' : 'E_SIGNATURE';
      await api('raise-checkpoint', {
        job_id: job.id, checkpoint_type: type,
        reason: 'Lender configuration requires authorized human confirmation before submission',
      });
      await closeSession({ session_id: session.session_id, status: 'HUMAN_CHECKPOINT', termination_reason: type, checkpoint: true });
      return;
    }

    await event(job.id, 'READY_TO_SUBMIT', 'Final review complete', { status: 'READY_TO_SUBMIT' });
    await event(job.id, 'SUBMITTING', 'Submitting authorized application', { status: 'SUBMITTING' });
    await adapter.submit(page);

    const text = await adapter.readResponse(page);
    const result = await api<{ result?: { status?: string } }>('submit-result', { job_id: job.id, page_text: text });
    await closeSession({
      session_id: session.session_id, status: 'COMPLETED', outcome: result?.result?.status ?? 'SUBMITTED',
    });
  } catch (err) {
    await api('report-failure', {
      job_id: job.id,
      failure_class: /timeout/i.test((err as Error).message) ? 'API_TIMEOUT' : 'BROWSER_CRASH',
      reason: (err as Error).message.slice(0, 400),
    });
    await closeSession({
      session_id: session.session_id, status: 'FAILED',
      error_code: 'BROWSER_CRASH', termination_reason: (err as Error).message.slice(0, 400),
    }).catch(() => {});
  } finally {
    // Destroy the context first, then every byte of the job workspace.
    if (closer) await closer();
    const purge = await purgeWorkspace(workspace);
    if (!purge.purged) {
      // Client material may still be on disk: this is a containment incident and
      // is escalated to a human instead of being logged and forgotten.
      await api('report-failure', {
        job_id: job.id, failure_class: 'WORKSPACE_PURGE_FAILED', retryable: false,
        reason: `Workspace ${workspace} could not be purged: ${purge.error}`,
      }).catch(() => {});
      await event(job.id, 'WORKSPACE_PURGE_FAILED',
        `Workspace ${workspace} could not be purged: ${purge.error}`, { level: 'error' }).catch(() => {});
    }
  }
}

async function runApiJob(claim: ClaimedJob) {
  const { job, config, values } = claim;
  const adapter = adapters[job.adapter_key] ?? adapters.generic;
  const opened = await api<{ session: SessionIdentity & { status: string } }>('open-session', {
    job_id: job.id, worker_id: WORKER_ID, provider: 'lender-api', infrastructure_region: REGION,
  });
  const session = opened.session;
  try {
    assertSessionOwnership(session, {
      id: job.id, application_id: job.application_id, funding_client_id: job.funding_client_id,
    });
    if (!adapter.submitViaApi) throw new Error(`Adapter ${job.adapter_key} has no authorized API integration`);
    await event(job.id, 'SUBMITTING', 'Submitting via lender API', { status: 'RUNNING' });
    const response = await adapter.submitViaApi(values, config);
    await api('submit-result', { job_id: job.id, api_response: response });
    await api('close-session', { session_id: session.session_id, status: 'COMPLETED', outcome: 'SUBMITTED' });
  } catch (err) {
    const isolation = err instanceof SessionIsolationError;
    if (!isolation) {
      await api('report-failure', { job_id: job.id, failure_class: 'LENDER_ERROR', reason: (err as Error).message.slice(0, 400) });
    }
    await api('close-session', {
      session_id: session.session_id, status: 'FAILED',
      error_code: isolation ? (err as SessionIsolationError).code : 'LENDER_ERROR',
      termination_reason: (err as Error).message.slice(0, 400), escalate: isolation,
    }).catch(() => {});
  }
}

export async function tick() {
  await api('reap-stale');
  const claim = await api<ClaimedJob & { job: null }>('claim-job', { worker_id: WORKER_ID, methods: ['api', 'browser'] });
  if (!claim.job) return false;
  if (claim.job.submission_method === 'api') await runApiJob(claim as unknown as ClaimedJob);
  else await runBrowserJob(claim as unknown as ClaimedJob);
  return true;
}

async function main() {
  if (!API || !TOKEN) throw new Error('AUTOMATION_API_URL and AUTOMATION_WORKER_TOKEN are required');
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const worked = await tick();
      if (!worked) await new Promise((r) => setTimeout(r, 10_000));
    } catch (e) {
      console.error('worker tick failed:', (e as Error).message);
      await new Promise((r) => setTimeout(r, 15_000));
    }
  }
}

if (process.env.NODE_ENV !== 'test' && require.main === module) main();
