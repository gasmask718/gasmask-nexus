import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2, XCircle, Loader2, Search, AlertTriangle,
  Radio, Phone, Zap, Server, Globe,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface TwimlApp {
  sid: string;
  friendly_name: string;
  voice_url: string | null;
  date_updated: string;
  date_created: string;
  routing_match: boolean;
  matched_endpoint: string | null;
  provider: string | null;
}

interface DiscoveryResult {
  verdict: string;
  verdict_detail: string;
  env_discovery: { sid: string; source: string }[];
  configured_app_sid: string | null;
  configured_app_match: TwimlApp | null;
  twilio_apps: TwimlApp[];
  twilio_api_error: string | null;
  call_usage: {
    most_used_app: string | null;
    usage_count: number;
    last_call_time: string | null;
    app_usage_map: Record<string, number>;
  };
  total_apps_found: number;
  matched_apps_count: number;
  timestamp: string;
}

const VERDICT_CONFIG: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  EXISTING_APP_VERIFIED: { color: "border-green-500/30", label: "VERIFIED", icon: <CheckCircle2 className="h-4 w-4 text-green-500" /> },
  MULTIPLE_APPS_FOUND: { color: "border-yellow-500/30", label: "MULTIPLE FOUND", icon: <AlertTriangle className="h-4 w-4 text-yellow-500" /> },
  APPS_FOUND_NO_MATCH: { color: "border-yellow-500/30", label: "NO ROUTE MATCH", icon: <AlertTriangle className="h-4 w-4 text-yellow-500" /> },
  NO_APP_FOUND: { color: "border-destructive/50", label: "NONE FOUND", icon: <XCircle className="h-4 w-4 text-destructive" /> },
  API_ERROR: { color: "border-destructive/50", label: "API ERROR", icon: <XCircle className="h-4 w-4 text-destructive" /> },
};

function providerBadge(provider: string | null) {
  if (!provider) return null;
  const colors: Record<string, string> = {
    ELEVENLABS: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
    AWS_TTS: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
    VOICE_ROUTER: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
    HYBRID: "bg-green-500/10 text-green-700 dark:text-green-400",
  };
  return (
    <Badge variant="outline" className={`text-[10px] ${colors[provider] || ""}`}>
      {provider}
    </Badge>
  );
}

