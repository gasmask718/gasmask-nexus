// Shared Twilio client for operator-initiated comms.
// Implements DEV_PHONE_LOCK safety gate so all outbound SMS/calls during
// development are redirected to a single owner test number.

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")!;
export const TWILIO_SHARED_NUMBER =
  Deno.env.get("TWILIO_SHARED_NUMBER") || Deno.env.get("GASMASK_PHONE_NUMBER")!;
const DEV_TEST_PHONE = Deno.env.get("DEV_TEST_PHONE");
export const DEV_PHONE_LOCK =
  (Deno.env.get("DEV_PHONE_LOCK") || "true").toLowerCase() === "true";

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
}): Promise<{ sid: string; actualTo: string; overridden: boolean }> {
  const { actualTo, overridden } = getOutboundRecipient(to);
  console.log(
    `[twilio-operator] SMS from=${TWILIO_SHARED_NUMBER} to=${actualTo} (intended=${to}) len=${body.length}`,
  );

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        From: TWILIO_SHARED_NUMBER,
        To: actualTo,
        Body: body,
      }),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Twilio SMS failed [${response.status}]: ${error}`);
  }

  const data = await response.json();
  console.log(`[twilio-operator] SMS ok sid=${data.sid}`);
  return { sid: data.sid, actualTo, overridden };
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
