/**
 * INBOUND CONCIERGE — TURN (the speech loop).
 *
 * Each Gather posts SpeechResult here. We append it to the session
 * transcript, ask the model for the next spoken line + an optional
 * structured action, execute the action (inbound_call_outcomes row +
 * communication_logs summary), then speak and loop — or close.
 *
 * Model output contract (STRICT JSON, no markdown):
 *   {
 *     "say": "1-2 short spoken sentences",
 *     "action": null | { "kind": "message"|"callback_request"|"reorder_intent"|"address_capture"|"note",
 *                        "summary": "one line", "details": { ... } },
 *     "done": false
 *   }
 *
 * Guardrails: max 15 caller turns, empty-speech reprompt, JSON parse
 * fallback that speaks the raw reply, and a no-gateway-key degradation that
 * records the caller's words as a plain message instead of dying.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, readForm, verifyTwilio, escapeXml } from "../_shared/dialer.ts";
import { patchCallLog } from "../_shared/gasmaskVoice.ts";
import { functionsBase, twiml } from "../_shared/inboundVoiceMain.ts";

const MODEL = "claude-haiku-4-5"; // voice turns are latency-sensitive
const MAX_CALLER_TURNS = 15;

interface Turn {
  role: "caller" | "concierge";
  text: string;
}

interface ModelReply {
  say: string;
  action: null | {
    kind: string;
    summary?: string;
    details?: Record<string, unknown>;
    reason_category?: string;
    requested_action?: string;
    urgency?: string;
    callback_requested?: boolean;
    ai_resolved?: boolean;
    unresolved_reason?: string;
  };
  done: boolean;
}

const ACTION_KINDS = new Set(["message", "callback_request", "reorder_intent", "address_capture", "note"]);
const REASON_CATEGORIES = [
  "order",
  "delivery",
  "billing",
  "product_question",
  "complaint",
  "new_account",
  "hours_or_location",
  "other",
];
const URGENCIES = new Set(["low", "normal", "high"]);

function systemPrompt(opts: {
  companyName: string;
  storeName: string | null;
  contactName: string | null;
  from: string;
}): string {
  const who = opts.contactName
    ? `${opts.contactName}${opts.storeName ? ` from ${opts.storeName}` : ""}`
    : opts.storeName
    ? `someone at ${opts.storeName}`
    : `an unidentified caller (${opts.from})`;
  return [
    `You are the phone concierge for ${opts.companyName}, answering because no human is free right now.`,
    `The caller is ${who}.`,
    `You are having a LIVE spoken phone conversation. Rules:`,
    `- Replies must be natural spoken English: one or two short sentences, no lists, no markdown, no emoji.`,
    `- Never claim to be human. If asked, say you are the automated assistant.`,
    `- Your job is to find out WHY they are calling and collect enough for a human to resolve it without calling back twice.`,
    `- Ask short follow-ups until you know: the reason for the call, which store/account they are with, what they want done, how urgent it is, and whether they want a callback (and the best time).`,
    `- Ask ONE question at a time. Confirm details back before recording them ("So that's two cases of ... — got it").`,
    `- You may only answer from approved basics: business hours, that a human will follow up, and repeating back what the caller told you.`,
    `- NEVER invent or guess pricing, discounts, policies, order status, stock, delivery dates or promises, account balances, or any commitment. If asked, say you'll have someone confirm and book a callback.`,
    `- If you cannot safely resolve it, escalate: tell them a human will follow up, and set ai_resolved=false with an unresolved_reason.`,
    `- When the caller is done, say a warm goodbye and mark done=true.`,
    `- Respond with STRICT JSON only, no code fences:`,
    `  {"say": "...", "action": null, "done": false}`,
    `- When you have captured something concrete, include ONE action with the full triage:`,
    `  {"kind": "message"|"callback_request"|"reorder_intent"|"address_capture"|"note",`,
    `   "summary": "one line for the human",`,
    `   "reason_category": ${REASON_CATEGORIES.map((c) => `"${c}"`).join("|")},`,
    `   "requested_action": "what the caller wants done",`,
    `   "urgency": "low"|"normal"|"high",`,
    `   "callback_requested": true|false,`,
    `   "ai_resolved": true|false,`,
    `   "unresolved_reason": "why a human is still needed, or null",`,
    `   "details": {"store_or_account": "...", "best_callback_time": "...", "verbatim": "..."}}`,
    `- Do not repeat an action you already recorded.`,
  ].join("\n");
}


function parseModelReply(raw: string): ModelReply {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    const say = typeof parsed.say === "string" && parsed.say.trim()
      ? parsed.say.trim()
      : "Got it — anything else I can help with?";
    let action: ModelReply["action"] = null;
    if (parsed.action && ACTION_KINDS.has(parsed.action.kind)) {
      action = {
        kind: parsed.action.kind,
        summary: typeof parsed.action.summary === "string" ? parsed.action.summary : undefined,
        details: typeof parsed.action.details === "object" && parsed.action.details ? parsed.action.details : {},
      };
    }
    return { say, action, done: parsed.done === true };
  } catch {
    // Model ignored the contract — speak whatever it said, keep going.
    return { say: cleaned.slice(0, 300) || "Sorry, could you say that again?", action: null, done: false };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const params = await readForm(req);
  const v = verifyTwilio(req, params);
  if (!v.ok) {
    console.error(`[inbound-concierge-turn] signature invalid: ${v.reason}`);
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  const callSid = params.CallSid || "";
  const speech = (params.SpeechResult || "").trim();
  const cid = new URL(req.url).searchParams.get("cid") || "";

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const base = functionsBase(req);
  const turnUrl = `${base}/inbound-concierge-turn?cid=${encodeURIComponent(cid)}`;

  const { data: session } = await supabase
    .from("inbound_concierge_sessions")
    .select("*")
    .eq("call_sid", callSid)
    .maybeSingle();

  if (!session) {
    console.error(`[concierge-turn] no session for ${callSid}`);
    return twiml(`<Say voice="alice">Sorry, something went wrong. Please call us back.</Say><Hangup/>`);
  }

  const transcript: Turn[] = Array.isArray(session.transcript) ? session.transcript : [];
  const callerTurns = transcript.filter((t) => t.role === "caller").length;

  // ── Empty speech / wrap-up guards ──
  if (!speech) {
    const empty = transcript.length && transcript[transcript.length - 1].role === "concierge";
    if (empty || callerTurns >= 2) {
      await endSession(supabase, callSid, transcript);
      return twiml(`<Say voice="alice">No problem — call us back any time. Goodbye.</Say><Hangup/>`);
    }
    return twiml(gatherAgain(turnUrl, "Sorry, I didn't catch that. What can I do for you?"));
  }

  transcript.push({ role: "caller", text: speech });

  let reply: ModelReply;

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    // Degraded mode: capture the words as a plain message, never drop the call.
    console.error("[concierge-turn] LOVABLE_API_KEY missing — message-capture fallback");
    reply = {
      say: "I've taken that down and someone will get back to you. Thank you for calling — goodbye.",
      action: { kind: "message", summary: speech.slice(0, 200), details: { verbatim: speech } },
      done: true,
    };
  } else if (callerTurns + 1 >= MAX_CALLER_TURNS) {
    reply = {
      say: "I've got everything noted down. Someone from the team will follow up — thanks for calling, goodbye.",
      action: { kind: "note", summary: `Long call (${callerTurns + 1} turns) — wrapped automatically`, details: {} },
      done: true,
    };
  } else {
    const { data: company } = await supabase
      .from("va_companies")
      .select("name")
      .eq("id", session.va_company_id)
      .maybeSingle();

    const res = await fetch("https://ai-gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.3,
        max_tokens: 300,
        messages: [
          {
            role: "system",
            content: systemPrompt({
              companyName: company?.name || "the company",
              storeName: session.store_name,
              contactName: session.contact_name,
              from: session.from_number || "",
            }),
          },
          ...transcript.map((t) => ({
            role: t.role === "caller" ? "user" : "assistant",
            content: t.text,
          })),
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[concierge-turn] gateway ${res.status}: ${body.slice(0, 300)}`);
      reply = {
        say: "Let me make sure I have that — I've noted it down. Is there anything else?",
        action: { kind: "message", summary: speech.slice(0, 200), details: { verbatim: speech, degraded: "gateway_error" } },
        done: false,
      };
    } else {
      const json = await res.json();
      const raw = json?.choices?.[0]?.message?.content ?? "";
      reply = parseModelReply(typeof raw === "string" ? raw : JSON.stringify(raw));
    }
  }

  // ── Execute the action — the record a human sees in the morning ──
  if (reply.action) {
    const { error } = await supabase.from("inbound_call_outcomes").insert({
      call_sid: callSid,
      va_company_id: session.va_company_id,
      store_id: session.store_id,
      kind: reply.action.kind,
      payload: reply.action.details || {},
      summary: reply.action.summary || null,
    });
    if (error) console.error("[concierge-turn] outcome insert failed:", error.message);
    else console.log(`[concierge-turn] outcome: ${reply.action.kind} — ${reply.action.summary || ""}`);
  }

  transcript.push({ role: "concierge", text: reply.say });

  if (reply.done) {
    await endSession(supabase, callSid, transcript);
    await patchCallLog(supabase, callSid, {
      status: "ai-handled",
      summary: `AI concierge handled — ${session.store_name || session.from_number}${reply.action ? ` (${reply.action.kind})` : ""}`,
    });
    return twiml(`<Say voice="alice">${escapeXml(reply.say)}</Say><Hangup/>`);
  }

  const { error } = await supabase
    .from("inbound_concierge_sessions")
    .update({ transcript })
    .eq("call_sid", callSid);
  if (error) console.error("[concierge-turn] transcript save failed:", error.message);

  return twiml(gatherAgain(turnUrl, reply.say));
});

function gatherAgain(turnUrl: string, say: string): string {
  return `
  <Gather input="speech" action="${escapeXml(turnUrl)}" method="POST"
          timeout="6" speechTimeout="auto" language="en-US">
    <Say voice="alice">${escapeXml(say)}</Say>
  </Gather>
  <Say voice="alice">Are you still there? Call us back if we got cut off. Goodbye.</Say>
  <Hangup/>`;
}

async function endSession(
  supabase: ReturnType<typeof createClient>,
  callSid: string,
  transcript: Turn[],
): Promise<void> {
  const { error } = await supabase
    .from("inbound_concierge_sessions")
    .update({ transcript, status: "ended", ended_at: new Date().toISOString() })
    .eq("call_sid", callSid);
  if (error) console.error("[concierge-turn] session close failed:", error.message);
}
