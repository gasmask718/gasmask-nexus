import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
  Phone, PhoneOff, Bot, User, Clock, Eye, Radio,
  Headphones, Activity, Shield, Play, BarChart3,
  Zap, TrendingUp
} from "lucide-react";
import { useLiveCalls, useLiveTranscripts, type LiveCall } from "@/hooks/useLiveCalls";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// State color config
const stateConfig: Record<string, { label: string; dotColor: string; bgColor: string; borderColor: string; pulse: boolean; icon: typeof Phone }> = {
  queued:           { label: "Queued",        dotColor: "bg-muted-foreground", bgColor: "bg-muted/50",                        borderColor: "border-muted",       pulse: false, icon: Clock },
  dialing:          { label: "Dialing",       dotColor: "bg-yellow-500",       bgColor: "bg-yellow-500/10",                   borderColor: "border-yellow-500/30", pulse: true,  icon: Phone },
  ringing:          { label: "Ringing",       dotColor: "bg-blue-500",         bgColor: "bg-blue-500/10",                     borderColor: "border-blue-500/40", pulse: true,  icon: Phone },
  answered:         { label: "Answered",      dotColor: "bg-green-500",        bgColor: "bg-green-500/10",                    borderColor: "border-green-500/40", pulse: false, icon: Activity },
  ai_active:        { label: "AI Speaking",   dotColor: "bg-purple-500",       bgColor: "bg-purple-500/10",                   borderColor: "border-purple-500/40", pulse: true,  icon: Bot },
  human_connected:  { label: "Human Live",    dotColor: "bg-amber-500",        bgColor: "bg-amber-500/10",                    borderColor: "border-amber-500/40", pulse: true,  icon: User },
  completed:        { label: "Completed",     dotColor: "bg-muted-foreground", bgColor: "bg-muted/30",                        borderColor: "border-muted",       pulse: false, icon: Clock },
  failed:           { label: "Failed",        dotColor: "bg-destructive",      bgColor: "bg-destructive/10",                  borderColor: "border-destructive/30", pulse: false, icon: PhoneOff },
};

function useElapsedTimer(startTime: string) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const calc = () => Math.floor((Date.now() - new Date(startTime).getTime()) / 1000);
    setElapsed(calc());
    const iv = setInterval(() => setElapsed(calc()), 1000);
    return () => clearInterval(iv);
  }, [startTime]);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function LiveCallCardItem({ call, onSelect, isSelected }: { call: LiveCall; onSelect: (c: LiveCall) => void; isSelected: boolean }) {
  const config = stateConfig[call.state] || stateConfig.queued;
  const time = useElapsedTimer(call.answered_at || call.started_at);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, x: -20 }}
      className={cn(
        "p-3 rounded-lg border-l-[3px] cursor-pointer transition-all",
        config.bgColor, config.borderColor,
        isSelected ? "ring-1 ring-primary shadow-md" : "hover:shadow-sm"
      )}
      onClick={() => onSelect(call)}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <div className={cn("h-2.5 w-2.5 rounded-full", config.dotColor, config.pulse && "animate-pulse")} />
          <Badge variant="outline" className="text-[10px] border-0 bg-transparent font-semibold uppercase tracking-wider">
            {config.label}
          </Badge>
        </div>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">{time}</span>
      </div>

      <p className="text-sm font-semibold truncate">{call.entity_name || call.phone_number || "Unknown"}</p>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
          {call.agent_type === "ai" ? <Bot className="h-3 w-3 text-purple-500" /> : <User className="h-3 w-3 text-amber-500" />}
          {call.agent_type === "ai" ? "AI" : "Human"}
        </span>
        {call.voice_provider && (
          <span className="text-[10px] text-muted-foreground">• {call.voice_provider}</span>
        )}
        {call.recording_url && (
          <Play className="h-3 w-3 text-green-500 ml-auto" />
        )}
      </div>
    </motion.div>
  );
}

