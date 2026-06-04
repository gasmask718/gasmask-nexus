import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { ArrowLeft, Mic, Square, Loader2, Volume2, Bot, User, Sparkles } from 'lucide-react';
import { runOwnerCommand } from '@/services/aiEngine';

/**
 * Owner Voice Console — mic → STT (ElevenLabs scribe_v2) → runOwnerCommand → TTS (ElevenLabs)
 * One command brain, two inputs (voice + text). Mobile-friendly: MediaRecorder works on
 * iOS Safari 14.5+ and modern Android browsers.
 *
 * STT path: ElevenLabs `scribe_v2` via supabase edge function `owner-voice-stt`.
 * Permissions: informational commands run directly; executable verbs are gated by
 * has_ai_permission() (see services/floor10/aiPermissionGuard.ts) — current Owner brain
 * responses are read-only/informational, so no permission check is required yet.
 */

type Phase = 'idle' | 'recording' | 'transcribing' | 'thinking' | 'speaking' | 'error';

export default function OwnerVoiceAI() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('idle');
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Recent history from owner_ai_commands
  const history = useQuery({
    queryKey: ['owner_ai_commands:recent'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('owner_ai_commands')
        .select('id, prompt, response, mode, created_at')
        .order('created_at', { ascending: false })
        .limit(15);
      if (error) throw error;
      return (data || []) as Array<{ id: string; prompt: string; response: string | null; mode: string; created_at: string }>;
    },
    refetchOnWindowFocus: false,
  });

  const cleanup = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const startRecording = useCallback(async () => {
    try {
      setTranscript('');
      setResponse('');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      // Let the browser pick the supported mime (webm/opus on Chrome/Android, mp4 on iOS).
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = handleStop;
      recorderRef.current = rec;
      rec.start();
      setPhase('recording');
    } catch (err) {
      console.error('[OwnerVoice] mic error', err);
      toast.error('Microphone access denied. Enable mic permission in browser settings.');
      setPhase('error');
    }
  }, []);

  const handleStop = useCallback(async () => {
    try {
      const mime = recorderRef.current?.mimeType || 'audio/webm';
      const blob = new Blob(chunksRef.current, { type: mime });
      cleanup();
      if (blob.size < 1000) {
        toast.error('No audio captured.');
        setPhase('idle');
        return;
      }

      // ── STT ───────────────────────────────────────────────────────────
      setPhase('transcribing');
      const form = new FormData();
      const ext = mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm';
      form.append('audio', blob, `command.${ext}`);
      const sttRes = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/owner-voice-stt`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
          body: form,
        },
      );
      if (!sttRes.ok) throw new Error(`STT ${sttRes.status}: ${await sttRes.text()}`);
      const { text } = await sttRes.json();
      if (!text || !text.trim()) {
        toast.error('Could not transcribe audio.');
        setPhase('idle');
        return;
      }
      setTranscript(text);

      // ── COMMAND BRAIN ────────────────────────────────────────────────
      setPhase('thinking');
      const result = await runOwnerCommand(text, { source: 'voice' }, 'voice');
      setResponse(result.response);

      // ── TTS ──────────────────────────────────────────────────────────
      setPhase('speaking');
      const ttsRes = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/owner-voice-tts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ text: result.response }),
        },
      );
      if (!ttsRes.ok) throw new Error(`TTS ${ttsRes.status}: ${await ttsRes.text()}`);
      const audioBlob = await ttsRes.blob();
      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { setPhase('idle'); URL.revokeObjectURL(url); };
      audio.onerror = () => { setPhase('idle'); URL.revokeObjectURL(url); };
      try { await audio.play(); } catch {
        toast.info('Tap the play button to hear the reply (browser blocked autoplay).');
        setPhase('idle');
      }
      history.refetch();
    } catch (err) {
      console.error('[OwnerVoice] roundtrip error', err);
      toast.error(`Voice round-trip failed: ${(err as Error).message}`);
      setPhase('error');
      setTimeout(() => setPhase('idle'), 1500);
    }
  }, [cleanup, history]);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
  }, []);

  const replay = useCallback(() => { audioRef.current?.play().catch(() => {}); }, []);

  const phaseLabel: Record<Phase, string> = {
    idle: 'Tap mic to speak',
    recording: 'Listening… tap to stop',
    transcribing: 'Transcribing (ElevenLabs Scribe v2)…',
    thinking: 'Thinking…',
    speaking: 'Speaking reply…',
    error: 'Error — try again',
  };

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/os/owner')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/10 border border-violet-500/30">
            <Mic className="h-6 w-6 text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Owner Voice Console</h1>
            <p className="text-sm text-muted-foreground">Speak to the empire — one command brain, two inputs</p>
          </div>
        </div>
        <Badge variant="outline" className="ml-auto bg-violet-500/10 text-violet-400 border-violet-500/30">
          <Sparkles className="h-3 w-3 mr-1" /> LIVE
        </Badge>
      </div>

      {/* Mic */}
      <Card className="rounded-2xl border-violet-500/30">
        <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4">
          <button
            onClick={phase === 'recording' ? stopRecording : startRecording}
            disabled={phase === 'transcribing' || phase === 'thinking' || phase === 'speaking'}
            className={`relative h-28 w-28 rounded-full flex items-center justify-center transition-all
              ${phase === 'recording'
                ? 'bg-red-500/20 border-2 border-red-500 animate-pulse'
                : 'bg-violet-500/15 border-2 border-violet-500/40 hover:bg-violet-500/25'}
              disabled:opacity-60 disabled:cursor-not-allowed`}
            aria-label={phase === 'recording' ? 'Stop recording' : 'Start recording'}
          >
            {phase === 'transcribing' || phase === 'thinking' || phase === 'speaking' ? (
              <Loader2 className="h-12 w-12 text-violet-400 animate-spin" />
            ) : phase === 'recording' ? (
              <Square className="h-10 w-10 text-red-400" />
            ) : (
              <Mic className="h-12 w-12 text-violet-400" />
            )}
          </button>
          <p className="text-sm text-muted-foreground">{phaseLabel[phase]}</p>
          {response && phase === 'idle' && (
            <Button variant="ghost" size="sm" onClick={replay}>
              <Volume2 className="h-4 w-4 mr-2" /> Replay last reply
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Live transcript / response */}
      {(transcript || response) && (
        <Card className="rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Current exchange</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {transcript && (
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/20"><User className="h-4 w-4 text-primary" /></div>
                <div className="flex-1"><p className="text-sm">{transcript}</p></div>
              </div>
            )}
            {response && (
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-violet-500/20"><Bot className="h-4 w-4 text-violet-400" /></div>
                <div className="flex-1"><p className="text-sm text-muted-foreground whitespace-pre-wrap">{response}</p></div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* History */}
      <Card className="rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent commands</CardTitle>
          <CardDescription className="text-xs">Voice + text both log to <code>owner_ai_commands</code></CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[280px] pr-3">
            <div className="space-y-3">
              {history.isLoading ? (
                <p className="text-xs text-muted-foreground">Loading…</p>
              ) : (history.data || []).length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No commands yet — say something.</p>
              ) : (
                (history.data || []).map((row) => (
                  <div key={row.id} className="p-3 rounded-lg border bg-card/50 space-y-1">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className={
                        row.mode === 'voice'
                          ? 'bg-violet-500/15 text-violet-400 border-violet-500/30 text-[10px]'
                          : 'bg-blue-500/15 text-blue-400 border-blue-500/30 text-[10px]'
                      }>{row.mode}</Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(row.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm font-medium">{row.prompt}</p>
                    {row.response && (
                      <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">{row.response}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
