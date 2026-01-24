import { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  Mic, 
  MicOff, 
  User, 
  AlertTriangle, 
  PhoneOff,
  Hand,
  Power,
  Volume2,
  VolumeX
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { CallState } from "@/hooks/useCallStateAuthority";

/**
 * CALL STATE CONTROLS
 * ===================
 * Operator controls for managing call state.
 * Each button triggers an authoritative state transition.
 */

interface CallStateControlsProps {
  currentState: CallState | null;
  isAISpeechAllowed: boolean;
  isTransitioning: boolean;
  onHumanTakeover: () => Promise<void>;
  onMuteAI: () => Promise<void>;
  onUnmuteAI: () => Promise<void>;
  onEscalate: () => Promise<void>;
  onEndCall: () => Promise<void>;
  onKillSwitch: (reason: string) => Promise<void>;
  className?: string;
}

export function CallStateControls({
  currentState,
  isAISpeechAllowed,
  isTransitioning,
  onHumanTakeover,
  onMuteAI,
  onUnmuteAI,
  onEscalate,
  onEndCall,
  onKillSwitch,
  className,
}: CallStateControlsProps) {
  const [killSwitchReason, setKillSwitchReason] = useState("");
  const [escalateReason, setEscalateReason] = useState("");

  const isEnded = currentState === 'ended';
  const isHumanActive = currentState === 'human_active';
  const isAIMuted = currentState === 'ai_muted';
  const isEscalated = currentState === 'escalated';
  const isAISpeaking = currentState === 'ai_speaking';

  // Can't do anything if call is ended
  if (isEnded) {
    return (
      <div className={cn("flex items-center gap-2 p-2 bg-muted rounded-lg", className)}>
        <PhoneOff className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Call ended - no actions available</span>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {/* Take Over Button - Available when AI is active */}
      {!isHumanActive && !isEscalated && (
        <Button
          variant="default"
          size="sm"
          onClick={onHumanTakeover}
          disabled={isTransitioning}
          className="gap-2"
        >
          <User className="h-4 w-4" />
          Take Over Call
        </Button>
      )}

      {/* Mute/Unmute AI */}
      {!isHumanActive && !isEscalated && (
        <>
          {isAIMuted ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onUnmuteAI}
              disabled={isTransitioning}
              className="gap-2"
            >
              <Volume2 className="h-4 w-4" />
              Unmute AI
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={onMuteAI}
              disabled={isTransitioning}
              className="gap-2 border-orange-300 text-orange-600 hover:bg-orange-50"
            >
              <VolumeX className="h-4 w-4" />
              Mute AI
            </Button>
          )}
        </>
      )}

      {/* Escalate Button */}
      {!isEscalated && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={isTransitioning}
              className="gap-2 border-red-300 text-red-600 hover:bg-red-50"
            >
              <AlertTriangle className="h-4 w-4" />
              Escalate
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Escalate Call</AlertDialogTitle>
              <AlertDialogDescription>
                This will mark the call as escalated and stop all AI activity.
                A supervisor will be notified.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <Label htmlFor="escalate-reason">Reason (optional)</Label>
              <Textarea
                id="escalate-reason"
                value={escalateReason}
                onChange={(e) => setEscalateReason(e.target.value)}
                placeholder="Why is this call being escalated?"
                className="mt-2"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  onEscalate();
                  setEscalateReason("");
                }}
                className="bg-red-600 hover:bg-red-700"
              >
                Escalate Call
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Kill Switch - Emergency Stop */}
      {isAISpeaking && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              size="sm"
              disabled={isTransitioning}
              className="gap-2 animate-pulse"
            >
              <Power className="h-4 w-4" />
              STOP AI NOW
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-red-600 flex items-center gap-2">
                <Power className="h-5 w-5" />
                Emergency AI Kill Switch
              </AlertDialogTitle>
              <AlertDialogDescription>
                This will immediately stop AI speech and prevent any further AI actions on this call.
                This is an emergency action and will be logged.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <Label htmlFor="kill-reason">Reason (required for audit)</Label>
              <Textarea
                id="kill-reason"
                value={killSwitchReason}
                onChange={(e) => setKillSwitchReason(e.target.value)}
                placeholder="Why are you stopping the AI?"
                className="mt-2"
                required
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (killSwitchReason.trim()) {
                    onKillSwitch(killSwitchReason);
                    setKillSwitchReason("");
                  }
                }}
                disabled={!killSwitchReason.trim()}
                className="bg-red-600 hover:bg-red-700"
              >
                STOP AI IMMEDIATELY
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* End Call */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={isTransitioning}
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            <PhoneOff className="h-4 w-4" />
            End Call
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End Call</AlertDialogTitle>
            <AlertDialogDescription>
              This will end the call and finalize all call records.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onEndCall}>
              End Call
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AI Status Indicator */}
      <div className="ml-auto flex items-center gap-2 text-sm">
        {isAISpeechAllowed ? (
          <span className="flex items-center gap-1 text-green-600">
            <Mic className="h-3 w-3" />
            AI can speak
          </span>
        ) : (
          <span className="flex items-center gap-1 text-orange-600">
            <MicOff className="h-3 w-3" />
            AI speech blocked
          </span>
        )}
      </div>
    </div>
  );
}
