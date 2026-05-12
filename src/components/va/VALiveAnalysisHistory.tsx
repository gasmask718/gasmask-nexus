import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Lightbulb, Target, AlertTriangle } from 'lucide-react';

export function VALiveAnalysisHistory({ callLogId }: { callLogId: string | null }) {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['va-live-analysis', callLogId],
    queryFn: async () => {
      if (!callLogId) return [];
      const { data } = await (supabase as any)
        .from('va_live_call_analysis')
        .select('*')
        .eq('call_log_id', callLogId)
        .order('created_at', { ascending: true });
      return data || [];
    },
    enabled: !!callLogId,
  });

  if (!callLogId) return null;

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader className="pb-2">
        <CardTitle className="text-white text-sm flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-400" />
          Live Claude Coaching ({rows.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-xs text-slate-400">Loading…</p>}
        {!isLoading && rows.length === 0 && (
          <p className="text-xs text-slate-500 italic">No live coaching captured for this call.</p>
        )}
        {rows.length > 0 && (
          <ol className="space-y-2 max-h-80 overflow-y-auto">
            {rows.map((r: any, i: number) => (
              <li key={r.id} className="border-l-2 border-purple-500/40 pl-3 py-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] text-slate-500">
                    #{i + 1} · {new Date(r.created_at).toLocaleTimeString()}
                  </span>
                  {r.buyer_intent && (
                    <Badge className="text-[10px] bg-cyan-500/15 text-cyan-300 border-cyan-500/30">
                      intent: {r.buyer_intent}
                    </Badge>
                  )}
                  {r.sentiment && (
                    <Badge className="text-[10px] bg-slate-700/50 text-slate-300">
                      {r.sentiment}
                    </Badge>
                  )}
                </div>
                {r.coaching_tip && (
                  <div className="flex gap-1.5 text-xs text-cyan-100">
                    <Lightbulb className="h-3 w-3 text-cyan-400 mt-0.5 shrink-0" />
                    <span>{r.coaching_tip}</span>
                  </div>
                )}
                {r.next_best_action && (
                  <div className="flex gap-1.5 text-xs text-emerald-100">
                    <Target className="h-3 w-3 text-emerald-400 mt-0.5 shrink-0" />
                    <span className="italic">"{r.next_best_action}"</span>
                  </div>
                )}
                {r.objection_detected && r.objection_detected !== 'null' && (
                  <div className="flex gap-1.5 text-xs text-red-200">
                    <AlertTriangle className="h-3 w-3 text-red-400 mt-0.5 shrink-0" />
                    <span>Objection: {r.objection_detected}</span>
                  </div>
                )}
                {r.transcript_chunk && (
                  <p className="text-[11px] text-slate-400 italic">"{r.transcript_chunk.slice(0, 180)}{r.transcript_chunk.length > 180 ? '…' : ''}"</p>
                )}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
