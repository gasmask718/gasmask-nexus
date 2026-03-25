import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star, Trophy, TrendingUp, TrendingDown } from 'lucide-react';

type Hub = 'real_estate' | 'surplus_funds';

interface CallScoringProps {
  hub: Hub;
  accentColor: string;
}

function ScoreBar({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-20">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${score * 10}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-bold w-6 text-right">{score}</span>
    </div>
  );
}

export function CallScoring({ hub, accentColor }: CallScoringProps) {
  const { data: scores = [] } = useQuery({
    queryKey: ['call-scores', hub],
    queryFn: async () => {
      const { data } = await supabase
        .from('sales_mastery_call_scores')
        .select('*')
        .eq('hub', hub)
        .order('created_at', { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  const trainingCalls = scores.filter((s: any) => s.is_training_call);
  const avgScore = scores.length > 0
    ? (scores.reduce((sum: number, s: any) => sum + (Number(s.overall_score) || 0), 0) / scores.length).toFixed(1)
    : '—';

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Star className="h-4 w-4" style={{ color: accentColor }} />
          Call Scoring & Training
          <Badge variant="outline" className="ml-auto text-xs">{scores.length} scored</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-2xl font-bold" style={{ color: accentColor }}>{avgScore}</p>
            <p className="text-xs text-muted-foreground">Avg Score</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{scores.length}</p>
            <p className="text-xs text-muted-foreground">Calls Scored</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-amber-500">{trainingCalls.length}</p>
            <p className="text-xs text-muted-foreground">Training Calls</p>
          </div>
        </div>

        {scores.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground">RECENT CALLS</p>
            {scores.slice(0, 5).map((s: any) => (
              <div key={s.id} className="p-3 rounded-lg border border-border/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">
                    Score: {Number(s.overall_score).toFixed(1)}/10
                    {s.is_training_call && (
                      <Badge className="ml-2 text-xs bg-amber-500/20 text-amber-500 border-amber-500">
                        <Trophy className="h-3 w-3 mr-1" />Training Call
                      </Badge>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(s.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="space-y-1">
                  <ScoreBar label="Opening" score={s.opening_score || 0} color={accentColor} />
                  <ScoreBar label="Qualifying" score={s.qualifying_score || 0} color={accentColor} />
                  <ScoreBar label="Objections" score={s.objection_score || 0} color={accentColor} />
                  <ScoreBar label="Close" score={s.close_score || 0} color={accentColor} />
                </div>
                {s.what_went_well && (
                  <div className="mt-2 flex items-start gap-1 text-xs text-green-400">
                    <TrendingUp className="h-3 w-3 mt-0.5 flex-shrink-0" />{s.what_went_well}
                  </div>
                )}
                {s.what_to_improve && (
                  <div className="mt-1 flex items-start gap-1 text-xs text-amber-400">
                    <TrendingDown className="h-3 w-3 mt-0.5 flex-shrink-0" />{s.what_to_improve}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {scores.length === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <Star className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs">No scored calls yet</p>
            <p className="text-xs mt-1 opacity-50">Calls are auto-scored after transcription</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
