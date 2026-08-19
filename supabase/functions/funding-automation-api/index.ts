// Dynasty Application Automation Engine — Automation API
// Execution layer only. Funding Hub (funding_applications / funding_clients /
// funding_lender_database) remains the system of record.
//
// Auth:
//   - Operators: Supabase JWT + owner/admin/employee/accountant role.
//   - Workers:   x-automation-worker-token header (AUTOMATION_WORKER_TOKEN secret).
// Secrets are NEVER returned to the caller.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import {
  buildCanonical, validateAndFormat, redact, type MappingRow,
} from '../_shared/automation/canonical.ts';
import {
  normalizeApiResponse, normalizePageText, toHubApplicationStatus,
  type NormalizedResult, type NormalizedStatus,
} from '../_shared/automation/normalize.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const WORKER_TOKEN = Deno.env.get('AUTOMATION_WORKER_TOKEN') ?? '';

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const RETRYABLE = ['NETWORK_ERROR', 'API_TIMEOUT', 'BROWSER_CRASH', 'LENDER_ERROR'];
const NEVER_AUTO_RETRY = ['CAPTCHA', 'BOT_BLOCK', 'INVALID_CLIENT_DATA', 'IDENTITY_VERIFICATION', 'FINAL_CERTIFICATION'];

async function logEvent(
  jobId: string, applicationId: string | null, eventType: string,
  message: string, metadata: Record<string, unknown> = {}, level: 'info' | 'warn' | 'error' = 'info',
  actor?: string | null,
) {
  await admin.from('automation_events').insert({
    automation_job_id: jobId,
    application_id: applicationId,
    event_type: eventType,
    message,
    level,
    metadata: redact(metadata),
    actor_user_id: actor ?? null,
  });
  await admin.from('automation_jobs').update({ last_event_at: new Date().toISOString() }).eq('id', jobId);
}

// Status transitions are written by the public.record_application_status RPC so
// the application row and its history entry always move together, with replay
// protection on event_id.



interface Caller { kind: 'operator' | 'worker'; userId: string | null }


async function authenticate(req: Request): Promise<Caller | null> {
  const workerToken = req.headers.get('x-automation-worker-token');
  if (workerToken && WORKER_TOKEN && workerToken === WORKER_TOKEN) {
    return { kind: 'worker', userId: null };
  }
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.replace('Bearer ', '');
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } }, auth: { persistSession: false },
  });
  // getClaims() throws on a structurally invalid JWT — a forged token must be
  // an unauthenticated caller (401), not a 500.
  let userId: string;
  try {
    const { data, error } = await userClient.auth.getClaims(token);
    if (error || !data?.claims?.sub) return null;
    userId = data.claims.sub as string;
  } catch {
    return null;
  }

  const { data: roles } = await admin.from('user_roles').select('role').eq('user_id', userId);
  const allowed = ['owner', 'admin', 'employee', 'accountant'];
  if (!roles?.some((r: { role: string }) => allowed.includes(r.role))) return null;
  return { kind: 'operator', userId };
}

/** Load the Funding Hub records + lender execution config for an application. */
async function loadContext(applicationId: string) {
  const { data: application, error } = await admin
    .from('funding_applications').select('*').eq('id', applicationId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!application) throw new Error('Application not found in Funding Hub');

  const [{ data: client }, { data: profile }] = await Promise.all([
    admin.from('funding_clients').select('*').eq('id', application.client_id).maybeSingle(),
    admin.from('funding_application_profile').select('*').eq('client_id', application.client_id).maybeSingle(),
  ]);

  // Lender resolution by name — Funding Hub stores lender_name on the application.
  const { data: lender } = await admin
    .from('funding_lender_database').select('*')
    .ilike('lender_name', application.lender_name ?? '').limit(1).maybeSingle();

  let config: Record<string, any> | null = null;
  if (lender?.id) {
    const { data } = await admin.from('lender_automation_config').select('*').eq('lender_id', lender.id).maybeSingle();
    config = data;
  }
  return { application, client, profile, lender, config };
}

function resolveMethod(requested: string | undefined, config: Record<string, any> | null, lender: Record<string, any> | null): string {
  // A lender that has not authorized automation is ALWAYS manual.
  if (!config || !config.active || !config.automation_authorized) return 'manual';
  if (lender && lender.automation_allowed === false) return 'manual';
  const want = requested ?? config.submission_method ?? 'manual';
  if (want === 'api' && config.api_enabled) return 'api';
  if (want === 'browser' && config.browser_enabled) return 'browser';
  if (config.api_enabled) return 'api';
  if (config.browser_enabled) return 'browser';
  return 'manual';
}

// ------------------------------- handlers -------------------------------

