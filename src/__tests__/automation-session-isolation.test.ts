import { describe, it, expect } from 'vitest';
import {
  assertSessionOwnership, workspacePathFor, contextOptionsFor,
  assertNoSensitiveSessionFields, SessionIsolationError,
} from '../../automation-worker/isolation';

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
