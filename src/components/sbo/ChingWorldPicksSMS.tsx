import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  MessageSquare, Plus, Trash2, Send, TestTube, RefreshCw, Loader2,
  Phone, User, Star, Users, ToggleLeft, ToggleRight, Clock, Edit3, Check,
  ChevronLeft, ChevronRight, SlidersHorizontal, Play, Settings, AlertTriangle,
  CheckCircle, XCircle, Zap
} from "lucide-react";

// ── Helpers ──
const formatPhone = (input: string): string => {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits[0] === "1") return `+${digits}`;
  return `+${digits}`;
};

const maskPhone = (phone: string) => {
  if (!phone || phone.length < 10) return phone;
  return phone.replace(/(\+\d)(\d{3})(\d{3})(\d{4})/, "$1XXX-XXX-$4");
};

const PROP_TYPE_LABELS: Record<string, string> = {
  points: "Points", pts: "Points", player_points: "Points",
  rebounds: "Rebounds", reb: "Rebounds",
  assists: "Assists", ast: "Assists",
  threes: "3PT", three_pointers: "3PT", threes_made: "3PT",
  blocks: "Blocks", blk: "Blocks",
  steals: "Steals", stl: "Steals",
  turnovers: "Turnovers", tov: "Turnovers",
  pra: "PRA", points_rebounds_assists: "PRA",
  fantasy_points: "Fantasy", minutes: "Minutes",
};

const normPropType = (t: string) => PROP_TYPE_LABELS[t?.toLowerCase()?.trim()] || t || "Prop";

const CONF_OPTIONS = [55, 60, 65, 70, 75, 80, 85, 90];
const MAX_OPTIONS = [3, 5, 8, 10];

interface Thresholds {
  topMin: number; stealsMin: number; blocksMin: number;
  otherMin: number; gamesMin: number; maxPerCat: number;
}

// ── Multi-segment builder ──
const MAX_CHARS = 1550;

function buildSegments(sections: { header: string; body: string }[]): string[] {
  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York",
  });
  const segments: string[] = [];
  let cur = `🏆 CHINGWORLD PICKS 🏆\n📅 ${dateLabel}\n─────────────────────\n\n`;
  let segNum = 1;

  for (const section of sections) {
    const block = `${section.header}\n${section.body}─────────────────────\n\n`;
    if (cur.length + block.length > MAX_CHARS && cur.length > 100) {
      cur += `💡 Continued in next message... (${segNum} of TOTAL)`;
      segments.push(cur);
      segNum++;
      cur = `🏆 CHINGWORLD PICKS (cont.) 🏆\n─────────────────────\n\n${block}`;
    } else {
      cur += block;
    }
  }
  cur += `💡 Bet responsibly\nGood luck! 🎯`;
  segments.push(cur);
  const total = segments.length;
  return segments.map((s) => s.replace(/\((\d+) of TOTAL\)/g, (_, n) => `(${n} of ${total})`));
}

function formatPropLine(pp: any, pred: any): string {
  const dir = (pred?.predicted_outcome || "over").toUpperCase();
  const odds = dir === "OVER" ? pp.over_odds : pp.under_odds;
  const oddsStr = odds ? (odds > 0 ? `+${odds}` : `${odds}`) : "N/A";
  const propLabel = normPropType(pp.prop_type);
  return `${pp.player_name}${pp.team ? ` (${pp.team})` : ""}\n${propLabel} ${dir} ${pp.line} | ${pred?.final_confidence || "?"}% | ${oddsStr}\n\n`;
}

const formatET = (iso: string) => {
  try {
    return new Date(iso).toLocaleString("en-US", {
      timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit",
    }) + " ET";
  } catch { return iso; }
};

