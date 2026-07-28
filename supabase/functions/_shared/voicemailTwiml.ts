import { escapeXml } from "./dialer.ts";

/** Shared voicemail TwiML block — record + Twilio transcription callback. */
export function voicemailTwiml(base: string, greeting: string): string {
  const action = `${base}/gasmask-voicemail-complete`;
  const transcribeCb = `${base}/gasmask-voicemail-transcription`;
  return `<Say voice="alice">${escapeXml(greeting)}</Say>
  <Record maxLength="120" playBeep="true" timeout="5" trim="trim-silence"
          action="${escapeXml(action)}" method="POST"
          transcribe="true" transcribeCallback="${escapeXml(transcribeCb)}" />
  <Say voice="alice">We did not receive a message. Goodbye.</Say><Hangup/>`;
}
