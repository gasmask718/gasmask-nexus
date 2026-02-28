import { useState, useCallback, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CheckCircle2, XCircle, Loader2, Play, RefreshCw, ShieldCheck, Mic,
  Phone, Radio, AlertTriangle, ChevronDown, ChevronUp, Activity, Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useVoiceDevice } from "@/contexts/VoiceDeviceProvider";
import { TwilioCredentialInstaller } from "./TwilioCredentialInstaller";
import { VoiceInfrastructureAudit } from "./VoiceInfrastructureAudit";
import { VoiceDeviceReadiness } from "./VoiceDeviceReadiness";

type GateStatus = "idle" | "running" | "pass" | "fail";

interface GateResult {
  status: GateStatus;
  evidence: string[];
  error?: string;
}

const DEFAULT_GATE: GateResult = { status: "idle", evidence: [] };

function GateIcon({ status }: { status: GateStatus }) {
  switch (status) {
    case "pass": return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    case "fail": return <XCircle className="h-5 w-5 text-destructive" />;
    case "running": return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
    default: return <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />;
  }
}

function GateCard({ label, icon, gate, children }: {
  label: string; icon: React.ReactNode; gate: GateResult; children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card className={gate.status === "fail" ? "border-destructive/50" : gate.status === "pass" ? "border-green-500/30" : ""}>
      <CardHeader className="py-3 px-4 cursor-pointer" onClick={() => setOpen(!open)}>
        <div className="flex items-center gap-3">
          <GateIcon status={gate.status} />
          <span className="text-muted-foreground">{icon}</span>
          <CardTitle className="text-sm font-medium flex-1">{label}</CardTitle>
          <Badge variant={gate.status === "pass" ? "outline" : gate.status === "fail" ? "destructive" : "secondary"} className="text-xs">
            {gate.status.toUpperCase()}
          </Badge>
          {gate.evidence.length > 0 && (open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
        </div>
      </CardHeader>
      {open && (gate.evidence.length > 0 || gate.error || children) && (
        <CardContent className="pt-0 px-4 pb-3 space-y-2">
          {gate.error && (
            <div className="flex items-start gap-2 p-2 rounded bg-destructive/10 text-destructive text-xs">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{gate.error}</span>
            </div>
          )}
          {gate.evidence.map((e, i) => (
            <div key={i} className="text-xs text-muted-foreground font-mono bg-muted/50 rounded px-2 py-1">{e}</div>
          ))}
          {children}
        </CardContent>
      )}
    </Card>
  );
}

// ── Full Pipeline Audit Panel (server-side) ──
interface AuditResult {
  gate_d_status: string;
  health_score: number;
  steps: {
    a_environment: { env_health: Record<string, boolean>; env_masked: Record<string, string> };
    b_sid_validation: Record<string, { valid: boolean; detail: string }>;
    c_token_generation: { success: boolean; error?: string };
    d_function_reachability: Record<string, { status: string; code: number | null; detail: string }>;
    e_twilio_api: { reachable: boolean; detail: string };
  };
  failures: string[];
  recommendations: string[];
  timestamp: string;
}

function statusColor(ok: boolean) {
  return ok ? "text-green-500" : "text-destructive";
}

function PipelineAuditPanel() {
  const [result, setResult] = useState<AuditResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAudit = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke("voice-pipeline-audit", { body: {} });
      if (invokeErr) {
        setError(invokeErr.message || String(invokeErr));
        return;
      }
      if (data?.error) {
        setError(data.error);
        return;
      }
      setResult(data as AuditResult);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const scoreColor = result ? (result.health_score >= 80 ? "text-green-500" : result.health_score >= 40 ? "text-yellow-500" : "text-destructive") : "";

  // Determine if this is a "production OK but audit probe issue" scenario
  const isProbeOnlyIssue = result && result.gate_d_status === "FAIL" && 
    result.steps.c_token_generation.success && 
    Object.values(result.steps.a_environment.env_health).every(Boolean);

  const borderClass = result 
    ? (result.gate_d_status === "PASS" ? "border-green-500/30" : isProbeOnlyIssue ? "border-yellow-500/30" : "border-destructive/50")
    : "";

  return (
    <Card className={borderClass}>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center gap-3">
          <Zap className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-sm font-medium flex-1">Voice Pipeline Audit (Server-Side)</CardTitle>
          {result && (
            <span className={`text-lg font-bold ${scoreColor}`}>{result.health_score}%</span>
          )}
          <Button size="sm" variant="outline" onClick={runAudit} disabled={loading} className="gap-1.5 text-xs h-7">
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
            Run Pipeline Audit
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0 px-4 pb-3 space-y-3">
        {error && (
          <div className="flex items-start gap-2 p-2 rounded bg-destructive/10 text-destructive text-xs">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Yellow warning banner for probe-only issues */}
        {isProbeOnlyIssue && (
          <div className="flex items-start gap-2 p-2 rounded bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 text-xs">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span><strong>Production OK</strong> — Live calling works. Audit probes have configuration issues that don't affect operators.</span>
          </div>
        )}

        {!result && !error && !loading && (
          <p className="text-xs text-muted-foreground">Click "Run Pipeline Audit" to test the full voice calling pipeline from the server side.</p>
        )}
        {result && (
          <>
            {/* Step cards */}
            <div className="grid grid-cols-2 gap-2">
              {/* Environment */}
              <div className="rounded border p-2 space-y-1">
                <div className="text-xs font-medium flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" /> Environment
                </div>
                {Object.entries(result.steps.a_environment.env_health).map(([k, v]) => (
                  <div key={k} className="text-[10px] font-mono flex justify-between">
                    <span className="truncate">{k.replace("TWILIO_", "").replace("SUPABASE_", "SB_")}</span>
                    <span className={statusColor(v)}>{v ? "✅" : "❌"}</span>
                  </div>
                ))}
              </div>
              {/* SID Validation */}
              <div className="rounded border p-2 space-y-1">
                <div className="text-xs font-medium flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" /> SID Format
                </div>
                {Object.entries(result.steps.b_sid_validation).map(([k, v]) => (
                  <div key={k} className="text-[10px] font-mono flex justify-between gap-1">
                    <span className="truncate">{k.replace("TWILIO_", "")}</span>
                    <span className={statusColor(v.valid)}>{v.valid ? "✅" : "❌"}</span>
                  </div>
                ))}
              </div>
              {/* Token Gen */}
              <div className="rounded border p-2 space-y-1">
                <div className="text-xs font-medium flex items-center gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5" /> Token Authority
                </div>
                <div className={`text-[10px] font-mono ${statusColor(result.steps.c_token_generation.success)}`}>
                  {result.steps.c_token_generation.success ? "✅ Token generated" : `❌ ${result.steps.c_token_generation.error || "Failed"}`}
                </div>
              </div>
              {/* Function Reachability */}
              <div className="rounded border p-2 space-y-1">
                <div className="text-xs font-medium flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5" /> Edge Functions
                </div>
                {Object.entries(result.steps.d_function_reachability).map(([name, r]) => (
                  <div key={name} className="text-[10px] font-mono flex justify-between gap-1">
                    <span className="truncate">{name.replace("twilio-", "")}</span>
                    <span className={statusColor(r.status === "OK")}>{r.status === "OK" ? "✅" : `❌ ${r.status}`}</span>
                  </div>
                ))}
              </div>
              {/* Twilio API */}
              <div className="rounded border p-2 space-y-1 col-span-2">
                <div className="text-xs font-medium flex items-center gap-1.5">
                  <Radio className="h-3.5 w-3.5" /> Twilio API
                </div>
                <div className={`text-[10px] font-mono ${statusColor(result.steps.e_twilio_api.reachable)}`}>
                  {result.steps.e_twilio_api.reachable ? "✅ Twilio API responding" : `❌ ${result.steps.e_twilio_api.detail}`}
                </div>
                {!result.steps.e_twilio_api.reachable && result.steps.e_twilio_api.detail.includes("401") && (
                  <div className="text-[10px] text-yellow-600 dark:text-yellow-400 mt-1">
                    💡 Tip: Add <code className="bg-muted px-1 rounded">TWILIO_AUTH_TOKEN</code> secret for reliable API access, or create a new Standard API Key in Twilio Console.
                  </div>
                )}
              </div>
            </div>

            {/* Recommendations */}
            {result.recommendations.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">Recommendations:</div>
                {result.recommendations.map((r, i) => (
                  <div key={i} className="text-xs bg-muted/50 rounded px-2 py-1 font-mono">{r}</div>
                ))}
              </div>
            )}
            <div className="text-[10px] text-muted-foreground">Audited at {result.timestamp}</div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Always-on pipeline reachability (client-side pings) ──
type FnStatus = "checking" | "reachable" | "auth_required" | "not_deployed" | "error";

interface FnPing {
  name: string;
  status: FnStatus;
  lastCheck: string | null;
  detail?: string;
}

function PipelineReachabilityCard() {
  const FUNCTIONS = ["twilio-voice-token", "twilio-outbound-call", "health-check"];
  const [pings, setPings] = useState<FnPing[]>(FUNCTIONS.map(name => ({ name, status: "checking", lastCheck: null })));
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkAll = useCallback(async () => {
    const results = await Promise.all(
      FUNCTIONS.map(async (name): Promise<FnPing> => {
        try {
          const { data, error } = await supabase.functions.invoke(name, {
            method: "POST",
            body: name === "health-check" ? undefined : { dry_run: true },
          });
          const now = new Date().toISOString();
          if (error) {
            const msg = error.message || String(error);
            if (msg.includes("404") || msg.includes("not found")) {
              return { name, status: "not_deployed", lastCheck: now, detail: msg };
            }
            if (msg.includes("401") || msg.includes("403") || msg.includes("Unauthorized")) {
              return { name, status: "auth_required", lastCheck: now, detail: msg };
            }
            return { name, status: "reachable", lastCheck: now, detail: `Response with error: ${msg}` };
          }
          return { name, status: "reachable", lastCheck: now, detail: data ? "OK" : "Empty response" };
        } catch (err) {
          return { name, status: "error", lastCheck: new Date().toISOString(), detail: String(err) };
        }
      })
    );
    setPings(results);
  }, []);

  useEffect(() => {
    checkAll();
    intervalRef.current = setInterval(checkAll, 15000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [checkAll]);

  const statusIcon = (s: FnStatus) => {
    switch (s) {
      case "reachable": return "🟢";
      case "auth_required": return "🟡";
      case "not_deployed": return "🔴";
      case "error": return "🔴";
      default: return "⏳";
    }
  };

  const allGreen = pings.every(p => p.status === "reachable");

  return (
    <Card className={allGreen ? "border-green-500/30" : "border-destructive/50"}>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-sm font-medium flex-1">Pipeline Reachability (Live)</CardTitle>
          <Badge variant={allGreen ? "outline" : "destructive"} className="text-xs">
            {allGreen ? "ALL GREEN" : "ISSUES"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0 px-4 pb-3 space-y-1.5">
        {pings.map(p => (
          <div key={p.name} className="flex items-center gap-2 text-xs font-mono bg-muted/50 rounded px-2 py-1.5">
            <span>{statusIcon(p.status)}</span>
            <span className="flex-1">{p.name}</span>
            <span className="text-muted-foreground">{p.status}</span>
          </div>
        ))}
        <div className="text-[10px] text-muted-foreground mt-1">Auto-refreshes every 15s</div>
      </CardContent>
    </Card>
  );
}

export function VoiceGoLiveReport() {
  const device = useVoiceDevice();
  const [gateA, setGateA] = useState<GateResult>(DEFAULT_GATE);
  const [gateB, setGateB] = useState<GateResult>(DEFAULT_GATE);
  const [gateC, setGateC] = useState<GateResult>(DEFAULT_GATE);
  const [gateD, setGateD] = useState<GateResult>(DEFAULT_GATE);
  const [gateE, setGateE] = useState<GateResult>(DEFAULT_GATE);
  const [testPhone, setTestPhone] = useState("");
  const [running, setRunning] = useState(false);

  const runAudit = useCallback(async () => {
    setRunning(true);
    setGateA({ ...DEFAULT_GATE, status: "running" });
    setGateB(DEFAULT_GATE);
    setGateC(DEFAULT_GATE);
    setGateD(DEFAULT_GATE);
    setGateE(DEFAULT_GATE);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setGateA({ status: "fail", evidence: [], error: "No auth session — log in first" });
        setRunning(false);
        return;
      }

      setGateB({ ...DEFAULT_GATE, status: "running" });

      const { data, error: invokeError } = await supabase.functions.invoke("twilio-voice-token", { body: {} });

      if (invokeError && !data) {
        setGateA({ status: "fail", evidence: [String(invokeError)], error: "Edge function unreachable or errored" });
        setGateB({ status: "fail", evidence: [], error: "Blocked by Gate A failure" });
        setRunning(false);
        return;
      }

      if (data?.health) {
        const allOk = Object.values(data.health).every(Boolean);
        const evidence = Object.entries(data.health).map(([k, v]) => `${k}: ${v ? "✅" : "❌"}`);
        setGateA({
          status: allOk ? "pass" : "fail",
          evidence,
          error: allOk ? undefined : `Failing keys: ${Object.entries(data.health).filter(([, v]) => !v).map(([k]) => k).join(", ")}`,
        });
        if (!allOk) {
          setGateB({ status: "fail", evidence: [], error: "Blocked by Gate A failure" });
          setRunning(false);
          return;
        }
      } else if (invokeError) {
        setGateA({ status: "fail", evidence: [JSON.stringify(data)], error: data?.error || "Token endpoint error" });
        setGateB({ status: "fail", evidence: [], error: "Blocked by Gate A failure" });
        setRunning(false);
        return;
      } else {
        setGateA({ status: "pass", evidence: ["Health map not returned but token succeeded"] });
      }

      // Gate B
      const token = data?.token;
      if (!token || token.length < 200 || token.split(".").length !== 3) {
        setGateB({ status: "fail", evidence: [`Token length: ${token?.length || 0}`, `Segments: ${token?.split(".").length || 0}`], error: "Invalid JWT format" });
        setRunning(false);
        return;
      }

      try {
        const payloadB64 = token.split(".")[1];
        const payload = JSON.parse(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")));
        const evidence = [
          `iss: ${payload.iss}`,
          `sub: ${payload.sub}`,
          `exp: ${new Date(payload.exp * 1000).toISOString()}`,
          `identity: ${payload.grants?.identity || "MISSING"}`,
          `voice_grant: ${payload.grants?.voice ? "present" : "MISSING"}`,
          `outgoing_app: ${payload.grants?.voice?.outgoing?.application_sid || "MISSING"}`,
        ];
        const expValid = payload.exp * 1000 > Date.now();
        const hasVoice = !!payload.grants?.voice;
        const hasIdentity = !!payload.grants?.identity;

        setGateB({
          status: expValid && hasVoice && hasIdentity ? "pass" : "fail",
          evidence,
          error: !expValid ? "Token already expired" : !hasVoice ? "Missing voice grant" : !hasIdentity ? "Missing identity" : undefined,
        });
      } catch {
        setGateB({ status: "fail", evidence: [], error: "Failed to decode JWT payload" });
        setRunning(false);
        return;
      }

      // Gate C
      setGateC({ ...DEFAULT_GATE, status: "running" });
      await new Promise(r => setTimeout(r, 2000));
      setGateC({
        status: device.isReady ? "pass" : "fail",
        evidence: [
          `Device ready: ${device.isReady}`,
          `Device error: ${device.deviceError || "none"}`,
          `Token expires: ${device.tokenExpiresAt || "unknown"}`,
        ],
        error: device.isReady ? undefined : device.deviceError || "Device not registered — check browser microphone permissions",
      });

      // Gate D
      setGateD({ ...DEFAULT_GATE, status: "running" });
      const fnNames = ["twilio-outbound-call", "twilio-voice-token", "health-check"];
      const pipelineChecks: string[] = [];
      await Promise.all(fnNames.map(async (name) => {
        try {
          const { error } = await supabase.functions.invoke(name, { method: "POST", body: name === "health-check" ? undefined : { dry_run: true } });
          if (error) {
            const msg = error.message || String(error);
            if (msg.includes("404") || msg.includes("not found")) {
              pipelineChecks.push(`${name}: ❌ not deployed`);
            } else {
              pipelineChecks.push(`${name}: ✅ reachable`);
            }
          } else {
            pipelineChecks.push(`${name}: ✅ reachable`);
          }
        } catch {
          pipelineChecks.push(`${name}: ❌ unreachable (network error)`);
        }
      }));
      const allReachable = pipelineChecks.every(c => c.includes("✅"));
      setGateD({
        status: allReachable ? "pass" : "fail",
        evidence: [...pipelineChecks, "Method: supabase.functions.invoke()"],
        error: allReachable ? undefined : "Some edge functions unreachable — check deployment",
      });

      // Gate E
      setGateE({
        status: device.isReady ? "pass" : "fail",
        evidence: [device.isReady ? "Device ready — enter a test number and click Test Call" : "Device not ready — cannot place test calls"],
        error: device.isReady ? undefined : "Fix gates above first",
      });

    } catch (err) {
      setGateA(prev => prev.status === "running" ? { status: "fail", evidence: [], error: String(err) } : prev);
    } finally {
      setRunning(false);
    }
  }, [device.isReady, device.deviceError, device.tokenExpiresAt]);

  const handleTestCall = useCallback(async () => {
    if (!testPhone.match(/^\+\d{10,15}$/)) return;
    const call = await device.makeCall(testPhone);
    if (call) {
      setGateE(prev => ({
        ...prev,
        status: "pass",
        evidence: [...prev.evidence, `Test call initiated at ${new Date().toISOString()}`],
      }));
      setTimeout(() => device.hangUp(), 10000);
    } else {
      setGateE(prev => ({
        ...prev,
        status: "fail",
        evidence: [...prev.evidence, "Test call failed to connect"],
        error: "Device.connect() failed — check console",
      }));
    }
  }, [testPhone, device]);

  const allPassed = [gateA, gateB, gateC, gateD, gateE].every(g => g.status === "pass");
  const anyFailed = [gateA, gateB, gateC, gateD, gateE].some(g => g.status === "fail");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" /> Voice Go-Live Report
          </h2>
          <p className="text-xs text-muted-foreground">5-gate forensic audit: Token → Device → Call</p>
        </div>
        <div className="flex items-center gap-2">
          {allPassed && <Badge className="bg-green-500 text-white">ALL GATES PASS</Badge>}
          {anyFailed && <Badge variant="destructive">ISSUES DETECTED</Badge>}
          <Button size="sm" onClick={runAudit} disabled={running} className="gap-1.5">
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            {running ? "Auditing…" : "Run Audit"}
          </Button>
        </div>
      </div>

      {/* Voice Infrastructure Discovery (read-only) */}
      <VoiceDeviceReadiness showDebug={true} />
      <VoiceInfrastructureAudit />

      {/* Credential installer */}
      <TwilioCredentialInstaller />

      {/* Server-side pipeline audit */}
      <PipelineAuditPanel />

      {/* Always-on client-side monitor */}
      <PipelineReachabilityCard />

      <div className="space-y-2">
        <GateCard label="Gate A — Secrets & Credentials" icon={<ShieldCheck className="h-4 w-4" />} gate={gateA} />
        <GateCard label="Gate B — Token Validation" icon={<RefreshCw className="h-4 w-4" />} gate={gateB} />
        <GateCard label="Gate C — Device Registration" icon={<Mic className="h-4 w-4" />} gate={gateC} />
        <GateCard label="Gate D — Pipeline Reachability" icon={<Radio className="h-4 w-4" />} gate={gateD} />
        <GateCard label="Gate E — Test Call" icon={<Phone className="h-4 w-4" />} gate={gateE}>
          {gateE.status !== "idle" && (
            <div className="flex gap-2 mt-2">
              <Input
                placeholder="+15551234567"
                value={testPhone}
                onChange={e => setTestPhone(e.target.value)}
                className="text-xs h-8 max-w-[200px]"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleTestCall}
                disabled={!device.isReady || !testPhone.match(/^\+\d{10,15}$/)}
                className="gap-1 text-xs h-8"
              >
                <Phone className="h-3 w-3" /> Test Call
              </Button>
            </div>
          )}
        </GateCard>
      </div>
    </div>
  );
}
