import { useEffect, useRef, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import {
  Sparkles, Mic, AlertTriangle, Lightbulb, Target, MessageCircle,
  WifiOff, Search, Minimize2, Maximize2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  active: boolean;
  callLogId: string | null;
  leadId?: string | null;
  leadName?: string;
  startedAt?: number;
}

interface Analysis {
  sentiment?: string;
  buyer_intent?: string;
  coaching_tip?: string;
  next_best_action?: string;
  objection_detected?: string | null;
  key_signal?: string;
}

type SR = any;

export function VALiveAnalysisModal({ active, callLogId, leadId, leadName, startedAt }: Props) {
  const [open, setOpen] = useState(false);
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [pending, setPending] = useState('');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [history, setHistory] = useState<Analysis[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [scriptQuery, setScriptQuery] = useState('');
  const recogRef = useRef<SR | null>(null);
  const cumulativeRef = useRef('');
  const lastSentRef = useRef('');
  const tickerRef = useRef<NodeJS.Timeout | null>(null);
  const inFlightRef = useRef(false);

  // Auto open when call connects
  useEffect(() => { if (active) setOpen(true); else setOpen(false); }, [active]);

  // Setup recognizer
  useEffect(() => {
    const W: any = window;
    const SpeechRecognition = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!SpeechRecognition) { setSupported(false); return; }
    const rec: SR = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.onresult = (e: any) => {
      let interim = ''; let finalText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript + ' ';
        else interim += r[0].transcript;
      }
      if (finalText) {
        cumulativeRef.current += finalText;
        setTranscript(cumulativeRef.current);
        setPending('');
      } else setPending(interim);
    };
    rec.onerror = (e: any) => {
      if (active && e?.error !== 'not-allowed') { try { rec.start(); } catch {} }
    };
    rec.onend = () => { if (active) { try { rec.start(); } catch {} } else setListening(false); };
    recogRef.current = rec;
  }, []);

  useEffect(() => {
    const rec = recogRef.current; if (!rec) return;
    if (active) {
      cumulativeRef.current = ''; lastSentRef.current = '';
      setTranscript(''); setPending(''); setHistory([]); setAnalysis(null);
      try { rec.start(); setListening(true); } catch { }
    } else {
      try { rec.stop(); } catch { }
      setListening(false);
    }
  }, [active]);

  // Fast analyzer loop — 2.5s tick to keep dead air down
  useEffect(() => {
    if (!active) return;
    tickerRef.current = setInterval(async () => {
      if (inFlightRef.current) return;
      const cumulative = cumulativeRef.current.trim();
      if (!cumulative) return;
      const sent = lastSentRef.current;
      if (cumulative === sent) return;
      const chunk = cumulative.slice(sent.length).trim();
      if (chunk.length < 6) return;
      lastSentRef.current = cumulative;
      const duration = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;
      inFlightRef.current = true;
      setAnalyzing(true);
      try {
        const { data, error } = await supabase.functions.invoke('va-live-coach', {
          body: {
            callLogId, leadId, leadName,
            transcriptChunk: chunk,
            cumulativeTranscript: cumulative.slice(-2400),
            durationSeconds: duration,
          },
        });
        if (error) throw error;
        if (data?.analysis) {
          setAnalysis(data.analysis);
          setHistory(h => [data.analysis, ...h].slice(0, 12));
        }
      } catch (e) { console.warn('live-coach error', e); }
      finally { setAnalyzing(false); inFlightRef.current = false; }
    }, 2500);
    return () => { if (tickerRef.current) clearInterval(tickerRef.current); };
  }, [active, callLogId, leadId, leadName, startedAt]);

  // Script search
  const { data: scripts = [] } = useQuery({
    queryKey: ['brandaro-script-steps-modal'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('brandaro_sales_script_steps')
        .select('*').eq('is_active', true).order('step_number');
      return data || [];
    },
    enabled: active,
  });

  const filteredScripts = useMemo(() => {
    const q = scriptQuery.trim().toLowerCase();
    if (!q) return scripts;
    return (scripts as any[]).filter(s =>
      [s.step_name, s.display_label, s.va_says, s.coaching_tip]
        .filter(Boolean).join(' ').toLowerCase().includes(q));
  }, [scriptQuery, scripts]);

  const intentColor = (i?: string) =>
    i === 'hot' ? 'bg-red-500/15 text-red-300 border-red-500/30'
      : i === 'warm' ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
        : 'bg-blue-500/15 text-blue-300 border-blue-500/30';
  const sentimentColor = (s?: string) =>
    s === 'positive' ? 'text-emerald-400' : s === 'negative' ? 'text-red-400' : 'text-amber-300';

  if (!active) return null;

  return (
    <>
      {/* Floating reopen pill when minimized */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-4 left-4 z-[60] flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-600/90 hover:bg-cyan-500 text-white text-sm shadow-2xl shadow-cyan-500/30 border border-cyan-400/40"
        >
          <Sparkles className="h-4 w-4" /> Live AI Coach
          {analyzing && <span className="text-[10px] animate-pulse">analyzing…</span>}
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl bg-slate-950 text-white border-cyan-500/30 max-h-[88vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="p-5 pb-3 border-b border-slate-800">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-cyan-400" />
                Claude Live Call Analysis
                {leadName && <span className="text-cyan-300 font-normal text-sm">— {leadName}</span>}
              </DialogTitle>
              <div className="flex items-center gap-2">
                {supported ? (
                  <Badge variant="outline" className={`text-[10px] gap-1 ${listening ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : 'text-muted-foreground'}`}>
                    <Mic className="h-3 w-3" /> {listening ? 'Listening' : 'Idle'}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] gap-1 text-amber-400 border-amber-500/30">
                    <WifiOff className="h-3 w-3" /> Use Chrome
                  </Badge>
                )}
                {analyzing && <span className="text-[10px] text-cyan-400 animate-pulse">analyzing…</span>}
                <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-white" onClick={() => setOpen(false)}>
                  <Minimize2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <DialogDescription className="text-slate-500 text-xs">
              Real-time guidance from Claude. Updates every ~2.5s based on what's being said.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="coach" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="mx-5 mt-2 bg-slate-900/60">
              <TabsTrigger value="coach" className="text-xs">Live Coach</TabsTrigger>
              <TabsTrigger value="scripts" className="text-xs">
                <Search className="h-3 w-3 mr-1" /> Script Search
              </TabsTrigger>
              <TabsTrigger value="transcript" className="text-xs">Transcript</TabsTrigger>
            </TabsList>

            {/* COACH */}
            <TabsContent value="coach" className="flex-1 overflow-y-auto px-5 pb-5 mt-3 space-y-3">
              <AnimatePresence mode="wait">
                {analysis ? (
                  <motion.div
                    key={analysis.coaching_tip}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="space-y-2.5"
                  >
                    <div className="flex gap-2 flex-wrap">
                      {analysis.buyer_intent && (
                        <Badge variant="outline" className={intentColor(analysis.buyer_intent)}>
                          intent: {analysis.buyer_intent}
                        </Badge>
                      )}
                      {analysis.sentiment && (
                        <Badge variant="outline" className={`bg-slate-900/60 ${sentimentColor(analysis.sentiment)} border-slate-700`}>
                          {analysis.sentiment}
                        </Badge>
                      )}
                    </div>

                    {analysis.next_best_action && (
                      <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 flex gap-3">
                        <Target className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-emerald-400/80 mb-1">Say this NOW</p>
                          <p className="text-base text-emerald-50 leading-snug font-medium">"{analysis.next_best_action}"</p>
                        </div>
                      </div>
                    )}

                    {analysis.coaching_tip && (
                      <div className="rounded-xl bg-cyan-500/10 border border-cyan-500/30 p-3 flex gap-2">
                        <Lightbulb className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                        <p className="text-sm text-cyan-100 leading-snug">{analysis.coaching_tip}</p>
                      </div>
                    )}

                    {analysis.objection_detected && analysis.objection_detected !== 'null' && (
                      <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-3 flex gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                        <p className="text-sm text-red-100">Objection: {analysis.objection_detected}</p>
                      </div>
                    )}

                    {analysis.key_signal && (
                      <p className="text-xs text-slate-400 italic flex gap-1.5">
                        <MessageCircle className="h-3 w-3 mt-0.5" /> {analysis.key_signal}
                      </p>
                    )}
                  </motion.div>
                ) : (
                  <div className="text-center py-10 text-slate-500 text-sm">
                    <Sparkles className="h-6 w-6 mx-auto mb-2 text-cyan-500/40" />
                    Waiting for conversation… Claude will start guiding once you start speaking.
                  </div>
                )}
              </AnimatePresence>

              {history.length > 1 && (
                <div className="border-t border-slate-800 pt-3">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">Recent guidance</p>
                  <ul className="space-y-1.5">
                    {history.slice(1).map((h, i) => (
                      <li key={i} className="text-xs text-slate-400 border-l-2 border-cyan-500/30 pl-2">
                        {h.coaching_tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </TabsContent>

            {/* SCRIPTS */}
            <TabsContent value="scripts" className="flex-1 overflow-y-auto px-5 pb-5 mt-3 space-y-3">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <Input
                  value={scriptQuery}
                  onChange={(e) => setScriptQuery(e.target.value)}
                  placeholder="Search scripts (e.g. 'price', 'voicemail', 'gatekeeper')…"
                  className="pl-9 bg-slate-900 border-slate-700 text-white"
                  autoFocus
                />
              </div>
              {filteredScripts.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">No scripts match "{scriptQuery}"</p>
              ) : (
                <div className="space-y-2">
                  {filteredScripts.map((s: any) => (
                    <div key={s.id} className="bg-slate-900/60 rounded-lg p-3 border border-slate-800">
                      <p className="text-[10px] font-bold text-cyan-400 uppercase mb-1.5">
                        Step {s.step_number} — {s.display_label || s.step_name}
                      </p>
                      <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{s.va_says}</p>
                      {s.coaching_tip && (
                        <p className="text-[11px] text-amber-300/80 italic border-l-2 border-amber-500/40 pl-2 mt-2">
                          💡 {s.coaching_tip}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* TRANSCRIPT */}
            <TabsContent value="transcript" className="flex-1 overflow-y-auto px-5 pb-5 mt-3">
              {(transcript || pending) ? (
                <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                  {transcript}
                  {pending && <span className="text-slate-500 italic"> {pending}</span>}
                </p>
              ) : (
                <p className="text-xs text-slate-500 text-center py-10">Listening for speech…</p>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
