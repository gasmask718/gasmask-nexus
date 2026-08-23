/**
 * DC INBOUND CALL — Twilio voice webhook for the company number pool.
 * Humans-first routing; all logic lives in _shared/inboundVoiceMain.ts
 * (twilio-inbound-call is an identical wrapper — both entry points stay
 * because live Twilio numbers point at both URLs).
 */
import { handleInboundVoice } from "../_shared/inboundVoiceMain.ts";

Deno.serve(handleInboundVoice);
