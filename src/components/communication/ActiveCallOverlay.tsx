import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Pause,
  Play,
  User,
  Minimize2,
  Maximize2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface ActiveCallOverlayProps {
  callSid: string;
  callLogId: string;
  destinationPhone: string;
  entityName?: string;
  status: string;
  startedAt: Date;
  onEndCall: () => void;
  formatPhoneDisplay: (phone: string) => string;
}

export function ActiveCallOverlay({
  callSid,
  destinationPhone,
  entityName,
  status,
  startedAt,
  onEndCall,
  formatPhoneDisplay,
}: ActiveCallOverlayProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  // Timer
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const statusConfig: Record<string, { label: string; color: string; pulse: boolean }> = {
    initiated: { label: "Connecting...", color: "text-yellow-500", pulse: true },
    ringing: { label: "Ringing...", color: "text-blue-500", pulse: true },
    "in-progress": { label: "In Progress", color: "text-green-500", pulse: false },
    answered: { label: "Connected", color: "text-green-500", pulse: false },
    completed: { label: "Call Ended", color: "text-muted-foreground", pulse: false },
    failed: { label: "Failed", color: "text-destructive", pulse: false },
    busy: { label: "Busy", color: "text-orange-500", pulse: false },
    "no-answer": { label: "No Answer", color: "text-muted-foreground", pulse: false },
  };

  const currentStatus = statusConfig[status] || statusConfig.initiated;

  if (isMinimized) {
    return (
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="fixed bottom-4 right-4 z-50"
      >
        <div className="bg-green-600 text-white rounded-full px-4 py-2 flex items-center gap-3 shadow-lg cursor-pointer"
          onClick={() => setIsMinimized(false)}
        >
          <Phone className="h-4 w-4 animate-pulse" />
          <span className="font-mono text-sm">{formatTime(elapsed)}</span>
          <span className="text-sm truncate max-w-[120px]">
            {entityName || formatPhoneDisplay(destinationPhone)}
          </span>
          <Maximize2 className="h-3 w-3" />
        </div>
      </motion.div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[360px]"
      >
        <div className="bg-card border rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn(
                "h-2 w-2 rounded-full",
                currentStatus.pulse && "animate-pulse",
                status === "in-progress" || status === "answered" ? "bg-green-500" :
                status === "ringing" ? "bg-blue-500" :
                status === "initiated" ? "bg-yellow-500" : "bg-muted-foreground"
              )} />
              <span className={cn("text-xs font-medium", currentStatus.color)}>
                {currentStatus.label}
              </span>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsMinimized(true)}>
              <Minimize2 className="h-3 w-3" />
            </Button>
          </div>

          {/* Contact info with call animation */}
          <div className="px-4 pb-3 text-center relative">
            {/* Pulsing rings animation for ringing/connecting */}
            <div className="relative w-14 h-14 mx-auto mb-2">
              {(status === "initiated" || status === "ringing") && (
                <>
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-primary"
                    animate={{ scale: [1, 2], opacity: [0.6, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
                  />
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-primary"
                    animate={{ scale: [1, 2], opacity: [0.6, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut", delay: 0.5 }}
                  />
                </>
              )}
              {(status === "in-progress" || status === "answered") && (
                <motion.div
                  className="absolute inset-[-4px] rounded-full border-2 border-green-500/50"
                  animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.8, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />
              )}
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center relative z-10">
                <User className="h-7 w-7 text-primary" />
              </div>
            </div>
            <h3 className="font-semibold text-lg truncate">
              {entityName || formatPhoneDisplay(destinationPhone)}
            </h3>
            {entityName && (
              <p className="text-sm text-muted-foreground">{formatPhoneDisplay(destinationPhone)}</p>
            )}
            <p className="font-mono text-2xl font-bold mt-1 text-foreground">
              {formatTime(elapsed)}
            </p>
          </div>

          {/* Controls */}
          <div className="px-4 pb-4 grid grid-cols-4 gap-2">
            <ControlButton
              icon={isMuted ? MicOff : Mic}
              label={isMuted ? "Unmute" : "Mute"}
              active={isMuted}
              onClick={() => setIsMuted(!isMuted)}
            />
            <ControlButton
              icon={isSpeakerOn ? Volume2 : VolumeX}
              label="Speaker"
              active={isSpeakerOn}
              onClick={() => setIsSpeakerOn(!isSpeakerOn)}
            />
            <ControlButton
              icon={isOnHold ? Play : Pause}
              label={isOnHold ? "Resume" : "Hold"}
              active={isOnHold}
              onClick={() => setIsOnHold(!isOnHold)}
            />
            <div className="flex flex-col items-center gap-1">
              <Button
                size="icon"
                variant="destructive"
                className="h-12 w-12 rounded-full"
                onClick={onEndCall}
              >
                <PhoneOff className="h-5 w-5" />
              </Button>
              <span className="text-[10px] text-muted-foreground">End</span>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function ControlButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof Mic;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <Button
        size="icon"
        variant={active ? "default" : "outline"}
        className={cn("h-12 w-12 rounded-full", active && "bg-primary")}
        onClick={onClick}
      >
        <Icon className="h-5 w-5" />
      </Button>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}