async function createJob(body: any, caller: Caller) {
  const applicationId = body.application_id;
  if (!applicationId) return json({ error: 'application_id is required' }, 400);

  const { application, client, profile, lender, config } = await loadContext(applicationId);

  // Idempotency: never allow a second open job for the same application.
  const { data: open } = await admin.from('automation_jobs')
    .select('id,status').eq('application_id', applicationId)
    .not('status', 'in', '("COMPLETED","FAILED","CANCELLED")').maybeSingle();
  if (open) return json({ error: 'An automation job is already open for this application', job_id: open.id, status: open.status }, 409);

  // Already submitted upstream? Do not risk a duplicate submission.
  const { data: prior } = await admin.from('automation_jobs')
    .select('id,lender_reference,result_status').eq('application_id', applicationId)
    .eq('submission_confirmed', true).limit(1).maybeSingle();
  if (prior && !body.force_resubmit) {
    return json({
      error: 'This application already has a confirmed submission. Human review required before resubmitting.',
      prior_job_id: prior.id, lender_reference: prior.lender_reference,
    }, 409);
  }

  const method = resolveMethod(body.submission_method, config, lender);

  // Validate BEFORE queuing: incomplete applications are never submitted.
  let missing: string[] = [];
  let invalid: string[] = [];
  if (method !== 'manual' && config) {
    const { data: mappings } = await admin.from('automation_field_mappings')
      .select('lender_field_label,canonical_field,field_kind,required,allowed_values')
      .eq('lender_config_id', config.id).order('sort_order');
    const canonical = buildCanonical({ application, client, profile });
    const v = validateAndFormat(canonical, (mappings ?? []) as MappingRow[]);
    missing = v.missing; invalid = v.invalid;
  }
  const needsInfo = missing.length > 0 || invalid.length > 0;

  const idempotencyKey = body.idempotency_key
    ?? `${applicationId}:${method}:${new Date().toISOString().slice(0, 10)}:${crypto.randomUUID().slice(0, 8)}`;

  const { data: job, error } = await admin.from('automation_jobs').insert({
    application_id: applicationId,
    client_id: application.client_id,
    lender_id: lender?.id ?? null,
    lender_name: application.lender_name,
    adapter_key: config?.adapter_key ?? 'manual',
    submission_method: method,
    status: 'CREATED',
    priority: body.priority ?? 5,
    max_attempts: config?.max_attempts ?? 3,
    requested_amount: application.requested_amount,
    missing_fields: [...missing, ...invalid],
    idempotency_key: idempotencyKey,
    created_by: caller.userId,
  }).select().single();
  if (error) return json({ error: error.message }, 400);

  await logEvent(job.id, applicationId, 'JOB_CREATED',
    `Automation job created (method=${method})`, { method, lender: application.lender_name }, 'info', caller.userId);

  const nextStatus = method === 'manual' ? 'NEEDS_INFORMATION' : needsInfo ? 'NEEDS_INFORMATION' : 'QUEUED';
  const patch: Record<string, unknown> = { status: nextStatus };
  if (nextStatus === 'QUEUED') patch.queued_at = new Date().toISOString();
  if (method === 'manual') {
    patch.requires_human_action = true;
    patch.human_action_type = 'MANUAL_SUBMISSION';
    patch.failure_reason = config ? 'Lender configured for manual submission' : 'No authorized automation config for this lender';
  } else if (needsInfo) {
    patch.failure_reason = `Missing/invalid fields: ${[...missing, ...invalid].join(', ')}`;
    patch.failure_class = 'INVALID_CLIENT_DATA';
    patch.requires_human_action = true;
    patch.human_action_type = 'PROVIDE_INFORMATION';
  }
  const { data: updated } = await admin.from('automation_jobs').update(patch).eq('id', job.id).select().single();
  await logEvent(job.id, applicationId, nextStatus, patch.failure_reason as string ?? 'Job queued for execution', {}, needsInfo ? 'warn' : 'info');

  return json({ job: updated ?? job, missing_fields: missing, invalid_fields: invalid });
}

async function listJobs(body: any) {
  let q = admin.from('automation_jobs').select('*').order('created_at', { ascending: false }).limit(body.limit ?? 200);
  if (body.status) q = q.eq('status', body.status);
  if (body.application_id) q = q.eq('application_id', body.application_id);
  const { data, error } = await q;
  if (error) return json({ error: error.message }, 400);
  return json({ jobs: data ?? [] });
}

async function getJob(body: any) {
  const { data: job, error } = await admin.from('automation_jobs').select('*').eq('id', body.job_id).maybeSingle();
  if (error || !job) return json({ error: error?.message ?? 'Job not found' }, 404);
  const [{ data: events }, { data: checkpoints }] = await Promise.all([
    admin.from('automation_events').select('*').eq('automation_job_id', job.id).order('created_at', { ascending: false }).limit(200),
    admin.from('automation_checkpoints').select('*').eq('automation_job_id', job.id).order('detected_at', { ascending: false }),
  ]);
  return json({ job, events: events ?? [], checkpoints: checkpoints ?? [] });
}