export function VoiceInfrastructureAudit() {
  const [result, setResult] = useState<DiscoveryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runDiscovery = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke("twilio-admin-list-twiml-apps", { body: {} });
      if (invokeErr) { setError(invokeErr.message || String(invokeErr)); return; }
      if (data?.error) { setError(data.error); return; }
      setResult(data as DiscoveryResult);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const vc = result ? VERDICT_CONFIG[result.verdict] || VERDICT_CONFIG.API_ERROR : null;

  return (
    <Card className={vc?.color || ""}>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center gap-3">
          <Search className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-sm font-medium flex-1">
            Voice Infrastructure Audit
          </CardTitle>
          {vc && (
            <Badge variant="outline" className="text-xs gap-1">
              {vc.icon} {vc.label}
            </Badge>
          )}
          <Button size="sm" variant="outline" onClick={runDiscovery} disabled={loading} className="gap-1.5 text-xs h-7">
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
            Discover
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0 px-4 pb-3 space-y-3">
        {!result && !error && !loading && (
          <p className="text-xs text-muted-foreground">
            Read-only scan of your Twilio account. Discovers existing TwiML Apps, matches routes, and identifies active providers. Does not create or modify anything.
          </p>
        )}

        {error && (
          <div className="flex items-start gap-2 p-2 rounded bg-destructive/10 text-destructive text-xs">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <>
            {/* Verdict */}
            <div className={`p-2 rounded text-xs ${
              result.verdict === "EXISTING_APP_VERIFIED" ? "bg-green-500/10 text-green-700 dark:text-green-400" :
              result.verdict === "NO_APP_FOUND" || result.verdict === "API_ERROR" ? "bg-destructive/10 text-destructive" :
              "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
            }`}>
              <div className="font-medium">{result.verdict_detail}</div>
            </div>

            {/* Configured SID from env */}
            {result.env_discovery.length > 0 && (
              <div className="rounded border p-2 space-y-1">
                <div className="text-xs font-medium flex items-center gap-1.5">
                  <Server className="h-3.5 w-3.5" /> Configured in Secrets
                </div>
                {result.env_discovery.map((e, i) => (
                  <div key={i} className="text-[10px] font-mono flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                    <span>{e.source}: {e.sid.slice(0, 8)}…{e.sid.slice(-4)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Configured app match detail */}
            {result.configured_app_match && (
              <div className="rounded border p-2 space-y-1">
                <div className="text-xs font-medium flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5" /> Active Configured App
                </div>
                <div className="text-[10px] font-mono space-y-0.5">
                  <div>Name: {result.configured_app_match.friendly_name}</div>
                  <div>SID: {result.configured_app_match.sid}</div>
                  <div className="truncate">Voice URL: {result.configured_app_match.voice_url || "(none)"}</div>
                  <div className="flex items-center gap-2">
                    Route Match: {result.configured_app_match.routing_match ? 
                      <span className="text-green-500">✅ {result.configured_app_match.matched_endpoint}</span> : 
                      <span className="text-yellow-500">⚠ No match</span>
                    }
                  </div>
                  {result.configured_app_match.provider && (
                    <div className="flex items-center gap-2">Provider: {providerBadge(result.configured_app_match.provider)}</div>
                  )}
                </div>
              </div>
            )}

            {/* All TwiML Apps */}
            {result.twilio_apps.length > 0 && (
              <div className="rounded border p-2 space-y-1.5">
                <div className="text-xs font-medium flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5" /> All TwiML Apps ({result.total_apps_found})
                </div>
                {result.twilio_apps.map(app => (
                  <div key={app.sid} className={`text-[10px] font-mono p-1.5 rounded ${
                    app.routing_match ? "bg-green-500/5 border border-green-500/20" : "bg-muted/50"
                  }`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate">{app.friendly_name}</span>
                      <div className="flex items-center gap-1">
                        {app.routing_match && <CheckCircle2 className="h-3 w-3 text-green-500" />}
                        {providerBadge(app.provider)}
                        {result.call_usage.app_usage_map[app.sid] && (
                          <Badge variant="secondary" className="text-[9px] h-4">
                            {result.call_usage.app_usage_map[app.sid]} calls
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-muted-foreground truncate">
                      {app.sid} → {app.voice_url || "(no voice URL)"}
                    </div>
                    {app.matched_endpoint && (
                      <div className="text-green-600 dark:text-green-400">
                        Routes to: {app.matched_endpoint}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Call usage */}
            {result.call_usage.most_used_app && (
              <div className="rounded border p-2 space-y-1">
                <div className="text-xs font-medium flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" /> Recent Call Activity
                </div>
                <div className="text-[10px] font-mono space-y-0.5">
                  <div>Most used app: {result.call_usage.most_used_app}</div>
                  <div>Usage count (last 50 calls): {result.call_usage.usage_count}</div>
                  <div>Last call: {result.call_usage.last_call_time || "N/A"}</div>
                </div>
              </div>
            )}

            {/* Provider summary */}
            <div className="rounded border p-2 space-y-1">
              <div className="text-xs font-medium flex items-center gap-1.5">
                <Radio className="h-3.5 w-3.5" /> Provider Routing Summary
              </div>
              <div className="grid grid-cols-2 gap-1">
                {["ELEVENLABS", "AWS_TTS", "VOICE_ROUTER", "HYBRID"].map(p => {
                  const apps = result.twilio_apps.filter(a => a.provider === p);
                  return (
                    <div key={p} className="text-[10px] font-mono flex items-center gap-1.5">
                      {apps.length > 0 ? (
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                      ) : (
                        <XCircle className="h-3 w-3 text-muted-foreground/40" />
                      )}
                      {p}: {apps.length > 0 ? `${apps.length} app(s)` : "none"}
                    </div>
                  );
                })}
              </div>
            </div>

            {result.twilio_api_error && (
              <div className="text-[10px] text-destructive font-mono bg-destructive/5 rounded p-1.5">
                API Error: {result.twilio_api_error}
              </div>
            )}

            <div className="text-[10px] text-muted-foreground">
              Scanned at {result.timestamp} • READ ONLY — no resources modified
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
