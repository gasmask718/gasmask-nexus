// Dynasty Capital — Generic inbound LENDER WEBHOOK.
//
// This endpoint does NOT contain an automation engine. It authenticates and
// normalizes an external lender event and then feeds the EXISTING pipeline:
//
//   lender -> signature check -> validation -> idempotency ->
//   application matching -> public.record_application_status (atomic) ->
//   funding_applications + funding_application_status_history ->
//   get_capital_plan -> Dynasty Capital / Client Portal
//
// Security: HMAC-SHA256 over `${timestamp}.${rawBody}` using a server-side
// secret named by public.lender_webhook_providers.signing_secret_name.
// Secrets are never returned, logged or echoed.
//
// verify_jwt is false by design (lenders cannot hold Supabase JWTs); the HMAC
// boundary is the authentication mechanism.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import {
  normalizeWebhookStatus, isDecisionStatus, clientUpdateTitle,
  type WebhookNormalizedStatus,
} from '../_shared/funding/webhookNormalize.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const enc = new TextEncoder();

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(message: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(message));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time comparison — never leak signature bytes through timing. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface WebhookEvent {
  event_id: string;
  event_type?: string;
  occurred_at?: string;
  application_id?: string;
  application_external_id?: string;
  application_reference?: string;
  status: string;
  approved_amount?: number;
  decision_date?: string;
  raw_reference?: string;
}

function validate(body: any): { ok: true; event: WebhookEvent } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, errors: ['body must be a JSON object'] };
  }
  const eid = body.event_id;
  if (typeof eid !== 'string' || eid.trim().length < 1 || eid.length > 200) {
    errors.push('event_id must be a string of 1-200 characters');
  }
  if (typeof body.status !== 'string' || !body.status.trim()) errors.push('status is required');
  if (body.application_id != null && !UUID_RE.test(String(body.application_id))) {
    errors.push('application_id must be a uuid');
  }
  if (body.approved_amount != null && !Number.isFinite(Number(body.approved_amount))) {
    errors.push('approved_amount must be numeric');
  }
  if (body.decision_date != null && !/^\d{4}-\d{2}-\d{2}$/.test(String(body.decision_date))) {
    errors.push('decision_date must be YYYY-MM-DD');
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, event: body as WebhookEvent };
}