async function cancelJob(body: any, caller: Caller) {
  const { data: job } = await admin.from('automation_jobs').select('*').eq('id', body.job_id).maybeSingle();
  if (!job) return json({ error: 'Job not found' }, 404);
  if (['COMPLETED', 'CANCELLED'].includes(job.status)) return json({ error: `Job is ${job.status}` }, 409);
  const { error } = await admin.from('automation_jobs')
    .update({ status: 'CANCELLED', completed_at: new Date().toISOString() }).eq('id', job.id);
  if (error) return json({ error: error.message }, 400);
  await logEvent(job.id, job.application_id, 'JOB_CANCELLED', body.reason ?? 'Cancelled by operator', {}, 'warn', caller.userId);
  return json({ ok: true });
}

async function retryJob(body: any, caller: Caller) {
  const { data: job } = await admin.from('automation_jobs').select('*').eq('id', body.job_id).maybeSingle();
  if (!job) return json({ error: 'Job not found' }, 404);
  if (job.submission_confirmed) {
    return json({ error: 'Submission already confirmed with the lender — retry would duplicate. Resolve manually.' }, 409);
  }
  if (job.failure_class && NEVER_AUTO_RETRY.includes(job.failure_class)) {
    return json({ error: `Failure class ${job.failure_class} must not be retried automatically. Human resolution required.` }, 409);
  }
  if (job.attempt_count >= job.max_attempts) return json({ error: 'Max attempts reached' }, 409);
  if (!['FAILED', 'NEEDS_INFORMATION', 'NEEDS_HUMAN_REVIEW'].includes(job.status)) {
    return json({ error: `Cannot retry a job in status ${job.status}` }, 409);
  }
  const { error } = await admin.from('automation_jobs').update({
    status: 'QUEUED', queued_at: new Date().toISOString(),
    failure_reason: null, failure_class: null, requires_human_action: false, human_action_type: null,
  }).eq('id', job.id);
  if (error) return json({ error: error.message }, 400);
  await logEvent(job.id, job.application_id, 'JOB_REQUEUED', 'Retry requested by operator', {}, 'info', caller.userId);
  return json({ ok: true });
}

/** Worker claims the next queued job with a lease (concurrency + worker recovery). */
async function claimJob(body: any) {
  const workerId = body.worker_id ?? 'worker';
  const now = new Date();
  const { data: candidates } = await admin.from('automation_jobs')
    .select('*').eq('status', 'QUEUED')
    .in('submission_method', body.methods ?? ['api', 'browser'])
    .order('priority').order('queued_at').limit(5);
  if (!candidates?.length) return json({ job: null });

  for (const c of candidates) {
    const { data: claimed } = await admin.from('automation_jobs').update({
      status: 'STARTING', worker_id: workerId,
      started_at: now.toISOString(),
      lease_expires_at: new Date(now.getTime() + 15 * 60_000).toISOString(),
      attempt_count: c.attempt_count + 1,
    }).eq('id', c.id).eq('status', 'QUEUED').select().maybeSingle();
    if (!claimed) continue;

    const { application, client, profile, lender, config } = await loadContext(claimed.application_id);

    // Ownership chain: job → application → client. A drift here means the job row
    // and the Funding Hub disagree about whose application this is. Never guess.
    const chain = checkOwnershipChain(claimed, application);
    if (chain) {
      await haltJob(claimed, 'SESSION_CLIENT_MISMATCH', chain);
      continue;
    }

    // Consent gate: no submission attempt without a recorded client consent.
    const consent = checkConsent(client);
    if (consent) {
      await haltJob(claimed, 'CLIENT_CONSENT_REQUIRED', consent, 'BLOCKED');
      continue;
    }

    // QA fixture containment: a fixture client may only ever be pointed at a
    // fixture lender configuration. It must never reach a real lender.
    if (client?.is_qa_fixture && !config?.is_qa_fixture) {
      await haltJob(claimed, 'QA_FIXTURE_CONTAINMENT',
        'QA fixture client cannot be submitted to a non-fixture lender configuration', 'BLOCKED');
      continue;
    }

    const { data: mappings } = await admin.from('automation_field_mappings')
      .select('lender_field_label,canonical_field,field_kind,required,allowed_values,lender_selector,sort_order')
      .eq('lender_config_id', config?.id ?? '00000000-0000-0000-0000-000000000000').order('sort_order');
    const canonical = buildCanonical({ application, client, profile });
    const v = validateAndFormat(canonical, (mappings ?? []) as MappingRow[]);

    if (!v.ok) {
      await admin.from('automation_jobs').update({
        status: 'RUNNING',
      }).eq('id', claimed.id);
      await admin.from('automation_jobs').update({
        status: 'NEEDS_INFORMATION', requires_human_action: true, human_action_type: 'PROVIDE_INFORMATION',
        missing_fields: [...v.missing, ...v.invalid], failure_class: 'INVALID_CLIENT_DATA',
        failure_reason: 'Validation failed at claim time',
      }).eq('id', claimed.id);
      await logEvent(claimed.id, claimed.application_id, 'NEEDS_INFORMATION', 'Validation failed', { missing: v.missing, invalid: v.invalid }, 'warn');
      continue;
    }

    await logEvent(claimed.id, claimed.application_id, 'JOB_CLAIMED', `Claimed by ${workerId}`, { worker_id: workerId });

    // Data minimization: only mapped, validated, non-sensitive-by-design values leave the API.
    return json({
      job: {
        id: claimed.id,
        application_id: claimed.application_id,
        funding_client_id: application?.client_id ?? claimed.client_id,
        submission_method: claimed.submission_method,
        adapter_key: claimed.adapter_key,
        lender_name: claimed.lender_name,
      },
      config: config ? {
        application_url: config.application_url,
        api_base_url: config.api_base_url,
        requires_otp: config.requires_otp,
        requires_identity_verification: config.requires_identity_verification,
        requires_signature: config.requires_signature,
        requires_final_certification: config.requires_final_certification,
      } : null,
      field_mappings: mappings ?? [],
      values: v.values,
    });
  }
  return json({ job: null });
}

