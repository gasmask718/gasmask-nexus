import { useState, useEffect, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  SkipForward,
  User,
  Hash,
} from "lucide-react";
import { useVoiceDevice } from "@/contexts/VoiceDeviceProvider";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface QueueItem {
  id: string;
  phone_number: string;
  contact_name: string;
  status: string;
  twilio_call_sid?: string;
}

interface TranscriptLine {
  speaker: "you" | "caller";
  text: string;
  timestamp: Date;
}

interface ManualCampaignCallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  campaignName: string;
}

// Browser Speech Recognition types
interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

export function ManualCampaignCallModal({
  open,
  onOpenChange,
  campaignId,
  campaignName,
}: ManualCampaignCallModalProps) {
  const device = useVoiceDevice();
  const queryClient = useQueryClient();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDialing, setIsDialing] = useState(false);
  const [callStartedAt, setCallStartedAt] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [localTranscripts, setLocalTranscripts] = useState<TranscriptLine[]>([]);
  const [interimText, setInterimText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const currentCallSidRef = useRef<string | null>(null);
  const remoteRecorderRef = useRef<MediaRecorder | null>(null);
  const remoteChunksRef = useRef<Blob[]>([]);
  const transcribeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch all queued items for this campaign
  const { data: queueItems = [], refetch: refetchQueue } = useQuery({
    queryKey: ["manual-campaign-queue", campaignId],
    queryFn: async () => {
      const { data } = await supabase
        .from("outbound_call_queue")
        .select("id, phone_number, contact_name, status, twilio_call_sid")
        .eq("campaign_id", campaignId)
        .order("priority_score", { ascending: false });
      return (data as QueueItem[]) || [];
    },
    enabled: open && !!campaignId,
    refetchInterval: 5000,
  });

  const currentItem = queueItems[currentIndex] || null;
  const totalItems = queueItems.length;
  const completedCount = queueItems.filter(
    (q) => q.status === "completed" || q.status === "failed" || q.status === "no_answer"
  ).length;

  // Fetch DB transcripts for current call
  const currentCallSid = currentItem?.twilio_call_sid || null;
  const { data: dbTranscripts = [] } = useQuery({
    queryKey: ["manual-call-transcripts", currentCallSid],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("live_call_transcripts")
        .select("*")
        .eq("call_sid", currentCallSid)
        .order("created_at", { ascending: true });
      return data || [];
    },
    enabled: !!currentCallSid,
    refetchInterval: 3000,
  });

  // Timer
  useEffect(() => {
    if (!callStartedAt) { setElapsed(0); return; }
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - callStartedAt.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [callStartedAt]);

  // Auto-scroll transcripts
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localTranscripts, dbTranscripts, interimText]);

  // Auto-advance currentIndex to first "queued" item
  useEffect(() => {
    if (!open || queueItems.length === 0) return;
    const firstQueued = queueItems.findIndex((q) => q.status === "queued");
    if (firstQueued >= 0 && !isDialing && device.callStatus === "idle") {
      setCurrentIndex(firstQueued);
    }
  }, [queueItems, open]);

  // ── Speech Recognition ──
  const startSpeechRecognition = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech Recognition not supported in this browser");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            const text = result[0].transcript.trim();
            if (text) {
              const line: TranscriptLine = {
                speaker: "you",
                text,
                timestamp: new Date(),
              };
              setLocalTranscripts((prev) => [...prev, line]);
              setInterimText("");
              
              // Persist to live_call_transcripts
              const callSid = currentCallSidRef.current;
              if (callSid) {
                (supabase as any)
                  .from("live_call_transcripts")
                  .insert({
                    call_sid: callSid,
                    speaker: "human",
                    text,
                    created_at: new Date().toISOString(),
                  })
                  .then(() => {
                    queryClient.invalidateQueries({ queryKey: ["campaign-transcripts"] });
                  });
              }
            }
          } else {
            interim += result[0].transcript;
          }
        }
        if (interim) setInterimText(interim);
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        if (event.error === "not-allowed") {
          toast.error("Microphone access denied for speech recognition");
        }
        // Auto-restart on non-fatal errors
        if (event.error !== "not-allowed" && event.error !== "service-not-allowed") {
          setTimeout(() => {
            try { recognition.start(); } catch { /* already running */ }
          }, 500);
        }
      };

      recognition.onend = () => {
        // Auto-restart if still on call
        if (currentCallSidRef.current) {
          try { recognition.start(); } catch { /* already running */ }
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
      console.log("🎤 Speech recognition started");
    } catch (err) {
      console.error("Failed to start speech recognition:", err);
    }
  }, [queryClient]);

  const stopSpeechRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ok */ }
      recognitionRef.current = null;
      setInterimText("");
      console.log("🎤 Speech recognition stopped");
    }
  }, []);

  // ── Remote Audio Transcription ──
  const startRemoteAudioCapture = useCallback((call: any) => {
    try {
      // Access the underlying PeerConnection from Twilio SDK
      const pc =
        call?._mediaHandler?._peerConnection ||
        call?.mediaStream?._peerConnection ||
        call?._peerConnection;

      if (!pc) {
        console.warn("Could not access PeerConnection for remote audio capture");
        return;
      }

      // Build a MediaStream from the remote tracks
      const receivers = pc.getReceivers?.();
      if (!receivers || receivers.length === 0) {
        console.warn("No remote receivers found");
        return;
      }

      const remoteStream = new MediaStream(
        receivers
          .filter((r: RTCRtpReceiver) => r.track && r.track.kind === "audio")
          .map((r: RTCRtpReceiver) => r.track)
      );

      if (remoteStream.getTracks().length === 0) {
        console.warn("No remote audio tracks found");
        return;
      }

      console.log("🔊 Remote audio stream captured, starting recorder");

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(remoteStream, { mimeType });
      remoteRecorderRef.current = recorder;
      remoteChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          remoteChunksRef.current.push(e.data);
        }
      };

      recorder.start(5000); // Collect 5-second chunks

      // Every 6 seconds, send accumulated audio for transcription
      transcribeIntervalRef.current = setInterval(async () => {
        if (remoteChunksRef.current.length === 0) return;

        const chunks = [...remoteChunksRef.current];
        remoteChunksRef.current = [];
        const blob = new Blob(chunks, { type: mimeType });

        // Skip tiny chunks (likely silence)
        if (blob.size < 2000) return;

        try {
          const arrayBuffer = await blob.arrayBuffer();
          const base64 = btoa(
            new Uint8Array(arrayBuffer).reduce(
              (data, byte) => data + String.fromCharCode(byte),
              ""
            )
          );

          const callSid = currentCallSidRef.current;
          if (!callSid) return;

          const { data } = await supabase.functions.invoke("transcribe-call-audio", {
            body: {
              audio_base64: base64,
              call_sid: callSid,
              mime_type: "audio/webm",
            },
          });

          if (data?.text && !data?.skipped) {
            setLocalTranscripts((prev) => [
              ...prev,
              { speaker: "caller", text: data.text, timestamp: new Date() },
            ]);
            queryClient.invalidateQueries({ queryKey: ["manual-call-transcripts", callSid] });
            queryClient.invalidateQueries({ queryKey: ["campaign-transcripts"] });
          }
        } catch (err) {
          console.warn("Remote transcription chunk failed:", err);
        }
      }, 6000);
    } catch (err) {
      console.error("Failed to start remote audio capture:", err);
    }
  }, [queryClient]);

  const stopRemoteAudioCapture = useCallback(() => {
    if (remoteRecorderRef.current) {
      try { remoteRecorderRef.current.stop(); } catch { /* ok */ }
      remoteRecorderRef.current = null;
    }
    if (transcribeIntervalRef.current) {
      clearInterval(transcribeIntervalRef.current);
      transcribeIntervalRef.current = null;
    }
    remoteChunksRef.current = [];
    console.log("🔊 Remote audio capture stopped");
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const dialCurrent = useCallback(async () => {
    if (!currentItem || currentItem.status !== "queued") {
      toast.error("No queued number to dial");
      return;
    }
    if (!device.isReady) {
      toast.error("Voice device not ready. Check microphone permissions.");
      return;
    }

    setIsDialing(true);
    setLocalTranscripts([]);
    currentCallSidRef.current = null;

    try {
      // Mark as dialing in DB
      await supabase
        .from("outbound_call_queue")
        .update({ status: "dialing", dialing_started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", currentItem.id);

      // Place the call via Twilio Voice SDK (browser WebRTC)
      const call = await device.makeCall(currentItem.phone_number);
      if (call) {
        setCallStartedAt(new Date());
        toast.success(`Dialing ${currentItem.contact_name || currentItem.phone_number}...`);

        // Get and store call SID immediately
        const callSid = (call as any).parameters?.CallSid || `browser-${Date.now()}`;
        currentCallSidRef.current = callSid;
        
        await supabase
          .from("outbound_call_queue")
          .update({ twilio_call_sid: callSid, updated_at: new Date().toISOString() })
          .eq("id", currentItem.id);
        refetchQueue();

        // Start speech recognition when call connects
        call.on("accept", () => {
          supabase
            .from("outbound_call_queue")
            .update({ status: "connected", updated_at: new Date().toISOString() })
            .eq("id", currentItem.id)
            .then(() => refetchQueue());
          
          // Start capturing speech (user's mic)
          startSpeechRecognition();
          // Start capturing remote party audio for transcription
          startRemoteAudioCapture(call);
        });

        call.on("disconnect", () => {
          stopSpeechRecognition();
          stopRemoteAudioCapture();
          currentCallSidRef.current = null;
          supabase
            .from("outbound_call_queue")
            .update({ status: "completed", updated_at: new Date().toISOString() })
            .eq("id", currentItem.id)
            .then(() => {
              refetchQueue();
              queryClient.invalidateQueries({ queryKey: ["campaign-calls", campaignId] });
              queryClient.invalidateQueries({ queryKey: ["campaign-transcripts", campaignId] });
            });
          setCallStartedAt(null);
          setIsDialing(false);
        });

        call.on("cancel", () => {
          stopSpeechRecognition();
          stopRemoteAudioCapture();
          currentCallSidRef.current = null;
          supabase
            .from("outbound_call_queue")
            .update({ status: "no_answer", updated_at: new Date().toISOString() })
            .eq("id", currentItem.id)
            .then(() => refetchQueue());
          setCallStartedAt(null);
          setIsDialing(false);
        });

        call.on("reject", () => {
          stopSpeechRecognition();
          stopRemoteAudioCapture();
          currentCallSidRef.current = null;
          supabase
            .from("outbound_call_queue")
            .update({ status: "failed", updated_at: new Date().toISOString() })
            .eq("id", currentItem.id)
            .then(() => refetchQueue());
          setCallStartedAt(null);
          setIsDialing(false);
        });
      }
    } catch (err: any) {
      toast.error(`Failed to dial: ${err.message}`);
      await supabase
        .from("outbound_call_queue")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", currentItem.id);
      setIsDialing(false);
      currentCallSidRef.current = null;
      refetchQueue();
    }
  }, [currentItem, device, campaignId, queryClient, refetchQueue, startSpeechRecognition, startRemoteAudioCapture, stopSpeechRecognition, stopRemoteAudioCapture]);

  const endCall = useCallback(() => {
    stopSpeechRecognition();
    stopRemoteAudioCapture();
    device.hangUp();
    setCallStartedAt(null);
    setIsDialing(false);
    currentCallSidRef.current = null;
    if (currentItem) {
      supabase
        .from("outbound_call_queue")
        .update({ status: "completed", updated_at: new Date().toISOString() })
        .eq("id", currentItem.id)
        .then(() => {
          refetchQueue();
          queryClient.invalidateQueries({ queryKey: ["campaign-calls", campaignId] });
          queryClient.invalidateQueries({ queryKey: ["campaign-transcripts", campaignId] });
        });
    }
  }, [device, currentItem, campaignId, queryClient, refetchQueue, stopSpeechRecognition]);

  const skipToNext = useCallback(() => {
    if (isDialing || device.callStatus !== "idle") {
      toast.error("End the current call before skipping");
      return;
    }
    if (currentItem?.status === "queued") {
      supabase
        .from("outbound_call_queue")
        .update({ status: "no_answer", updated_at: new Date().toISOString() })
        .eq("id", currentItem.id)
        .then(() => refetchQueue());
    }
    setLocalTranscripts([]);
    const nextQueued = queueItems.findIndex((q, i) => i > currentIndex && q.status === "queued");
    if (nextQueued >= 0) {
      setCurrentIndex(nextQueued);
    } else {
      toast.info("No more numbers in queue");
    }
  }, [currentIndex, queueItems, currentItem, isDialing, device.callStatus, refetchQueue]);

  const handleClose = (next: boolean) => {
    if (isDialing || device.callStatus !== "idle") {
      toast.error("End the current call before closing");
      return;
    }
    stopSpeechRecognition();
    onOpenChange(next);
  };

  // Merge local + DB transcripts for display
  const allTranscripts = [
    ...localTranscripts.map((t) => ({
      speaker: t.speaker,
      text: t.text,
      time: t.timestamp,
      source: "local" as const,
    })),
    ...(dbTranscripts as any[]).map((t: any) => ({
      speaker: t.speaker === "human" || t.speaker === "user" ? "you" as const : "caller" as const,
      text: t.text,
      time: new Date(t.created_at),
      source: "db" as const,
    })),
  ]
    // Deduplicate by text similarity
    .filter((t, i, arr) => {
      if (t.source === "local") {
        // Remove local if DB has same text
        return !arr.some((o) => o.source === "db" && o.text === t.text);
      }
      return true;
    })
    .sort((a, b) => a.time.getTime() - b.time.getTime());

  const isOnCall = device.callStatus === "in-progress" || device.callStatus === "ringing" || device.callStatus === "connecting";
  const progressPct = totalItems > 0 ? (completedCount / totalItems) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Manual Cold Call — {campaignName}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-3">
            <Badge variant="outline" className="gap-1">
              <Hash className="h-3 w-3" />
              {currentIndex + 1} / {totalItems}
            </Badge>
            <Badge variant="secondary" className="gap-1">
              Completed: {completedCount}
            </Badge>
          </DialogDescription>
        </DialogHeader>

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Campaign Progress</span>
            <span>{Math.round(progressPct)}%</span>
          </div>
          <Progress value={progressPct} className="h-2" />
        </div>

        {/* Current contact card */}
        <Card className="p-4 border-l-4 border-l-primary">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground">
                  {currentItem?.contact_name || "No contact"}
                </p>
                <p className="text-sm text-muted-foreground font-mono">
                  {currentItem?.phone_number || "—"}
                </p>
              </div>
            </div>
            <div className="text-right">
              {isOnCall && (
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-sm font-mono font-bold text-green-600 dark:text-green-400">
                    {formatTime(elapsed)}
                  </span>
                </div>
              )}
              {currentItem && (
                <Badge
                  variant={currentItem.status === "queued" ? "secondary" : currentItem.status === "connected" ? "default" : "outline"}
                  className="text-xs mt-1"
                >
                  {currentItem.status}
                </Badge>
              )}
            </div>
          </div>
        </Card>

        {/* Call controls */}
        <div className="flex items-center justify-center gap-3 py-2">
          {!isOnCall && !isDialing ? (
            <>
              <Button
                onClick={dialCurrent}
                disabled={!currentItem || currentItem.status !== "queued" || !device.isReady}
                size="lg"
                className="gap-2 bg-green-600 hover:bg-green-700 text-white"
              >
                <Phone className="h-4 w-4" />
                Dial
              </Button>
              <Button onClick={skipToNext} variant="outline" size="lg" className="gap-2">
                <SkipForward className="h-4 w-4" />
                Skip
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={() => device.toggleMute()}
                variant={device.isMuted ? "default" : "outline"}
                size="lg"
                className="gap-2"
              >
                {device.isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                {device.isMuted ? "Unmute" : "Mute"}
              </Button>
              <Button
                onClick={endCall}
                variant="destructive"
                size="lg"
                className="gap-2"
              >
                <PhoneOff className="h-4 w-4" />
                End Call
              </Button>
            </>
          )}
        </div>

        {!device.isReady && (
          <p className="text-xs text-destructive text-center">
            Voice device not connected. Make sure microphone is allowed.
          </p>
        )}

        {/* Live Transcript */}
        <div className="flex-1 min-h-0 border-t pt-3">
          <h4 className="text-sm font-semibold mb-2 text-foreground flex items-center gap-2">
            Live Transcript
            {isOnCall && recognitionRef.current && (
              <Badge variant="outline" className="text-[10px] gap-1 animate-pulse">
                <Mic className="h-2.5 w-2.5" /> Listening
              </Badge>
            )}
          </h4>
          <ScrollArea className="h-40 rounded-md border p-3 bg-muted/20">
            <div className="space-y-2">
              {allTranscripts.length === 0 && !interimText ? (
                <p className="text-xs text-muted-foreground italic text-center py-4">
                  {isOnCall
                    ? "Listening... speak and your words will appear here."
                    : "Transcript will appear here during the call."}
                </p>
              ) : (
                <>
                  {allTranscripts.map((t, i) => (
                    <div
                      key={i}
                      className={`flex gap-2 text-xs ${t.speaker === "you" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg px-3 py-1.5 ${
                          t.speaker === "you"
                            ? "bg-primary/10 text-foreground"
                            : "bg-muted text-foreground"
                        }`}
                      >
                        <span className="font-semibold text-[10px] text-muted-foreground">
                          {t.speaker === "you" ? "You" : "Caller"}
                        </span>
                        <p className="mt-0.5">{t.text}</p>
                      </div>
                    </div>
                  ))}
                  {interimText && (
                    <div className="flex gap-2 text-xs justify-end">
                      <div className="max-w-[80%] rounded-lg px-3 py-1.5 bg-primary/5 text-muted-foreground italic">
                        <span className="font-semibold text-[10px]">You</span>
                        <p className="mt-0.5">{interimText}...</p>
                      </div>
                    </div>
                  )}
                </>
              )}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>
        </div>

        {/* Queue list */}
        <div className="border-t pt-3">
          <h4 className="text-sm font-semibold mb-2 text-foreground">Call Queue</h4>
          <ScrollArea className="h-32">
            <div className="space-y-1">
              {queueItems.map((q, i) => (
                <div
                  key={q.id}
                  className={`flex items-center justify-between text-xs px-2 py-1.5 rounded ${
                    i === currentIndex
                      ? "bg-primary/10 border border-primary/30 font-semibold"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-6">{i + 1}.</span>
                    <span className="text-foreground">{q.contact_name || q.phone_number}</span>
                  </div>
                  <Badge
                    variant={q.status === "completed" ? "default" : q.status === "queued" ? "secondary" : "outline"}
                    className="text-[10px] h-4"
                  >
                    {q.status}
                  </Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
