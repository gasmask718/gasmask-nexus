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
import { toast } from "sonner";
import {
  MessageSquare, Plus, Trash2, Send, TestTube, RefreshCw, Loader2,
  Phone, User, Star, Users, ToggleLeft, ToggleRight, Clock, Edit3, Check
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

// ── Message Builder ──
async function buildChingWorldMessage(): Promise<string> {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York",
  });

  // Get today's predictions — note: no "result" column exists, use verdict/was_correct
  const { data: preds, error: predsErr } = await supabase
    .from("sbo_predictions")
    .select("*, sbo_games(home_team, away_team), sbo_player_props(player_name, prop_type, line, over_odds, under_odds, team)")
    .gte("created_at", `${today}T00:00:00-04:00`)
    .order("final_confidence", { ascending: false });

  if (predsErr) {
    console.error("ChingWorld picks query error:", predsErr);
  }

  const all = preds || [];
  console.log(`ChingWorld: Found ${all.length} predictions for ${today}`);
  const lines: string[] = [];

  lines.push("🏆 CHINGWORLD PICKS 🏆");
  lines.push(`📅 ${dateLabel}`);
  lines.push("─────────────────────");

  // Top props 90%+
  const top90 = all.filter(p => p.prediction_type === "player_prop" && (p.final_confidence || 0) >= 90);
  if (top90.length > 0) {
    lines.push("");
    lines.push("🔥 TOP PROPS (90%+ CONFIDENCE)");
    for (const p of top90) {
      const pp = p.sbo_player_props;
      if (!pp) continue;
      const team = pp.team || "";
      const propLabel = normPropType(pp.prop_type);
      const dir = (p.predicted_outcome || "over").toUpperCase();
      const odds = dir === "OVER" ? pp.over_odds : pp.under_odds;
      lines.push(`${pp.player_name}${team ? ` (${team})` : ""}`);
      lines.push(`${propLabel} ${dir} ${pp.line} | ${p.final_confidence}% | ${odds ? (odds > 0 ? "+" : "") + odds : "N/A"}`);
      lines.push("");
    }
  }

  // Steals
  const steals = all.filter(p => p.prediction_type === "player_prop" && normPropType(p.sbo_player_props?.prop_type) === "Steals");
  if (steals.length > 0) {
    lines.push("─────────────────────");
    lines.push("📊 STEALS PROPS");
    for (const p of steals) {
      const pp = p.sbo_player_props;
      if (!pp) continue;
      const dir = (p.predicted_outcome || "over").toUpperCase();
      const odds = dir === "OVER" ? pp.over_odds : pp.under_odds;
      lines.push(`${pp.player_name}${pp.team ? ` (${pp.team})` : ""}`);
      lines.push(`Steals ${dir} ${pp.line} | ${p.final_confidence}% | ${odds ? (odds > 0 ? "+" : "") + odds : "N/A"}`);
    }
  }

  // Blocks
  const blocks = all.filter(p => p.prediction_type === "player_prop" && normPropType(p.sbo_player_props?.prop_type) === "Blocks");
  if (blocks.length > 0) {
    lines.push("");
    lines.push("─────────────────────");
    lines.push("🛡️ BLOCKS PROPS");
    for (const p of blocks) {
      const pp = p.sbo_player_props;
      if (!pp) continue;
      const dir = (p.predicted_outcome || "over").toUpperCase();
      const odds = dir === "OVER" ? pp.over_odds : pp.under_odds;
      lines.push(`${pp.player_name}${pp.team ? ` (${pp.team})` : ""}`);
      lines.push(`Blocks ${dir} ${pp.line} | ${p.final_confidence}% | ${odds ? (odds > 0 ? "+" : "") + odds : "N/A"}`);
    }
  }

  // Top game picks (ML 75%+)
  const gamePicks = all
    .filter(p => p.prediction_type === "moneyline" && (p.final_confidence || 0) >= 75)
    .slice(0, 5);
  if (gamePicks.length > 0) {
    lines.push("");
    lines.push("─────────────────────");
    lines.push("🏀 TOP GAME PICKS");
    for (const p of gamePicks) {
      const g = p.sbo_games;
      if (!g) continue;
      const team = p.predicted_outcome === "home" ? g.home_team : g.away_team;
      lines.push(`${g.away_team} @ ${g.home_team}`);
      lines.push(`Pick: ${team} ML | ${p.final_confidence}%`);
      lines.push("");
    }
  }

  // If nothing found at all
  if (top90.length === 0 && steals.length === 0 && blocks.length === 0 && gamePicks.length === 0) {
    const otherProps = all.filter(p => p.prediction_type === "player_prop" && (p.final_confidence || 0) >= 70);
    if (otherProps.length > 0) {
      lines.push("");
      lines.push("─────────────────────");
      lines.push("📊 TOP PROPS (70%+ CONFIDENCE)");
      for (const p of otherProps.slice(0, 10)) {
        const pp = p.sbo_player_props;
        if (!pp) continue;
        const dir = (p.predicted_outcome || "over").toUpperCase();
        const odds = dir === "OVER" ? pp.over_odds : pp.under_odds;
        const propLabel = normPropType(pp.prop_type);
        lines.push(`${pp.player_name}${pp.team ? ` (${pp.team})` : ""}`);
        lines.push(`${propLabel} ${dir} ${pp.line} | ${p.final_confidence}% | ${odds ? (odds > 0 ? "+" : "") + odds : "N/A"}`);
        lines.push("");
      }
    } else {
      lines.push("");
      lines.push("No picks available yet for today.");
      lines.push("");
      lines.push("To generate picks:");
      lines.push("1. Go to Tonight's Games → Load Games → Run AI");
      lines.push("2. Go to Props → Run Props Analysis");
      lines.push("3. Come back here and press Generate");
      lines.push("");
    }
  }

  lines.push("─────────────────────");
  lines.push("💡 Bet responsibly");
  lines.push("Good luck! 🎯");

  return lines.join("\n");
}

