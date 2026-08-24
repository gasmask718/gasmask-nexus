/**
 * POWER DIALER CONSOLE — the operator screen for human power dialing.
 *
 * THE RULE: this engine never dials on a schedule. Nothing here runs on a
 * cron. The engine only cycles while ALL of these are true:
 *   1. A human pressed START CALLING (arm_dialer) for a specific campaign.
 *   2. This screen (or another operator's) is open and invoking the tick.
 *   3. The armed window has not hit auto_disarm_at.
 * Pressing STOP (disarm_dialer) or closing the screen ends dialing.
 *
 * The screen also owns the LIVE-MODE GATE: telephony_mode/twilio_enabled
 * only flip after a real test call reaches a confirmed-human AMD verdict.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/contexts/BusinessContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, PhoneCall, PhoneOff, ShieldAlert, ShieldCheck, UserCheck, UserX, AlertTriangle, Lock, LockOpen, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { CallListBuilder } from "@/components/communication/dialer/CallListBuilder";

// GasMask and Grabba R Us are the same company sharing one store book —
// the dialer shows the family's campaigns regardless of which badge is active.
const DIALER_FAMILY_BUSINESS_IDS = [
  "a1b2c3d4-e5f6-7890-abcd-ef1234567890", // Grabba R Us (existing dialer home)
  "c3d4e5f6-a7b8-9012-cdef-123456789012", // GasMask
];

const TICK_INTERVAL_MS = 20_000;
const POLL_MS = 10_000;

const STATUS_GROUPS: { key: string; label: string; statuses: string[]; className: string }[] = [
  { key: "connected", label: "Connected", statuses: ["connected", "bridged", "bridging", "transferred", "completed"], className: "text-emerald-500" },
  { key: "voicemail", label: "Voicemail", statuses: ["voicemail_detected", "voicemail_left"], className: "text-amber-500" },
  { key: "no_answer", label: "No answer", statuses: ["no-answer", "busy", "failed", "canceled"], className: "text-muted-foreground" },
  { key: "dnc", label: "Blocked (DNC)", statuses: ["dnc_skipped"], className: "text-destructive" },
  { key: "dialing", label: "Dialing now", statuses: ["dialing", "claimed"], className: "text-blue-500" },
  { key: "remaining", label: "Remaining", statuses: ["queued"], className: "text-foreground" },
];

export default function PowerDialerConsole() {
  const { currentBusiness } = useBusiness();
  const { isAdmin, role } = useUserRole();
  const queryClient = useQueryClient();
  const isElevated = isAdmin() || role === "owner";

  const [selectedCampaign, setSelectedCampaign] = useState<string>("");
  const [minutes, setMinutes] = useState(120);
  const [arming, setArming] = useState(false);
  const [testPhone, setTestPhone] = useState("+19174643048"); // owner's test line
  const [gateBusy, setGateBusy] = useState(false);
  const [testSid, setTestSid] = useState<string | null>(null);
  const tickInFlight = useRef(false);
  const autoConfirmFired = useRef(false);

  // ── Engine state (the master switch) ──
  const { data: settings } = useQuery({
    queryKey: ["power-dialer-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("dialer_settings").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return data as any;
    },
    refetchInterval: POLL_MS,
  });

  const armed = settings?.engine_armed === true;
  const isLive = settings?.telephony_mode === "live" && settings?.twilio_enabled === true;
  const armedCampaignId = settings?.armed_campaign_id as string | undefined;
  const disarmAt = settings?.auto_disarm_at ? new Date(settings.auto_disarm_at) : null;

  // ── Campaigns ──
  const { data: campaigns } = useQuery({
    queryKey: ["power-dialer-campaigns", currentBusiness?.id],
    queryFn: async () => {
      const ids = currentBusiness?.id && !DIALER_FAMILY_BUSINESS_IDS.includes(currentBusiness.id)
        ? [...DIALER_FAMILY_BUSINESS_IDS, currentBusiness.id]
        : DIALER_FAMILY_BUSINESS_IDS;
      const q = supabase.from("dialer_campaigns").select("id, name, status, total_targets, completed_calls").in("business_id", ids).is("archived_at", null).order("updated_at", { ascending: false });
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const activeCampaignId = armed ? armedCampaignId : selectedCampaign;

  // ── Live counters for the campaign being worked ──
  const { data: queueRows } = useQuery({
    queryKey: ["power-dialer-counters", activeCampaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("outbound_call_queue")
        .select("status")
        .eq("campaign_id", activeCampaignId!);
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeCampaignId,
    refetchInterval: armed ? POLL_MS : false,
  });

  const counters = useMemo(() => {
    const rows = queueRows || [];
    const count = (statuses: string[]) => rows.filter((r: any) => statuses.includes(r.status)).length;
    const dialedStatuses = STATUS_GROUPS.flatMap(g => g.statuses).filter(s => s !== "queued");
    return {
      dialed: rows.filter((r: any) => dialedStatuses.includes(r.status)).length,
      groups: STATUS_GROUPS.map(g => ({ ...g, count: count(g.statuses) })),
    };
  }, [queueRows]);

  // ── My agent availability (the tick only dials for available agents) ──
  const { data: myAgent } = useQuery({
    queryKey: ["power-dialer-my-agent", currentBusiness?.id],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      let q = supabase.from("dialer_agent_availability").select("*").eq("user_id", user.id);
      if (currentBusiness?.id) q = q.eq("business_id", currentBusiness.id);
      const { data, error } = await q.maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const iAmAvailable = myAgent?.status === "available";

  // ── THE TICK DRIVER: while armed AND an available agent is on this
  // screen, invoke one engine cycle per interval. Closing the screen or
  // pressing STOP stops the loop — no clock anywhere else runs it. ──
  useEffect(() => {
    if (!armed || !iAmAvailable) return;
    const tick = async () => {
      if (tickInFlight.current) return;
      tickInFlight.current = true;
      try {
        await supabase.functions.invoke("power-dialer-tick", { body: {} });
      } finally {
        tickInFlight.current = false;
      }
    };
    tick();
    const id = setInterval(tick, TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [armed, iAmAvailable]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["power-dialer-settings"] });
    queryClient.invalidateQueries({ queryKey: ["power-dialer-counters"] });
    queryClient.invalidateQueries({ queryKey: ["power-dialer-my-agent"] });
  };

  const handleArm = async () => {
    if (!selectedCampaign) { toast.error("Pick a campaign first"); return; }
    setArming(true);
    try {
      const { data, error } = await supabase.rpc("arm_dialer", { p_campaign_id: selectedCampaign, p_minutes: minutes });
      if (error) throw error;
      toast((data as any)?.note || "Engine armed", { icon: isLive ? <PhoneCall className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" /> });
      invalidate();
    } catch (e: any) {
      toast.error(`Could not start: ${e.message}`);
    } finally {
      setArming(false);
    }
  };

  const handleDisarm = async () => {
    try {
      const { error } = await supabase.rpc("disarm_dialer");
      if (error) throw error;
      toast.success("Engine stopped. No more calls will be placed.");
      invalidate();
    } catch (e: any) {
      toast.error(`Stop failed: ${e.message}`);
    }
  };

  const setMyStatus = async (status: "available" | "offline") => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if (myAgent?.id) {
        const { error } = await supabase.from("dialer_agent_availability")
          .update({ status, last_status_change: new Date().toISOString(), updated_at: new Date().toISOString() } as any)
          .eq("id", myAgent.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("dialer_agent_availability")
          .insert({ user_id: user.id, business_id: currentBusiness?.id, status, max_concurrent_calls: 1 } as any);
        if (error) throw error;
      }
      invalidate();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const adminAction = async (action: string, extra: Record<string, unknown> = {}) => {
    setGateBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("power-dialer-admin", { body: { action, ...extra } });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.detail ? `${data.error}: ${data.detail}` : data.error);
      if (action === "confirm_test") toast.success(data.message);
      else toast(data.message || "Done");
      if (action === "test_call" && data?.test_call_sid) {
        autoConfirmFired.current = false;
        setTestSid(data.test_call_sid);
      }
      invalidate();
      return data;
    } catch (e: any) {
      toast.error(e.message);
      return null;
    } finally {
      setGateBusy(false);
    }
  };

  // ── Live test-call step tracking ──
  // While a test call is in flight, poll OUR webhook pipeline's own event
  // log (through the admin function) so each step shows as it happens, and
  // a failure names the exact step that failed. Resume tracking on reload
  // if a test call was placed but never unlocked.
  useEffect(() => {
    if (!testSid && !isLive && settings?.live_mode_test_call_sid) {
      setTestSid(settings.live_mode_test_call_sid as string);
    }
  }, [settings?.live_mode_test_call_sid, isLive, testSid]);

  const { data: testStatus } = useQuery({
    queryKey: ["power-dialer-test-status", testSid],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("power-dialer-admin", { body: { action: "test_status" } });
      if (error) throw error;
      return data as any;
    },
    enabled: !!testSid && !isLive,
    refetchInterval: 2500,
  });

  // Human confirmed → unlock automatically. The manual button stays as a
  // fallback for a delayed webhook.
  useEffect(() => {
    if (isLive) { autoConfirmFired.current = false; return; }
    if (testStatus?.steps?.human_confirmed && !autoConfirmFired.current && !gateBusy) {
      autoConfirmFired.current = true;
      adminAction("confirm_test");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testStatus?.steps?.human_confirmed, isLive, gateBusy]);

  const testSteps = testStatus?.steps as Record<string, boolean> | undefined;
  const testFailure = testStatus?.failure as { step: string; detail: string } | null | undefined;
  const showTracker = !!testSid && !isLive;

  return (
    <div className="space-y-4 p-4 max-w-5xl mx-auto">
      {/* ── STATE BANNER — always visible, plain words ── */}
      <div className={`rounded-lg border p-4 flex items-center gap-3 ${
        armed && isLive ? "bg-destructive/15 border-destructive/40" :
        armed ? "bg-amber-500/10 border-amber-500/40" :
        "bg-muted border-border"
      }`}>
        {armed && isLive ? <PhoneCall className="h-6 w-6 text-destructive animate-pulse" /> :
         armed ? <AlertTriangle className="h-6 w-6 text-amber-500" /> :
         <PhoneOff className="h-6 w-6 text-muted-foreground" />}
        <div className="flex-1">
          <p className="font-bold text-lg">
            {!armed && "ENGINE OFF — nothing dials until you press START CALLING"}
            {armed && isLive && "LIVE — real calls are being placed"}
            {armed && !isLive && "SIMULATION — no real calls"}
          </p>
          {armed && disarmAt && (
            <p className="text-sm text-muted-foreground">
              Stops automatically at {disarmAt.toLocaleTimeString()} — no schedule keeps it running.
            </p>
          )}
          {armed && !iAmAvailable && (
            <p className="text-sm text-amber-500 font-medium">Armed, but you are not marked available — the engine is waiting on you.</p>
          )}
        </div>
        {armed && (
          <Button variant="destructive" size="lg" onClick={handleDisarm} className="text-lg px-8">
            <PhoneOff className="h-5 w-5 mr-2" /> STOP
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* ── START ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Phone className="h-5 w-5" /> Start calling</CardTitle>
            <CardDescription>Pick the campaign. Only that campaign is dialed, one number at a time, only while you are available.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Campaign</Label>
              <Select value={armed ? (armedCampaignId || "") : selectedCampaign} onValueChange={setSelectedCampaign} disabled={armed}>
                <SelectTrigger><SelectValue placeholder="Select campaign" /></SelectTrigger>
                <SelectContent>
                  {campaigns?.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} · {c.status} · {c.completed_calls ?? 0}/{c.total_targets ?? "?"} done
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Work window (minutes, max 480)</Label>
              <Input type="number" min={5} max={480} value={minutes} onChange={(e) => setMinutes(parseInt(e.target.value) || 120)} disabled={armed} />
              <p className="text-xs text-muted-foreground mt-1">The engine disarms itself when this window ends.</p>
            </div>
            {!armed ? (
              <Button size="lg" className="w-full text-lg" onClick={handleArm} disabled={arming || !selectedCampaign}>
                <PhoneCall className="h-5 w-5 mr-2" /> {arming ? "Starting…" : "START CALLING"}
              </Button>
            ) : (
              <Button variant="destructive" size="lg" className="w-full text-lg" onClick={handleDisarm}>
                <PhoneOff className="h-5 w-5 mr-2" /> STOP
              </Button>
            )}

            <div className="flex items-center justify-between rounded-md border p-3">
              <div className="flex items-center gap-2">
                {iAmAvailable ? <UserCheck className="h-4 w-4 text-emerald-500" /> : <UserX className="h-4 w-4 text-muted-foreground" />}
                <div>
                  <p className="text-sm font-medium">You are {iAmAvailable ? "available" : myAgent?.status || "offline"}</p>
                  <p className="text-xs text-muted-foreground">
                    Route: {myAgent?.phone_route_type === "forward" ? `your phone ${myAgent?.forward_phone_e164 || ""}` : "browser"}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setMyStatus(iAmAvailable ? "offline" : "available")}>
                {iAmAvailable ? "Go offline" : "I'm available"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── COUNTERS ── */}
        <Card>
          <CardHeader>
            <CardTitle>This campaign</CardTitle>
            <CardDescription>Live counts — refresh every 10s while armed</CardDescription>
          </CardHeader>
          <CardContent>
            {!activeCampaignId ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Select a campaign to see its numbers.</p>
            ) : (
              <>
                <div className="text-center py-2">
                  <p className="text-5xl font-bold tabular-nums">{counters.dialed}</p>
                  <p className="text-sm text-muted-foreground">dialed</p>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {counters.groups.map(g => (
                    <div key={g.key} className="flex items-center justify-between rounded-md border px-3 py-2">
                      <span className="text-sm">{g.label}</span>
                      <span className={`text-lg font-bold tabular-nums ${g.className}`}>{g.count}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── BUILD A CALL LIST — store book → campaign → queue ── */}
      <CallListBuilder
        businessId={currentBusiness?.id}
        onCampaignCreated={(id) => setSelectedCampaign(id)}
      />

      {/* ── LIVE-MODE GATE (admin/owner only) ── */}
      {isElevated && (
        <Card className={isLive ? "border-destructive/40" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isLive ? <LockOpen className="h-5 w-5 text-destructive" /> : <Lock className="h-5 w-5" />}
              Live mode gate
            </CardTitle>
            <CardDescription>
              {isLive
                ? `Unlocked ${settings?.live_mode_unlocked_at ? new Date(settings.live_mode_unlocked_at).toLocaleString() : ""}. Real calls are placed whenever the engine is armed.`
                : "Locked. Live mode only unlocks after one real test call reaches a confirmed human answer."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!isLive ? (
              <>
                <div className="flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/30 p-3 text-sm">
                  <ShieldAlert className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <span>
                    One real call from GasMask / Grabba's line <span className="font-mono">+19298225712</span> to the
                    number below — the full chain runs: dial → machine detection → confirmed human. Answer it and
                    stay on the line a few seconds; live mode unlocks itself when the human answer is confirmed.
                  </span>
                </div>
                <div className="flex gap-2">
                  <Input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} className="font-mono" />
                  <Button variant="outline" disabled={gateBusy || !testPhone} onClick={() => adminAction("test_call", { phone: testPhone })}>
                    {gateBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PhoneCall className="h-4 w-4" />}
                    <span className="ml-1">Place test call</span>
                  </Button>
                </div>

                {showTracker && (
                  <div className="rounded-md border p-3 space-y-2">
                    {[
                      { key: "dialing", label: "Dialing" },
                      { key: "ringing", label: "Ringing" },
                      { key: "answered", label: "Answered" },
                      { key: "human_confirmed", label: "Human confirmed (machine detection)" },
                    ].map((s, i, arr) => {
                      const done = !!testSteps?.[s.key];
                      const failedHere = testFailure?.step === s.key;
                      const prevDone = i === 0 ? true : !!testSteps?.[arr[i - 1].key];
                      const active = !done && !failedHere && !testFailure && prevDone;
                      return (
                        <div key={s.key} className="flex items-center gap-2 text-sm">
                          {done ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> :
                           failedHere ? <XCircle className="h-4 w-4 text-destructive" /> :
                           active ? <Loader2 className="h-4 w-4 animate-spin text-blue-500" /> :
                           <div className="h-4 w-4 rounded-full border border-muted-foreground/30" />}
                          <span className={done ? "text-foreground" : failedHere ? "text-destructive font-medium" : "text-muted-foreground"}>
                            {s.label}
                          </span>
                          {s.key === "human_confirmed" && testStatus?.answered_by && (
                            <span className="text-xs text-muted-foreground font-mono">({testStatus.answered_by})</span>
                          )}
                        </div>
                      );
                    })}
                    <div className="flex items-center gap-2 text-sm">
                      {testSteps?.human_confirmed && !testFailure
                        ? <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                        : <div className="h-4 w-4 rounded-full border border-muted-foreground/30" />}
                      <span className="text-muted-foreground">Live mode unlocked</span>
                    </div>
                    {testFailure && (
                      <div className="rounded-md bg-destructive/10 border border-destructive/40 p-3 text-sm text-destructive">
                        <p className="font-semibold">Failed at: {testFailure.step.replace(/_/g, " ")}</p>
                        <p className="text-xs mt-1">{testFailure.detail}</p>
                      </div>
                    )}
                  </div>
                )}

                {(testSid || settings?.live_mode_test_call_sid) && !testSteps?.human_confirmed && !testFailure && (
                  <Button className="w-full" disabled={gateBusy} onClick={() => adminAction("confirm_test")}>
                    <ShieldCheck className="h-4 w-4 mr-2" /> I answered — Confirm &amp; unlock live mode
                  </Button>
                )}
              </>
            ) : (
              <div className="space-y-3">
                <div className="rounded-md bg-destructive/10 border border-destructive/40 p-3 text-sm">
                  <p className="font-semibold text-destructive">LIVE MODE IS ON.</p>
                  <p className="mt-1">
                    Real calls will be placed when a campaign is armed.
                    Unlocked {settings?.live_mode_unlocked_at ? new Date(settings.live_mode_unlocked_at).toLocaleString() : ""}.
                  </p>
                </div>
                <Button variant="outline" disabled={gateBusy} onClick={() => adminAction("set_simulation")}>
                  Back to simulation (also stops the engine)
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