async function reportEvent(body: any, caller: Caller) {
  const { job_id, event_type, message, metadata, status, current_step } = body;
  const { data: job } = await admin.from('automation_jobs').select('*').eq('id', job_id).maybeSingle();
  if (!job) return json({ error: 'Job not found' }, 404);
  if (status || current_step) {
    const patch: Record<string, unknown> = {};
    if (status) patch.status = status;
    if (current_step) patch.current_step = current_step;
    const { error } = await admin.from('automation_jobs').update(patch).eq('id', job_id);
    if (error) return json({ error: error.message }, 409); // invalid state transition
  }
  await logEvent(job_id, job.application_id, event_type ?? 'WORKER_EVENT', message ?? '', metadata ?? {}, body.level ?? 'info', caller.userId);
  return json({ ok: true });
}

/** Checkpoint kinds the schema accepts. Validated before the job is moved. */
const CHECKPOINT_TYPES = [
  'OTP', 'SMS_VERIFICATION', 'EMAIL_VERIFICATION', 'IDENTITY_VERIFICATION',
  'SELFIE_VERIFICATION', 'E_SIGNATURE', 'CERTIFICATION', 'FINAL_ACCURACY_CONFIRMATION',
  'CAPTCHA', 'BOT_BLOCK', 'AMBIGUOUS_RESPONSE',
];

/** Worker hit a human-only step, a CAPTCHA, or a bot block. Automation stops. */
async function raiseCheckpoint(body: any, caller: Caller) {
  const { job_id, checkpoint_type, reason } = body;
  if (!CHECKPOINT_TYPES.includes(checkpoint_type)) {
    return json({ error: `Unknown checkpoint_type: ${checkpoint_type}`, allowed: CHECKPOINT_TYPES }, 400);
  }
  const { data: job } = await admin.from('automation_jobs').select('*').eq('id', job_id).maybeSingle();
  if (!job) return json({ error: 'Job not found' }, 404);

  const blocking = ['CAPTCHA', 'BOT_BLOCK'].includes(checkpoint_type);

  // Move the job FIRST. If the state machine rejects the transition the
  // checkpoint must not exist — a pending checkpoint against an unchanged job
  // is a false green that hides a stuck job from operators.
  const { error: jobError } = await admin.from('automation_jobs').update({
    status: blocking ? 'BLOCKED' : 'HUMAN_CHECKPOINT',
    requires_human_action: true,
    human_action_type: checkpoint_type,
    failure_class: blocking ? checkpoint_type : null,
    failure_reason: blocking ? 'Bot protection encountered — automation stopped, no circumvention attempted' : null,
  }).eq('id', job_id);
  if (jobError) {
    await logEvent(job_id, job.application_id, 'CHECKPOINT_REJECTED',
      `Checkpoint rejected by job state machine from ${job.status}: ${jobError.message}`,
      { checkpoint_type, from_status: job.status }, 'error', caller.userId);
    return json({ error: jobError.message, job_status: job.status }, 409);
  }

  const { data: cp, error } = await admin.from('automation_checkpoints').insert({
    automation_job_id: job_id, checkpoint_type, reason, status: 'PENDING',
  }).select().single();
  if (error) {
    // Put the job back where it was so it never sits in a checkpoint state
    // with no checkpoint for an operator to resolve. If the state machine
    // forbids the rewind, escalate instead of leaving it silently stuck.
    const { error: rewindErr } = await admin.from('automation_jobs').update({
      status: job.status,
      requires_human_action: job.requires_human_action,
      human_action_type: job.human_action_type,
      failure_class: job.failure_class,
      failure_reason: job.failure_reason,
    }).eq('id', job_id);
    if (rewindErr) {
      await admin.from('automation_jobs').update({
        status: 'NEEDS_HUMAN_REVIEW', requires_human_action: true,
        failure_class: 'CHECKPOINT_WRITE_FAILED',
        failure_reason: `Checkpoint could not be recorded: ${error.message}`,
      }).eq('id', job_id);
    }
    await logEvent(job_id, job.application_id, 'CHECKPOINT_WRITE_FAILED',
      `Checkpoint insert failed: ${error.message}`, { checkpoint_type }, 'error', caller.userId);
    return json({ error: error.message }, 400);
  }



  await logEvent(job_id, job.application_id, 'HUMAN_CHECKPOINT',
    `${checkpoint_type} checkpoint — automation paused`, { checkpoint_type, reason }, 'warn');

  if (blocking) {
    const { error: escErr } = await admin.from('automation_jobs')
      .update({ status: 'NEEDS_HUMAN_REVIEW' }).eq('id', job_id);
    await logEvent(job_id, job.application_id,
      escErr ? 'ESCALATION_FAILED' : 'NEEDS_HUMAN_REVIEW',
      escErr ? `Escalation to human review failed: ${escErr.message}` : 'Escalated to human review',
      {}, escErr ? 'error' : 'warn');
  }
  return json({ checkpoint: cp });
}


