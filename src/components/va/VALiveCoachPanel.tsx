import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Mic, AlertTriangle, Lightbulb, Target, MessageCircle, WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface LiveCoachPanelProps {
  active: boolean;          // call connected
  callLogId: string | null;
  leadId?: string | null;
  leadName?: string;
  startedAt?: number;       // ms timestamp
}

interface Analysis {
  sentiment?: string;
  buyer_intent?: string;
  coaching_tip?: string;
  next_best_action?: string;
  objection_detected?: string | null;
  key_signal?: string;
}

// Web Speech API typing
type SR = any;

export function VALiveCoachPanel({ active, callLogId, leadId, leadName, startedAt }: LiveCoachPanelProps) {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [pending, setPending] = useState('');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [history, setHistory] = useState<Analysis[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'listening' | 'thinking' | 'error'>('idle');
  const recogRef = useRef<SR | null>(null);
  const cumulativeRef = useRef('');
  const lastSentRef = useRef('');
  const tickerRef = useRef<NodeJS.Timeout | null>(null);
  const activeRef = useRef(active);
  const retryAttemptRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { activeRef.current = active; }, [active]);

  // Non-blocking exponential back-off: 2s → 4s → 8s → 16s → 30s cap.
  // Scheduled via setTimeout so it never stalls the UI thread or thrashes the mic.
  const scheduleRestart = (rec: SR) => {
    if (retryTimerRef.current) return; // already pending
    const attempt = retryAttemptRef.current;
    const delayMs = Math.min(2000 * Math.pow(2, attempt), 30000);
    retryAttemptRef.current = attempt + 1;
    setErrorMsg(`Network drop — reconnecting in ${Math.round(delayMs / 1000)}s…`);
    setStatus('connecting');
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      if (!activeRef.current) return;
      try { rec.start(); } catch {}
    }, delayMs);
  };

  const resetBackoff = () => {
    retryAttemptRef.current = 0;
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  };

  useEffect(() => {
    const W: any = window;
    const SpeechRecognition = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSupported(false);
      return;
    }
    const rec: SR = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';

    rec.onresult = (event: any) => {
      let interim = '';
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) finalText += r[0].transcript + ' ';
        else interim += r[0].transcript;
      }
      if (finalText) {
        cumulativeRef.current += finalText;
        setTranscript(cumulativeRef.current);
        setPending('');
      } else {
        setPending(interim);
      }
    };
    rec.onerror = (e: any) => {
      console.warn('SpeechRecognition err', e?.error);
      if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') {
        setErrorMsg('Microphone permission denied. Enable mic access to use Live Coach.');
        setStatus('error');
        resetBackoff();
        return;
      }
      if (e?.error === 'network' || e?.error === 'audio-capture' || e?.error === 'aborted') {
        if (activeRef.current) scheduleRestart(rec);
        return;
      }
      // Unknown soft error — back off rather than tight-loop.
      if (activeRef.current) scheduleRestart(rec);
    };
    rec.onend = () => {
      if (activeRef.current) {
        // If a back-off is already pending, let it run; otherwise restart immediately.
        if (retryTimerRef.current) return;
        try { rec.start(); setStatus('listening'); } catch { scheduleRestart(rec); }
      } else {
        setListening(false);
        setStatus('idle');
      }
    };
    rec.onstart = () => {
      setListening(true);
      setStatus('listening');
      setErrorMsg(null);
      resetBackoff();
    };
    recogRef.current = rec;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Start/stop based on call active
  useEffect(() => {
    const rec = recogRef.current;
    if (!rec) return;
    if (active) {
      cumulativeRef.current = '';
      lastSentRef.current = '';
      setTranscript('');
      setPending('');
      setHistory([]);
      setAnalysis(null);
      setErrorMsg(null);
      setStatus('connecting');
      resetBackoff();
      try { rec.start(); } catch {}
    } else {
      resetBackoff();
      try { rec.stop(); } catch {}
      setListening(false);
      setStatus('idle');
    }
  }, [active]);


  // Analyzer ticker — every 6s send the new portion of the transcript
  useEffect(() => {
    if (!active) return;
    tickerRef.current = setInterval(async () => {
      const cumulative = cumulativeRef.current.trim();
      if (!cumulative) return;
      const sent = lastSentRef.current;
      if (cumulative === sent) return;
      const chunk = cumulative.slice(sent.length).trim();
      if (chunk.length < 12) return; // wait for meaningful content
      lastSentRef.current = cumulative;
      const duration = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;
      setAnalyzing(true);
      setStatus('thinking');
      try {
        const { data, error } = await supabase.functions.invoke('va-live-coach', {
          body: {
            callLogId,
            leadId,
            leadName,
            transcriptChunk: chunk,
            cumulativeTranscript: cumulative,
            durationSeconds: duration,
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        if (data?.analysis) {
          setAnalysis(data.analysis);
          setHistory(h => [data.analysis, ...h].slice(0, 8));
          setErrorMsg(null);
        }
        setStatus('listening');
      } catch (e: any) {
        console.warn('live-coach error', e);
        setErrorMsg(e?.message || 'Coach service temporarily unavailable. Retrying…');
        setStatus('error');
        // allow retry on next tick by rolling back lastSent
        lastSentRef.current = sent;
      } finally {
        setAnalyzing(false);
      }

    }, 6000);
    return () => { if (tickerRef.current) clearInterval(tickerRef.current); };
  }, [active, callLogId, leadId, leadName, startedAt]);

  if (!active) return null;

  const intentColor = (intent?: string) => {
    if (intent === 'hot') return 'bg-red-500/15 text-red-400 border-red-500/30';
    if (intent === 'warm') return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
  };
  const sentimentColor = (s?: string) => {
    if (s === 'positive') return 'text-emerald-400';
    if (s === 'negative') return 'text-red-400';
    return 'text-amber-400';
  };

  return (
    <div className="glass-card rounded-2xl border border-border/50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-cyan-400" />
          <span className="text-sm font-semibold">Claude Live Coach</span>
          {analyzing && <span className="text-[10px] text-cyan-400 animate-pulse">analyzing…</span>}
        </div>
        {supported ? (
          <Badge variant="outline" className={`text-[10px] gap-1 ${
            status === 'listening' ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' :
            status === 'thinking' ? 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10' :
            status === 'connecting' ? 'text-amber-400 border-amber-500/30 bg-amber-500/10 animate-pulse' :
            status === 'error' ? 'text-red-400 border-red-500/30 bg-red-500/10' :
            'text-muted-foreground'
          }`}>
            <Mic className="h-3 w-3" />
            {status === 'connecting' ? 'Connecting…' :
             status === 'thinking' ? 'Thinking…' :
             status === 'listening' ? 'Listening' :
             status === 'error' ? 'Reconnecting' : 'Idle'}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] gap-1 text-amber-400 border-amber-500/30">
            <WifiOff className="h-3 w-3" /> Speech API not supported (use Chrome)
          </Badge>
        )}
      </div>

      {errorMsg && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-200 flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {!supported && (
        <p className="text-xs text-muted-foreground">
          Live transcription requires a Chromium-based browser. Recordings are still saved server-side.
        </p>
      )}


      <AnimatePresence mode="wait">
        {analysis && (
          <motion.div
            key={analysis.coaching_tip}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-2"
          >
            <div className="flex gap-2 flex-wrap">
              {analysis.buyer_intent && (
                <Badge variant="outline" className={intentColor(analysis.buyer_intent)}>
                  intent: {analysis.buyer_intent}
                </Badge>
              )}
              {analysis.sentiment && (
                <Badge variant="outline" className={`bg-background/40 ${sentimentColor(analysis.sentiment)} border-border/40`}>
                  {analysis.sentiment}
                </Badge>
              )}
            </div>

            {analysis.coaching_tip && (
              <div className="rounded-xl bg-cyan-500/10 border border-cyan-500/30 p-3 flex gap-2">
                <Lightbulb className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                <p className="text-sm text-cyan-100 leading-snug">{analysis.coaching_tip}</p>
              </div>
            )}

            {analysis.next_best_action && (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 flex gap-2">
                <Target className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-emerald-400/80 mb-0.5">Say this</p>
                  <p className="text-sm text-emerald-100 leading-snug">"{analysis.next_best_action}"</p>
                </div>
              </div>
            )}

            {analysis.objection_detected && analysis.objection_detected !== 'null' && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-3 flex gap-2">
                <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-100">Objection: {analysis.objection_detected}</p>
              </div>
            )}

            {analysis.key_signal && (
              <p className="text-xs text-muted-foreground italic flex gap-1.5">
                <MessageCircle className="h-3 w-3 mt-0.5" /> {analysis.key_signal}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {(transcript || pending) && (
        <div className="border-t border-border/30 pt-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Live transcript</p>
          <p className="text-xs text-foreground/80 max-h-24 overflow-y-auto leading-relaxed">
            {transcript}
            {pending && <span className="text-muted-foreground italic"> {pending}</span>}
          </p>
        </div>
      )}

      {history.length > 1 && (
        <details className="border-t border-border/30 pt-2">
          <summary className="text-[10px] uppercase tracking-wide text-muted-foreground cursor-pointer">
            Coaching history ({history.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {history.slice(1).map((h, i) => (
              <li key={i} className="text-[11px] text-muted-foreground border-l-2 border-border/40 pl-2">
                {h.coaching_tip}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
