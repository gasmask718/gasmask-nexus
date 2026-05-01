/**
 * Shared Bland AI dispatcher helpers.
 *
 * Use these instead of generating ElevenLabs <Stream> TwiML.
 * Bland AI handles the call placement, audio, and conversation directly.
 */

const BLAND_API = "https://api.bland.ai/v1";

export interface PlaceBlandCallOptions {
  to: string; // E.164 phone number to dial
  from?: string; // optional Twilio number to spoof / route from (Bland supports `from`)
  agent_id?: string; // Bland AI persistent agent ID (preferred)
  task?: string; // ad-hoc task script when no agent_id
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

/** Place an outbound call through Bland AI. */
export async function placeBlandCall(opts: PlaceBlandCallOptions): Promise<BlandCallResult> {
  const apiKey = getBlandApiKey();

  const url = opts.agent_id
    ? `${BLAND_API}/agents/${opts.agent_id}/calls`
    : `${BLAND_API}/calls`;

  const body: Record<string, unknown> = {
    phone_number: opts.to,
    record: opts.record ?? true,
    answered_by_enabled: opts.answered_by_enabled ?? true,
  };

  if (opts.from) body.from = opts.from;
  if (opts.first_sentence) body.first_sentence = opts.first_sentence;
  if (opts.webhook) body.webhook = opts.webhook;
  if (opts.metadata) body.metadata = opts.metadata;

  // For ad-hoc (no agent_id) calls, Bland needs a task script.
  if (!opts.agent_id) {
    body.task = opts.task || "You are a helpful AI agent. Continue the conversation naturally with the lead.";
    body.voice = opts.voice || "maya";
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const raw = await res.json().catch(() => ({}));
  return {
    ok: res.ok,
    status: res.status,
    call_id: (raw as { call_id?: string }).call_id,
    error: res.ok ? undefined : raw,
    raw,
  };
}