/** Operator confirms the human-only action was completed. Automation may resume. */
async function resolveCheckpoint(body: any, caller: Caller) {
  if (caller.kind !== 'operator') return json({ error: 'Only an authorized human operator may resolve a checkpoint' }, 403);
  const { data: cp } = await admin.from('automation_checkpoints').select('*').eq('id', body.checkpoint_id).maybeSingle();
  if (!cp) return json({ error: 'Checkpoint not found' }, 404);
  if (cp.status !== 'PENDING') return json({ error: `Checkpoint already ${cp.status}` }, 409);

  const resume = body.resume !== false;
  const { data: job } = await admin.from('automation_jobs').select('*').eq('id', cp.automation_job_id).maybeSingle();

  // Move the job FIRST so a rejected transition cannot leave a checkpoint
  // marked COMPLETED against a job that never moved.
  if (job) {
    const next = body.abandoned ? 'CANCELLED' : (resume ? (body.next_status ?? 'READY_TO_SUBMIT') : 'NEEDS_HUMAN_REVIEW');
    const { error: jobError } = await admin.from('automation_jobs').update({
      status: next, requires_human_action: false, human_action_type: null,
      completed_at: next === 'CANCELLED' ? new Date().toISOString() : null,
    }).eq('id', job.id);
    if (jobError) {
      await logEvent(job.id, job.application_id, 'CHECKPOINT_RESOLUTION_REJECTED',
        `Job state machine rejected ${job.status} -> ${next}: ${jobError.message}`,
        { from_status: job.status, next }, 'error', caller.userId);
      return json({ error: jobError.message, job_status: job.status }, 409);
    }
  }

  await admin.from('automation_checkpoints').update({
    status: body.abandoned ? 'ABANDONED' : 'COMPLETED',
    completed_at: new Date().toISOString(),
    completed_by: caller.userId,
    completion_note: body.note ?? null,
    automation_resumed: resume && !body.abandoned,
    resumed_at: resume && !body.abandoned ? new Date().toISOString() : null,
  }).eq('id', cp.id);

  if (job) {
    await logEvent(job.id, job.application_id, 'HUMAN_COMPLETED_CHECKPOINT',
      `${cp.checkpoint_type} completed by operator`, { checkpoint_type: cp.checkpoint_type, resumed: resume }, 'info', caller.userId);
  }
  return json({ ok: true });
}