// ── Component ──
export function ChingWorldPicksSMS() {
  const queryClient = useQueryClient();

  // Recipient form state
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newGroup, setNewGroup] = useState("all");
  const [newNotes, setNewNotes] = useState("");

  // Message state
  const [message, setMessage] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);

  // ── Queries ──
  const { data: recipients = [], isLoading: recipientsLoading } = useQuery({
    queryKey: ["sbo-sms-recipients"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sbo_sms_recipients")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: sendHistory = [] } = useQuery({
    queryKey: ["sbo-sms-sends-log"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("sbo_sms_sends_log")
        .select("*")
        .order("sent_at", { ascending: false })
        .limit(20);
      return data || [];
    },
  });

  const [genStatus, setGenStatus] = useState("");

  // Generate message on mount
  useEffect(() => {
    generateMessage();
  }, []);

  const generateMessage = useCallback(async () => {
    setGenerating(true);
    setGenStatus("⏳ Pulling picks from database...");
    try {
      const msg = await buildChingWorldMessage();
      setMessage(msg);
      // Count picks in message
      const propCount = (msg.match(/\|.*%.*\|/g) || []).length;
      setGenStatus(`✅ Generated — ${propCount} picks loaded`);
    } catch (e: any) {
      setGenStatus(`❌ Failed: ${e.message}`);
      toast.error("Failed to generate message: " + e.message);
    } finally {
      setGenerating(false);
    }
  }, []);

  // ── Mutations ──
  const addRecipient = useMutation({
    mutationFn: async () => {
      if (!newName.trim() || !newPhone.trim()) throw new Error("Name and phone required");
      const formatted = formatPhone(newPhone);
      if (formatted.length < 11) throw new Error("Invalid phone number");
      const { error } = await (supabase as any).from("sbo_sms_recipients").insert({
        name: newName.trim(),
        phone_number: formatted,
        group_tag: newGroup,
        notes: newNotes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Recipient added");
      setNewName(""); setNewPhone(""); setNewNotes("");
      queryClient.invalidateQueries({ queryKey: ["sbo-sms-recipients"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteRecipient = useMutation({
    mutationFn: async (id: string) => {
      await (supabase as any).from("sbo_sms_recipients").delete().eq("id", id);
    },
    onSuccess: () => {
      toast.success("Recipient removed");
      queryClient.invalidateQueries({ queryKey: ["sbo-sms-recipients"] });
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      await (supabase as any).from("sbo_sms_recipients").update({ active: !active }).eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sbo-sms-recipients"] }),
  });

  const sendSMS = async (targetGroup: "all" | "vip" | "test") => {
    const targets = recipients.filter((r: any) => {
      if (!r.active) return false;
      if (targetGroup === "all") return true;
      return r.group_tag === targetGroup;
    });

    if (targets.length === 0) {
      toast.error(`No active ${targetGroup} recipients`);
      return;
    }

    if (!confirm(`Send to ${targets.length} ${targetGroup} recipient(s)?`)) return;

    setSendingTo(targetGroup);
    try {
      const { data, error } = await supabase.functions.invoke("sbo-send-picks-sms", {
        body: {
          message,
          recipients: targets.map((r: any) => r.phone_number),
          send_type: "manual",
        },
      });
      if (error) throw error;
      toast.success(`✅ Sent to ${data.sent} recipients${data.failed > 0 ? `, ${data.failed} failed` : ""}`);
      queryClient.invalidateQueries({ queryKey: ["sbo-sms-sends-log"] });
      queryClient.invalidateQueries({ queryKey: ["sbo-sms-recipients"] });
    } catch (e: any) {
      toast.error("Send failed: " + e.message);
    } finally {
      setSendingTo(null);
    }
  };

  const charCount = message.length;
  const segments = Math.ceil(charCount / 160) || 1;
  const activeAll = recipients.filter((r: any) => r.active).length;
  const activeVIP = recipients.filter((r: any) => r.active && r.group_tag === "vip").length;
  const activeTest = recipients.filter((r: any) => r.active && r.group_tag === "test").length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">📱 ChingWorld Picks — SMS Sender</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Send tonight's top picks to your list. Add numbers, preview the message, hit send.
          </p>
        </CardContent>
      </Card>

      {/* Recipient Manager */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4" /> Recipient Manager
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Add form */}
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
              <select
                value={newGroup}
                onChange={e => setNewGroup(e.target.value)}
                className="w-full h-8 text-xs rounded-md border border-input bg-background px-2"
              >
                <option value="all">All</option>
                <option value="vip">VIP</option>
                <option value="test">Test</option>
              </select>
            </div>
            <div className="col-span-3">
              <Label className="text-xs">Notes (optional)</Label>
              <Input placeholder="Notes..." value={newNotes} onChange={e => setNewNotes(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="col-span-1">
              <Button size="sm" className="h-8 w-full" onClick={() => addRecipient.mutate()} disabled={addRecipient.isPending}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Recipient list */}
          <ScrollArea className="h-40 border rounded-md">
            {recipientsLoading ? (
              <div className="p-4 text-center text-xs text-muted-foreground">Loading...</div>
            ) : recipients.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">No recipients yet — add a number above</div>
            ) : (
              <div className="p-2 space-y-1">
                {recipients.map((r: any) => (
                  <div key={r.id} className={`flex items-center gap-2 p-1.5 rounded text-xs ${r.active ? "bg-secondary/30" : "bg-muted/20 opacity-60"}`}>
                    <button onClick={() => toggleActive.mutate({ id: r.id, active: r.active })} className="text-muted-foreground hover:text-primary">
                      {r.active ? <ToggleRight className="h-4 w-4 text-emerald-500" /> : <ToggleLeft className="h-4 w-4" />}
                    </button>
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium">{r.name}</span>
                    <Phone className="h-3 w-3 text-muted-foreground" />
                    <span className="font-mono text-muted-foreground">{maskPhone(r.phone_number)}</span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0">
                      {r.group_tag === "vip" ? "⭐ VIP" : r.group_tag === "test" ? "🧪 Test" : "All"}
                    </Badge>
                    {r.total_sends > 0 && (
                      <span className="text-[9px] text-muted-foreground">{r.total_sends} sent</span>
                    )}
                    <div className="flex-1" />
                    <button onClick={() => deleteRecipient.mutate(r.id)} className="text-destructive/60 hover:text-destructive">
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
          <span>⭐ VIP Only: <strong>{activeVIP}</strong></span>
          <span>🧪 Test: <strong>{activeTest}</strong></span>
        </CardContent>
      </Card>

      {/* Message Preview */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">MESSAGE PREVIEW</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" onClick={generateMessage} disabled={generating} className="bg-primary text-primary-foreground">
                {generating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                {generating ? "Pulling picks..." : "🔄 Generate Today's Picks"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsEditing(!isEditing)}>
                {isEditing ? <><Check className="h-3 w-3 mr-1" /> Done</> : <><Edit3 className="h-3 w-3 mr-1" /> Edit</>}
              </Button>
            </div>
          </div>
          {genStatus && (
            <p className="text-xs text-muted-foreground mt-1">{genStatus}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {isEditing ? (
            <Textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              className="font-mono text-xs min-h-[300px]"
            />
          ) : (
            <div className="border rounded-lg p-3 bg-muted/20 max-h-[400px] overflow-y-auto">
              <pre className="text-xs whitespace-pre-wrap font-mono text-foreground">{message || "No message generated yet"}</pre>
            </div>
          )}
          <div className="flex gap-4 text-[10px] text-muted-foreground">
            <span>Characters: <strong className={charCount > 1600 ? "text-destructive" : ""}>{charCount}</strong> / 1600</span>
            <span>SMS segments: <strong>{segments}</strong> ({segments} message{segments > 1 ? "s" : ""})</span>
          </div>
        </CardContent>
      </Card>

      {/* Send Buttons */}
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
                  <span className="text-muted-foreground truncate max-w-[200px]">
                    {s.message_preview?.substring(0, 80)}...
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
