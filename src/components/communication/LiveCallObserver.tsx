import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Phone, PhoneOff, Bot, User, Clock, Eye, Radio,
  Headphones, Activity, AlertTriangle, CheckCircle, XCircle
} from "lucide-react";
import { useLiveCalls, useLiveTranscripts, type LiveCall } from "@/hooks/useLiveCalls";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// State color config
const stateConfig: Record<string, { label: string; color: string; bgColor: string; pulse: boolean }> = {
  queued: { label: "Queued", color: "text-muted-foreground", bgColor: "bg-muted", pulse: false },
  dialing: { label: "Dialing", color: "text-yellow-600", bgColor: "bg-yellow-100 dark:bg-yellow-950", pulse: true },
  ringing: { label: "Ringing", color: "text-yellow-600", bgColor: "bg-yellow-100 dark:bg-yellow-950", pulse: true },
  answered: { label: "Answered", color: "text-green-600", bgColor: "bg-green-100 dark:bg-green-950", pulse: false },
  ai_active: { label: "AI Speaking", color: "text-purple-600", bgColor: "bg-purple-100 dark:bg-purple-950", pulse: true },
  human_connected: { label: "Human Live", color: "text-blue-600", bgColor: "bg-blue-100 dark:bg-blue-950", pulse: true },
  completed: { label: "Completed", color: "text-muted-foreground", bgColor: "bg-muted", pulse: false },
  failed: { label: "Failed", color: "text-destructive", bgColor: "bg-destructive/10", pulse: false },
};

function LiveCallCardItem({ call, onSelect, isSelected }: { call: LiveCall; onSelect: (c: LiveCall) => void; isSelected: boolean }) {
  const config = stateConfig[call.state] || stateConfig.queued;
  const elapsed = call.answered_at
    ? Math.floor((Date.now() - new Date(call.answered_at).getTime()) / 1000)
    : Math.floor((Date.now() - new Date(call.started_at).getTime()) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={cn(
        "p-3 rounded-lg border cursor-pointer transition-colors",
        isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
      )}
      onClick={() => onSelect(call)}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={cn("h-2.5 w-2.5 rounded-full", config.pulse && "animate-pulse",
            call.state === "ringing" || call.state === "dialing" ? "bg-yellow-500" :
            call.state === "answered" || call.state === "human_connected" ? "bg-green-500" :
            call.state === "ai_active" ? "bg-purple-500" : "bg-muted-foreground"
          )} />
          <Badge variant="outline" className={cn("text-[10px] border-0", config.bgColor, config.color)}>
            {config.label}
          </Badge>
        </div>
        <span className="font-mono text-xs text-muted-foreground">
          {mins.toString().padStart(2, "0")}:{secs.toString().padStart(2, "0")}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium truncate max-w-[180px]">
            {call.entity_name || call.phone_number || "Unknown"}
          </p>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            {call.agent_type === "ai" ? <Bot className="h-3 w-3" /> : <User className="h-3 w-3" />}
            {call.agent_type === "ai" ? "AI Agent" : "Human Agent"}
            {call.voice_provider && <span className="ml-1 text-[10px]">• {call.voice_provider}</span>}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function TranscriptView({ callSid }: { callSid: string | null }) {
  const transcripts = useLiveTranscripts(callSid);

  if (!callSid) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Select a call to view transcript
      </div>
    );
  }

  if (transcripts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-2">
        <Radio className="h-5 w-5 animate-pulse" />
        Waiting for transcript data...
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-2 p-3">
        {transcripts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "flex gap-2 text-sm",
              t.speaker === "ai" ? "justify-start" : t.speaker === "caller" ? "justify-end" : "justify-start"
            )}
          >
            <div className={cn(
              "rounded-lg px-3 py-1.5 max-w-[80%]",
              t.speaker === "ai" ? "bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-200" :
              t.speaker === "caller" ? "bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-200" :
              t.speaker === "human" ? "bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200" :
              "bg-muted text-muted-foreground"
            )}>
              <span className="text-[10px] font-medium uppercase block mb-0.5">
                {t.speaker}
              </span>
              {t.text}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

function CallDetailPanel({ call }: { call: LiveCall }) {
  const config = stateConfig[call.state] || stateConfig.queued;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">{call.entity_name || call.phone_number || "Unknown"}</h3>
          <p className="text-sm text-muted-foreground">{call.phone_number}</p>
        </div>
        <Badge className={cn("border-0", config.bgColor, config.color)}>{config.label}</Badge>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-muted/50 rounded p-2">
          <span className="text-muted-foreground">Agent Type</span>
          <p className="font-medium capitalize">{call.agent_type}</p>
        </div>
        <div className="bg-muted/50 rounded p-2">
          <span className="text-muted-foreground">Voice Provider</span>
          <p className="font-medium">{call.voice_provider || "Auto"}</p>
        </div>
        <div className="bg-muted/50 rounded p-2">
          <span className="text-muted-foreground">Source</span>
          <p className="font-medium">{call.source_reason || "—"}</p>
        </div>
        <div className="bg-muted/50 rounded p-2">
          <span className="text-muted-foreground">Call SID</span>
          <p className="font-mono text-[10px] truncate">{call.call_sid || "—"}</p>
        </div>
      </div>

      {/* Transcript stream */}
      <div>
        <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
          <Radio className="h-3.5 w-3.5 text-purple-500" />
          Live Transcript
        </h4>
        <div className="h-[250px] border rounded-lg bg-muted/20">
          <TranscriptView callSid={call.call_sid} />
        </div>
      </div>

      {/* Recording */}
      {call.recording_url && (
        <div>
          <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
            <Headphones className="h-3.5 w-3.5" />
            Recording
          </h4>
          <audio controls className="w-full" src={call.recording_url} />
        </div>
      )}
    </div>
  );
}

