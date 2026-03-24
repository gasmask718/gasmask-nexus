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
  ArrowRightLeft,
  Bot,
  UserCheck,
  Loader2,
  PanelRightOpen,
  PanelRightClose,
} from "lucide-react";
import { useVoiceDevice } from "@/contexts/VoiceDeviceProvider";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TransferStatusPanel } from "./TransferStatusPanel";

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
  const [activeCallSid, setActiveCallSid] = useState<string | null>(null);
  const [showTransferPicker, setShowTransferPicker] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [showTransferPanel, setShowTransferPanel] = useState(false);
  const [selectedTransferAgent, setSelectedTransferAgent] = useState<{ id: string; name: string } | null>(null);

  // Fetch available ElevenLabs agents for transfer
  const { data: transferAgents = [] } = useQuery({
    queryKey: ["elevenlabs-agents-transfer"],
    queryFn: async () => {
      const { data } = await supabase
        .from("elevenlabs_agents")
        .select("id, agent_name, elevenlabs_agent_id, script_label, agent_description, is_active")
        .eq("is_active", true)
        .order("sort_order");
      return (data || []) as Array<{
        id: string;
        agent_name: string;
        elevenlabs_agent_id: string | null;
        script_label: string;
        agent_description: string | null;
        is_active: boolean;
      }>;
    },
    enabled: open,
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const currentCallSidRef = useRef<string | null>(null);
  const remoteRecorderRef = useRef<MediaRecorder | null>(null);
  const remoteChunksRef = useRef<Blob[]>([]);
  const transcribeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sidResolveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    (q) => q.status === "completed" || q.status === "failed" || q.status === "no_answer" || q.status === "transferred"
  ).length;

  const isOnCall =
    !isTransferring &&
    (Boolean(device.activeCall) ||
    ["connecting", "ringing", "in-progress", "reconnecting"].includes(device.callStatus));

  // Fetch DB transcripts for current call
  const currentCallSid = activeCallSid || currentItem?.twilio_call_sid || null;

  useEffect(() => {
    currentCallSidRef.current = currentCallSid;
  }, [currentCallSid]);

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
    enabled: open && !!currentCallSid,
    refetchInterval: isOnCall ? 1000 : 3000,
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

  // Realtime inserts for near-instant transcript updates
  useEffect(() => {
    if (!open || !currentCallSid) return;

    const channel = supabase
      .channel(`manual-call-transcripts-${currentCallSid}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "live_call_transcripts",
          filter: `call_sid=eq.${currentCallSid}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["manual-call-transcripts", currentCallSid] });
          queryClient.invalidateQueries({ queryKey: ["campaign-transcripts"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, currentCallSid, queryClient]);

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
        if (event.error !== "not-allowed" && event.error !== "service-not-allowed") {
          setTimeout(() => {
            try { recognition.start(); } catch { /* already running */ }
          }, 500);
        }
      };

      recognition.onend = () => {
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

  const stopSidResolution = useCallback(() => {
    if (sidResolveIntervalRef.current) {
      clearInterval(sidResolveIntervalRef.current);
      sidResolveIntervalRef.current = null;
    }
  }, []);

  const persistCallSid = useCallback(
    async (rawSid: string | null | undefined, queueItemId?: string) => {
      const sid = rawSid?.trim();
      if (!sid || sid.startsWith("browser-") || sid === currentCallSidRef.current) return;

      currentCallSidRef.current = sid;
      setActiveCallSid(sid);

      if (queueItemId) {
        await supabase
          .from("outbound_call_queue")
          .update({ twilio_call_sid: sid, updated_at: new Date().toISOString() })
          .eq("id", queueItemId);
        refetchQueue();
      }
    },
    [refetchQueue]
  );

  const transcribeRemoteBlob = useCallback(
    async (blob: Blob) => {
      if (blob.size < 1200) return;

      try {
        const arrayBuffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = "";
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
        }

        const { data, error } = await supabase.functions.invoke("transcribe-call-audio", {
          body: {
            audio_base64: btoa(binary),
            call_sid: currentCallSidRef.current,
            queue_item_id: currentItem?.id,
            mime_type: blob.type || "audio/webm",
          },
        });

        if (error) throw error;

        if (data?.text && !data?.skipped) {
          setLocalTranscripts((prev) => [
            ...prev,
            { speaker: "caller", text: data.text, timestamp: new Date() },
          ]);
          if (currentCallSidRef.current) {
            queryClient.invalidateQueries({ queryKey: ["manual-call-transcripts", currentCallSidRef.current] });
          }
          queryClient.invalidateQueries({ queryKey: ["campaign-transcripts"] });
        }
      } catch (err) {
        console.warn("Remote transcription chunk failed:", err);
      }
    },
    [currentItem?.id, queryClient]
  );

  const startRemoteRecorder = useCallback(
    (remoteStream: MediaStream) => {
      if (remoteRecorderRef.current || remoteStream.getAudioTracks().length === 0) return;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(remoteStream, { mimeType });
      remoteRecorderRef.current = recorder;
      remoteChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) remoteChunksRef.current.push(e.data);
      };

      recorder.start(2000);

      transcribeIntervalRef.current = setInterval(() => {
        const chunks = [...remoteChunksRef.current];
        if (chunks.length === 0) return;

        remoteChunksRef.current = [];
        void transcribeRemoteBlob(new Blob(chunks, { type: mimeType }));
      }, 2500);
    },
    [transcribeRemoteBlob]
  );

  const startRemoteAudioCapture = useCallback(
    (call: any) => {
      try {
        call.on?.("audio", (audioElement: HTMLAudioElement) => {
          const audioWithCapture = audioElement as HTMLAudioElement & {
            captureStream?: () => MediaStream;
            mozCaptureStream?: () => MediaStream;
          };
          const stream = audioWithCapture.captureStream?.() || audioWithCapture.mozCaptureStream?.();

          if (stream?.getAudioTracks().length) {
            console.log("🔊 Remote audio captured from Twilio audio element");
            startRemoteRecorder(stream);
          }
        });
      } catch (err) {
        console.warn("Audio element capture hook failed, will use peer connection fallback", err);
      }

      // Retry PeerConnection extraction multiple times
      let attempts = 0;
      const tryCapture = () => {
        if (remoteRecorderRef.current) return; // already capturing
        attempts++;

        const pc =
          call?._mediaHandler?._peerConnection ||
          call?.mediaStream?._peerConnection ||
          call?._peerConnection;

        const receivers = pc?.getReceivers?.() || [];
        const remoteTracks = receivers
          .filter((r: RTCRtpReceiver) => r.track && r.track.kind === "audio")
          .map((r: RTCRtpReceiver) => r.track);

        if (remoteTracks.length > 0) {
          console.log("🔊 Remote audio captured from peer connection");
          startRemoteRecorder(new MediaStream(remoteTracks));
        } else if (attempts < 10) {
          setTimeout(tryCapture, 500);
        } else {
          console.warn("No remote audio tracks found after 10 attempts — relying on Twilio server-side recording");
        }
      };

      setTimeout(tryCapture, 800);
    },
    [startRemoteRecorder]
  );

  const stopRemoteAudioCapture = useCallback(() => {
    if (transcribeIntervalRef.current) {
      clearInterval(transcribeIntervalRef.current);
      transcribeIntervalRef.current = null;
    }

    const bufferedChunks = [...remoteChunksRef.current];
    remoteChunksRef.current = [];

    if (remoteRecorderRef.current) {
      try {
        if (remoteRecorderRef.current.state !== "inactive") {
          remoteRecorderRef.current.stop();
        }
      } catch {
        // noop
      }
      remoteRecorderRef.current = null;
    }

    if (bufferedChunks.length > 0) {
      void transcribeRemoteBlob(new Blob(bufferedChunks, { type: bufferedChunks[0]?.type || "audio/webm" }));
    }

    console.log("🔊 Remote audio capture stopped");
  }, [transcribeRemoteBlob]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // ── Start Twilio server-side recording ──
  const startServerRecording = useCallback(async (callSid: string) => {
    try {
      const { error } = await supabase.functions.invoke("start-call-recording", {
        body: { call_sid: callSid },
      });
      if (error) throw error;
      console.log("🎙️ Server-side Twilio recording started for", callSid);
    } catch (e) {
      console.warn("Failed to start server recording (will retry on call end via Twilio):", e);
    }
  }, []);

  const dialCurrent = useCallback(async () => {
    if (!currentItem || currentItem.status !== "queued") {
      toast.error("No queued number to dial");
      return;
    }
    if (isOnCall || isDialing) {
      toast.error("Finish the current call before dialing another");
      return;
    }
    if (!device.isReady) {
      toast.error("Voice device not ready. Check microphone permissions.");
      return;
    }

    setIsDialing(true);
    setLocalTranscripts([]);
    setInterimText("");
    setActiveCallSid(null);
    currentCallSidRef.current = null;
    stopSidResolution();

    try {
      await supabase
        .from("outbound_call_queue")
        .update({ status: "dialing", dialing_started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", currentItem.id);

      const call = await device.makeCall(currentItem.phone_number);
      if (!call) throw new Error("Call failed to initialize");

      setCallStartedAt(new Date());
      toast.success(`Dialing ${currentItem.contact_name || currentItem.phone_number}...`);

      const tryResolveSid = () => {
        const sid = (call as any)?.parameters?.CallSid?.toString?.().trim?.();
        if (!sid) return false;
        void persistCallSid(sid, currentItem.id);
        return true;
      };

      if (!tryResolveSid()) {
        sidResolveIntervalRef.current = setInterval(() => {
          if (tryResolveSid()) stopSidResolution();
        }, 300);
        setTimeout(() => stopSidResolution(), 10000);
      }

      call.on("ringing", () => {
        void tryResolveSid();
      });

      call.on("accept", () => {
        void tryResolveSid();
        supabase
          .from("outbound_call_queue")
          .update({ status: "connected", updated_at: new Date().toISOString() })
          .eq("id", currentItem.id)
          .then(() => refetchQueue());

        startSpeechRecognition();
        startRemoteAudioCapture(call);

        // Start server-side Twilio recording for reliable remote transcripts
        setTimeout(() => {
          const sid = (call as any)?.parameters?.CallSid?.toString?.().trim?.();
          if (sid) {
            void startServerRecording(sid);
          }
        }, 1500);
      });

      const handleTerminal = (status: "completed" | "no_answer" | "failed") => {
        stopSidResolution();
        stopSpeechRecognition();
        stopRemoteAudioCapture();
        currentCallSidRef.current = null;
        supabase
          .from("outbound_call_queue")
          .update({ status, updated_at: new Date().toISOString() })
          .eq("id", currentItem.id)
          .then(() => {
            refetchQueue();
            queryClient.invalidateQueries({ queryKey: ["campaign-calls", campaignId] });
            queryClient.invalidateQueries({ queryKey: ["campaign-transcripts", campaignId] });
          });
        setCallStartedAt(null);
        setIsDialing(false);
      };

      call.on("disconnect", () => handleTerminal("completed"));
      call.on("cancel", () => handleTerminal("no_answer"));
      call.on("reject", () => handleTerminal("failed"));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to dial: ${message}`);
      await supabase
        .from("outbound_call_queue")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", currentItem.id);
      stopSidResolution();
      setIsDialing(false);
      setCallStartedAt(null);
      currentCallSidRef.current = null;
      refetchQueue();
    }
  }, [
    campaignId,
    currentItem,
    device,
    isDialing,
    isOnCall,
    persistCallSid,
    queryClient,
    refetchQueue,
    startRemoteAudioCapture,
    startServerRecording,
    startSpeechRecognition,
    stopRemoteAudioCapture,
    stopSidResolution,
    stopSpeechRecognition,
  ]);

  const endCall = useCallback(() => {
    stopSidResolution();
    stopSpeechRecognition();
    stopRemoteAudioCapture();

    if (device.activeCall) {
      device.hangUp();
    }

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
  }, [
    campaignId,
    currentItem,
    device,
    queryClient,
    refetchQueue,
    stopRemoteAudioCapture,
    stopSidResolution,
    stopSpeechRecognition,
  ]);

  const handleTransfer = useCallback(async (transferType: "elevenlabs" | "human", agentOverride?: { id: string; name: string }) => {
    const sid = currentCallSidRef.current || activeCallSid;
    if (!sid) {
      toast.error("No active call to transfer");
      return;
    }

    setIsTransferring(true);
    setShowTransferPicker(false);
    setSelectedTransferAgent(null);

    const agent = agentOverride || selectedTransferAgent;

    try {
      const { data, error } = await supabase.functions.invoke("transfer-campaign-call", {
        body: {
          call_sid: sid,
          transfer_type: transferType,
          queue_item_id: currentItem?.id,
          campaign_id: campaignId,
          ...(transferType === "elevenlabs" && agent ? {
            agent_id: agent.id,
            agent_name: agent.name,
          } : {}),
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const agentLabel = transferType === "elevenlabs" 
        ? `AI Agent (${agent?.name || "Default"})` 
        : "Human Agent";
      toast.success(`Call transferred to ${agentLabel}`);

      // Show the transfer panel so user can monitor
      setShowTransferPanel(true);

      // Disconnect local call leg — the edge function already created a
      // new outbound call to the recipient for ElevenLabs transfers,
      // so we just need to clean up the browser side.
      stopSpeechRecognition();
      stopRemoteAudioCapture();
      if (device.activeCall) device.hangUp();

      // Track the new AI call SID if returned (for transcript monitoring)
      if (data?.new_call_sid) {
        setActiveCallSid(data.new_call_sid);
        currentCallSidRef.current = data.new_call_sid;
      } else {
        currentCallSidRef.current = null;
        setActiveCallSid(null);
      }
      setCallStartedAt(null);
      setIsDialing(false);
      setIsTransferring(false);

      // Auto-advance to next queued number
      refetchQueue();
      queryClient.invalidateQueries({ queryKey: ["campaign-calls", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["campaign-transcripts", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["transferred-calls", campaignId] });

      const nextQueued = queueItems.findIndex((q, i) => i > currentIndex && q.status === "queued");
      if (nextQueued >= 0) {
        setCurrentIndex(nextQueued);
        setLocalTranscripts([]);
        setActiveCallSid(null);
        setInterimText("");
      } else {
        toast.info("No more numbers in queue");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Transfer failed: ${message}`);
      setIsTransferring(false);
    }
  }, [activeCallSid, campaignId, currentIndex, currentItem?.id, device, queryClient, queueItems, refetchQueue, stopRemoteAudioCapture, stopSpeechRecognition, selectedTransferAgent]);

  const skipToNext = useCallback(() => {
    if (isDialing || isOnCall) {
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

    stopSidResolution();
    currentCallSidRef.current = null;
    setActiveCallSid(null);
    setInterimText("");
    setLocalTranscripts([]);

    const nextQueued = queueItems.findIndex((q, i) => i > currentIndex && q.status === "queued");
    if (nextQueued >= 0) {
      setCurrentIndex(nextQueued);
    } else {
      toast.info("No more numbers in queue");
    }
  }, [currentIndex, currentItem, isDialing, isOnCall, queueItems, refetchQueue, stopSidResolution]);

  const handleClose = (next: boolean) => {
    if (isDialing || isOnCall) {
      toast.error("End the current call before closing");
      return;
    }
    stopSidResolution();
    stopSpeechRecognition();
    stopRemoteAudioCapture();
    currentCallSidRef.current = null;
    setActiveCallSid(null);
    setInterimText("");
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
      speaker: t.speaker === "human" || t.speaker === "user" ? ("you" as const) : ("caller" as const),
      text: t.text,
      time: new Date(t.created_at),
      source: "db" as const,
    })),
  ]
    .filter((t, i, arr) => {
      if (t.source === "local") {
        return !arr.some((o) => o.source === "db" && o.text === t.text);
      }
      return true;
    })
    .sort((a, b) => a.time.getTime() - b.time.getTime());

  const progressPct = totalItems > 0 ? (completedCount / totalItems) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={`max-h-[90vh] flex ${showTransferPanel ? "sm:max-w-3xl" : "sm:max-w-xl"}`}>
        {/* Main call area */}
        <div className="flex-1 flex flex-col min-w-0">
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
              {/* Transfer panel toggle */}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs gap-1 ml-auto"
                onClick={() => setShowTransferPanel(!showTransferPanel)}
              >
                {showTransferPanel ? (
                  <PanelRightClose className="h-3.5 w-3.5" />
                ) : (
                  <PanelRightOpen className="h-3.5 w-3.5" />
                )}
                Transfers
              </Button>
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
                  onClick={() => setShowTransferPicker(true)}
                  variant="outline"
                  size="lg"
                  className="gap-2"
                  disabled={isTransferring}
                >
                  {isTransferring ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
                  {isTransferring ? "Transferring..." : "Transfer"}
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

          {/* Transfer Picker */}
          {showTransferPicker && (
            <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
              <p className="text-sm font-semibold text-foreground">Transfer call to:</p>
              
              {/* AI Agent Selection */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">AI Agents</p>
                <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto">
                  {transferAgents.length > 0 ? transferAgents.map((agent) => (
                    <Button
                      key={agent.id}
                      variant="outline"
                      className="h-auto flex items-start gap-2 py-2 px-3 hover:border-primary text-left justify-start"
                      onClick={() => handleTransfer("elevenlabs", {
                        id: agent.elevenlabs_agent_id || "",
                        name: agent.agent_name,
                      })}
                      disabled={isTransferring || !agent.elevenlabs_agent_id}
                    >
                      <Bot className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-xs font-semibold block truncate">{agent.agent_name}</span>
                        <span className="text-[10px] text-muted-foreground block truncate">{agent.script_label}</span>
                        {!agent.elevenlabs_agent_id && (
                          <span className="text-[10px] text-destructive block">⚠ No Agent ID configured</span>
                        )}
                      </div>
                    </Button>
                  )) : (
                    <p className="text-xs text-muted-foreground italic px-2">No AI agents configured</p>
                  )}
                </div>
              </div>

              {/* Human Agent */}
              <div className="space-y-2 border-t pt-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Human</p>
                <Button
                  variant="outline"
                  className="w-full h-auto flex items-center gap-2 py-2 hover:border-primary justify-start"
                  onClick={() => handleTransfer("human")}
                  disabled={isTransferring}
                >
                  <UserCheck className="h-4 w-4 text-primary" />
                  <div>
                    <span className="text-xs font-semibold">Human Agent</span>
                    <span className="text-[10px] text-muted-foreground block">Google Voice</span>
                  </div>
                </Button>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => setShowTransferPicker(false)}
              >
                Cancel
              </Button>
            </div>
          )}

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
        </div>

        {/* Transfer Status Sidebar */}
        {showTransferPanel && (
          <TransferStatusPanel campaignId={campaignId} />
        )}
      </DialogContent>
    </Dialog>
  );
}
