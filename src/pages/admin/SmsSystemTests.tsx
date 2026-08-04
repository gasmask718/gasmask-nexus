import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, XCircle, Play, Loader2, Shield, FlaskConical } from "lucide-react";
import { toast } from "sonner";
import Layout from "@/components/Layout";
import { verifiedInsert, verifiedDelete, mutationErrorMessage } from "@/lib/verifiedMutation";

const TEST_PHONE = "5551234567"; // Safe test number

interface TestResult {
  name: string;
  status: "idle" | "running" | "pass" | "fail";
  details: string;
}

export default function SmsSystemTests() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [testMode, setTestMode] = useState(false);
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [tests, setTests] = useState<TestResult[]>([
    { name: "Idempotency", status: "idle", details: "" },
    { name: "STOP Enforcement", status: "idle", details: "" },
    { name: "Duplicate Hash", status: "idle", details: "" },
    { name: "Provider Switch", status: "idle", details: "" },
    { name: "Fallback", status: "idle", details: "" },
  ]);

  const { data: logs = [], refetch: refetchLogs } = useQuery({
    queryKey: ["sms-test-logs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sms_test_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(25);
      return data || [];
    },
  });

  const updateTest = (idx: number, update: Partial<TestResult>) => {
    setTests(prev => prev.map((t, i) => i === idx ? { ...t, ...update } : t));
  };

  const logResult = async (test_name: string, result: "PASS" | "FAIL", details: any) => {
    await supabase.from("sms_test_logs").insert({
      test_name,
      result,
      details,
      executed_by: user?.id || null,
    });
    refetchLogs();
  };

  // ── TEST 1: Idempotency ──
  const runIdempotencyTest = async () => {
    updateTest(0, { status: "running", details: "Sending first request..." });
    const key = `test-idemp-${Date.now()}`;
    try {
      const { data: r1 } = await supabase.functions.invoke("send-sms", {
        body: { to_number: TEST_PHONE, message_body: `Idempotency test ${Date.now()}`, idempotency_key: key, metadata: { test: true } },
      });

      updateTest(0, { details: "Sending duplicate request..." });
      const { data: r2 } = await supabase.functions.invoke("send-sms", {
        body: { to_number: TEST_PHONE, message_body: `Idempotency test ${Date.now()}`, idempotency_key: key, metadata: { test: true } },
      });

      const pass = r2?.idempotent === true;
      updateTest(0, { status: pass ? "pass" : "fail", details: pass ? "Second call returned idempotent:true ✓" : `Expected idempotent:true, got: ${JSON.stringify(r2)}` });
      await logResult("Idempotency", pass ? "PASS" : "FAIL", { first: r1, second: r2 });
    } catch (e: any) {
      updateTest(0, { status: "fail", details: e.message });
      await logResult("Idempotency", "FAIL", { error: e.message });
    }
  };

  // ── TEST 2: STOP Enforcement ──
  const runStopTest = async () => {
    updateTest(1, { status: "running", details: "Inserting opt-out record..." });
    const testPhone = "5559999999";
    try {
      // Insert opt-out
      await verifiedInsert("insert test opt-out record", () =>
        supabase.from("opt_out_events").upsert(
          { phone_number: `1${testPhone}`, source: "test", reason: "Test STOP enforcement" },
          { onConflict: "phone_number" },
        ),
      );

      updateTest(1, { details: "Attempting send to opted-out number..." });
      const { data } = await supabase.functions.invoke("send-sms", {
        body: { to_number: testPhone, message_body: "STOP test message", idempotency_key: `test-stop-${Date.now()}`, metadata: { test: true } },
      });

      const pass = data?.status === "blocked";
      updateTest(1, { status: pass ? "pass" : "fail", details: pass ? "Send blocked for opted-out number ✓" : `Expected blocked, got: ${JSON.stringify(data)}` });
      await logResult("STOP Enforcement", pass ? "PASS" : "FAIL", data);

      // Cleanup
      await verifiedDelete("clean up test opt-out record", () =>
        supabase.from("opt_out_events").delete().eq("phone_number", `1${testPhone}`),
      );
    } catch (e: unknown) {
      const msg = mutationErrorMessage(e);
      updateTest(1, { status: "fail", details: msg });
      await logResult("STOP Enforcement", "FAIL", { error: msg });
    }
  };

  // ── TEST 3: Duplicate Hash ──
  const runDuplicateHashTest = async () => {
    updateTest(2, { status: "running", details: "Sending first message..." });
    const msg = `Dup hash test ${Date.now()}`;
    try {
      const { data: r1 } = await supabase.functions.invoke("send-sms", {
        body: { to_number: TEST_PHONE, message_body: msg, idempotency_key: `test-hash1-${Date.now()}`, metadata: { test: true } },
      });

      updateTest(2, { details: "Sending duplicate content..." });
      const { data: r2 } = await supabase.functions.invoke("send-sms", {
        body: { to_number: TEST_PHONE, message_body: msg, idempotency_key: `test-hash2-${Date.now()}`, metadata: { test: true } },
      });

      const pass = r2?.status === "duplicate" || r2?.status === "cooldown";
      updateTest(2, { status: pass ? "pass" : "fail", details: pass ? `Duplicate/cooldown detected: ${r2?.status} ✓` : `Expected duplicate/cooldown, got: ${JSON.stringify(r2)}` });
      await logResult("Duplicate Hash", pass ? "PASS" : "FAIL", { first: r1, second: r2 });
    } catch (e: any) {
      updateTest(2, { status: "fail", details: e.message });
      await logResult("Duplicate Hash", "FAIL", { error: e.message });
    }
  };

  // ── TEST 4: Provider Switch ──
  const runProviderSwitchTest = async () => {
    updateTest(3, { status: "running", details: "Testing explicit_provider=twilio..." });
    try {
      const { data: r1 } = await supabase.functions.invoke("send-sms", {
        body: { to_number: TEST_PHONE, message_body: `Provider test twilio ${Date.now()}`, idempotency_key: `test-prov-tw-${Date.now()}`, explicit_provider: "twilio", metadata: { test: true } },
      });

      updateTest(3, { details: "Testing explicit_provider=biztext..." });
      // Wait a bit to avoid cooldown
      await new Promise(r => setTimeout(r, 1500));
      const { data: r2 } = await supabase.functions.invoke("send-sms", {
        body: { to_number: TEST_PHONE, message_body: `Provider test biztext ${Date.now()}`, idempotency_key: `test-prov-bt-${Date.now()}`, explicit_provider: "biztext", metadata: { test: true } },
      });

      const pass = r1?.provider === "twilio" && r2?.provider === "biztext";
      updateTest(3, { status: pass ? "pass" : "fail", details: pass ? "Both providers routed correctly ✓" : `Twilio: ${r1?.provider}, BizText: ${r2?.provider}` });
      await logResult("Provider Switch", pass ? "PASS" : "FAIL", { twilio: r1, biztext: r2 });
    } catch (e: any) {
      updateTest(3, { status: "fail", details: e.message });
      await logResult("Provider Switch", "FAIL", { error: e.message });
    }
  };

  // ── TEST 5: Fallback (informational) ──
  const runFallbackTest = async () => {
    updateTest(4, { status: "running", details: "Fallback test requires invalid primary credentials to trigger. Checking settings..." });
    try {
      const { data: settings } = await supabase
        .from("messaging_settings")
        .select("default_sms_provider, fallback_provider")
        .limit(1)
        .maybeSingle();

      const hasFallback = !!settings?.fallback_provider;
      updateTest(4, {
        status: hasFallback ? "pass" : "fail",
        details: hasFallback
          ? `Fallback configured: ${settings.fallback_provider} (live fallback requires provider failure to trigger) ✓`
          : "No fallback provider configured in messaging_settings",
      });
      await logResult("Fallback Config", hasFallback ? "PASS" : "FAIL", settings);
    } catch (e: any) {
      updateTest(4, { status: "fail", details: e.message });
      await logResult("Fallback Config", "FAIL", { error: e.message });
    }
  };

  const runAllTests = async () => {
    setIsRunningAll(true);
    await runIdempotencyTest();
    await runStopTest();
    await runDuplicateHashTest();
    await runProviderSwitchTest();
    await runFallbackTest();
    setIsRunningAll(false);
    toast.success("All tests completed");
  };

  const toggleTestMode = async () => {
    const newValue = !testMode;
    const { error } = await supabase
      .from("messaging_settings")
      .update({ enable_test_mode: newValue })
      .not("id", "is", null);
    if (!error) {
      setTestMode(newValue);
      toast.success(newValue ? "Test mode enabled — no real SMS sent" : "Test mode disabled — live sends active");
    }
  };

  const passCount = tests.filter(t => t.status === "pass").length;
  const failCount = tests.filter(t => t.status === "fail").length;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            SMS System Validation
          </h1>
          <p className="text-muted-foreground text-sm">
            5-test suite verifying idempotency, opt-out, dedup, provider routing, and fallback
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="test-mode" className="text-sm">Test Mode</Label>
            <Switch id="test-mode" checked={testMode} onCheckedChange={toggleTestMode} />
          </div>
          <Button onClick={runAllTests} disabled={isRunningAll}>
            {isRunningAll ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
            Run All Tests
          </Button>
        </div>
      </div>

      {/* Scorecard */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-4xl font-bold">{passCount}</p>
            <p className="text-sm text-muted-foreground">Passed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-4xl font-bold text-destructive">{failCount}</p>
            <p className="text-sm text-muted-foreground">Failed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-4xl font-bold text-muted-foreground">{5 - passCount - failCount}</p>
            <p className="text-sm text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
      </div>

      {/* Test Results */}
      <Card>
        <CardHeader>
          <CardTitle>Test Suite</CardTitle>
          <CardDescription>Click individual tests or "Run All Tests" to validate</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Test</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Details</TableHead>
                <TableHead className="w-[100px]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tests.map((t, i) => (
                <TableRow key={t.name}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>
                    {t.status === "idle" && <Badge variant="secondary">Idle</Badge>}
                    {t.status === "running" && <Badge className="bg-blue-500 text-white gap-1"><Loader2 className="h-3 w-3 animate-spin" />Running</Badge>}
                    {t.status === "pass" && <Badge className="bg-green-600 text-white gap-1"><CheckCircle2 className="h-3 w-3" />PASS</Badge>}
                    {t.status === "fail" && <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />FAIL</Badge>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[400px] truncate">{t.details}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={t.status === "running" || isRunningAll}
                      onClick={() => {
                        if (i === 0) runIdempotencyTest();
                        if (i === 1) runStopTest();
                        if (i === 2) runDuplicateHashTest();
                        if (i === 3) runProviderSwitchTest();
                        if (i === 4) runFallbackTest();
                      }}
                    >
                      <Play className="h-3 w-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Historical Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Test History</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Test</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">{log.test_name}</TableCell>
                    <TableCell>
                      {log.result === "PASS"
                        ? <Badge className="bg-green-600 text-white">PASS</Badge>
                        : <Badge variant="destructive">FAIL</Badge>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(log.created_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground py-4">No test results yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
