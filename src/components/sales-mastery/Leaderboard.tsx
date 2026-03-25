import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal } from 'lucide-react';

type Hub = 'real_estate' | 'surplus_funds';

interface LeaderboardProps {
  hub: Hub;
  accentColor: string;
}

const rankStyles: Record<number, { emoji: string; border: string }> = {
  0: { emoji: '🥇', border: 'border-amber-400' },
  1: { emoji: '🥈', border: 'border-gray-400' },
  2: { emoji: '🥉', border: 'border-amber-700' },
};

export function Leaderboard({ hub, accentColor }: LeaderboardProps) {
  const { data: leaders = [] } = useQuery({
    queryKey: ['leaderboard', hub],
    queryFn: async () => {
      const { data } = await supabase
        .from('sales_mastery_leaderboard')
        .select('*')
        .eq('hub', hub)
        .order('contracts_signed', { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  // If no leaderboard data, show VA profiles as fallback for RE
  const { data: vaProfiles = [] } = useQuery({
    queryKey: ['va-profiles-leaderboard', hub],
    enabled: leaders.length === 0 && hub === 'real_estate',
    queryFn: async () => {
      const { data } = await supabase
        .from('re_va_profiles')
        .select('*')
        .eq('is_active', true)
        .order('revenue_mtd', { ascending: false });
      return data ?? [];
    },
  });

  const displayData = leaders.length > 0
    ? leaders.map((l: any) => ({
        name: l.va_name,
        calls: l.calls_made,
        contacts: l.contacts_reached,
        offers: l.offers_submitted,
        contracts: l.contracts_signed,
        revenue: l.revenue_generated,
      }))
    : vaProfiles.map((v: any) => ({
        name: v.name,
        calls: v.calls_today || 0,
        contacts: 0,
        offers: 0,
        contracts: v.contracts_mtd || 0,
        revenue: v.revenue_mtd || 0,
      }));

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Trophy className="h-4 w-4" style={{ color: accentColor }} />
          Leaderboard
          <Badge variant="outline" className="ml-auto text-xs">This Week</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {displayData.length > 0 ? (
          <div className="space-y-2">
            {displayData.map((entry: any, idx: number) => {
              const style = rankStyles[idx] || { emoji: '', border: 'border-border' };
              return (
                <div
                  key={idx}
                  className={`flex items-center gap-3 p-2.5 rounded-lg border ${style.border} ${idx < 3 ? 'bg-accent/20' : ''}`}
                >
                  <span className="text-lg w-8 text-center">{style.emoji || `#${idx + 1}`}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{entry.name}</p>
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span>{entry.calls} calls</span>
                      <span>{entry.contracts} contracts</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold" style={{ color: accentColor }}>
                      ${Number(entry.revenue).toLocaleString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <Medal className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs">No leaderboard data yet</p>
            <p className="text-xs mt-1 opacity-50">Rankings update as VAs make calls</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
