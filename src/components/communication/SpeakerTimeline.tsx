import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, User, Phone, Truck, Clock, AlertTriangle, TrendingUp, MessageSquare } from "lucide-react";
import { useVoiceOrchestration, ActiveSpeakerEntry, WhisperEvent } from "@/hooks/useVoiceOrchestration";
import { cn } from "@/lib/utils";
import { format, differenceInSeconds } from "date-fns";

interface SpeakerTimelineProps {
  sessionId: string;
}

export function SpeakerTimeline({ sessionId }: SpeakerTimelineProps) {
  const { fetchSpeakerLog, fetchWhisperEvents } = useVoiceOrchestration();
  const [speakerLog, setSpeakerLog] = useState<ActiveSpeakerEntry[]>([]);
  const [whisperEvents, setWhisperEvents] = useState<WhisperEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [speakers, whispers] = await Promise.all([
          fetchSpeakerLog(sessionId),
          fetchWhisperEvents(sessionId),
        ]);
        setSpeakerLog(speakers);
        setWhisperEvents(whispers);
      } catch (error) {
        console.error("Failed to load timeline data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [sessionId, fetchSpeakerLog, fetchWhisperEvents]);

  const getParticipantIcon = (type: string) => {
    switch (type) {
      case "ai_agent": return <Bot className="h-4 w-4" />;
      case "human_agent": return <User className="h-4 w-4" />;
      case "store_contact": return <Phone className="h-4 w-4" />;
      case "driver":
      case "biker": return <Truck className="h-4 w-4" />;
      default: return <User className="h-4 w-4" />;
    }
  };

  const getParticipantColor = (type: string) => {
    switch (type) {
      case "ai_agent": return "bg-green-500";
      case "human_agent": return "bg-blue-500";
      case "store_contact": return "bg-orange-500";
      case "driver":
      case "biker": return "bg-purple-500";
      default: return "bg-muted";
    }
  };

  const formatDuration = (entry: ActiveSpeakerEntry) => {
    const start = new Date(entry.started_at);
    const end = entry.ended_at ? new Date(entry.ended_at) : new Date();
    const seconds = differenceInSeconds(end, start);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  // Merge speaker log and whisper events into unified timeline
  const timelineEvents = [
    ...speakerLog.map((entry) => ({
      id: entry.id,
      type: "speaker" as const,
      timestamp: entry.started_at,
      data: entry,
    })),
    ...whisperEvents.map((event) => ({
      id: event.id,
      type: "whisper" as const,
      timestamp: event.created_at,
      data: event,
    })),
  ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Clock className="h-8 w-8 mx-auto mb-2 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading timeline...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Speaker Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        {timelineEvents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto mb-2" />
            <p>No timeline events yet</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="relative">
              {/* Timeline Line */}
              <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />

              {/* Timeline Events */}
              <div className="space-y-4">
                {timelineEvents.map((event, index) => (
                  <div key={event.id} className="relative pl-12">
                    {/* Timeline Dot */}
                    <div
                      className={cn(
                        "absolute left-3 w-5 h-5 rounded-full flex items-center justify-center",
                        event.type === "speaker"
                          ? getParticipantColor((event.data as ActiveSpeakerEntry).participant_type)
                          : "bg-purple-500"
                      )}
                    >
                      {event.type === "speaker" ? (
                        getParticipantIcon((event.data as ActiveSpeakerEntry).participant_type)
                      ) : (
                        <MessageSquare className="h-3 w-3 text-white" />
                      )}
                    </div>

                    {/* Event Card */}
                    <div
                      className={cn(
                        "p-3 rounded-lg border",
                        event.type === "whisper" ? "bg-purple-500/5 border-purple-500/30" : ""
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          {event.type === "speaker" ? (
                            <>
                              <span className="font-medium text-sm">
                                {(event.data as ActiveSpeakerEntry).agent?.name ||
                                  (event.data as ActiveSpeakerEntry).participant_type.replace("_", " ")}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {(event.data as ActiveSpeakerEntry).participant_type.replace("_", " ")}
                              </Badge>
                            </>
                          ) : (
                            <>
                              <span className="font-medium text-sm text-purple-600">
                                Whisper Coaching
                              </span>
                              <Badge variant="outline" className="text-xs bg-purple-500/10">
                                {(event.data as WhisperEvent).agent?.name}
                              </Badge>
                            </>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(event.timestamp), "HH:mm:ss")}
                        </span>
                      </div>

                      {event.type === "speaker" && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>Duration: {formatDuration(event.data as ActiveSpeakerEntry)}</span>
                          {(event.data as ActiveSpeakerEntry).ended_at === null && (
                            <Badge variant="default" className="text-xs bg-green-500">
                              Speaking Now
                            </Badge>
                          )}
                        </div>
                      )}

                      {event.type === "whisper" && (
                        <p className="text-sm text-purple-700 dark:text-purple-300 mt-1 italic">
                          "{(event.data as WhisperEvent).suggestion}"
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
