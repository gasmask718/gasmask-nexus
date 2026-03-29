import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { HudProgress } from '@/components/portal/HudProgress';
import { HudStatusBadge } from '@/components/portal/HudStatusBadge';
import { cn } from '@/lib/utils';
import {
  Loader2, Zap, CheckCircle2, XCircle, Clock, Square,
  Activity, BarChart3, AlertTriangle, Timer
} from 'lucide-react';

export interface AnalysisState {
  isRunning: boolean;
  status: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';
  total_props: number;
  processed_props: number;
  percent_complete: number;
  current_prop: string | null;
  current_step: string | null;
  errors_count: number;
  started_at: number | null;
  completed_at: number | null;
}

export interface AnalysisFeedItem {
  id: string;
  player: string;
  stat: string;
  status: 'success' | 'error' | 'processing';
  message?: string;
  timestamp: number;
}

const STEPS = [
  { key: 'fetching', label: 'Fetching Stats' },
  { key: 'ai_model', label: 'Running AI Model' },
  { key: 'scoring', label: 'Calculating Score' },
  { key: 'saving', label: 'Saving Result' },
];

interface LiveAnalysisPanelProps {
  state: AnalysisState;
  feed: AnalysisFeedItem[];
  onCancel?: () => void;
  className?: string;
}

