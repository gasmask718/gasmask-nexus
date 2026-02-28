import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2, XCircle, Loader2, ShieldCheck, AlertTriangle, KeyRound,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ValidationResult {
  format_valid: boolean;
  format_errors: string[];
  twilio_api_reachable: boolean;
  twilio_api_detail: string;
  token_generation: boolean;
  token_error?: string;
  overall: "PASS" | "FAIL";
  failures: string[];
}

const SID_PATTERNS = {
  account_sid: { regex: /^AC[a-f0-9]{32}$/i, label: "Account SID", prefix: "AC" },
  api_key_sid: { regex: /^SK[a-f0-9]{32}$/i, label: "API Key SID", prefix: "SK" },
  twiml_app_sid: { regex: /^AP[a-f0-9]{32}$/i, label: "TwiML App SID", prefix: "AP" },
};

function FormatBadge({ valid }: { valid: boolean | null }) {
  if (valid === null) return null;
  return valid
    ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
    : <XCircle className="h-3.5 w-3.5 text-destructive" />;
}

export function TwilioCredentialInstaller() {
  const [accountSid, setAccountSid] = useState("");
  const [apiKeySid, setApiKeySid] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [twimlAppSid, setTwimlAppSid] = useState("");

  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Client-side format checks
  const formatChecks = {
    account_sid: accountSid ? SID_PATTERNS.account_sid.regex.test(accountSid) : null,
    api_key_sid: apiKeySid ? SID_PATTERNS.api_key_sid.regex.test(apiKeySid) : null,
    twiml_app_sid: twimlAppSid ? SID_PATTERNS.twiml_app_sid.regex.test(twimlAppSid) : null,
    api_secret: apiSecret ? apiSecret.length >= 20 : null,
  };

  const allFormatValid = Object.values(formatChecks).every((v) => v === true);
  const anyEntered = accountSid || apiKeySid || apiSecret || twimlAppSid;

  const handleValidate = useCallback(async () => {
    setValidating(true);
    setError(null);
    setResult(null);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke(
        "validate-twilio-credentials",
        {
          body: {
            account_sid: accountSid,
            api_key_sid: apiKeySid,
            api_secret: apiSecret,
            twiml_app_sid: twimlAppSid,
          },
        }
      );
      if (invokeErr) {
        setError(invokeErr.message || String(invokeErr));
        return;
      }
      if (data?.error) {
        setError(data.error);
        return;
      }
      setResult(data as ValidationResult);
    } catch (err) {
      setError(String(err));
    } finally {
      setValidating(false);
    }
  }, [accountSid, apiKeySid, apiSecret, twimlAppSid]);

  const borderClass = result
    ? result.overall === "PASS"
      ? "border-green-500/30"
      : "border-destructive/50"
    : "";

  return (
    <Card className={borderClass}>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center gap-3">
          <KeyRound className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-sm font-medium flex-1">
            Twilio Voice Credentials
          </CardTitle>
          {result && (
            <Badge
              variant={result.overall === "PASS" ? "outline" : "destructive"}
              className="text-xs"
            >
              {result.overall}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0 px-4 pb-4 space-y-3">
        <p className="text-xs text-muted-foreground">
          Enter your Twilio API credentials. They will be validated against
          Twilio's API before you save them as secrets.
        </p>

        {/* Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1.5">
              Account SID
              <FormatBadge valid={formatChecks.account_sid} />
            </Label>
            <Input
              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              value={accountSid}
              onChange={(e) => setAccountSid(e.target.value.trim())}
              className="text-xs h-8 font-mono"
            />
            {formatChecks.account_sid === false && (
              <p className="text-[10px] text-destructive">Must start with AC + 32 hex chars</p>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1.5">
              API Key SID
              <FormatBadge valid={formatChecks.api_key_sid} />
            </Label>
            <Input
              placeholder="SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              value={apiKeySid}
              onChange={(e) => setApiKeySid(e.target.value.trim())}
              className="text-xs h-8 font-mono"
            />
            {formatChecks.api_key_sid === false && (
              <p className="text-[10px] text-destructive">Must start with SK + 32 hex chars</p>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1.5">
              API Secret
              <FormatBadge valid={formatChecks.api_secret} />
            </Label>
            <Input
              type="password"
              placeholder="Your API secret"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value.trim())}
              className="text-xs h-8 font-mono"
            />
            {formatChecks.api_secret === false && (
              <p className="text-[10px] text-destructive">Must be at least 20 characters</p>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1.5">
              TwiML App SID
              <FormatBadge valid={formatChecks.twiml_app_sid} />
            </Label>
            <Input
              placeholder="APxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              value={twimlAppSid}
              onChange={(e) => setTwimlAppSid(e.target.value.trim())}
              className="text-xs h-8 font-mono"
            />
            {formatChecks.twiml_app_sid === false && (
              <p className="text-[10px] text-destructive">Must start with AP + 32 hex chars</p>
            )}
          </div>
        </div>

        {/* Validate button */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleValidate}
            disabled={!allFormatValid || validating}
            className="gap-1.5 text-xs"
          >
            {validating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <ShieldCheck className="h-3 w-3" />
            )}
            Validate Credentials
          </Button>
          {!allFormatValid && anyEntered && (
            <span className="text-[10px] text-muted-foreground">
              Fix format errors to enable validation
            </span>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-2 rounded bg-destructive/10 text-destructive text-xs">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-2 rounded border p-3">
            <div className="text-xs font-medium">Validation Results</div>
            <div className="grid grid-cols-1 gap-1.5">
              <ResultRow
                label="Format Validation"
                ok={result.format_valid}
                detail={result.format_errors.join("; ") || "All SIDs valid"}
              />
              <ResultRow
                label="Twilio API Auth"
                ok={result.twilio_api_reachable}
                detail={result.twilio_api_detail}
              />
              <ResultRow
                label="Token Generation"
                ok={result.token_generation}
                detail={result.token_error || "JWT generated successfully"}
              />
            </div>

            {result.overall === "PASS" && (
              <div className="mt-2 p-2 rounded bg-green-500/10 text-green-700 dark:text-green-400 text-xs space-y-1">
                <div className="font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  All checks passed — credentials are valid
                </div>
                <p>
                  Now save these as Cloud secrets. Click the buttons below and
                  paste each value when prompted:
                </p>
                <div className="font-mono text-[10px] space-y-0.5">
                  <div>• TWILIO_ACCOUNT_SID → {accountSid.slice(0, 6)}…</div>
                  <div>• TWILIO_API_SID → {apiKeySid.slice(0, 6)}…</div>
                  <div>• TWILIO_API_SECRET → ••••••</div>
                  <div>• TWILIO_TWIML_APP_SID → {twimlAppSid.slice(0, 6)}…</div>
                </div>
              </div>
            )}

            {result.overall === "FAIL" && result.failures.length > 0 && (
              <div className="mt-2 p-2 rounded bg-destructive/10 text-destructive text-xs">
                <div className="font-medium mb-1">Failures:</div>
                {result.failures.map((f, i) => (
                  <div key={i} className="font-mono text-[10px]">• {f}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ResultRow({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {ok ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
      ) : (
        <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
      )}
      <span className="font-medium w-32">{label}</span>
      <span className="text-muted-foreground truncate">{detail}</span>
    </div>
  );
}
