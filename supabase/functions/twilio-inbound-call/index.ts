/**
 * TWILIO INBOUND CALL — second entry URL for the same pool (many live numbers
 * still point here). Humans-first routing; logic in _shared/inboundVoiceMain.ts.
 */
import { handleInboundVoice } from "../_shared/inboundVoiceMain.ts";

Deno.serve(handleInboundVoice);
