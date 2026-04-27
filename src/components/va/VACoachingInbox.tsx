import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Star, CheckCircle, TrendingUp, Lightbulb, Target, AlertTriangle, Sparkles, Check } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

export function VACoachingInbox() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['va-coaching-inbox', user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('brandaro_va_coaching')
        .select('*')
        .eq('va_user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const ackMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('brandaro_va_coaching')
        .update({ acknowledged_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Marked as reviewed');
      queryClient.invalidateQueries({ queryKey: ['va-coaching-inbox'] });
    },
    onError: (e: any) => toast.error(e.message || 'Failed'),
  });

  if (isLoading) {
    return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}</div>;
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No coaching feedback yet.</p>
          <p className="text-xs mt-1">When your manager runs an AI call review, it will appear here.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-500" /> AI Coaching Feedback
        </h2>
        <Badge variant="outline">{items.length} {items.length === 1 ? 'report' : 'reports'}</Badge>
      </div>

      {items.map((c: any) => {
        const score = c.rating ?? (c.quality_score ? Math.round(c.quality_score / 10) : null);
        const scoreColor = score == null ? 'text-muted-foreground'
          : score >= 8 ? 'text-emerald-500'
          : score >= 5 ? 'text-amber-500'
          : 'text-red-500';
        const isNew = !c.acknowledged_at;

        return (
          <Card key={c.id} className={isNew ? 'border-cyan-500/40 shadow-sm' : ''}>
            <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2 space-y-0">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Star className="h-4 w-4 text-yellow-500" /> Call Coaching Report
                  {isNew && <Badge className="bg-cyan-500/20 text-cyan-600 border-cyan-500/40">New</Badge>}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  {c.created_at ? formatDistanceToNow(new Date(c.created_at), { addSuffix: true }) : ''}
                </p>
              </div>
              {score != null && (
                <div className={`text-2xl font-bold ${scoreColor}`}>{score}/10</div>
              )}
            </CardHeader>

            <CardContent className="space-y-3 text-sm">
              {c.summary && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Summary</p>
                  <p>{c.summary}</p>
                </div>
              )}

              {c.improvement_target && (
                <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-md p-2">
                  <p className="text-cyan-700 dark:text-cyan-300">💪 {c.improvement_target}</p>
                </div>
              )}

              {c.strengths?.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-emerald-500" /> Strengths
                  </p>
                  <ul className="space-y-1">
                    {c.strengths.map((s: string, i: number) => (
                      <li key={i} className="text-emerald-700 dark:text-emerald-300 text-xs flex gap-1.5">
                        <span>✓</span><span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {c.weak_points?.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-amber-500" /> Areas to Improve
                  </p>
                  <ul className="space-y-1">
                    {c.weak_points.map((s: string, i: number) => (
                      <li key={i} className="text-amber-700 dark:text-amber-300 text-xs flex gap-1.5">
                        <span>→</span><span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {c.handling_tips?.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
                    <Target className="h-3 w-3 text-purple-500" /> How to Handle Calls Like This
                  </p>
                  <ul className="space-y-1">
                    {c.handling_tips.map((s: string, i: number) => (
                      <li key={i} className="text-purple-700 dark:text-purple-300 text-xs flex gap-1.5">
                        <span>•</span><span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {c.recommendations?.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
                    <Lightbulb className="h-3 w-3 text-yellow-500" /> Better Things You Could Have Said
                  </p>
                  <ul className="space-y-1">
                    {c.recommendations.map((s: string, i: number) => (
                      <li key={i} className="text-yellow-700 dark:text-yellow-400 text-xs flex gap-1.5">
                        <span>💡</span><span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {c.notes && (
                <div className="border-l-2 border-muted-foreground/20 pl-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Note from your manager
                  </p>
                  <p className="text-xs whitespace-pre-wrap">{c.notes}</p>
                </div>
              )}

              <div className="pt-2 flex justify-end">
                {isNew ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => ackMutation.mutate(c.id)}
                    disabled={ackMutation.isPending}
                  >
                    <Check className="h-3.5 w-3.5 mr-1" /> Mark as reviewed
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Check className="h-3 w-3" /> Reviewed
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
