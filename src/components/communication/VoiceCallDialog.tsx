import { useState, useCallback } from "react";
import { useConversation } from "@elevenlabs/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Phone, PhoneOff, Mic, MicOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface VoiceCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentName: string;
  elevenlabsAgentId: string;
}

export function VoiceCallDialog({
  open,
  onOpenChange,
  agentName,
  elevenlabsAgentId,
}: VoiceCallDialogProps) {
  const [isConnecting, setIsConnecting] = useState(false);

  const conversation = useConversation({
    onConnect: () => {
      console.log("Connected to ElevenLabs agent");
      toast.success("Call connected");
    },
    onDisconnect: () => {
      console.log("Disconnected from ElevenLabs agent");
      setIsConnecting(false);
    },
    onError: (error) => {
      console.error("Conversation error:", error);
      toast.error("Call error. Please try again.");
      setIsConnecting(false);
    },
  });

  const startCall = useCallback(async () => {
    if (!elevenlabsAgentId) {
      toast.error("No ElevenLabs Agent ID configured for this agent.");
      return;
    }

    setIsConnecting(true);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const { data, error } = await supabase.functions.invoke(
        "elevenlabs-conversation-token",
        { body: { agent_id: elevenlabsAgentId } }
      );

      if (error || !data?.token) {
        throw new Error(error?.message || "No token received");
      }

      await conversation.startSession({
        conversationToken: data.token,
        connectionType: "webrtc",
      });
    } catch (err: any) {
      console.error("Failed to start call:", err);
      if (err.name === "NotAllowedError") {
        toast.error("Microphone access denied. Please enable it in browser settings.");
      } else {
        toast.error(err.message || "Failed to start call");
      }
      setIsConnecting(false);
    }
  }, [conversation, elevenlabsAgentId]);

  const endCall = useCallback(async () => {
    await conversation.endSession();
  }, [conversation]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next && conversation.status === "connected") {
        conversation.endSession();
      }
      onOpenChange(next);
    },
    [conversation, onOpenChange]
  );

  const isConnected = conversation.status === "connected";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Voice Call — {agentName}
          </DialogTitle>
          <DialogDescription>
            Live AI voice conversation powered by ElevenLabs
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6 py-8">
          {/* Status indicator */}
          <div className="flex flex-col items-center gap-3">
            <div
              className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
                isConnected
                  ? conversation.isSpeaking
                    ? "bg-primary/20 animate-pulse ring-4 ring-primary/40"
                    : "bg-green-500/20 ring-4 ring-green-500/40"
                  : "bg-muted"
              }`}
            >
              {isConnecting ? (
                <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
              ) : isConnected ? (
                conversation.isSpeaking ? (
                  <Mic className="h-10 w-10 text-primary" />
                ) : (
                  <MicOff className="h-10 w-10 text-green-500" />
                )
              ) : (
                <Phone className="h-10 w-10 text-muted-foreground" />
              )}
            </div>

            <Badge
              variant={isConnected ? "default" : "secondary"}
              className="text-sm"
            >
              {isConnecting
                ? "Connecting..."
                : isConnected
                ? conversation.isSpeaking
                  ? "Agent Speaking"
                  : "Listening..."
                : "Ready"}
            </Badge>
          </div>

          {/* Action buttons */}
          {!isConnected ? (
            <Button
              onClick={startCall}
              disabled={isConnecting}
              size="lg"
              className="gap-2"
            >
              {isConnecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Phone className="h-4 w-4" />
              )}
              {isConnecting ? "Connecting..." : "Start Call"}
            </Button>
          ) : (
            <Button
              onClick={endCall}
              variant="destructive"
              size="lg"
              className="gap-2"
            >
              <PhoneOff className="h-4 w-4" />
              End Call
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