/** Normalized result comes back and Funding Hub is updated. Never fabricated. */
async function submitResult(body: any, caller: Caller) {
  const { data: job } = await admin.from('automation_jobs').select('*').eq('id', body.job_id).maybeSingle();
  if (!job) return json({ error: 'Job not found' }, 404);

  let normalized: NormalizedResult;
  if (body.api_response) normalized = normalizeApiResponse(body.api_response);
  else if (body.page_text) normalized = normalizePageText(String(body.page_text));
  else if (body.normalized) normalized = { confidence: 'high', approved_amount: null, lender_reference: null, next_action: null, decision_date: null, ...body.normalized };
  else return json({ error: 'Provide api_response, page_text, or normalized' }, 400);

  const ambiguous = normalized.status === 'NEEDS_HUMAN_REVIEW' || normalized.confidence === 'low';

  // Walk the job to READING_RESPONSE through legal transitions only. Manual
  // submissions sit in READY_TO_SUBMIT and must pass through SUBMITTING.
  if (job.status !== 'READING_RESPONSE') {
    if (job.status === 'READY_TO_SUBMIT' || job.status === 'HUMAN_CHECKPOINT') {
      const { error: subErr } = await admin.from('automation_jobs')
        .update({ status: 'SUBMITTING' }).eq('id', job.id);
      if (subErr) return json({ error: subErr.message, job_status: job.status }, 409);
    }
    const { error: readErr } = await admin.from('automation_jobs')
      .update({ status: 'READING_RESPONSE' }).eq('id', job.id);
    if (readErr) {
      await logEvent(job.id, job.application_id, 'RESULT_REJECTED',
        `Cannot record a result from status ${job.status}: ${readErr.message}`,
        { from_status: job.status }, 'error', caller.userId);
      return json({ error: readErr.message, job_status: job.status }, 409);
    }
  }


  const patch: Record<string, unknown> = {
    result_status: normalized.status,
    lender_reference: normalized.lender_reference,
    approved_amount: normalized.approved_amount,
    next_action: normalized.next_action,
    decision_date: normalized.decision_date,
    raw_response: redact({ summary: body.page_text ? String(body.page_text).slice(0, 4000) : body.api_response }),
    submission_confirmed: body.submission_confirmed === true || !!normalized.lender_reference,
    status: ambiguous ? 'NEEDS_HUMAN_REVIEW' : 'COMPLETED',
    completed_at: ambiguous ? null : new Date().toISOString(),
  };
  const { error } = await admin.from('automation_jobs').update(patch).eq('id', job.id);
  if (error) return json({ error: error.message }, 409);

  await logEvent(job.id, job.application_id, 'RESPONSE_RECEIVED',
    `Normalized result: ${normalized.status}`, { status: normalized.status, confidence: normalized.confidence }, ambiguous ? 'warn' : 'info', caller.userId);

  // ---- Funding Hub update (source of truth) ----
  if (!ambiguous) {
    const hubStatus = toHubApplicationStatus(normalized.status as NormalizedStatus);
    if (hubStatus) {
      const patchFields: Record<string, unknown> = {};
      if (normalized.status === 'APPROVED' && normalized.approved_amount != null) {
        patchFields.approved_amount = normalized.approved_amount;
        patchFields.decision_date = normalized.decision_date ?? new Date().toISOString().slice(0, 10);
      }
      if (normalized.status === 'DECLINED') {
        patchFields.decision_date = normalized.decision_date ?? new Date().toISOString().slice(0, 10);
      }
      if (normalized.status === 'SUBMITTED') {
        patchFields.application_date = new Date().toISOString().slice(0, 10);
      }

      // Atomic: application status + status-history row in one transaction, with
      // replay protection keyed on event_id. A replayed lender event is a no-op.
      const { data: applied, error: rpcError } = await admin.rpc('record_application_status', {
        _application_id: job.application_id,
        _new_status: hubStatus,
        _source: 'automation',
        _job_id: job.id,
        _event_id: body.event_id ? String(body.event_id) : null,
        _message: `Lender response recorded: ${normalized.status}`,
        _patch: patchFields,
      });

      if (rpcError) {
        await logEvent(job.id, job.application_id, 'HUB_UPDATE_FAILED',
          `Funding Hub update failed: ${rpcError.message}`, {}, 'error');
        return json({ error: `Funding Hub update failed: ${rpcError.message}` }, 409);
      }

      const wasApplied = (applied as { applied?: boolean } | null)?.applied === true;
      await logEvent(job.id, job.application_id,
        wasApplied ? 'FUNDING_HUB_UPDATED' : 'DUPLICATE_EVENT_IGNORED',
        wasApplied
          ? `Application set to ${hubStatus}`
          : `Replayed event ${body.event_id} ignored — no duplicate transition`,
        { hub_status: hubStatus, ...patchFields }, wasApplied ? 'info' : 'warn');
    }
  } else {
    await logEvent(job.id, job.application_id, 'HUB_UPDATE_SKIPPED',
      'Ambiguous lender response — Funding Hub not modified', {}, 'warn');
  }



  return json({ ok: true, normalized });
}

/** Failure reporting with safe retry classification. */
async function reportFailure(body: any, caller: Caller) {
  const { data: job } = await admin.from('automation_jobs').select('*').eq('id', body.job_id).maybeSingle();
  if (!job) return json({ error: 'Job not found' }, 404);
  const failureClass = body.failure_class ?? 'UNKNOWN';
  const retryable = RETRYABLE.includes(failureClass)
    && !job.submission_confirmed
    && job.attempt_count < job.max_attempts;

  await admin.from('automation_jobs').update({
    status: retryable ? 'FAILED' : 'NEEDS_HUMAN_REVIEW',
    failure_class: failureClass,
    failure_reason: String(body.reason ?? '').slice(0, 500),
    requires_human_action: !retryable,
  }).eq('id', job.id);
  await logEvent(job.id, job.application_id, 'JOB_FAILED',
    `${failureClass}: ${body.reason ?? ''}`, { retryable }, 'error', caller.userId);
  return json({ ok: true, retryable });
}

/** Manual fallback: switch an application to human submission and keep it alive. */
async function switchToManual(body: any, caller: Caller) {
  if (caller.kind !== 'operator') return json({ error: 'Operator only' }, 403);
  const { data: job } = await admin.from('automation_jobs').select('*').eq('id', body.job_id).maybeSingle();
  if (!job) return json({ error: 'Job not found' }, 404);
  await admin.from('automation_jobs').update({
    submission_method: 'manual', requires_human_action: true, human_action_type: 'MANUAL_SUBMISSION',
    status: ['COMPLETED', 'CANCELLED'].includes(job.status) ? job.status : 'NEEDS_HUMAN_REVIEW',
  }).eq('id', job.id);
  await logEvent(job.id, job.application_id, 'SWITCHED_TO_MANUAL',
    'Assigned to a human operator for manual submission', {}, 'warn', caller.userId);
  return json({ ok: true });
}