async function finish(
  rowId: string | null, outcome: string, patch: Record<string, unknown> = {},
) {
  if (!rowId) return;
  await admin.from('funding_lender_webhook_events')
    .update({ outcome, processed_at: new Date().toISOString(), ...patch })
    .eq('id', rowId);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let eventRowId: string | null = null;
  try {
    const rawBody = await req.text();

    // ---------- 1. AUTHENTICATION BOUNDARY ----------
    const providerKey = req.headers.get('x-dynasty-provider') ?? '';
    const signature = (req.headers.get('x-dynasty-signature') ?? '').replace(/^sha256=/, '');
    const timestamp = req.headers.get('x-dynasty-timestamp') ?? '';

    if (!providerKey || !signature || !timestamp) {
      return json({ error: 'unauthorized', detail: 'missing provider, signature or timestamp' }, 401);
    }

    const { data: provider } = await admin
      .from('lender_webhook_providers')
      .select('provider, signing_secret_name, tolerance_seconds, active, is_qa_fixture')
      .eq('provider', providerKey).maybeSingle();

    if (!provider || provider.active !== true) return json({ error: 'unauthorized' }, 401);

    const ts = Number(timestamp);
    if (!Number.isFinite(ts)) return json({ error: 'unauthorized', detail: 'bad timestamp' }, 401);
    const skew = Math.abs(Math.floor(Date.now() / 1000) - ts);
    if (skew > (provider.tolerance_seconds ?? 300)) {
      return json({ error: 'unauthorized', detail: 'timestamp outside tolerance' }, 401);
    }

    const secret = Deno.env.get(provider.signing_secret_name) ?? '';
    if (!secret) {
      // Misconfiguration must never be treated as a valid request.
      return json({ error: 'webhook_not_configured' }, 503);
    }
    const expected = await hmacHex(secret, `${ts}.${rawBody}`);
    if (!timingSafeEqual(expected, signature.toLowerCase())) {
      return json({ error: 'unauthorized', detail: 'invalid signature' }, 401);
    }

    // ---------- 2. VALIDATION (no mutation on failure) ----------
    let parsed: any;
    try { parsed = JSON.parse(rawBody); } catch {
      return json({ error: 'bad_request', detail: 'invalid JSON' }, 400);
    }
    const v = validate(parsed);
    if (!v.ok) return json({ error: 'bad_request', detail: v.errors }, 400);
    const event = v.event;

    const payloadHash = await sha256Hex(rawBody);

    // ---------- 3. IDEMPOTENCY (database-enforced) ----------
    const { data: inserted, error: insertErr } = await admin
      .from('funding_lender_webhook_events')
      .insert({
        provider: provider.provider,
        event_id: event.event_id,
        event_type: event.event_type ?? null,
        payload_hash: payloadHash,
        raw_payload: parsed,
        signature_valid: true,
        is_qa_fixture: provider.is_qa_fixture === true,
      })
      .select('id').maybeSingle();

    if (insertErr) {
      // 23505 = unique(provider, event_id): this event was already accepted.
      if ((insertErr as any).code === '23505') {
        const { data: existing } = await admin
          .from('funding_lender_webhook_events')
          .select('id, payload_hash, outcome, application_id, normalized_status')
          .eq('provider', provider.provider).eq('event_id', event.event_id).maybeSingle();

        if (existing && existing.payload_hash !== payloadHash) {
          await admin.from('funding_lender_webhook_events')
            .update({ error_detail: `conflicting replay rejected at ${new Date().toISOString()}` })
            .eq('id', existing.id);
          return json({
            error: 'conflict',
            detail: 'event_id already processed with different payload',
            authoritative_outcome: existing.outcome,
            authoritative_status: existing.normalized_status,
          }, 409);
        }
        return json({
          ok: true, idempotent: true, duplicate: true,
          outcome: existing?.outcome ?? 'processed',
          application_id: existing?.application_id ?? null,
          normalized_status: existing?.normalized_status ?? null,
        }, 200);
      }
      return json({ error: 'storage_failed', detail: insertErr.message }, 500);
    }
    eventRowId = inserted?.id ?? null;

    // ---------- 4. STATUS NORMALIZATION ----------
    const normalized: WebhookNormalizedStatus | null = normalizeWebhookStatus(event.status);
    if (!normalized) {
      await finish(eventRowId, 'rejected', { error_detail: `unsupported status: ${event.status}` });
      return json({ error: 'bad_request', detail: `unsupported status: ${event.status}` }, 400);
    }

    // ---------- 5. APPLICATION MATCHING (identity-safe only) ----------
    let applicationId: string | null = null;
    let matchedBy: string | null = null;

    if (event.application_id) {
      const { data: app } = await admin.from('funding_applications')
        .select('id').eq('id', event.application_id).maybeSingle();
      if (app) { applicationId = app.id; matchedBy = 'internal_application_id'; }
    }
    if (!applicationId) {
      const externalCandidates = [event.application_external_id, event.application_reference]
        .filter((x): x is string => typeof x === 'string' && x.length > 0);
      for (const candidate of externalCandidates) {
        const { data: ref } = await admin.from('funding_application_external_refs')
          .select('application_id').eq('provider', provider.provider)
          .eq('external_id', candidate).maybeSingle();
        if (ref) { applicationId = ref.application_id; matchedBy = 'external_ref'; break; }
      }
    }

    if (!applicationId) {
      await finish(eventRowId, 'needs_human_review', {
        normalized_status: normalized,
        error_detail: 'no safe application match — operator investigation required',
      });
      return json({
        ok: true, outcome: 'NEEDS_HUMAN_REVIEW',
        detail: 'event retained for operator review; no application was modified',
      }, 202);
    }

    const { data: appRow } = await admin.from('funding_applications')
      .select('id, client_id, status').eq('id', applicationId).maybeSingle();
    const { data: clientRow } = await admin.from('funding_clients')
      .select('id, is_qa_fixture').eq('id', appRow!.client_id).maybeSingle();

    // ---------- 5b. QA FIXTURE BOUNDARY ----------
    const providerQa = provider.is_qa_fixture === true;
    const clientQa = clientRow?.is_qa_fixture === true;
    if (providerQa !== clientQa) {
      await finish(eventRowId, 'rejected', {
        application_id: applicationId, client_id: appRow!.client_id,
        normalized_status: normalized,
        error_detail: `QA isolation violation: provider qa=${providerQa}, client qa=${clientQa}`,
      });
      return json({ error: 'qa_isolation_violation' }, 409);
    }

    // ---------- 6. EXISTING STATUS PIPELINE (atomic, replay-guarded) ----------
    const patchFields: Record<string, unknown> = {};
    if (normalized === 'Approved' && event.approved_amount != null) {
      patchFields.approved_amount = Number(event.approved_amount);
    }
    if (normalized === 'Denied') patchFields.approved_amount = 0;
    if (isDecisionStatus(normalized)) {
      patchFields.decision_date = event.decision_date ?? new Date().toISOString().slice(0, 10);
    }
    if (normalized === 'Applied') {
      patchFields.application_date = event.decision_date ?? new Date().toISOString().slice(0, 10);
    }

    const { data: applied, error: rpcError } = await admin.rpc('record_application_status', {
      _application_id: applicationId,
      _new_status: normalized,
      _source: 'lender_webhook',
      _job_id: null,
      _event_id: `${provider.provider}:${event.event_id}`,
      _message: `Lender event ${event.event_type ?? 'status_update'} → ${normalized}`,
      _patch: patchFields,
    });

    if (rpcError) {
      await finish(eventRowId, 'error', {
        application_id: applicationId, client_id: appRow!.client_id,
        normalized_status: normalized, error_detail: rpcError.message,
      });
      // Explicit failure — never a silent 200.
      return json({ error: 'status_update_failed', detail: rpcError.message }, 500);
    }

    const result = (applied ?? {}) as { applied?: boolean; reason?: string; conflict?: boolean };
    if (result.applied !== true) {
      const conflict = result.conflict === true;
      await finish(eventRowId, conflict ? 'conflict' : 'duplicate', {
        application_id: applicationId, client_id: appRow!.client_id,
        normalized_status: normalized, error_detail: result.reason ?? null,
      });
      return json(
        conflict
          ? { error: 'conflict', detail: result.reason }
          : { ok: true, idempotent: true, duplicate: true, detail: result.reason },
        conflict ? 409 : 200,
      );
    }

    // ---------- 7. CLIENT-SAFE PORTAL NOTIFICATION ----------
    // Never contains raw payloads, lender configuration or internal metadata.
    await admin.from('client_status_updates').insert({
      client_id: appRow!.client_id,
      application_id: applicationId,
      category: 'application',
      title: clientUpdateTitle(normalized),
      body: normalized === 'Approved' && patchFields.approved_amount != null
        ? `Approved for $${Number(patchFields.approved_amount).toLocaleString()}.`
        : `Your application status is now: ${normalized}.`,
      action_required: normalized === 'Needs Information',
      action_label: normalized === 'Needs Information' ? 'Upload documents' : null,
      action_url: normalized === 'Needs Information' ? '/funding-machine/portal' : null,
    });

    await finish(eventRowId, 'processed', {
      application_id: applicationId, client_id: appRow!.client_id,
      normalized_status: normalized,
    });

    return json({
      ok: true, processed: true, application_id: applicationId,
      matched_by: matchedBy, normalized_status: normalized,
    }, 200);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await finish(eventRowId, 'error', { error_detail: message });
    return json({ error: 'internal_error', detail: message }, 500);
  }
});