export function LiveCallObserver() {
  const { activeCalls, recentCalls, isLoading, stats } = useLiveCalls();
  const [selectedCall, setSelectedCall] = useState<LiveCall | null>(null);
  const [tab, setTab] = useState("active");

  const displayCalls = tab === "active" ? activeCalls : recentCalls;

  return (
    <div className="space-y-4">
      {/* Stats banner */}
      <div className="flex items-center gap-3 flex-wrap">
        <Badge variant="outline" className="gap-1.5 text-xs">
          <div className={cn("h-2 w-2 rounded-full", stats.total > 0 ? "bg-green-500 animate-pulse" : "bg-muted-foreground")} />
          Active: {stats.total}
        </Badge>
        {stats.ringing > 0 && (
          <Badge variant="outline" className="gap-1 text-xs text-yellow-600 border-yellow-300">
            <Phone className="h-3 w-3" /> Ringing: {stats.ringing}
          </Badge>
        )}
        {stats.aiActive > 0 && (
          <Badge variant="outline" className="gap-1 text-xs text-purple-600 border-purple-300">
            <Bot className="h-3 w-3" /> AI: {stats.aiActive}
          </Badge>
        )}
        {stats.humanActive > 0 && (
          <Badge variant="outline" className="gap-1 text-xs text-blue-600 border-blue-300">
            <User className="h-3 w-3" /> Human: {stats.humanActive}
          </Badge>
        )}
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 min-h-[500px]">
        {/* Call list */}
        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="w-full h-8">
                <TabsTrigger value="active" className="text-xs flex-1 gap-1">
                  <Activity className="h-3 w-3" /> Live ({activeCalls.length})
                </TabsTrigger>
                <TabsTrigger value="recent" className="text-xs flex-1 gap-1">
                  <Clock className="h-3 w-3" /> Recent
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-2">
            <ScrollArea className="h-[440px]">
              <AnimatePresence mode="popLayout">
                {displayCalls.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm gap-2">
                    <Phone className="h-5 w-5" />
                    {tab === "active" ? "No active calls" : "No recent calls"}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {displayCalls.map((call) => (
                      <LiveCallCardItem
                        key={call.id}
                        call={call}
                        onSelect={setSelectedCall}
                        isSelected={selectedCall?.id === call.id}
                      />
                    ))}
                  </div>
                )}
              </AnimatePresence>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Detail panel */}
        <Card>
          <CardContent className="p-4">
            {selectedCall ? (
              <CallDetailPanel call={selectedCall} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-muted-foreground gap-3">
                <Eye className="h-8 w-8" />
                <p className="text-sm">Select a call to observe</p>
                <p className="text-xs text-center max-w-[250px]">
                  View live transcripts, monitor AI conversations, and review recordings
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