/** Recover leases from crashed workers. */
async function reapStaleJobs() {
  const { data: stale } = await admin.from('automation_jobs')
    .select('id,application_id,status,attempt_count,max_attempts,submission_confirmed')
    .lt('lease_expires_at', new Date().toISOString())
    .in('status', ['STARTING', 'RUNNING', 'FORM_DETECTED', 'FILLING', 'DOCUMENT_UPLOAD', 'SUBMITTING', 'READING_RESPONSE']);
  let recovered = 0;
  for (const j of stale ?? []) {
    // If the job died anywhere near submission, a human must confirm — never auto-resubmit.
    const uncertain = ['SUBMITTING', 'READING_RESPONSE'].includes(j.status);
    await admin.from('automation_jobs').update({
      status: uncertain ? 'NEEDS_HUMAN_REVIEW' : 'FAILED',
      failure_class: uncertain ? 'UNKNOWN' : 'BROWSER_CRASH',
      failure_reason: uncertain
        ? 'Worker lease expired during submission — submission outcome uncertain, human verification required'
        : 'Worker lease expired',
      requires_human_action: uncertain, worker_id: null, lease_expires_at: null,
    }).eq('id', j.id);
    await logEvent(j.id, j.application_id, 'LEASE_EXPIRED',
      uncertain ? 'Uncertain submission state — escalated' : 'Worker lease expired', {}, 'error');
    recovered++;
    // A dead worker cannot close its own session — never leave one live.
    await admin.from('automation_sessions').update({
      status: 'FAILED', error_code: 'WORKER_LEASE_EXPIRED',
      termination_reason: 'Worker lease expired; session force-closed and workspace considered destroyed',
      ended_at: new Date().toISOString(),
    }).eq('automation_job_id', j.id).in('status', ['OPEN', 'RUNNING']);
  }
  return json({ recovered });
}

// ------------------------- session isolation layer -------------------------

/** Job → application → client must agree before any worker touches a lender. */
function checkOwnershipChain(job: any, application: any): string | null {
  if (!application) return 'Application row not found for this job';
  if (job.application_id !== application.id) return 'Job application_id does not match the loaded application';
  if (job.client_id && application.client_id && job.client_id !== application.client_id) {
    return `Job client ${job.client_id} does not own application ${application.id}`;
  }
  if (!application.client_id) return 'Application has no owning client';
  return null;
}

/** No submission attempt is made without a recorded client authorization. */
function checkConsent(client: any): string | null {
  if (!client) return 'Client record not found';
  if (client.consent_signed === true) return null;
  return 'Client has not signed the automated submission authorization';
}

/** Stop a claimed job cold, without retrying and without contacting a lender. */
async function haltJob(job: any, code: string, reason: string, status = 'NEEDS_HUMAN_REVIEW') {
  await admin.from('automation_jobs').update({
    status, requires_human_action: true, human_action_type: 'REVIEW_REQUIRED',
    failure_class: code, failure_reason: reason,
    worker_id: null, lease_expires_at: null,
  }).eq('id', job.id);
  await logEvent(job.id, job.application_id, code, reason, {}, 'error');
}

/**
 * Open the single session that a worker is allowed to run for this job.
 * Refuses on: unknown job, non-running job, an already-live session,
 * missing consent, or a broken ownership chain. The DB trigger is the
 * last line of defence behind these checks.
 */
async function openSession(body: any, caller: Caller) {
  if (caller.kind !== 'worker') return json({ error: 'Worker only' }, 403);
  const { data: job } = await admin.from('automation_jobs').select('*').eq('id', body.job_id).maybeSingle();
  if (!job) return json({ error: 'Job not found' }, 404);
  if (!['STARTING', 'RUNNING'].includes(job.status)) {
    return json({ error: `Job is ${job.status}; sessions may only open on a claimed job` }, 409);
  }

  const { application, client } = await loadContext(job.application_id);
  const chain = checkOwnershipChain(job, application);
  if (chain) { await haltJob(job, 'SESSION_CLIENT_MISMATCH', chain); return json({ error: chain }, 409); }
  const consent = checkConsent(client);
  if (consent) { await haltJob(job, 'CLIENT_CONSENT_REQUIRED', consent, 'BLOCKED'); return json({ error: consent }, 409); }

  const { data: live } = await admin.from('automation_sessions')
    .select('id,status').eq('automation_job_id', job.id)
    .in('status', ['OPEN', 'RUNNING']).maybeSingle();
  if (live) return json({ error: 'A live session already exists for this job', session_id: live.id }, 409);

  const { data: session, error } = await admin.from('automation_sessions').insert({
    automation_job_id: job.id,
    application_id: job.application_id,
    funding_client_id: application.client_id,
    session_owner: String(body.worker_id ?? 'worker').slice(0, 120),
    owner_kind: 'worker',
    provider: String(body.provider ?? 'playwright-chromium').slice(0, 60),
    infrastructure_region: String(body.infrastructure_region ?? 'UNVERIFIED').slice(0, 60),
    workspace_path: `automation-runs/${job.id}`,
    is_qa_fixture: client?.is_qa_fixture === true,
    status: 'OPEN',
  }).select().single();
  if (error) return json({ error: error.message }, 409);

  await logEvent(job.id, job.application_id, 'SESSION_OPENED',
    `Isolated session opened by ${session.session_owner} in ${session.infrastructure_region}`,
    { session_id: session.id, provider: session.provider }, 'info');

  return json({
    session: {
      session_id: session.id,
      automation_job_id: session.automation_job_id,
      application_id: session.application_id,
      funding_client_id: session.funding_client_id,
      status: session.status,
      workspace_path: session.workspace_path,
    },
  });
}

