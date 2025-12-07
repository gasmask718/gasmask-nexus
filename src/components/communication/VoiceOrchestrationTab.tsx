import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Radio, Route, Clock, MessageSquare } from "lucide-react";
import { LiveVoiceMatrix } from "./LiveVoiceMatrix";
import { CallRoutingRulesPanel } from "./CallRoutingRulesPanel";
import { SpeakerTimeline } from "./SpeakerTimeline";
import { WhisperCoachingPanel } from "./WhisperCoachingPanel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function VoiceOrchestrationTab() {
  const [selectedSessionId, setSelectedSessionId] = useState("");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Radio className="h-6 w-6 text-primary" />
          Voice Orchestration (V8)
        </h2>
        <p className="text-muted-foreground">
          Real-time multi-agent voice call management with AI Switchboard Operator
        </p>
      </div>

      <Tabs defaultValue="matrix" className="space-y-4">
        <TabsList>
          <TabsTrigger value="matrix" className="flex items-center gap-2">
            <Radio className="h-4 w-4" />
            Live Voice Matrix
          </TabsTrigger>
          <TabsTrigger value="routing" className="flex items-center gap-2">
            <Route className="h-4 w-4" />
            Routing Rules
          </TabsTrigger>
          <TabsTrigger value="timeline" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Session Timeline
          </TabsTrigger>
          <TabsTrigger value="whisper" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Whisper Coaching
          </TabsTrigger>
        </TabsList>

        <TabsContent value="matrix">
          <LiveVoiceMatrix />
        </TabsContent>

        <TabsContent value="routing">
          <CallRoutingRulesPanel />
        </TabsContent>

        <TabsContent value="timeline">
          <div className="space-y-4">
            <div>
              <Label>Session ID</Label>
              <Input
                value={selectedSessionId}
                onChange={(e) => setSelectedSessionId(e.target.value)}
                placeholder="Enter session ID to view timeline"
              />
            </div>
            {selectedSessionId && <SpeakerTimeline sessionId={selectedSessionId} />}
          </div>
        </TabsContent>

        <TabsContent value="whisper">
          <div className="space-y-4">
            <div>
              <Label>Session ID</Label>
              <Input
                value={selectedSessionId}
                onChange={(e) => setSelectedSessionId(e.target.value)}
                placeholder="Enter session ID for whisper coaching"
              />
            </div>
            {selectedSessionId && <WhisperCoachingPanel sessionId={selectedSessionId} />}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
