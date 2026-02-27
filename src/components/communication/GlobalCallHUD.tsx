import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Phone, X, Bot, User, ChevronUp, Activity, Radio } from "lucide-react";
import { useLiveCalls, type LiveCall } from "@/hooks/useLiveCalls";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const stateColors: Record<string, string> = {
  ringing: "bg-blue-500",
  dialing: "bg-yellow-500",
  answered: "bg-green-500",
  ai_active: "bg-purple-500",
  human_connected: "bg-amber-500",
  queued: "bg-muted-foreground",
};

const stateLabels: Record<string, string> = {
  ringing: "Ringing",
  dialing: "Dialing",
  answered: "Answered",
  ai_active: "AI Speaking",
  human_connected: "Human Live",
  queued: "Queued",
};

function MiniCallRow({ call }: { call: LiveCall }) {
  const [elapsed, setElapsed] = useState(0);
  const start = call.answered_at || call.started_at;
  useEffect(() => {
    const calc = () => Math.floor((Date.now() - new Date(start).getTime()) / 1000);
    setElapsed(calc());
    const iv = setInterval(() => setElapsed(calc()), 1000);
    return () => clearInterval(iv);
  }, [start]);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;

  return (
    <div className="flex items-center justify-between px-3 py-2 text-xs">
      <div className="flex items-center gap-2 min-w-0">
        <div className={cn("h-2 w-2 rounded-full shrink-0", stateColors[call.state] || "bg-muted-foreground",
          (call.state === "ringing" || call.state === "ai_active") && "animate-pulse"
        )} />
        <span className="truncate font-medium">{call.entity_name || call.phone_number || "Unknown"}</span>
      </div>
      <div className="flex items-center gap-2 text-muted-foreground shrink-0 ml-2">
        <Badge variant="outline" className="text-[9px] h-4 px-1 border-0 bg-muted/50">
          {stateLabels[call.state] || call.state}
        </Badge>
        {call.agent_type === "ai" ? <Bot className="h-3 w-3 text-purple-500" /> : <User className="h-3 w-3 text-amber-500" />}
        <span className="font-mono tabular-nums">{m}:{s.toString().padStart(2, "0")}</span>
      </div>
    </div>
  );
}

export function GlobalCallHUD() {
  const { activeCalls, stats } = useLiveCalls();
  const [expanded, setExpanded] = useState(false);

  if (stats.total === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        className="fixed bottom-4 right-4 z-[60]"
      >
        {expanded ? (
          <div className="bg-card border border-border rounded-xl shadow-2xl w-[320px] overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50">
              <div className="flex items-center gap-2">
                <Radio className="h-3.5 w-3.5 text-green-500 animate-pulse" />
                <span className="text-xs font-semibold">Live Calls</span>
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{stats.total}</Badge>
              </div>
              <div className="flex items-center gap-1">
                {stats.aiActive > 0 && <Badge variant="outline" className="text-[9px] h-4 px-1 gap-0.5"><Bot className="h-2.5 w-2.5" />{stats.aiActive}</Badge>}
                {stats.humanActive > 0 && <Badge variant="outline" className="text-[9px] h-4 px-1 gap-0.5"><User className="h-2.5 w-2.5" />{stats.humanActive}</Badge>}
                <Button variant="ghost" size="icon" className="h-5 w-5 ml-1" onClick={() => setExpanded(false)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <ScrollArea className="max-h-[240px]">
              <div className="divide-y divide-border">
                {activeCalls.map(call => <MiniCallRow key={call.id} call={call} />)}
              </div>
            </ScrollArea>
          </div>
        ) : (
          <button
            onClick={() => setExpanded(true)}
            className="bg-green-600 hover:bg-green-700 text-white rounded-full px-4 py-2.5 flex items-center gap-2 shadow-lg transition-colors"
          >
            <Phone className="h-4 w-4 animate-pulse" />
            <span className="text-sm font-semibold">☎ {stats.total} Live</span>
            {stats.ringing > 0 && <span className="text-xs opacity-80">({stats.ringing} ringing)</span>}
            <ChevronUp className="h-3 w-3" />
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