async function setSessionStatus(body: any, caller: Caller) {
  if (caller.kind !== 'worker') return json({ error: 'Worker only' }, 403);
  const status = ['OPEN', 'RUNNING'].includes(body.status) ? body.status : 'RUNNING';
  const { error } = await admin.from('automation_sessions')
    .update({ status }).eq('id', body.session_id).in('status', ['OPEN', 'RUNNING']);
  if (error) return json({ error: error.message }, 409);
  return json({ ok: true });
}

/** Terminal close. A closed session is never reopened or reused. */
async function closeSession(body: any, caller: Caller) {
  if (caller.kind !== 'worker' && caller.kind !== 'operator') return json({ error: 'Unauthorized' }, 403);
  const { data: session } = await admin.from('automation_sessions')
    .select('*').eq('id', body.session_id).maybeSingle();
  if (!session) return json({ error: 'Session not found' }, 404);

  const status = ['COMPLETED', 'FAILED', 'HUMAN_CHECKPOINT'].includes(body.status) ? body.status : 'FAILED';
  await admin.from('automation_sessions').update({
    status: status === 'HUMAN_CHECKPOINT' ? 'CLOSED' : status,
    outcome: body.outcome ? String(body.outcome).slice(0, 60) : null,
    error_code: body.error_code ? String(body.error_code).slice(0, 60) : null,
    termination_reason: body.termination_reason ? String(body.termination_reason).slice(0, 500) : null,
    human_checkpoint_count: session.human_checkpoint_count + (body.checkpoint ? 1 : 0),
    ended_at: new Date().toISOString(),
  }).eq('id', session.id);

  await logEvent(session.automation_job_id, session.application_id, 'SESSION_CLOSED',
    `Session closed: ${status}${body.error_code ? ` (${body.error_code})` : ''}`,
    { session_id: session.id, outcome: body.outcome ?? null }, status === 'FAILED' ? 'error' : 'info');

  // An isolation violation is never retried silently — a human reviews it.
  if (body.escalate) {
    const { data: job } = await admin.from('automation_jobs').select('*').eq('id', session.automation_job_id).maybeSingle();
    if (job) await haltJob(job, String(body.error_code ?? 'SESSION_ISOLATION_VIOLATION'),
      String(body.termination_reason ?? 'Session isolation violation'));
  }
  return json({ ok: true });
}

async function listSessions(body: any, caller: Caller) {
  if (caller.kind !== 'operator') return json({ error: 'Operator only' }, 403);
  let q = admin.from('automation_sessions').select('*').order('started_at', { ascending: false }).limit(200);
  if (body.job_id) q = q.eq('automation_job_id', body.job_id);
  const { data, error } = await q;
  if (error) return json({ error: error.message }, 400);
  return json({ sessions: data ?? [] });
}

// -------------------------------- router --------------------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const caller = await authenticate(req);
    if (!caller) return json({ error: 'Unauthorized' }, 401);

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const url = new URL(req.url);
    const action = body.action ?? url.pathname.split('/').filter(Boolean).pop();

    switch (action) {
      case 'create-job': return await createJob(body, caller);
      case 'list-jobs': return await listJobs(body);
      case 'get-job': return await getJob(body);
      case 'cancel-job': return await cancelJob(body, caller);
      case 'retry-job': return await retryJob(body, caller);
      case 'claim-job': return await claimJob(body);
      case 'report-event': return await reportEvent(body, caller);
      case 'raise-checkpoint': return await raiseCheckpoint(body, caller);
      case 'resolve-checkpoint': return await resolveCheckpoint(body, caller);
      case 'submit-result': return await submitResult(body, caller);
      case 'report-failure': return await reportFailure(body, caller);
      case 'switch-to-manual': return await switchToManual(body, caller);
      case 'open-session': return await openSession(body, caller);
      case 'session-status': return await setSessionStatus(body, caller);
      case 'close-session': return await closeSession(body, caller);
      case 'list-sessions': return await listSessions(body, caller);
      case 'reap-stale': return await reapStaleJobs();
      default: return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (e) {
    console.error('automation-api error', (e as Error).message);
    return json({ error: (e as Error).message }, 500);
  }
});
