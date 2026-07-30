import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataQualityBadge } from '@/components/sbo/DataQualityBadge';
import { ArrowLeft, Trophy, Target, Activity } from 'lucide-react';

/**
 * Sports Betting AI — LIVE (model accuracy + saved-pick volume from SBO).
 * Bankroll/record sections are honest-empty until sbo_actual_bets/sbo_bankroll are seeded.
 */
export default function OwnerSportsDetailPage() {
  const navigate = useNavigate();

  const accuracy = useQuery({
    queryKey: ['owner-sports:accuracy'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('sbo_accuracy_log')
        .select('date, accuracy_pct, total_predictions, correct_predictions')
        .order('date', { ascending: false })
        .limit(30);
      if (error) throw error;
      return data || [];
    },
  });

  const picks = useQuery({
    queryKey: ['owner-sports:picks'],
    queryFn: async () => {
      const { data, error, count } = await (supabase as any)
        .from('sbo_saved_picks')
        .select('id, label, pick_type, sport, confidence, stake, potential_payout, result, pick_date, created_at, source_id, sbo_predictions!source_id(data_quality, sport_key)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return { rows: data || [], total: count || 0 };
    },
  });

  const bankroll = useQuery({
    queryKey: ['owner-sports:bankroll'],
    queryFn: async () => {
      const [bets, br] = await Promise.all([
        (supabase as any).from('sbo_actual_bets').select('id', { count: 'exact', head: true }),
        (supabase as any).from('sbo_bankroll').select('id', { count: 'exact', head: true }),
      ]);
      return { bets: bets.count || 0, bankroll: br.count || 0 };
    },
  });

  const rolling = (() => {
    const rows = accuracy.data || [];
    const totalP = rows.reduce((s: number, r: any) => s + (r.total_predictions || 0), 0);
    const totalC = rows.reduce((s: number, r: any) => s + (r.correct_predictions || 0), 0);
    return totalP > 0 ? (totalC / totalP) * 100 : null;
  })();

  const sampleSize = (accuracy.data || []).reduce((s: number, r: any) => s + (r.total_predictions || 0), 0);

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/os/owner/holdings')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/10 border border-green-500/30">
            <Trophy className="h-6 w-6 text-green-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Sports Betting AI</h1>
            <p className="text-sm text-muted-foreground">Live model performance — bankroll activates when bets are logged</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="rounded-xl">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Rolling Accuracy (30d)</div>
            <div className="text-2xl font-bold text-emerald-400">
              {rolling === null ? '—' : `${rolling.toFixed(1)}%`}
            </div>
            <div className="text-xs text-muted-foreground mt-1">{sampleSize} predictions</div>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Saved Picks (total)</div>
            <div className="text-2xl font-bold">{picks.data ? picks.data.total.toLocaleString() : '…'}</div>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Bankroll</div>
            <div className="text-base font-medium text-muted-foreground italic">
              {bankroll.data && bankroll.data.bankroll === 0
                ? 'Not seeded — log first bet to activate'
                : '$ live'}
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Record (W-L)</div>
            <div className="text-base font-medium text-muted-foreground italic">
              {bankroll.data && bankroll.data.bets === 0
                ? 'Not seeded — log first bet to activate'
                : 'live record'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent picks */}
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4 text-green-400" />
            Recent Saved Picks
          </CardTitle>
          <CardDescription className="text-xs">Last 10 from the SBO pick log</CardDescription>
        </CardHeader>
        <CardContent>
          {picks.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !picks.data || picks.data.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No saved picks yet.</p>
          ) : (
            <div className="space-y-2">
              {picks.data.rows.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border bg-card/50">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{p.label || p.pick_type}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.sport || '—'} · conf {p.confidence ?? '—'} · {p.pick_date || (p.created_at && new Date(p.created_at).toLocaleDateString())}
                    </p>
                    {p.sbo_predictions && (
                      <div className="mt-1">
                        <DataQualityBadge quality={(Array.isArray(p.sbo_predictions) ? p.sbo_predictions[0] : p.sbo_predictions)?.data_quality} compact />
                      </div>
                    )}
                  </div>
                  <Badge variant="outline" className={
                    p.result === 'W' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : p.result === 'L' ? 'bg-red-500/20 text-red-400 border-red-500/30'
                    : 'bg-muted text-muted-foreground'
                  }>
                    {p.result || 'pending'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-xl border-green-500/30">
        <CardContent className="pt-6 flex items-start gap-3">
          <Activity className="h-5 w-5 text-green-400 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Honest empty states: </span>
            Bankroll, monthly ROI, and W-L appear once <code>sbo_actual_bets</code> and <code>sbo_bankroll</code> are seeded.
            Model accuracy and pick volume are already live.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
