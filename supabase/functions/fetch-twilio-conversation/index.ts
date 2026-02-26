import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const normalizeE164 = (input: string) => {
  const digits = (input || "").replace(/\D/g, "");
  const last10 = digits.slice(-10);
  return last10 ? `+1${last10}` : "";
};

const twilioAuthHeader = () => {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const token = Deno.env.get("TWILIO_AUTH_TOKEN");
  if (!sid || !token) return null;
  return {
    sid,
    auth: `Basic ${btoa(`${sid}:${token}`)}`,
  };
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { phone } = await req.json();
    const targetPhone = normalizeE164(phone || "");
    if (!targetPhone) {
      return new Response(JSON.stringify({ success: true, messages: [] }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const creds = twilioAuthHeader();
    if (!creds) {
      return new Response(JSON.stringify({ success: false, error: "Twilio credentials are not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const baseUrl = `https://api.twilio.com/2010-04-01/Accounts/${creds.sid}/Messages.json`;
    const inboundUrl = `${baseUrl}?From=${encodeURIComponent(targetPhone)}&PageSize=100`;
    const outboundUrl = `${baseUrl}?To=${encodeURIComponent(targetPhone)}&PageSize=100`;

    const [inboundRes, outboundRes] = await Promise.all([
      fetch(inboundUrl, { headers: { Authorization: creds.auth } }),
      fetch(outboundUrl, { headers: { Authorization: creds.auth } }),
    ]);

    const inboundJson = inboundRes.ok ? await inboundRes.json() : { messages: [] };
    const outboundJson = outboundRes.ok ? await outboundRes.json() : { messages: [] };

    const normalizeDirection = (direction: string) => {
      const d = (direction || "").toLowerCase();
      return d.startsWith("inbound") ? "inbound" : "outbound";
    };

    const parseTwilioDate = (dateValue?: string | null) => {
      if (!dateValue) return null;
      const parsed = new Date(dateValue);
      return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
    };

    const all = [...(inboundJson.messages || []), ...(outboundJson.messages || [])]
      .map((m: any) => ({
        sid: m.sid,
        direction: normalizeDirection(m.direction),
        body: m.body || "",
        from: m.from || null,
        to: m.to || null,
        status: m.status || null,
        created_at: parseTwilioDate(m.date_sent) || parseTwilioDate(m.date_created),
      }))
      .filter((m: any) => !!m.sid && !!m.created_at);

    const unique = new Map<string, any>();
    all.forEach((m: any) => unique.set(m.sid, m));

    const messages = Array.from(unique.values()).sort(
      (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

    return new Response(JSON.stringify({ success: true, messages }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("❌ fetch-twilio-conversation error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message || "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
