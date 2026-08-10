/**
 * Dynasty Application Automation Engine — Browser/API Worker (isolated service).
 *
 * This is NOT part of the Vite frontend and must never run in a user's browser.
 * Deploy it on an isolated container/VM with only:
 *   AUTOMATION_API_URL       https://<project>.functions.supabase.co/funding-automation-api
 *   AUTOMATION_WORKER_TOKEN  shared worker secret (server-side only)
 *
 * Compliance posture (hard rules, enforced in code below):
 *   - No CAPTCHA solving, no bot-detection evasion, no fingerprint/UA spoofing,
 *     no proxy or IP rotation.
 *   - Human-only steps (OTP, identity, e-signature, final certification) pause the
 *     job and hand control to an authorized human.
 *   - The worker never sees the full client profile — only validated, mapped values.
 */
import { chromium, type Page } from '@playwright/test';
import type { AutomationAdapter, ClaimedJob } from './adapters/types';
import { adapters } from './adapters';

const API = process.env.AUTOMATION_API_URL!;
const TOKEN = process.env.AUTOMATION_WORKER_TOKEN!;
const WORKER_ID = process.env.WORKER_ID ?? `worker-${process.pid}`;

async function api<T = any>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-automation-worker-token': TOKEN },
    body: JSON.stringify({ action, ...payload }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`[${res.status}] ${text}`);
  return JSON.parse(text) as T;
}

const event = (job_id: string, event_type: string, message: string, extra: Record<string, unknown> = {}) =>
  api('report-event', { job_id, event_type, message, ...extra });

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

async function runBrowserJob(claim: ClaimedJob) {
  const { job, config, values, field_mappings } = claim;
  const adapter: AutomationAdapter = adapters[job.adapter_key] ?? adapters.generic;

  // Standard, unmodified browser identity. No spoofing, no proxy.
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await event(job.id, 'BROWSER_STARTED', 'Browser session started', { status: 'RUNNING' });
    await page.goto(config!.application_url!, { waitUntil: 'domcontentloaded' });

    let cp = await detectCheckpoint(page);
    if (cp) { await api('raise-checkpoint', { job_id: job.id, checkpoint_type: cp, reason: 'Detected on page load' }); return; }

    await adapter.detectForm(page);
    await event(job.id, 'FORM_DETECTED', 'Application form located', { status: 'FORM_DETECTED' });

    await event(job.id, 'FILLING', 'Filling authorized client data', { status: 'FILLING' });
    await adapter.fillFields(page, values, field_mappings);

    if (adapter.uploadDocuments) {
      await event(job.id, 'DOCUMENT_UPLOAD', 'Uploading authorized documents', { status: 'DOCUMENT_UPLOAD' });
      await adapter.uploadDocuments(page, job.application_id);
    }

    cp = await detectCheckpoint(page);
    if (cp) { await api('raise-checkpoint', { job_id: job.id, checkpoint_type: cp, reason: 'Detected before submission' }); return; }

    // Lender requires a human certification/signature: stop here, always.
    if (config?.requires_final_certification || config?.requires_signature || config?.requires_otp || config?.requires_identity_verification) {
      await api('raise-checkpoint', {
        job_id: job.id,
        checkpoint_type: config.requires_final_certification ? 'FINAL_ACCURACY_CONFIRMATION' : 'E_SIGNATURE',
        reason: 'Lender configuration requires authorized human confirmation before submission',
      });
      return;
    }

    await event(job.id, 'READY_TO_SUBMIT', 'Final review complete', { status: 'READY_TO_SUBMIT' });
    await event(job.id, 'SUBMITTING', 'Submitting authorized application', { status: 'SUBMITTING' });
    await adapter.submit(page);

    const text = await adapter.readResponse(page);
    await api('submit-result', { job_id: job.id, page_text: text });
  } catch (err) {
    await api('report-failure', {
      job_id: job.id,
      failure_class: /timeout/i.test((err as Error).message) ? 'API_TIMEOUT' : 'BROWSER_CRASH',
      reason: (err as Error).message.slice(0, 400),
    });
  } finally {
    await browser.close().catch(() => {});
  }
}

async function runApiJob(claim: ClaimedJob) {
  const { job, config, values } = claim;
  const adapter = adapters[job.adapter_key] ?? adapters.generic;
  try {
    if (!adapter.submitViaApi) throw new Error(`Adapter ${job.adapter_key} has no authorized API integration`);
    await event(job.id, 'SUBMITTING', 'Submitting via lender API', { status: 'RUNNING' });
    const response = await adapter.submitViaApi(values, config);
    await api('submit-result', { job_id: job.id, api_response: response });
  } catch (err) {
    await api('report-failure', { job_id: job.id, failure_class: 'LENDER_ERROR', reason: (err as Error).message.slice(0, 400) });
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