export function LiveAnalysisPanel({ state, feed, onCancel, className }: LiveAnalysisPanelProps) {
  const feedEndRef = useRef<HTMLDivElement>(null);
  const [elapsed, setElapsed] = useState(0);

  // Timer
  useEffect(() => {
    if (!state.isRunning || !state.started_at) { setElapsed(0); return; }
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - state.started_at!) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [state.isRunning, state.started_at]);

  // Auto-scroll feed
  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [feed.length]);

  if (state.status === 'idle') return null;

  const avgTime = state.processed_props > 0 ? (elapsed / state.processed_props).toFixed(1) : '—';
  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const currentStepIdx = STEPS.findIndex(s => s.key === state.current_step);

  const successCount = feed.filter(f => f.status === 'success').length;
  const errorCount = feed.filter(f => f.status === 'error').length;

  // Avg score from completed items (placeholder — would come from real data)
  const completedFeed = feed.filter(f => f.status === 'success');

  return (
    <div className={cn('space-y-3', className)}>
      {/* OVERLAY BANNER */}
      {state.isRunning && (
        <div className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40 pointer-events-none" />
      )}

      <Card className={cn(
        'relative z-50 border',
        state.status === 'running' && 'border-primary/40 bg-primary/5',
        state.status === 'completed' && 'border-hud-green/40 bg-hud-green/5',
        state.status === 'failed' && 'border-destructive/40 bg-destructive/5',
        state.status === 'cancelled' && 'border-hud-amber/40 bg-hud-amber/5',
      )}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              {state.isRunning ? (
                <><Loader2 className="h-4 w-4 animate-spin text-primary" /> Analyzing Props...</>
              ) : state.status === 'completed' ? (
                <><CheckCircle2 className="h-4 w-4 text-hud-green" /> Analysis Complete</>
              ) : state.status === 'failed' ? (
                <><XCircle className="h-4 w-4 text-destructive" /> Analysis Failed</>
              ) : (
                <><Square className="h-4 w-4 text-hud-amber" /> Cancelled</>
              )}
            </CardTitle>

            <div className="flex items-center gap-3">
              {/* Timer */}
              <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
                <Timer className="h-3 w-3" />
                {formatTime(state.completed_at
                  ? Math.floor((state.completed_at - (state.started_at || 0)) / 1000)
                  : elapsed
                )}
              </div>

              {/* Cancel */}
              {state.isRunning && onCancel && (
                <Button variant="destructive" size="sm" onClick={onCancel}>
                  <Square className="h-3 w-3 mr-1" /> Stop
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* PROGRESS BAR */}
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Processing {state.processed_props} / {state.total_props} props</span>
              <span className="font-mono">{state.percent_complete}%</span>
            </div>
            <HudProgress
              value={state.percent_complete}
              variant={state.status === 'failed' ? 'red' : state.status === 'completed' ? 'green' : 'cyan'}
              size="lg"
            />
          </div>

          {/* STATS ROW */}
          <div className="grid grid-cols-4 gap-2">
            <div className="rounded-md bg-muted/30 p-2 text-center">
              <div className="text-lg font-bold text-foreground font-mono">{successCount}</div>
              <div className="text-[10px] uppercase tracking-wider text-hud-green">Completed</div>
            </div>
            <div className="rounded-md bg-muted/30 p-2 text-center">
              <div className="text-lg font-bold text-foreground font-mono">{errorCount}</div>
              <div className="text-[10px] uppercase tracking-wider text-destructive">Errors</div>
            </div>
            <div className="rounded-md bg-muted/30 p-2 text-center">
              <div className="text-lg font-bold text-foreground font-mono">{avgTime}s</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Avg/Prop</div>
            </div>
            <div className="rounded-md bg-muted/30 p-2 text-center">
              <div className="text-lg font-bold text-foreground font-mono">{state.total_props - state.processed_props}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Remaining</div>
            </div>
          </div>

          {/* STEP INDICATORS + CURRENT PROP */}
          {state.isRunning && (
            <div className="flex items-start gap-4">
              {/* Steps */}
              <div className="space-y-1.5 flex-shrink-0">
                {STEPS.map((step, i) => {
                  const done = i < currentStepIdx;
                  const active = i === currentStepIdx;
                  const pending = i > currentStepIdx;
                  return (
                    <div key={step.key} className="flex items-center gap-2 text-xs">
                      {done && <CheckCircle2 className="h-3.5 w-3.5 text-hud-green" />}
                      {active && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
                      {pending && <Clock className="h-3.5 w-3.5 text-muted-foreground/40" />}
                      <span className={cn(
                        done && 'text-hud-green',
                        active && 'text-foreground font-medium',
                        pending && 'text-muted-foreground/40',
                      )}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Current prop detail */}
              {state.current_prop && (
                <div className="flex-1 rounded-md border border-border/50 bg-muted/20 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Now Analyzing</div>
                  <div className="text-sm font-semibold text-foreground">{state.current_prop}</div>
                  <HudStatusBadge status="active" label={state.current_step || 'Processing'} pulse />
                </div>
              )}
            </div>
          )}

          {/* ERROR WARNING */}
          {state.errors_count > 0 && (
            <div className="flex items-center gap-2 text-xs text-hud-amber bg-hud-amber/10 rounded-md px-3 py-2">
              <AlertTriangle className="h-3.5 w-3.5" />
              {state.errors_count} prop{state.errors_count > 1 ? 's' : ''} failed — review needed
            </div>
          )}

          {/* LIVE FEED */}
          {feed.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                <Activity className="h-3 w-3" /> Live Analysis Feed
              </div>
              <ScrollArea className="h-[140px] rounded-md border border-border/30 bg-muted/10">
                <div className="p-2 space-y-0.5 font-mono text-xs">
                  {feed.map(item => (
                    <div key={item.id} className={cn(
                      'flex items-center gap-2 px-2 py-1 rounded',
                      item.status === 'success' && 'text-hud-green',
                      item.status === 'error' && 'text-destructive',
                      item.status === 'processing' && 'text-primary animate-pulse',
                    )}>
                      {item.status === 'success' && <span>✔</span>}
                      {item.status === 'error' && <span>✖</span>}
                      {item.status === 'processing' && <Loader2 className="h-3 w-3 animate-spin" />}
                      <span className="flex-1 truncate">
                        {item.player} — {item.stat} {item.status === 'success' ? 'analyzed' : item.status === 'error' ? `failed${item.message ? `: ${item.message}` : ''}` : 'analyzing...'}
                      </span>
                      <span className="text-muted-foreground/50 text-[10px]">
                        {new Date(item.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                  ))}
                  <div ref={feedEndRef} />
                </div>
              </ScrollArea>
            </div>
          )}

          {/* COMPLETION SUMMARY */}
          {state.status === 'completed' && (
            <div className="rounded-md bg-hud-green/10 border border-hud-green/30 p-3">
              <div className="text-sm font-medium text-hud-green mb-1">✅ Analysis Complete</div>
              <div className="grid grid-cols-3 gap-3 text-xs text-muted-foreground">
                <div>Processed: <span className="text-foreground font-mono">{state.processed_props}</span></div>
                <div>Errors: <span className={cn('font-mono', state.errors_count > 0 ? 'text-destructive' : 'text-foreground')}>{state.errors_count}</span></div>
                <div>Time: <span className="text-foreground font-mono">
                  {state.completed_at && state.started_at ? formatTime(Math.floor((state.completed_at - state.started_at) / 1000)) : '—'}
                </span></div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
