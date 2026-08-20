import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageSquare, Link2, ReceiptText, Activity, PhoneCall, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type Result = { ok: boolean; data: any } | null;

function ResultBlock({ result }: { result: Result }) {
  if (!result) return null;
  return (
    <pre
      className={`mt-3 text-xs rounded-md p-3 overflow-auto max-h-64 border ${
        result.ok
          ? "border-green-500/40 bg-green-500/5"
          : "border-destructive/40 bg-destructive/5"
      }`}
    >
      {JSON.stringify(result.data, null, 2)}
    </pre>
  );
}

export default function TwilioTestConsole() {
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState(
    "GasMask OS test SMS — toll-free verification. Reply STOP to opt out.",
  );
  const [storeName, setStoreName] = useState("Test Store");
  const [storeId, setStoreId] = useState("00000000-0000-0000-0000-000000000000");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [amount, setAmount] = useState("42.50");

  const [busy, setBusy] = useState<string | null>(null);
  const [healthResult, setHealthResult] = useState<Result>(null);
  const [smsResult, setSmsResult] = useState<Result>(null);
  const [signupResult, setSignupResult] = useState<Result>(null);
  const [receiptResult, setReceiptResult] = useState<Result>(null);
  const [voiceResult, setVoiceResult] = useState<Result>(null);

  async function call(action: string, body: Record<string, any>) {
    const { data, error } = await supabase.functions.invoke("admin-twilio-test", {
      body: { action, ...body },
    });
    if (error) return { ok: false, data: { error: error.message, data } };
    const ok = data?.success === true || data?.status === "active";
    return { ok, data };
  }

  const runHealth = async () => {
    setBusy("health");
    const r = await call("health", {});
    setHealthResult(r);
    r.ok ? toast.success("Twilio credentials active") : toast.error("Twilio health check failed");
    setBusy(null);
  };

  const runSms = async () => {
    if (!phone) return toast.error("Enter a phone number");
    setBusy("sms");
    const r = await call("send_sms", { to: phone, message });
    setSmsResult(r);
    r.ok ? toast.success(`SMS sent (sid ${r.data?.message_sid})`) : toast.error(r.data?.error_message || "Send failed");
    setBusy(null);
  };

  const runSignup = async () => {
    if (!phone) return toast.error("Enter a phone number");
    setBusy("signup");
    const r = await call("signup_link", { to: phone, store_name: storeName, store_id: storeId });
    setSignupResult(r);
    r.ok ? toast.success("Signup link SMS sent") : toast.error(r.data?.error_message || r.data?.error || "Send failed");
    setBusy(null);
  };

  const runReceipt = async () => {
    if (!phone) return toast.error("Enter a phone number");
    setBusy("receipt");
    const r = await call("receipt", {
      to: phone,
      invoice_number: invoiceNumber || undefined,
      amount: Number(amount),
      store_name: storeName,
    });
    setReceiptResult(r);
    r.ok ? toast.success("Receipt SMS sent") : toast.error(r.data?.error_message || "Send failed");
    setBusy(null);
  };

  const runVoiceDiscovery = async () => {
    setBusy("voice");
    const { data, error } = await supabase.functions.invoke("twilio-admin-list-twiml-apps", { body: {} });
    const ok = !error && !data?.error && !data?.twilio_api_error;
    const r: Result = { ok, data: error ? { error: error.message } : data };
    setVoiceResult(r);
    ok
      ? toast.success(`Voice webhook scan: ${data?.verdict}`)
      : toast.error(data?.twilio_api_error || data?.error || error?.message || "Discovery failed");
    setBusy(null);
  };

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Twilio / Toll-Free Test Console</h1>
        <p className="text-sm text-muted-foreground">
          Live-fire tests for Twilio SMS, tokenized store signup links, and SMS receipts.
          Uses the verified toll-free sender. Admin/Owner only.
        </p>
      </div>

      {/* 1. Health */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" /> 1. Credentials & Account Health
          </CardTitle>
          <CardDescription>
            Verifies <code>TWILIO_ACCOUNT_SID</code>, <code>TWILIO_AUTH_TOKEN</code>,{" "}
            <code>TWILIO_PHONE_NUMBER</code> and pings Twilio.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={runHealth} disabled={busy === "health"}>
            {busy === "health" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Check Twilio Health
          </Button>
          {healthResult?.ok && (
            <Badge className="ml-3 bg-green-600 text-white">
              {healthResult.data?.account_status} · {healthResult.data?.phone_number}
            </Badge>
          )}
          <ResultBlock result={healthResult} />
        </CardContent>
      </Card>

      {/* Shared destination */}
      <Card>
        <CardHeader>
          <CardTitle>Test Destination</CardTitle>
          <CardDescription>Used by all three send tests below.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="phone">Recipient phone (E.164 or 10-digit US)</Label>
            <Input
              id="phone"
              placeholder="+15551234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* 2. Send SMS */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" /> 2. Send Test SMS
          </CardTitle>
          <CardDescription>
            Sends a plain SMS via the toll-free number to verify outbound delivery.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="msg">Message body</Label>
            <Textarea id="msg" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <Button onClick={runSms} disabled={busy === "sms"}>
            {busy === "sms" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Send Test SMS
          </Button>
          <ResultBlock result={smsResult} />
        </CardContent>
      </Card>

      {/* 3. Tokenized Signup Link */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" /> 3. Tokenized Store Signup Link
          </CardTitle>
          <CardDescription>
            Creates a unique <code>store_signup_tokens</code> row and SMS's the
            tokenized <code>/store-signup?token=...</code> URL.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Store name</Label>
              <Input value={storeName} onChange={(e) => setStoreName(e.target.value)} />
            </div>
            <div>
              <Label>Store ID (uuid)</Label>
              <Input value={storeId} onChange={(e) => setStoreId(e.target.value)} />
            </div>
          </div>
          <Button onClick={runSignup} disabled={busy === "signup"}>
            {busy === "signup" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Generate & Send Signup Link
          </Button>
          <ResultBlock result={signupResult} />
        </CardContent>
      </Card>

      {/* 4. Receipt */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ReceiptText className="h-5 w-5" /> 4. Send Test Receipt SMS
          </CardTitle>
          <CardDescription>
            Sends a mock receipt SMS — same template the live receipt pipeline produces.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Invoice number (blank = auto)</Label>
              <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
            </div>
            <div>
              <Label>Amount ($)</Label>
              <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
          </div>
          <Button onClick={runReceipt} disabled={busy === "receipt"}>
            {busy === "receipt" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Send Test Receipt
          </Button>
          <ResultBlock result={receiptResult} />
        </CardContent>
      </Card>

      {/* 5. Voice Webhook Discovery (C11) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PhoneCall className="h-5 w-5" /> 5. Voice Webhook Discovery
          </CardTitle>
          <CardDescription>
            Read-only scan of Twilio TwiML Apps. Shows which voice webhooks
            (call-ai-*, twilio-bridge, twilio-voice-twiml, etc.) are currently
            wired into Twilio versus orphaned/unused.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={runVoiceDiscovery} disabled={busy === "voice"}>
            {busy === "voice" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Scan Voice Webhooks
          </Button>

          {voiceResult?.ok && voiceResult.data && (
            <div className="space-y-3 mt-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-blue-600 text-white">{voiceResult.data.verdict}</Badge>
                <span className="text-xs text-muted-foreground">
                  {voiceResult.data.total_apps_found} apps · {voiceResult.data.matched_apps_count} matched
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{voiceResult.data.verdict_detail}</p>

              <div className="border rounded-md divide-y">
                {(voiceResult.data.twilio_apps || []).map((app: any) => {
                  const calls = voiceResult.data.call_usage?.app_usage_map?.[app.sid] || 0;
                  const orphaned = !app.routing_match && calls === 0;
                  return (
                    <div key={app.sid} className="p-3 flex items-start gap-3 text-sm">
                      {app.routing_match ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                      ) : (
                        <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${orphaned ? "text-destructive" : "text-amber-500"}`} />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium truncate">{app.friendly_name}</span>
                          <code className="text-xs text-muted-foreground">{app.sid}</code>
                          {app.matched_endpoint && (
                            <Badge variant="outline" className="text-xs">→ {app.matched_endpoint}</Badge>
                          )}
                          {app.provider && (
                            <Badge variant="secondary" className="text-xs">{app.provider}</Badge>
                          )}
                          {orphaned && (
                            <Badge variant="destructive" className="text-xs">orphaned</Badge>
                          )}
                          {!orphaned && calls > 0 && (
                            <Badge className="text-xs bg-green-600 text-white">{calls} recent calls</Badge>
                          )}
                        </div>
                        {app.voice_url && (
                          <div className="text-xs text-muted-foreground truncate mt-1">{app.voice_url}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {(!voiceResult.data.twilio_apps || voiceResult.data.twilio_apps.length === 0) && (
                  <div className="p-3 text-sm text-muted-foreground">No TwiML Apps configured on this Twilio account.</div>
                )}
              </div>
            </div>
          )}

          <ResultBlock result={voiceResult} />
        </CardContent>
      </Card>
    </div>
  );
}
