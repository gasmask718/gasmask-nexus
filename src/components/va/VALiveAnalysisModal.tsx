import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery } from '@tanstack/react-query';
import {
  Sparkles, AlertTriangle, Lightbulb, Target, MessageCircle,
  Search, Minimize2, Maximize2, Send, Zap,
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

const QUICK_PROMPTS = [
  { label: 'Said too expensive', text: 'Prospect said the price is too expensive.' },
  { label: 'Asked for callback', text: 'Prospect asked us to call back later.' },
  { label: 'Gatekeeper blocked', text: 'Gatekeeper / receptionist will not put me through to the decision maker.' },
  { label: 'Not interested', text: 'Prospect said they are not interested.' },
  { label: 'Wants more info', text: 'Prospect wants more information sent by email.' },
  { label: 'Decision maker on line', text: 'Decision maker / owner just got on the line.' },
  { label: 'Going to think about it', text: 'Prospect said they need to think about it.' },
  { label: 'Already has solution', text: 'Prospect said they already work with a competitor.' },
];

export function VALiveAnalysisModal({ active, callLogId, leadId, leadName, startedAt }: Props) {
  const [open, setOpen] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [snippet, setSnippet] = useState('');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [history, setHistory] = useState<Analysis[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [scriptQuery, setScriptQuery] = useState('');
  const inFlightRef = useRef(false);

  // Auto open when call connects, reset state
  useEffect(() => {
    if (active) {
      setOpen(true);
      setTranscript(''); setSnippet(''); setAnalysis(null); setHistory([]);
    } else {
      setOpen(false);
    }
  }, [active]);

  const askClaude = useCallback(async (text: string) => {
    const chunk = text.trim();
    if (!chunk || inFlightRef.current) return;
    const next = (transcript ? transcript + '\n' : '') + chunk;
    setTranscript(next);
    setSnippet('');
    inFlightRef.current = true;
    setAnalyzing(true);
    try {
      const duration = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;
      const { data, error } = await supabase.functions.invoke('va-live-coach', {
        body: {
          callLogId, leadId, leadName,
          transcriptChunk: chunk,
          cumulativeTranscript: next.slice(-2400),
          durationSeconds: duration,
        },
      });
      if (error) throw error;
      if (data?.analysis) {
        setAnalysis(data.analysis);
        setHistory(h => [data.analysis, ...h].slice(0, 12));
      }
    } catch (e) {
      console.warn('live-coach error', e);
    } finally {
      setAnalyzing(false);
      inFlightRef.current = false;
    }
  }, [transcript, callLogId, leadId, leadName, startedAt]);

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
          {analyzing && <span className="text-[10px] animate-pulse">thinking…</span>}
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen} modal={false}>
        <DialogContent
          className="max-w-4xl w-[min(96vw,1024px)] bg-slate-950 text-white border-cyan-500/30 max-h-[88vh] p-0 gap-0 flex flex-col overflow-hidden"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader className="px-5 py-3 border-b border-slate-800 shrink-0">
            <div className="flex items-center justify-between gap-3">
              <DialogTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-5 w-5 text-cyan-400" />
                Live AI Coach
                {leadName && <span className="text-cyan-300 font-normal text-sm">— {leadName}</span>}
              </DialogTitle>
              <div className="flex items-center gap-2">
                {analyzing && (
                  <Badge variant="outline" className="text-[10px] gap-1 text-cyan-400 border-cyan-500/30 bg-cyan-500/10 animate-pulse">
                    <Zap className="h-3 w-3" /> analyzing
                  </Badge>
                )}
                <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-white" onClick={() => setOpen(false)}>
                  <Minimize2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <DialogDescription className="text-slate-500 text-xs mt-0.5">
              Type what was just said or tap a quick prompt — Claude responds in ~1s with what to say next.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="coach" className="flex-1 flex flex-col overflow-hidden min-h-0">
            <TabsList className="mx-5 mt-3 bg-slate-900/60 shrink-0 self-start">
              <TabsTrigger value="coach" className="text-xs">Live Coach</TabsTrigger>
              <TabsTrigger value="scripts" className="text-xs">
                <Search className="h-3 w-3 mr-1" /> Scripts
              </TabsTrigger>
              <TabsTrigger value="transcript" className="text-xs">Notes</TabsTrigger>
            </TabsList>

            {/* COACH */}
            <TabsContent value="coach" className="flex-1 overflow-hidden mt-3 px-5 pb-4 data-[state=inactive]:hidden flex flex-col min-h-0">
              {/* Top: Live suggestion */}
              <ScrollArea className="flex-1 pr-2 -mr-2">
                <AnimatePresence mode="wait">
                  {analysis ? (
                    <motion.div
                      key={analysis.next_best_action || analysis.coaching_tip}
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
                    <div className="text-center py-8 text-slate-500 text-sm">
                      <Sparkles className="h-6 w-6 mx-auto mb-2 text-cyan-500/40" />
                      Tap a quick prompt below or type what the prospect just said.
                    </div>
                  )}
                </AnimatePresence>

                {history.length > 1 && (
                  <div className="border-t border-slate-800 pt-3 mt-4">
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
              </ScrollArea>

              {/* Bottom: Quick prompts + input */}
              <div className="shrink-0 mt-3 pt-3 border-t border-slate-800 space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_PROMPTS.map((q) => (
                    <button
                      key={q.label}
                      onClick={() => askClaude(q.text)}
                      disabled={analyzing}
                      className="text-[11px] px-2.5 py-1 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 disabled:opacity-50 transition-colors"
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Textarea
                    value={snippet}
                    onChange={(e) => setSnippet(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        askClaude(snippet);
                      }
                    }}
                    placeholder='What did they just say? e.g. "I already have a website I built myself"'
                    rows={2}
                    className="bg-slate-900 border-slate-700 text-sm text-white resize-none min-h-[44px]"
                  />
                  <Button
                    onClick={() => askClaude(snippet)}
                    disabled={!snippet.trim() || analyzing}
                    className="bg-cyan-600 hover:bg-cyan-500 self-stretch px-3"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* SCRIPTS */}
            <TabsContent value="scripts" className="flex-1 overflow-hidden mt-3 px-5 pb-5 data-[state=inactive]:hidden flex flex-col min-h-0">
              <div className="relative shrink-0">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <Input
                  value={scriptQuery}
                  onChange={(e) => setScriptQuery(e.target.value)}
                  placeholder="Search scripts (e.g. 'price', 'voicemail', 'gatekeeper')…"
                  className="pl-9 bg-slate-900 border-slate-700 text-white"
                />
              </div>
              <ScrollArea className="flex-1 mt-3 pr-2 -mr-2">
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
              </ScrollArea>
            </TabsContent>

            {/* TRANSCRIPT / NOTES */}
            <TabsContent value="transcript" className="flex-1 overflow-hidden mt-3 px-5 pb-5 data-[state=inactive]:hidden flex flex-col min-h-0">
              <ScrollArea className="flex-1 pr-2 -mr-2">
                {transcript ? (
                  <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{transcript}</p>
                ) : (
                  <p className="text-xs text-slate-500 text-center py-10">
                    Snippets you send to the coach will appear here as a running call note.
                  </p>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