function TranscriptView({ callSid }: { callSid: string | null }) {
  const transcripts = useLiveTranscripts(callSid);
  if (!callSid) return <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Select a call to view transcript</div>;
  if (transcripts.length === 0) return <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-2"><Radio className="h-5 w-5 animate-pulse" />Waiting for transcript...</div>;

  return (
    <ScrollArea className="h-full">
      <div className="space-y-2 p-3">
        {transcripts.map((t) => (
          <div key={t.id} className={cn("flex gap-2 text-sm", t.speaker === "caller" ? "justify-end" : "justify-start")}>
            <div className={cn(
              "rounded-lg px-3 py-1.5 max-w-[80%]",
              t.speaker === "ai" ? "bg-purple-500/10 text-purple-700 dark:text-purple-300" :
              t.speaker === "caller" ? "bg-green-500/10 text-green-700 dark:text-green-300" :
              t.speaker === "human" ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" :
              "bg-muted text-muted-foreground"
            )}>
              <span className="text-[10px] font-semibold uppercase block mb-0.5">{t.speaker}</span>
              {t.text}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

function CallTimeline({ call }: { call: LiveCall }) {
  const events: { time: string; label: string; icon: typeof Phone }[] = [];
  events.push({ time: call.started_at, label: "Call Initiated", icon: Phone });
  if (call.state !== "queued") events.push({ time: call.started_at, label: "Dialing", icon: Zap });
  if (call.answered_at) events.push({ time: call.answered_at, label: "Answered", icon: Activity });
  if (call.state === "ai_active") events.push({ time: call.answered_at || call.started_at, label: "AI Greeting Started", icon: Bot });
  if (call.state === "human_connected") events.push({ time: call.answered_at || call.started_at, label: "Human Rep Joined", icon: User });
  if (call.ended_at) events.push({ time: call.ended_at, label: call.state === "failed" ? "Call Failed" : "Call Completed", icon: PhoneOff });

  return (
    <div className="space-y-3">
      {events.map((ev, i) => {
        const Icon = ev.icon;
        const t = new Date(ev.time);
        return (
          <div key={i} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                <Icon className="h-3 w-3 text-primary" />
              </div>
              {i < events.length - 1 && <div className="w-px h-4 bg-border" />}
            </div>
            <div>
              <p className="text-sm font-medium">{ev.label}</p>
              <p className="text-[10px] text-muted-foreground font-mono">
                {t.toLocaleTimeString()}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CallDetailDrawer({ call, open, onClose }: { call: LiveCall | null; open: boolean; onClose: () => void }) {
  if (!call) return null;
  const config = stateConfig[call.state] || stateConfig.queued;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-[400px] sm:w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <div className={cn("h-3 w-3 rounded-full", config.dotColor, config.pulse && "animate-pulse")} />
            {call.entity_name || call.phone_number || "Unknown"}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Status */}
          <div className="flex items-center gap-2">
            <Badge className={cn("border-0", config.bgColor)}>{config.label}</Badge>
            <Badge variant="outline" className="text-[10px]">
              {call.agent_type === "ai" ? "🤖 AI" : "👤 Human"}
            </Badge>
            {call.voice_provider && <Badge variant="outline" className="text-[10px]">{call.voice_provider}</Badge>}
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-muted/50 rounded p-2">
              <span className="text-muted-foreground">Phone</span>
              <p className="font-medium">{call.phone_number || "—"}</p>
            </div>
            <div className="bg-muted/50 rounded p-2">
              <span className="text-muted-foreground">Source</span>
              <p className="font-medium">{call.source_reason || "—"}</p>
            </div>
            <div className="bg-muted/50 rounded p-2">
              <span className="text-muted-foreground">Duration</span>
              <p className="font-medium">{call.duration_seconds ? `${call.duration_seconds}s` : "—"}</p>
            </div>
            <div className="bg-muted/50 rounded p-2">
              <span className="text-muted-foreground">Call SID</span>
              <p className="font-mono text-[10px] truncate">{call.call_sid || "—"}</p>
            </div>
          </div>

          {/* Timeline */}
          <div>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Call Timeline
            </h4>
            <CallTimeline call={call} />
          </div>

          {/* Live Transcript */}
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
              <Radio className="h-3.5 w-3.5 text-purple-500" /> Live Transcript
            </h4>
            <div className="h-[200px] border rounded-lg bg-muted/20">
              <TranscriptView callSid={call.call_sid} />
            </div>
          </div>

          {/* Recording */}
          {call.recording_url && (
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <Play className="h-3.5 w-3.5 text-green-500" /> Recording
              </h4>
              <audio controls className="w-full" src={call.recording_url} />
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function RadarHUD({ stats, activeCalls, recentCalls }: {
  stats: { total: number; ringing: number; answered: number; aiActive: number; humanActive: number };
  activeCalls: LiveCall[];
  recentCalls: LiveCall[];
}) {
  const totalCompleted = recentCalls.length;
  const answered = recentCalls.filter(c => c.state === "completed" && c.answered_at).length;
  const answerRate = totalCompleted > 0 ? Math.round((answered / totalCompleted) * 100) : 0;
  const avgTalk = recentCalls.filter(c => c.duration_seconds).reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / (answered || 1);
  const aiPct = stats.total > 0 ? Math.round((stats.aiActive / stats.total) * 100) : 0;

  const metrics = [
    { label: "Active Calls", value: stats.total, icon: Phone, color: "text-green-500", glow: stats.total > 0 },
    { label: "Ringing", value: stats.ringing, icon: Zap, color: "text-blue-500", glow: stats.ringing > 0 },
    { label: "Answer Rate", value: `${answerRate}%`, icon: TrendingUp, color: "text-emerald-500", glow: false },
    { label: "Avg Talk", value: `${Math.round(avgTalk)}s`, icon: Clock, color: "text-amber-500", glow: false },
    { label: "AI Calls", value: `${aiPct}%`, icon: Bot, color: "text-purple-500", glow: false },
    { label: "Human Calls", value: `${100 - aiPct}%`, icon: User, color: "text-amber-500", glow: false },
  ];

  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
      {metrics.map((m) => {
        const Icon = m.icon;
        return (
          <div key={m.label} className={cn(
            "rounded-lg border bg-card p-3 text-center transition-shadow",
            m.glow && "shadow-md shadow-green-500/10"
          )}>
            <Icon className={cn("h-4 w-4 mx-auto mb-1", m.color)} />
            <p className="text-lg font-bold tabular-nums">{m.value}</p>
            <p className="text-[10px] text-muted-foreground">{m.label}</p>
          </div>
        );
      })}
    </div>
  );
}

export function LiveCallObserver() {
  const { activeCalls, recentCalls, isLoading, stats } = useLiveCalls();
  const [selectedCall, setSelectedCall] = useState<LiveCall | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tab, setTab] = useState("active");
  const [supervisorMode, setSupervisorMode] = useState(false);

  const displayCalls = tab === "active" ? activeCalls : recentCalls;

  const handleSelect = (call: LiveCall) => {
    setSelectedCall(call);
    setDrawerOpen(true);
  };

  // Pipeline health check: if queue has items but live_calls is empty, show warning
  const [queueCount, setQueueCount] = useState(0);
  useEffect(() => {
    if (stats.total === 0) {
      import("@/integrations/supabase/client").then(({ supabase }) => {
        supabase
          .from("outbound_call_queue")
          .select("id", { count: "exact", head: true })
          .in("status", ["queued", "dialing", "ringing", "answered"])
          .then(({ count }) => setQueueCount(count || 0));
      });
    }
  }, [stats.total]);

  return (
    <div className="space-y-4">
      {/* Pipeline health failsafe */}
      {stats.total === 0 && queueCount > 0 && (
        <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-3 text-sm">
          <Activity className="h-4 w-4 text-yellow-600 shrink-0" />
          <span className="text-yellow-700 dark:text-yellow-300">
            <strong>{queueCount} calls in queue</strong> but no live call entries detected. New calls will auto-populate — existing queue items have been backfilled.
          </span>
        </div>
      )}

      {/* Radar HUD */}
      <RadarHUD stats={stats} activeCalls={activeCalls} recentCalls={recentCalls} />

      {/* Supervisor toggle + live counter */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {stats.total > 0 && (
            <Badge className="bg-green-500/15 text-green-600 border-green-500/30 gap-1.5 text-sm font-semibold">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              🟢 {stats.total} LIVE CONVERSATION{stats.total !== 1 ? "S" : ""}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Shield className={cn("h-4 w-4", supervisorMode ? "text-primary" : "text-muted-foreground")} />
          <span className="text-xs text-muted-foreground">Supervisor Mode</span>
          <Switch checked={supervisorMode} onCheckedChange={setSupervisorMode} />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-8">
          <TabsTrigger value="active" className="text-xs gap-1">
            <Activity className="h-3 w-3" /> Live ({activeCalls.length})
          </TabsTrigger>
          <TabsTrigger value="recent" className="text-xs gap-1">
            <Clock className="h-3 w-3" /> Recent ({recentCalls.length})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Call Grid */}
      <AnimatePresence mode="popLayout">
        {displayCalls.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-3 border rounded-lg bg-muted/20">
            <Eye className="h-8 w-8" />
            <p className="text-sm font-medium">{tab === "active" ? "No active calls" : "No recent calls"}</p>
            <p className="text-xs text-center max-w-[280px]">
              When calls begin, they'll appear here with real-time state tracking
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {displayCalls.map((call) => (
              <LiveCallCardItem
                key={call.id}
                call={call}
                onSelect={handleSelect}
                isSelected={selectedCall?.id === call.id}
              />
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Detail Drawer */}
      <CallDetailDrawer call={selectedCall} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}
