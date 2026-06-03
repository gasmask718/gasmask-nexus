/**
 * Shared Bland AI dispatcher helpers.
 *
 * Bland's outbound API is a single endpoint: POST /v1/calls.
 * The conversation source can be either:
 *   - pathway_id (UUID — conversational pathway)
 *   - task       (ad-hoc inline script)
 *
 * There is NO POST /v1/agents/<id>/calls endpoint (that 404s).
 * Web-agent style IDs (agent_xxx…) are not supported by /v1/calls
 * in the current Bland REST API — they would need to be migrated to
 * a pathway. Until then, an unknown / non-UUID agent_id falls back
 * to ad-hoc `task` mode so the call still places.
 */

const BLAND_API = "https://api.bland.ai/v1";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface PlaceBlandCallOptions {
  to: string; // E.164 phone number to dial
  from?: string; // optional Bland-OWNED from number (Twilio numbers are rejected by Bland)
  agent_id?: string; // UUID → sent as pathway_id; non-UUID → ignored, task is used
  task?: string; // ad-hoc task script when no pathway
  voice?: string; // Bland voice name, defaults to "maya"
  first_sentence?: string;
  webhook?: string; // post-call webhook
  metadata?: Record<string, unknown>;
  record?: boolean;
  answered_by_enabled?: boolean;
}

export interface BlandCallResult {
  ok: boolean;
  status: number;
  call_id?: string;
  error?: unknown;
  raw: unknown;
}

export function getBlandApiKey(): string {
  const key = Deno.env.get("BLAND_API_KEY");
  if (!key) throw new Error("BLAND_API_KEY is not configured");
  return key;
}

/** Optional allow-list of Bland-owned from numbers. Comma-separated env var. */
function isBlandOwnedFrom(from: string | undefined): boolean {
  if (!from) return false;
  const list = (Deno.env.get("BLAND_OWNED_NUMBERS") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list.includes(from);
}

/** Place an outbound call through Bland AI. */
export async function placeBlandCall(opts: PlaceBlandCallOptions): Promise<BlandCallResult> {
  const apiKey = getBlandApiKey();

  const body: Record<string, unknown> = {
    phone_number: opts.to,
    record: opts.record ?? true,
    answered_by_enabled: opts.answered_by_enabled ?? true,
  };

  // Pathway vs ad-hoc routing
  if (opts.agent_id && UUID_RE.test(opts.agent_id)) {
    body.pathway_id = opts.agent_id;
  } else {
    body.task = opts.task ||
      "You are a helpful AI agent. Continue the conversation naturally with the lead.";
    body.voice = opts.voice || "maya";
  }

  // Bland rejects from-numbers it doesn't own. Only forward when explicitly allow-listed.
  if (isBlandOwnedFrom(opts.from)) body.from = opts.from;

  if (opts.first_sentence) body.first_sentence = opts.first_sentence;
  if (opts.webhook) body.webhook = opts.webhook;
  if (opts.metadata) body.metadata = opts.metadata;

  const res = await fetch(`${BLAND_API}/calls`, {
    method: "POST",
    headers: {
      authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const raw = await res.json().catch(() => ({}));
  return {
    ok: res.ok && (raw as { status?: string }).status !== "error",
    status: res.status,
    call_id: (raw as { call_id?: string }).call_id,
    error: res.ok ? undefined : raw,
    raw,
  };
}
