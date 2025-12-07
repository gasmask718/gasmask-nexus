import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Send, Bot, User, Volume2 } from "lucide-react";
import { useVoiceOrchestration, WhisperEvent } from "@/hooks/useVoiceOrchestration";
import { useAIAgents } from "@/hooks/useAIAgents";
import { useBusiness } from "@/contexts/BusinessContext";
import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface WhisperCoachingPanelProps {
  sessionId: string;
  humanParticipantId?: string;
}

export function WhisperCoachingPanel({ sessionId, humanParticipantId }: WhisperCoachingPanelProps) {
  const { currentBusiness } = useBusiness();
  const { sendWhisper, fetchWhisperEvents } = useVoiceOrchestration(currentBusiness?.id);
  const { agents } = useAIAgents(currentBusiness?.id);
  
  const [whisperEvents, setWhisperEvents] = useState<WhisperEvent[]>([]);
  const [suggestion, setSuggestion] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Load whisper events
  React.useEffect(() => {
    const loadEvents = async () => {
      const events = await fetchWhisperEvents(sessionId);
      setWhisperEvents(events);
    };
    loadEvents();
  }, [sessionId, fetchWhisperEvents]);

  const supervisorAgents = agents.filter((a) => a.role === "supervisor" && a.active);

  const handleSendWhisper = async () => {
    if (!suggestion.trim() || !selectedAgentId || !humanParticipantId) return;

    setIsSending(true);
    try {
      await sendWhisper({
        sessionId,
        agentId: selectedAgentId,
        humanParticipantId,
        suggestion: suggestion.trim(),
      });
      setSuggestion("");
      // Reload events
      const events = await fetchWhisperEvents(sessionId);
      setWhisperEvents(events);
    } finally {
      setIsSending(false);
    }
  };

  const quickSuggestions = [
    "Ask about their delivery schedule preferences",
    "Mention our current promotion",
    "Acknowledge their concern and offer a solution",
    "Redirect conversation to the main topic",
    "Suggest scheduling a follow-up",
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-purple-500" />
          Whisper Coaching
          <Badge variant="outline" className="ml-2 bg-purple-500/10 text-purple-600">
            Silent AI Guidance
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Whisper History */}
        <ScrollArea className="h-[200px] border rounded-lg p-3">
          {whisperEvents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Volume2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No whisper coaching messages yet</p>
              <p className="text-xs">AI suggestions will appear here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {whisperEvents.map((event) => (
                <div
                  key={event.id}
                  className="p-3 bg-purple-500/5 border border-purple-500/20 rounded-lg"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4 text-purple-500" />
                      <span className="text-sm font-medium text-purple-600">
                        {event.agent?.name || "Supervisor AI"}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(event.created_at), "HH:mm:ss")}
                    </span>
                  </div>
                  <p className="text-sm italic text-purple-700 dark:text-purple-300">
                    "{event.suggestion}"
                  </p>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Quick Suggestions */}
        <div>
          <p className="text-sm font-medium mb-2">Quick Suggestions</p>
          <div className="flex flex-wrap gap-2">
            {quickSuggestions.map((qs, i) => (
              <Button
                key={i}
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setSuggestion(qs)}
              >
                {qs.substring(0, 30)}...
              </Button>
            ))}
          </div>
        </div>

        {/* Send Whisper */}
        <div className="space-y-3">
          <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
            <SelectTrigger>
              <SelectValue placeholder="Select coaching agent" />
            </SelectTrigger>
            <SelectContent>
              {supervisorAgents.length === 0 ? (
                <SelectItem value="none" disabled>
                  No supervisor agents available
                </SelectItem>
              ) : (
                supervisorAgents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4" />
                      {agent.name}
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>

          <Textarea
            value={suggestion}
            onChange={(e) => setSuggestion(e.target.value)}
            placeholder="Type coaching suggestion for the human agent..."
            rows={3}
          />

          <Button
            onClick={handleSendWhisper}
            disabled={!suggestion.trim() || !selectedAgentId || !humanParticipantId || isSending}
            className="w-full"
          >
            <Send className="h-4 w-4 mr-2" />
            {isSending ? "Sending..." : "Send Whisper Coaching"}
          </Button>

          {!humanParticipantId && (
            <p className="text-xs text-amber-600 text-center">
              No human participant in this call to coach
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
