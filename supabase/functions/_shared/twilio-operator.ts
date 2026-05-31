// Shared Twilio client for operator-initiated comms.
// Implements:
//   1. DEV_PHONE_LOCK safety gate (dev → owner test number)
//   2. A2P 10DLC pre-send guard — outbound US SMS from an unregistered long
//      code silently 30034s. Until A2P registration completes, force the
//      verified toll-free as the From for any US destination unless a
//      Messaging Service SID is configured.

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")!;
const TWILIO_MESSAGING_SERVICE_SID = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID") || "";
const VERIFIED_TOLL_FREE = Deno.env.get("TWILIO_VERIFIED_TOLL_FREE") || "+18776818621";
const A2P_BYPASS = (Deno.env.get("TWILIO_A2P_BYPASS") || "").toLowerCase() === "true";
const RAW_SHARED = Deno.env.get("TWILIO_SHARED_NUMBER") || Deno.env.get("GASMASK_PHONE_NUMBER") || "";
const DEV_TEST_PHONE = Deno.env.get("DEV_TEST_PHONE");
export const DEV_PHONE_LOCK =
  (Deno.env.get("DEV_PHONE_LOCK") || "true").toLowerCase() === "true";

const TOLL_FREE_PREFIXES = new Set(["800", "833", "844", "855", "866", "877", "888"]);
function isUsTollFree(e164: string): boolean {
  const m = e164.match(/^\+1(\d{3})\d{7}$/);
  return !!m && TOLL_FREE_PREFIXES.has(m[1]);
}
function isUsLongCode(e164: string): boolean {
  return /^\+1\d{10}$/.test(e164) && !isUsTollFree(e164);
}

// A2P-safe outbound From for a given destination. US long code From + US dest
// without a Messaging Service = silent carrier drop (30034); force toll-free.
export function pickSafeFrom(to: string): string {
  if (A2P_BYPASS) return RAW_SHARED || VERIFIED_TOLL_FREE;
  const usDest = to.startsWith("+1");
  if (usDest && (!RAW_SHARED || isUsLongCode(RAW_SHARED))) {
    if (RAW_SHARED && isUsLongCode(RAW_SHARED)) {
      console.warn(
        `[twilio-operator] A2P guard: TWILIO_SHARED_NUMBER ${RAW_SHARED} is an unregistered US long code — forcing verified toll-free ${VERIFIED_TOLL_FREE}`,
      );
    }
    return VERIFIED_TOLL_FREE;
  }
  return RAW_SHARED || VERIFIED_TOLL_FREE;
}

export const TWILIO_SHARED_NUMBER = RAW_SHARED || VERIFIED_TOLL_FREE;

export function getOutboundRecipient(intendedTo: string): {
  actualTo: string;
  overridden: boolean;
} {
  if (DEV_PHONE_LOCK && DEV_TEST_PHONE) {
    console.log(
      `[DEV_PHONE_LOCK] Overriding ${intendedTo} → ${DEV_TEST_PHONE}`,
    );
    return { actualTo: DEV_TEST_PHONE, overridden: true };
  }
  return { actualTo: intendedTo, overridden: false };
}

function authHeader(): string {
  return `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`;
}

export async function sendOperatorSms({
  to,
  body,
}: {
  to: string;
  body: string;
}): Promise<{ sid: string; actualTo: string; overridden: boolean; from: string }> {
  const { actualTo, overridden } = getOutboundRecipient(to);
  const fromSafe = pickSafeFrom(actualTo);
  console.log(
    `[twilio-operator] SMS from=${fromSafe} to=${actualTo} (intended=${to}) len=${body.length}${TWILIO_MESSAGING_SERVICE_SID ? " via MS" : ""}`,
  );

  const params: Record<string, string> = { To: actualTo, Body: body };
  if (TWILIO_MESSAGING_SERVICE_SID) params.MessagingServiceSid = TWILIO_MESSAGING_SERVICE_SID;
  else params.From = fromSafe;

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(params),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Twilio SMS failed [${response.status}]: ${error}`);
  }

  const data = await response.json();
  console.log(`[twilio-operator] SMS ok sid=${data.sid}`);
  return { sid: data.sid, actualTo, overridden, from: fromSafe };
}

export async function initiateOperatorCall({
  to,
  recordingCallbackUrl,
  twimlUrl,
}: {
  to: string;
  recordingCallbackUrl: string;
  twimlUrl?: string;
}): Promise<{ sid: string; actualTo: string; overridden: boolean }> {
  const { actualTo, overridden } = getOutboundRecipient(to);
  console.log(
    `[twilio-operator] CALL from=${TWILIO_SHARED_NUMBER} to=${actualTo} (intended=${to})`,
  );

  // TODO: Replace twimlUrl with TwiML that announces "this call is recorded"
  // and connects the operator. Phase 5 UI will remind operator to disclose
  // verbally if TwiML isn't ready.
  const url = twimlUrl || "http://demo.twilio.com/docs/voice.xml";

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`,
    {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        From: TWILIO_SHARED_NUMBER,
        To: actualTo,
        Url: url,
        Record: "true",
        RecordingStatusCallback: recordingCallbackUrl,
        RecordingStatusCallbackEvent: "completed",
      }),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Twilio call failed [${response.status}]: ${error}`);
  }

  const data = await response.json();
  console.log(`[twilio-operator] CALL ok sid=${data.sid}`);
  return { sid: data.sid, actualTo, overridden };
}
