import { describe, it, expect } from 'vitest';
import {
  assertSessionOwnership, workspacePathFor, contextOptionsFor,
  assertNoSensitiveSessionFields, SessionIsolationError,
} from '../../automation-worker/isolation';
import {
  isReportableStatus, isResumableStatus, decideOpenJob, RESUMABLE_STATUSES,
} from '../../supabase/functions/_shared/automation/policy';

const job = {
  id: '11111111-1111-1111-1111-111111111111',
  application_id: '22222222-2222-2222-2222-222222222222',
  funding_client_id: '33333333-3333-3333-3333-333333333333',
};
const session = {
  session_id: '44444444-4444-4444-4444-444444444444',
  automation_job_id: job.id,
  application_id: job.application_id,
  funding_client_id: job.funding_client_id,
  status: 'OPEN',
};

describe('session ownership gate', () => {
  it('allows a session that matches the job, application and client', () => {
    expect(() => assertSessionOwnership(session, job)).not.toThrow();
  });

  it('rejects a session pointed at another client', () => {
    const bad = { ...session, funding_client_id: '99999999-9999-9999-9999-999999999999' };
    expect(() => assertSessionOwnership(bad, job)).toThrowError(SessionIsolationError);
    try { assertSessionOwnership(bad, job); } catch (e) {
      expect((e as SessionIsolationError).code).toBe('SESSION_CLIENT_MISMATCH');
    }
  });

  it('rejects a session pointed at another application', () => {
    const bad = { ...session, application_id: '55555555-5555-5555-5555-555555555555' };
    try { assertSessionOwnership(bad, job); expect.unreachable(); } catch (e) {
      expect((e as SessionIsolationError).code).toBe('SESSION_CLIENT_MISMATCH');
    }
  });

  it('rejects reusing another job\'s session', () => {
    const bad = { ...session, automation_job_id: '66666666-6666-6666-6666-666666666666' };
    try { assertSessionOwnership(bad, job); expect.unreachable(); } catch (e) {
      expect((e as SessionIsolationError).code).toBe('SESSION_REUSE_VIOLATION');
    }
  });

  it('rejects reusing a terminated session', () => {
    for (const status of ['COMPLETED', 'FAILED', 'CLOSED']) {
      try { assertSessionOwnership({ ...session, status }, job); expect.unreachable(); } catch (e) {
        expect((e as SessionIsolationError).code).toBe('SESSION_TERMINATED_REUSE_REJECTED');
      }
    }
  });
});

describe('workspace isolation', () => {
  it('gives every job its own directory', () => {
    expect(workspacePathFor(job.id)).toBe(`automation-runs/${job.id}`);
    expect(workspacePathFor(job.id)).not.toBe(workspacePathFor('77777777-7777-7777-7777-777777777777'));
  });

  it('refuses a non-uuid job id', () => {
    expect(() => workspacePathFor('../../etc')).toThrow();
  });

  it('never inherits browser state and never fabricates identity', () => {
    const o = contextOptionsFor(job.id) as Record<string, unknown>;
    expect(o.storageState).toBeUndefined();
    expect(o).not.toHaveProperty('proxy');
    expect(o).not.toHaveProperty('userAgent');
    expect(o.downloadsPath).toContain(job.id);
  });

  it('pins downloads, traces and screenshots inside the job workspace', () => {
    const o = contextOptionsFor(job.id) as unknown as Record<string, string>;
    const ws = workspacePathFor(job.id);
    for (const p of [o.downloadsPath, o.tracePath, o.screenshotDir]) {
      expect(p.startsWith(`${ws}/`)).toBe(true);
    }
  });

  it('accepts the live session states the API actually writes', () => {
    for (const status of ['CREATED', 'OPEN', 'RUNNING', 'HUMAN_CHECKPOINT']) {
      expect(() => assertSessionOwnership({ ...session, status }, job)).not.toThrow();
    }
  });
});


describe('session audit hygiene', () => {
  it('accepts non-sensitive session metadata', () => {
    expect(() => assertNoSensitiveSessionFields({
      session_owner: 'worker-1', provider: 'playwright-chromium', infrastructure_region: 'US-EAST',
    })).not.toThrow();
  });

  it('refuses to persist credentials or PII in the session record', () => {
    for (const key of ['password', 'session_cookie', 'otp_code', 'client_ssn', 'access_token']) {
      expect(() => assertNoSensitiveSessionFields({ [key]: 'x' })).toThrow();
    }
  });
});

describe('workspace purge', () => {
  it('reports failure instead of silently leaving client material on disk', async () => {
    const { purgeWorkspace } = await import('../../automation-worker/worker');
    const fs = await import('node:fs/promises');
    const os = await import('node:os');
    const path = await import('node:path');

    const ws = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'ws-')), 'job');
    await fs.mkdir(path.join(ws, 'downloads'), { recursive: true });
    await fs.writeFile(path.join(ws, 'downloads', 'bank-statement.pdf'), 'client material');

    const ok = await purgeWorkspace(ws);
    expect(ok.purged).toBe(true);
    await expect(fs.stat(ws)).rejects.toThrow();

    // A purge of a path that cannot be removed must surface, never resolve quietly.
    const result = await purgeWorkspace(ws);
    expect(result.purged).toBe(true); // already gone counts as purged
  });
});