// ── Component ──
export function ChingWorldPicksSMS() {
  const queryClient = useQueryClient();

  // Recipient form
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newGroup, setNewGroup] = useState("all");
  const [newNotes, setNewNotes] = useState("");

  // Message state
  const [messageSegments, setMessageSegments] = useState<string[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [sendProgress, setSendProgress] = useState("");
  const [genStatus, setGenStatus] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [runningAutomation, setRunningAutomation] = useState(false);
  const [automationProgress, setAutomationProgress] = useState("");

  // Thresholds
  const [thresholds, setThresholds] = useState<Thresholds>({
    topMin: 90, stealsMin: 75, blocksMin: 80, otherMin: 70, gamesMin: 75, maxPerCat: 5,
  });

  const currentMessage = messageSegments[previewIndex] || "";

  // ── Queries ──
  const { data: recipients = [], isLoading: recipientsLoading } = useQuery({
    queryKey: ["sbo-sms-recipients"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("sbo_sms_recipients").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: sendHistory = [] } = useQuery({
    queryKey: ["sbo-sms-sends-log"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("sbo_sms_sends_log").select("*").order("sent_at", { ascending: false }).limit(20);
      return data || [];
    },
  });

  const { data: automationLogs = [] } = useQuery({
    queryKey: ["sbo-automation-log"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("sbo_automation_log").select("*").order("created_at", { ascending: false }).limit(30);
      return data || [];
    },
  });

  // Generate on mount
  useEffect(() => { generateMessage(); }, []);

  const generateMessage = useCallback(async () => {
    setGenerating(true);
    setGenStatus("⏳ Pulling picks from database...");
    try {
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
      const { data: preds, error } = await supabase
        .from("sbo_predictions")
        .select("*, sbo_games(home_team, away_team), sbo_player_props(player_name, prop_type, line, over_odds, under_odds, team)")
        .gte("created_at", `${today}T00:00:00-04:00`)
        // PHASE 3 / ITEM 8 — bounded read (today's picks board); table exceeds the 1k PostgREST default.
        .limit(200)
        .order("final_confidence", { ascending: false });

      if (error) console.error("ChingWorld query error:", error);
      const all = preds || [];
      const th = thresholds;

      const topProps = all.filter(p => p.prediction_type === "player_prop" && (p.final_confidence || 0) >= th.topMin).slice(0, th.maxPerCat);
      const stealsProps = all.filter(p => p.prediction_type === "player_prop" && normPropType(p.sbo_player_props?.prop_type) === "Steals" && (p.final_confidence || 0) >= th.stealsMin).slice(0, th.maxPerCat);
      const blocksProps = all.filter(p => p.prediction_type === "player_prop" && normPropType(p.sbo_player_props?.prop_type) === "Blocks" && (p.final_confidence || 0) >= th.blocksMin).slice(0, th.maxPerCat);
      const excludeTypes = ["Steals", "Blocks"];
      const otherProps = all.filter(p => {
        if (p.prediction_type !== "player_prop") return false;
        const t = normPropType(p.sbo_player_props?.prop_type);
        return !excludeTypes.includes(t) && (p.final_confidence || 0) >= th.otherMin && (p.final_confidence || 0) < th.topMin;
      }).slice(0, th.maxPerCat);
      const gamePicks = all.filter(p => p.prediction_type === "moneyline" && (p.final_confidence || 0) >= th.gamesMin).slice(0, 5);

      const sections: { header: string; body: string }[] = [];
      if (topProps.length > 0) { let body = ""; topProps.forEach(p => { body += formatPropLine(p.sbo_player_props, p); }); sections.push({ header: `🔥 TOP PROPS (${th.topMin}%+ CONFIDENCE)`, body }); }
      if (stealsProps.length > 0) { let body = ""; stealsProps.forEach(p => { body += formatPropLine(p.sbo_player_props, p); }); sections.push({ header: `🤿 STEALS PROPS (Top ${stealsProps.length})`, body }); }
      if (blocksProps.length > 0) { let body = ""; blocksProps.forEach(p => { body += formatPropLine(p.sbo_player_props, p); }); sections.push({ header: `🛡️ BLOCKS PROPS (Top ${blocksProps.length})`, body }); }
      if (otherProps.length > 0) { let body = ""; otherProps.forEach(p => { body += formatPropLine(p.sbo_player_props, p); }); sections.push({ header: `📊 OTHER TOP PROPS (${th.otherMin}%+)`, body }); }
      if (gamePicks.length > 0) {
        let body = "";
        gamePicks.forEach(p => { const g = p.sbo_games; if (!g) return; const team = p.predicted_outcome === "home" ? g.home_team : g.away_team; body += `${g.away_team} @ ${g.home_team}\nPick: ${team} ML | ${p.final_confidence}%\n\n`; });
        sections.push({ header: "🏀 TOP GAME PICKS", body });
      }

      if (sections.length === 0) {
        const dateLabel = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" });
        setMessageSegments([`🏆 CHINGWORLD PICKS 🏆\n📅 ${dateLabel}\n─────────────────────\n\nNo picks available yet for today.\n\nTo generate picks:\n1. Go to Tonight's Games → Load Games → Run AI\n2. Go to Props → Run Props Analysis\n3. Come back here and press Generate\n\n─────────────────────\n💡 Bet responsibly\nGood luck! 🎯`]);
        setPreviewIndex(0);
        setGenStatus("⚠️ No picks found — run analysis first");
        return;
      }

      const segs = buildSegments(sections);
      setMessageSegments(segs);
      setPreviewIndex(0);
      const totalPicks = topProps.length + stealsProps.length + blocksProps.length + otherProps.length + gamePicks.length;
      setGenStatus(`✅ Generated — ${totalPicks} picks | ${segs.length} message${segs.length > 1 ? "s" : ""} | ${segs.reduce((a, s) => a + s.length, 0)} chars total`);
    } catch (e: any) {
      setGenStatus(`❌ Failed: ${e.message}`);
    } finally {
      setGenerating(false);
    }
  }, [thresholds]);

  // ── Mutations ──
  const addRecipient = useMutation({
    mutationFn: async () => {
      if (!newName.trim() || !newPhone.trim()) throw new Error("Name and phone required");
      const formatted = formatPhone(newPhone);
      if (formatted.length < 11) throw new Error("Invalid phone number");
      const { error } = await (supabase as any).from("sbo_sms_recipients").insert({
        name: newName.trim(), phone_number: formatted, group_tag: newGroup, notes: newNotes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Recipient added"); setNewName(""); setNewPhone(""); setNewNotes(""); queryClient.invalidateQueries({ queryKey: ["sbo-sms-recipients"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteRecipient = useMutation({
    mutationFn: async (id: string) => { await (supabase as any).from("sbo_sms_recipients").delete().eq("id", id); },
    onSuccess: () => { toast.success("Removed"); queryClient.invalidateQueries({ queryKey: ["sbo-sms-recipients"] }); },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      await (supabase as any).from("sbo_sms_recipients").update({ active: !active }).eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sbo-sms-recipients"] }),
  });

  const toggleAutoSend = useMutation({
    mutationFn: async ({ id, autoSend }: { id: string; autoSend: boolean }) => {
      await (supabase as any).from("sbo_sms_recipients").update({ auto_send: !autoSend }).eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sbo-sms-recipients"] }),
  });

  // ── Run Automation Now ──
  const runAutomationNow = async () => {
    setRunningAutomation(true);
    setAutomationProgress("🚀 Starting full pipeline...");
    try {
      const { data, error } = await supabase.functions.invoke("sbo-daily-automation", { body: {} });
      if (error) throw error;
      const safeSteps = Array.isArray(data?.steps) ? data.steps : [];
      const safeErrors = Array.isArray(data?.errors) ? data.errors : [];
      const stepsDone = safeSteps.filter((s: any) => s.status === "success").length;
      const stepsTotal = safeSteps.length;
      const errs = safeErrors.length;
      setAutomationProgress(`✅ Complete — ${stepsDone}/${stepsTotal} steps succeeded${errs > 0 ? `, ${errs} error(s)` : ""}`);
      toast.success(`Automation complete: ${stepsDone}/${stepsTotal} steps`);
      queryClient.invalidateQueries({ queryKey: ["sbo-automation-log"] });
      queryClient.invalidateQueries({ queryKey: ["sbo-sms-sends-log"] });
      queryClient.invalidateQueries({ queryKey: ["sbo-sms-recipients"] });
    } catch (e: any) {
      setAutomationProgress(`❌ Failed: ${e.message}`);
      toast.error("Automation failed: " + e.message);
    } finally {
      setRunningAutomation(false);
    }
  };

  // ── Send (multi-segment) ──
  const sendSMS = async (targetGroup: "all" | "vip" | "test") => {
    const targets = recipients.filter((r: any) => {
      if (!r.active) return false;
      if (targetGroup === "all") return true;
      return r.group_tag === targetGroup;
    });
    if (targets.length === 0) { toast.error(`No active ${targetGroup} recipients`); return; }
    if (!confirm(`Send ${messageSegments.length} message${messageSegments.length > 1 ? "s" : ""} to ${targets.length} recipient(s)?`)) return;

    setSendingTo(targetGroup);
    let totalSent = 0, totalFailed = 0;
    try {
      for (let ri = 0; ri < targets.length; ri++) {
        const r = targets[ri] as any;
        for (let si = 0; si < messageSegments.length; si++) {
          setSendProgress(`Sending msg ${si + 1}/${messageSegments.length} to ${r.name} (${ri + 1}/${targets.length})`);
          try {
            const { error } = await supabase.functions.invoke("sbo-send-picks-sms", {
              body: { message: messageSegments[si], recipients: [r.phone_number], send_type: "manual" },
            });
            if (error) throw error;
            totalSent++;
          } catch { totalFailed++; }
          if (si < messageSegments.length - 1) await new Promise(r => setTimeout(r, 1000));
        }
        if (ri < targets.length - 1) await new Promise(r => setTimeout(r, 500));
      }
      toast.success(`✅ ${totalSent} segments sent${totalFailed > 0 ? `, ${totalFailed} failed` : ""}`);
      queryClient.invalidateQueries({ queryKey: ["sbo-sms-sends-log"] });
      queryClient.invalidateQueries({ queryKey: ["sbo-sms-recipients"] });
    } catch (e: any) { toast.error("Send failed: " + e.message); } finally { setSendingTo(null); setSendProgress(""); }
  };

  const charCount = currentMessage.length;
  const smsSegs = Math.ceil(charCount / 160) || 1;
  const activeAll = recipients.filter((r: any) => r.active).length;
  const activeVIP = recipients.filter((r: any) => r.active && r.group_tag === "vip").length;
  const activeTest = recipients.filter((r: any) => r.active && r.group_tag === "test").length;
  const autoSendCount = recipients.filter((r: any) => r.active && r.auto_send).length;

  const lastRun = automationLogs[0] as any;
  const rawSteps = lastRun?.steps;
  const lastRunSteps = Array.isArray(rawSteps) ? rawSteps : (typeof rawSteps === 'string' ? (() => { try { const p = JSON.parse(rawSteps); return Array.isArray(p) ? p : []; } catch { return []; } })() : []);

  const ThresholdSelect = ({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) => (
    <div className="flex items-center gap-2">
      <Label className="text-xs whitespace-nowrap w-32">{label}</Label>
      <select value={value} onChange={e => onChange(Number(e.target.value))} className="h-7 text-xs rounded-md border border-input bg-background px-2">
        {CONF_OPTIONS.map(v => <option key={v} value={v}>{v}%</option>)}
      </select>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">📱 ChingWorld Picks — SMS Sender</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Send tonight's top picks. Smart-trimmed to fit clean SMS segments.</p>
        </CardContent>
      </Card>

      {/* ⚙️ Automation Status */}
      <Card className="border-accent/30">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><Settings className="h-4 w-4" /> ⚙️ Daily Automation</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">📬 {autoSendCount} auto-send recipients</Badge>
              <Badge variant="default" className="text-[10px] bg-emerald-600">✅ Active — 10:00 AM EST daily</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Last Run Summary */}
          {lastRun ? (
            <div className="bg-muted/30 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">Last Run: {formatET(lastRun.run_at || lastRun.created_at)}</span>
                <Badge variant={lastRun.status === "success" ? "default" : lastRun.status === "partial" ? "secondary" : "destructive"} className="text-[10px]">
                  {lastRun.status === "success" ? "✅" : lastRun.status === "partial" ? "⚠️" : "❌"} {lastRun.status}
                </Badge>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {lastRunSteps.map((step: any, i: number) => (
                  <div key={i} className="text-[10px] flex items-center gap-1">
                    {step.status === "success" ? <CheckCircle className="h-3 w-3 text-emerald-500" /> : <XCircle className="h-3 w-3 text-destructive" />}
                    <span className="truncate">{step.name?.replace(/_/g, " ")}</span>
                  </div>
                ))}
              </div>
              {lastRunSteps.length > 0 && (
                <div className="flex gap-3 text-[10px] text-muted-foreground flex-wrap">
                  {lastRunSteps.map((step: any, i: number) => {
                    const r = step.result || {};
                    const val = Object.entries(r).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`).join(", ");
                    return val ? <span key={i}>{step.name?.split("_")[0]}: {val}</span> : null;
                  })}
                </div>
              )}
              {(lastRun.errors as any[])?.length > 0 && (
                <div className="text-[10px] text-destructive">
                  <AlertTriangle className="h-3 w-3 inline mr-1" />
                  {(lastRun.errors as any[]).slice(0, 2).join(" | ")}
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No automation runs yet</p>
          )}

          <div className="flex gap-2">
            <Button size="sm" onClick={runAutomationNow} disabled={runningAutomation} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {runningAutomation ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Running...</> : <><Play className="h-3 w-3 mr-1" /> ▶ Run Now</>}
            </Button>
            {automationProgress && <span className="text-xs text-muted-foreground self-center">{automationProgress}</span>}
          </div>
        </CardContent>
      </Card>

      {/* Automation Log History */}
      {automationLogs.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4" /> 📋 Automation Log</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-40">
              <div className="space-y-1">
                {automationLogs.map((log: any) => {
                  const steps = Array.isArray(log.steps) ? log.steps : [];
                  const successSteps = steps.filter((s: any) => s.status === "success").length;
                  const totalDuration = steps.reduce((a: number, s: any) => a + (s.duration_ms || 0), 0);
                  return (
                    <div key={log.id} className="flex items-center gap-3 text-[10px] p-2 rounded bg-muted/20 border border-border">
                      <span className="font-mono text-muted-foreground w-28 shrink-0">{formatET(log.run_at || log.created_at)}</span>
                      <Badge variant={log.status === "success" ? "default" : log.status === "partial" ? "secondary" : "destructive"} className="text-[9px]">
                        {log.status === "success" ? "✅" : log.status === "partial" ? "⚠️" : "❌"} {log.status}
                      </Badge>
                      <span>{successSteps}/{steps.length} steps</span>
                      <span className="text-muted-foreground">{(totalDuration / 1000).toFixed(0)}s</span>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Recipient Manager */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" /> Recipient Manager</CardTitle>
            <span className="text-[10px] text-muted-foreground">📬 Auto-Send: {autoSendCount} of {recipients.length} will receive 10am text</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-3">
              <Label className="text-xs">Name</Label>
              <Input placeholder="David" value={newName} onChange={e => setNewName(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="col-span-3">
              <Label className="text-xs">Phone</Label>
              <Input placeholder="(555) 123-4567" value={newPhone} onChange={e => setNewPhone(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Group</Label>
              <select value={newGroup} onChange={e => setNewGroup(e.target.value)} className="w-full h-8 text-xs rounded-md border border-input bg-background px-2">
                <option value="all">All</option>
                <option value="vip">VIP</option>
                <option value="test">Test</option>
              </select>
            </div>
            <div className="col-span-3">
              <Label className="text-xs">Notes</Label>
              <Input placeholder="Notes..." value={newNotes} onChange={e => setNewNotes(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="col-span-1">
              <Button size="sm" className="h-8 w-full" onClick={() => addRecipient.mutate()} disabled={addRecipient.isPending}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <ScrollArea className="h-48 border rounded-md">
            {recipientsLoading ? (
              <div className="p-4 text-center text-xs text-muted-foreground">Loading...</div>
            ) : recipients.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">No recipients yet</div>
            ) : (
              <div className="p-2 space-y-1">
                {recipients.map((r: any) => (
                  <div key={r.id} className={`flex items-center gap-2 p-1.5 rounded text-xs ${r.active ? "bg-secondary/30" : "bg-muted/20 opacity-60"}`}>
                    <button onClick={() => toggleActive.mutate({ id: r.id, active: r.active })} className="text-muted-foreground hover:text-primary" title={r.active ? "Active — click to pause" : "Paused — click to activate"}>
                      {r.active ? <ToggleRight className="h-4 w-4 text-emerald-500" /> : <ToggleLeft className="h-4 w-4" />}
                    </button>
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium">{r.name}</span>
                    <Phone className="h-3 w-3 text-muted-foreground" />
                    <span className="font-mono text-muted-foreground">{maskPhone(r.phone_number)}</span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0">
                      {r.group_tag === "vip" ? "⭐ VIP" : r.group_tag === "test" ? "🧪 Test" : "All"}
                    </Badge>
                    {/* Auto-Send Toggle */}
                    <div className="flex items-center gap-1 ml-1" title={r.auto_send ? "Auto-send ON — receives 10am text" : "Manual only"}>
                      <Switch
                        checked={!!r.auto_send}
                        onCheckedChange={() => toggleAutoSend.mutate({ id: r.id, autoSend: !!r.auto_send })}
                        className="h-4 w-7 data-[state=checked]:bg-emerald-600"
                      />
                      <span className="text-[9px] text-muted-foreground">{r.auto_send ? "📬 Auto" : "Manual"}</span>
                    </div>
                    {r.last_sent_at && (
                      <span className="text-[9px] text-muted-foreground ml-1">
                        Last: {new Date(r.last_sent_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    )}
                    {r.total_sends > 0 && <span className="text-[9px] text-muted-foreground">{r.total_sends} sent</span>}
                    <div className="flex-1" />
                    <button
                      onClick={() => {
                        if (confirm(`Remove ${r.name} from ChingWorld list? They will no longer receive any picks.`)) {
                          deleteRecipient.mutate(r.id);
                        }
                      }}
                      className="text-destructive/60 hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Send To Summary */}
      <Card>
        <CardContent className="p-3 flex gap-4 text-xs">
          <span className="font-medium">SEND TO:</span>
          <span>📤 All Active: <strong>{activeAll}</strong></span>
          <span>⭐ VIP: <strong>{activeVIP}</strong></span>
          <span>🧪 Test: <strong>{activeTest}</strong></span>
          <span className="ml-auto">📬 Auto-Send: <strong className="text-emerald-500">{autoSendCount}</strong></span>
        </CardContent>
      </Card>

      {/* Confidence Filters */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><SlidersHorizontal className="h-4 w-4" /> Pick Filters</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setShowFilters(!showFilters)} className="text-xs">{showFilters ? "Hide" : "Show"}</Button>
          </div>
        </CardHeader>
        {showFilters && (
          <CardContent className="space-y-2 pb-4">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              <ThresholdSelect label="Top Props min:" value={thresholds.topMin} onChange={v => setThresholds(t => ({ ...t, topMin: v }))} />
              <ThresholdSelect label="Steals min:" value={thresholds.stealsMin} onChange={v => setThresholds(t => ({ ...t, stealsMin: v }))} />
              <ThresholdSelect label="Blocks min:" value={thresholds.blocksMin} onChange={v => setThresholds(t => ({ ...t, blocksMin: v }))} />
              <ThresholdSelect label="Other Props min:" value={thresholds.otherMin} onChange={v => setThresholds(t => ({ ...t, otherMin: v }))} />
              <ThresholdSelect label="Game Picks min:" value={thresholds.gamesMin} onChange={v => setThresholds(t => ({ ...t, gamesMin: v }))} />
              <div className="flex items-center gap-2">
                <Label className="text-xs whitespace-nowrap w-32">Max per category</Label>
                <select value={thresholds.maxPerCat} onChange={e => setThresholds(t => ({ ...t, maxPerCat: Number(e.target.value) }))} className="h-7 text-xs rounded-md border border-input bg-background px-2">
                  {MAX_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>
            <Button size="sm" variant="secondary" onClick={generateMessage} disabled={generating} className="mt-2">
              <RefreshCw className="h-3 w-3 mr-1" /> Regenerate with new filters
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Message Preview */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">MESSAGE PREVIEW</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" onClick={generateMessage} disabled={generating} className="bg-primary text-primary-foreground">
                {generating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                {generating ? "Pulling picks..." : "🔄 Generate"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsEditing(!isEditing)}>
                {isEditing ? <><Check className="h-3 w-3 mr-1" /> Done</> : <><Edit3 className="h-3 w-3 mr-1" /> Edit</>}
              </Button>
            </div>
          </div>
          {genStatus && <p className="text-xs text-muted-foreground mt-1">{genStatus}</p>}
          {messageSegments.length > 1 && (
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary" className="text-xs">📨 {messageSegments.length} messages will be sent</Badge>
              <div className="flex items-center gap-1 ml-auto">
                <Button variant="ghost" size="icon" className="h-6 w-6" disabled={previewIndex === 0} onClick={() => setPreviewIndex(i => i - 1)}>
                  <ChevronLeft className="h-3 w-3" />
                </Button>
                <span className="text-xs font-medium">Message {previewIndex + 1} of {messageSegments.length}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" disabled={previewIndex >= messageSegments.length - 1} onClick={() => setPreviewIndex(i => i + 1)}>
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {isEditing ? (
            <Textarea value={currentMessage} onChange={e => { const updated = [...messageSegments]; updated[previewIndex] = e.target.value; setMessageSegments(updated); }} className="font-mono text-xs min-h-[300px]" />
          ) : (
            <div className="border rounded-lg p-3 bg-muted/20 max-h-[400px] overflow-y-auto">
              <pre className="text-xs whitespace-pre-wrap font-mono text-foreground">{currentMessage || "No message generated yet"}</pre>
            </div>
          )}
          <div className="flex gap-4 text-[10px] text-muted-foreground">
            <span>Characters: <strong className={charCount > MAX_CHARS ? "text-destructive" : "text-emerald-500"}>{charCount}</strong> / {MAX_CHARS} {charCount <= MAX_CHARS ? "✅" : "⚠️ over limit"}</span>
            <span>SMS segments: <strong>{smsSegs}</strong></span>
          </div>
        </CardContent>
      </Card>

      {/* Send Buttons */}
      <div className="space-y-2">
        {sendProgress && <p className="text-xs text-muted-foreground animate-pulse">{sendProgress}</p>}
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => sendSMS("all")} disabled={!!sendingTo || activeAll === 0}>
            {sendingTo === "all" ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Sending...</> : <><Send className="h-4 w-4 mr-1" /> Send to All ({activeAll})</>}
          </Button>
          <Button variant="secondary" onClick={() => sendSMS("vip")} disabled={!!sendingTo || activeVIP === 0}>
            {sendingTo === "vip" ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Sending...</> : <><Star className="h-4 w-4 mr-1" /> Send to VIP ({activeVIP})</>}
          </Button>
          <Button variant="outline" onClick={() => sendSMS("test")} disabled={!!sendingTo || activeTest === 0}>
            {sendingTo === "test" ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Sending...</> : <><TestTube className="h-4 w-4 mr-1" /> Send Test ({activeTest})</>}
          </Button>
        </div>
      </div>

      {/* Send History */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4" /> Send History</CardTitle>
        </CardHeader>
        <CardContent>
          {sendHistory.length === 0 ? (
            <p className="text-xs text-muted-foreground">No sends yet</p>
          ) : (
            <div className="space-y-1">
              {sendHistory.map((s: any) => (
                <div key={s.id} className="flex items-center gap-3 text-xs p-2 rounded bg-muted/20 border border-border">
                  <span className="font-mono text-muted-foreground">
                    {new Date(s.sent_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <Badge variant={s.status === "sent" ? "default" : s.status === "partial" ? "secondary" : "destructive"} className="text-[9px]">
                    {s.status === "sent" ? "✅" : s.status === "partial" ? "⚠️" : "❌"} {s.status}
                  </Badge>
                  <span>{s.recipient_count} recipients</span>
                  <Badge variant="outline" className="text-[9px]">{s.send_type === "auto" ? "🤖 Auto" : "👤 Manual"}</Badge>
                  <span className="text-muted-foreground truncate max-w-[200px]">{s.message_preview?.substring(0, 80)}...</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
