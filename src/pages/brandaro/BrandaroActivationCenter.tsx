import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Zap, RefreshCw, Phone, MessageSquare, Database, Settings,
  Play, AlertTriangle, CheckCircle, Loader2, Rocket, Shield
} from "lucide-react";

interface ActivationStatus {
  label: string;
  count: number;
  status: "active" | "empty" | "warning";
  icon: any;
}

export default function BrandaroActivationCenter() {
  const queryClient = useQueryClient();
  const [runningAction, setRunningAction] = useState<string | null>(null);

  // System status queries
  const { data: queueCount } = useQuery({
    queryKey: ["activation-call-queue"],
    queryFn: async () => {
      const { count } = await (supabase as any).from("brandaro_call_queue").select("*", { count: "exact", head: true }).eq("is_active", true);
      return count || 0;
    },
  });

  const { data: pendingMsgs } = useQuery({
    queryKey: ["activation-pending-msgs"],
    queryFn: async () => {
      const { count } = await (supabase as any).from("brandaro_pending_messages").select("*", { count: "exact", head: true }).eq("status", "pending");
      return count || 0;
    },
  });

  const { data: qualifiedCount } = useQuery({
    queryKey: ["activation-qualified"],
    queryFn: async () => {
      const { count } = await supabase.from("brandaro_qualified_leads").select("*", { count: "exact", head: true });
      return count || 0;
    },
  });

  const { data: masterCount } = useQuery({
    queryKey: ["activation-master"],
    queryFn: async () => {
      const { count } = await (supabase as any).from("brandaro_leads_master").select("*", { count: "exact", head: true });
      return count || 0;
    },
  });

  const { data: numberPoolCount } = useQuery({
    queryKey: ["activation-numbers"],
    queryFn: async () => {
      const { count } = await (supabase as any).from("brandaro_number_pool").select("*", { count: "exact", head: true }).eq("is_active", true);
      return count || 0;
    },
  });

  const { data: automationCount } = useQuery({
    queryKey: ["activation-automations"],
    queryFn: async () => {
      const { count } = await (supabase as any).from("brandaro_automations").select("*", { count: "exact", head: true }).eq("is_active", true);
      return count || 0;
    },
  });

  const { data: callLogCount } = useQuery({
    queryKey: ["activation-call-logs"],
    queryFn: async () => {
      const { count } = await (supabase as any).from("brandaro_call_logs").select("*", { count: "exact", head: true });
      return count || 0;
    },
  });

  const { data: clientCount } = useQuery({
    queryKey: ["activation-clients"],
    queryFn: async () => {
      const { count } = await (supabase as any).from("brandaro_clients").select("*", { count: "exact", head: true });
      return count || 0;
    },
  });

  // Action mutations
  const syncLeads = useMutation({
    mutationFn: async () => {
      setRunningAction("sync");
      const { data, error } = await supabase.functions.invoke("brandaro-lead-sync");
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Lead Sync Complete: ${data.synced} new leads synced`);
      queryClient.invalidateQueries({ queryKey: ["activation-master"] });
      setRunningAction(null);
    },
    onError: (err: any) => {
      toast.error(`Sync failed: ${err.message}`);
      setRunningAction(null);
    },
  });

  const dispatchSMS = useMutation({
    mutationFn: async (dryRun: boolean) => {
      setRunningAction("sms");
      const { data, error } = await supabase.functions.invoke("brandaro-sms-dispatch", {
        body: { batch_size: 25, dry_run: dryRun },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.dry_run) {
        toast.info(`SMS Dry Run: ${data.sent} messages would be sent`);
      } else {
        toast.success(`SMS Dispatch: ${data.sent} sent, ${data.failed} failed`);
      }
      queryClient.invalidateQueries({ queryKey: ["activation-pending-msgs"] });
      setRunningAction(null);
    },
    onError: (err: any) => {
      toast.error(`SMS dispatch failed: ${err.message}`);
      setRunningAction(null);
    },
  });

  const executeCalls = useMutation({
    mutationFn: async (dryRun: boolean) => {
      setRunningAction("calls");
      const { data, error } = await supabase.functions.invoke("brandaro-execute-calls", {
        body: { batch_size: 10, dry_run: dryRun },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.dry_run) {
        toast.info(`Call Dry Run: ${data.calls_initiated} calls would be initiated`);
      } else {
        toast.success(`Calls: ${data.calls_initiated} initiated, ${data.calls_failed} failed`);
      }
      queryClient.invalidateQueries({ queryKey: ["activation-call-queue"] });
      queryClient.invalidateQueries({ queryKey: ["activation-call-logs"] });
      setRunningAction(null);
    },
    onError: (err: any) => {
      toast.error(`Call execution failed: ${err.message}`);
      setRunningAction(null);
    },
  });

  const seedAutomations = useMutation({
    mutationFn: async () => {
      setRunningAction("automations");
      const { data, error } = await supabase.functions.invoke("brandaro-seed-automations");
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Automations: ${data.seeded} rules seeded`);
      queryClient.invalidateQueries({ queryKey: ["activation-automations"] });
      setRunningAction(null);
    },
    onError: (err: any) => {
      toast.error(`Seed failed: ${err.message}`);
      setRunningAction(null);
    },
  });

  const statuses: ActivationStatus[] = [
    { label: "Qualified Leads", count: qualifiedCount || 0, status: (qualifiedCount || 0) > 0 ? "active" : "empty", icon: Database },
    { label: "Pipeline (Master)", count: masterCount || 0, status: (masterCount || 0) > 0 ? "active" : "warning", icon: Database },
    { label: "Call Queue", count: queueCount || 0, status: (queueCount || 0) > 0 ? "active" : "empty", icon: Phone },
    { label: "Pending Messages", count: pendingMsgs || 0, status: (pendingMsgs || 0) > 0 ? "warning" : "active", icon: MessageSquare },
    { label: "Phone Numbers", count: numberPoolCount || 0, status: (numberPoolCount || 0) > 0 ? "active" : "warning", icon: Phone },
    { label: "Automation Rules", count: automationCount || 0, status: (automationCount || 0) > 0 ? "active" : "warning", icon: Settings },
    { label: "Calls Executed", count: callLogCount || 0, status: (callLogCount || 0) > 0 ? "active" : "empty", icon: Phone },
    { label: "Clients Won", count: clientCount || 0, status: (clientCount || 0) > 0 ? "active" : "empty", icon: Rocket },
  ];

  const activeCount = statuses.filter(s => s.status === "active").length;
  const healthScore = Math.round((activeCount / statuses.length) * 100);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Zap className="h-8 w-8 text-amber-500" />
            System Activation Center
          </h1>
          <p className="text-muted-foreground mt-1">Connect, activate, and monitor all Brandaro systems</p>
        </div>
        <Badge
          variant="outline"
          className={`px-4 py-2 text-lg font-bold ${
            healthScore >= 75 ? "text-emerald-500 border-emerald-500/30" :
            healthScore >= 40 ? "text-amber-500 border-amber-500/30" :
            "text-destructive border-destructive/30"
          }`}
        >
          {healthScore >= 75 ? "🟢" : healthScore >= 40 ? "🟡" : "🔴"} {healthScore}%
        </Badge>
      </div>

      {/* System Status Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statuses.map((s) => (
          <Card key={s.label} className={`${
            s.status === "warning" ? "border-amber-500/30" :
            s.status === "empty" ? "border-muted" :
            "border-emerald-500/30"
          }`}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                {s.status === "active" ? (
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                ) : s.status === "warning" ? (
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                ) : (
                  <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
                )}
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
              <p className="text-xl font-bold">{s.count}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Lead Sync */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Database className="h-4 w-4 text-blue-500" />
              Lead Pipeline Sync
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              Sync {qualifiedCount || 0} qualified leads → pipeline master. Only adds new leads (no duplicates).
            </p>
            <Button
              onClick={() => syncLeads.mutate()}
              disabled={runningAction !== null}
              className="w-full"
            >
              {runningAction === "sync" ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Syncing...</>
              ) : (
                <><RefreshCw className="h-4 w-4 mr-2" /> Sync Leads Now</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* SMS Dispatch */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-emerald-500" />
              SMS Message Dispatch
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              {pendingMsgs || 0} messages pending. Send via Twilio with pacing + retry logic.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => dispatchSMS.mutate(true)}
                disabled={runningAction !== null}
                className="flex-1"
              >
                {runningAction === "sms" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4 mr-1" />}
                Dry Run
              </Button>
              <Button
                onClick={() => dispatchSMS.mutate(false)}
                disabled={runningAction !== null}
                className="flex-1"
              >
                {runningAction === "sms" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
                Send Now
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Call Execution */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Phone className="h-4 w-4 text-violet-500" />
              Call Queue Execution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              {queueCount || 0} calls queued. Execute batch via Twilio dialer.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => executeCalls.mutate(true)}
                disabled={runningAction !== null}
                className="flex-1"
              >
                {runningAction === "calls" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4 mr-1" />}
                Dry Run
              </Button>
              <Button
                onClick={() => executeCalls.mutate(false)}
                disabled={runningAction !== null}
                className="flex-1"
              >
                {runningAction === "calls" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
                Execute
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Automation Rules */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Settings className="h-4 w-4 text-amber-500" />
              Automation Rules
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              {automationCount || 0} rules active. Seed default rules for the full pipeline.
            </p>
            <Button
              onClick={() => seedAutomations.mutate()}
              disabled={runningAction !== null || (automationCount || 0) > 0}
              className="w-full"
              variant={(automationCount || 0) > 0 ? "outline" : "default"}
            >
              {runningAction === "automations" ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Seeding...</>
              ) : (automationCount || 0) > 0 ? (
                <><CheckCircle className="h-4 w-4 mr-2" /> Rules Active</>
              ) : (
                <><Zap className="h-4 w-4 mr-2" /> Seed Automation Rules</>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Blockers */}
      {(numberPoolCount || 0) === 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div>
                <p className="font-medium text-sm text-destructive">BLOCKER: No Phone Numbers</p>
                <p className="text-xs text-muted-foreground">
                  Add Twilio numbers to <code className="text-xs">brandaro_number_pool</code> before executing calls.
                  Go to <strong>Phone Numbers</strong> in the sidebar to manage your number pool.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