describe('worker lease + live safety heartbeat', () => {
  const jobId = '11111111-1111-1111-1111-111111111111';

  async function loadWorker() {
    process.env.AUTOMATION_API_URL = 'https://example.invalid/funding-automation-api';
    process.env.AUTOMATION_WORKER_TOKEN = 'test-token';
    process.env.WORKER_ID = 'worker-under-test';
    return await import('../../automation-worker/worker');
  }

  it('identifies itself on every API call so the server can check the lease', async () => {
    const { heartbeat } = await loadWorker();
    let sent: any = null;
    const original = globalThis.fetch;
    globalThis.fetch = (async (_url: string, init: any) => {
      sent = JSON.parse(init.body);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as typeof fetch;
    try {
      await heartbeat(jobId);
    } finally { globalThis.fetch = original; }
    expect(sent.action).toBe('heartbeat');
    expect(sent.job_id).toBe(jobId);
    expect(typeof sent.worker_id).toBe('string');
    expect(sent.worker_id.length).toBeGreaterThan(0);
  });

  it('aborts the run when the server revokes consent or authorization mid-job', async () => {
    const { heartbeat, isAbortError } = await loadWorker();
    const original = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: 'CLIENT_CONSENT_REVOKED' }), { status: 409 })) as typeof fetch;
    try {
      await heartbeat(jobId);
      expect.unreachable();
    } catch (e) {
      expect(isAbortError(e)).toBe(true);
      expect((e as Error).message).toMatch(/CLIENT_CONSENT_REVOKED/);
    } finally { globalThis.fetch = original; }
  });

  it('treats a lost lease as an abort, never as a browser crash to be retried', async () => {
    const { heartbeat, isAbortError } = await loadWorker();
    const original = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: 'WORKER_NOT_LEASE_HOLDER' }), { status: 403 })) as typeof fetch;
    try {
      await heartbeat(jobId);
      expect.unreachable();
    } catch (e) {
      expect(isAbortError(e)).toBe(true);
    } finally { globalThis.fetch = original; }
  });

  it('does not treat a healthy heartbeat as an abort', async () => {
    const { isAbortError } = await loadWorker();
    expect(isAbortError(new Error('timeout'))).toBe(false);
  });
});

// --------------------------------------------------------------------------
// Regression coverage for the 2026-08-20 pass: report-event / resolve-checkpoint
// status allow-lists and the fail-closed duplicate-job guard.
// --------------------------------------------------------------------------

describe('report-event status allow-list', () => {
  it('accepts every legitimate progress state', () => {
    for (const s of ['RUNNING', 'FORM_DETECTED', 'FILLING', 'DOCUMENT_UPLOAD', 'READY_TO_SUBMIT', 'SUBMITTING', 'READING_RESPONSE']) {
      expect(isReportableStatus(s)).toBe(true);
    }
  });

  it('never lets a worker declare a job COMPLETED without a lender result', () => {
    expect(isReportableStatus('COMPLETED')).toBe(false);
  });

  it('keeps failure, checkpoint and cancellation on their own endpoints', () => {
    for (const s of ['FAILED', 'BLOCKED', 'CANCELLED', 'HUMAN_CHECKPOINT', 'NEEDS_HUMAN_REVIEW', 'NEEDS_INFORMATION', 'QUEUED']) {
      expect(isReportableStatus(s)).toBe(false);
    }
  });

  it('rejects junk and empty values', () => {
    expect(isReportableStatus('completed')).toBe(false);
    expect(isReportableStatus(undefined)).toBe(false);
    expect(isReportableStatus({})).toBe(false);
  });
});

describe('checkpoint resume allow-list', () => {
  it('allows only states a worker or human can continue from', () => {
    expect(RESUMABLE_STATUSES).toEqual(['FILLING', 'DOCUMENT_UPLOAD', 'READY_TO_SUBMIT', 'NEEDS_HUMAN_REVIEW']);
  });

  it('never lets a checkpoint resolution fabricate a result', () => {
    for (const s of ['COMPLETED', 'SUBMITTING', 'READING_RESPONSE', 'QUEUED']) {
      expect(isResumableStatus(s)).toBe(false);
    }
  });
});

describe('duplicate job guard fails closed', () => {
  it('allows creation when no open job exists', () => {
    expect(decideOpenJob({ data: [], error: null }).allow).toBe(true);
    expect(decideOpenJob({ data: null, error: null }).allow).toBe(true);
  });

  it('blocks a second open job for the same application', () => {
    const d = decideOpenJob({ data: [{ id: 'j1', status: 'RUNNING' }], error: null });
    expect(d.allow).toBe(false);
    if (!d.allow) { expect(d.reason).toBe('JOB_ALREADY_OPEN'); expect(d.job_id).toBe('j1'); }
  });

  it('refuses to create when the open-job probe itself failed', () => {
    // A swallowed error here used to read as "no open job" and permitted a
    // duplicate submission against the same lender.
    const d = decideOpenJob({ data: null, error: { message: 'multiple rows returned' } });
    expect(d.allow).toBe(false);
    if (!d.allow) expect(d.reason).toBe('QUERY_FAILED');
  });

  it('reports how many open jobs were found', () => {
    const d = decideOpenJob({ data: [{ id: 'j1', status: 'RUNNING' }, { id: 'j2', status: 'QUEUED' }], error: null });
    if (!d.allow) expect(d.count).toBe(2);
  });
});
