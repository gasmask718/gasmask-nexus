import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Phone, X, Bot, User, ChevronUp } from "lucide-react";
import { useLiveCalls, type LiveCall } from "@/hooks/useLiveCalls";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const stateColors: Record<string, string> = {
  ringing: "bg-yellow-500",
  dialing: "bg-yellow-500",
  answered: "bg-green-500",
  ai_active: "bg-purple-500",
  human_connected: "bg-blue-500",
  queued: "bg-muted-foreground",
};

function MiniCallRow({ call }: { call: LiveCall }) {
  const elapsed = Math.floor((Date.now() - new Date(call.started_at).getTime()) / 1000);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;

  return (
    <div className="flex items-center justify-between px-3 py-1.5 text-xs">
      <div className="flex items-center gap-2">
        <div className={cn("h-2 w-2 rounded-full", stateColors[call.state] || "bg-muted-foreground", 
          (call.state === "ringing" || call.state === "ai_active") && "animate-pulse"
        )} />
        <span className="truncate max-w-[140px] font-medium">
          {call.entity_name || call.phone_number || "Unknown"}
        </span>
      </div>
      <div className="flex items-center gap-2 text-muted-foreground">
        {call.agent_type === "ai" ? <Bot className="h-3 w-3" /> : <User className="h-3 w-3" />}
        <span className="font-mono">{m}:{s.toString().padStart(2, "0")}</span>
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
          <div className="bg-card border border-border rounded-xl shadow-2xl w-[300px] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50">
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-green-500" />
                <span className="text-xs font-semibold">Active Calls</span>
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{stats.total}</Badge>
              </div>
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setExpanded(false)}>
                <X className="h-3 w-3" />
              </Button>
            </div>

            {/* Call list */}
            <ScrollArea className="max-h-[200px]">
              <div className="divide-y divide-border">
                {activeCalls.map(call => (
                  <MiniCallRow key={call.id} call={call} />
                ))}
              </div>
            </ScrollArea>
          </div>
        ) : (
          <button
            onClick={() => setExpanded(true)}
            className="bg-green-600 hover:bg-green-700 text-white rounded-full px-4 py-2 flex items-center gap-2 shadow-lg transition-colors"
          >
            <Phone className="h-4 w-4 animate-pulse" />
            <span className="text-sm font-medium">☎ Active: {stats.total}</span>
            <ChevronUp className="h-3 w-3" />
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
