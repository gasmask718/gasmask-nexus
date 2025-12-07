import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Phone, 
  Users, 
  Mic, 
  MicOff, 
  UserPlus, 
  Bot, 
  User, 
  Truck, 
  Radio,
  ArrowRight,
  Volume2
} from "lucide-react";
import { useVoiceOrchestration, CallParticipant } from "@/hooks/useVoiceOrchestration";
import { useBusiness } from "@/contexts/BusinessContext";
import { cn } from "@/lib/utils";

interface SessionWithParticipants {
  session: any;
  participants: CallParticipant[];
}

export function LiveVoiceMatrix() {
  const { currentBusiness } = useBusiness();
  const { 
    multiPartySessions, 
    sessionsLoading, 
    fetchParticipants,
    promoteToSpeaker,
    demoteToListener,
    removeParticipant 
  } = useVoiceOrchestration(currentBusiness?.id);

  const [sessionsWithParticipants, setSessionsWithParticipants] = useState<SessionWithParticipants[]>([]);

  useEffect(() => {
    const loadParticipants = async () => {
      const results = await Promise.all(
        multiPartySessions.map(async (session) => {
          const participants = await fetchParticipants(session.id);
          return { session, participants };
        })
      );
      setSessionsWithParticipants(results);
    };

    if (multiPartySessions.length > 0) {
      loadParticipants();
    } else {
      setSessionsWithParticipants([]);
    }
  }, [multiPartySessions, fetchParticipants]);

  const getParticipantIcon = (type: string) => {
    switch (type) {
      case "ai_agent": return <Bot className="h-4 w-4" />;
      case "human_agent": return <User className="h-4 w-4" />;
      case "store_contact": return <Phone className="h-4 w-4" />;
      case "driver":
      case "biker": return <Truck className="h-4 w-4" />;
      default: return <Users className="h-4 w-4" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "speaker": return "bg-green-500";
      case "listener": return "bg-blue-500";
      case "whisper_only": return "bg-purple-500";
      default: return "bg-muted";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ai_active": return <Badge variant="default" className="bg-primary">AI Active</Badge>;
      case "human_active": return <Badge variant="secondary">Human Active</Badge>;
      case "pending": return <Badge variant="outline">Pending</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (sessionsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Radio className="h-8 w-8 animate-pulse text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{multiPartySessions.length}</p>
                <p className="text-sm text-muted-foreground">Active Multi-Party Calls</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">
                  {sessionsWithParticipants.reduce((acc, s) => 
                    acc + s.participants.filter(p => p.participant_type === "ai_agent").length, 0
                  )}
                </p>
                <p className="text-sm text-muted-foreground">AI Agents Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">
                  {sessionsWithParticipants.reduce((acc, s) => 
                    acc + s.participants.filter(p => p.participant_type === "human_agent").length, 0
                  )}
                </p>
                <p className="text-sm text-muted-foreground">Human Agents</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Volume2 className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">
                  {sessionsWithParticipants.reduce((acc, s) => 
                    acc + s.participants.filter(p => p.role === "speaker").length, 0
                  )}
                </p>
                <p className="text-sm text-muted-foreground">Active Speakers</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Live Sessions Matrix */}
      {sessionsWithParticipants.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Radio className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium">No Active Multi-Party Calls</h3>
            <p className="text-muted-foreground">Multi-party voice sessions will appear here in real-time</p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[600px]">
          <div className="grid gap-4">
            {sessionsWithParticipants.map(({ session, participants }) => (
              <Card key={session.id} className="border-2 border-primary/20">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Phone className="h-5 w-5 text-primary animate-pulse" />
                      </div>
                      <div>
                        <CardTitle className="text-base">
                          {session.store?.store_name || "Unknown Store"}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {session.business?.name} • {participants.length} participants
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(session.status)}
                      {session.sentiment_trend && (
                        <Badge variant="outline">{session.sentiment_trend}</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Participant Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                    {participants.map((participant) => (
                      <div
                        key={participant.id}
                        className={cn(
                          "p-3 rounded-lg border-2 relative",
                          participant.role === "speaker" 
                            ? "border-green-500 bg-green-500/5" 
                            : "border-border"
                        )}
                      >
                        <div className="absolute top-2 right-2">
                          <div className={cn("h-2 w-2 rounded-full", getRoleColor(participant.role))} />
                        </div>
                        <div className="flex flex-col items-center text-center gap-2">
                          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                            {getParticipantIcon(participant.participant_type)}
                          </div>
                          <div>
                            <p className="text-sm font-medium">
                              {participant.agent?.name || participant.participant_type.replace("_", " ")}
                            </p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {participant.role.replace("_", " ")}
                            </p>
                          </div>
                          <div className="flex gap-1">
                            {participant.role === "speaker" ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2"
                                onClick={() => demoteToListener(participant.id)}
                              >
                                <MicOff className="h-3 w-3" />
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2"
                                onClick={() => promoteToSpeaker({ 
                                  participantId: participant.id, 
                                  sessionId: session.id 
                                })}
                              >
                                <Mic className="h-3 w-3" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-destructive"
                              onClick={() => removeParticipant(participant.id)}
                            >
                              ×
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {/* Add Participant Button */}
                    <div className="p-3 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                      <Button variant="ghost" size="sm" className="h-full w-full flex-col gap-2">
                        <UserPlus className="h-5 w-5" />
                        <span className="text-xs">Add Participant</span>
                      </Button>
                    </div>
                  </div>

                  {/* Switchboard Info */}
                  {session.switchboard_agent && (
                    <div className="mt-4 p-3 bg-muted/50 rounded-lg flex items-center gap-3">
                      <Radio className="h-4 w-4 text-primary" />
                      <span className="text-sm">
                        <strong>Switchboard:</strong> {session.switchboard_agent.name}
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        Managing call routing & agent coordination
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
