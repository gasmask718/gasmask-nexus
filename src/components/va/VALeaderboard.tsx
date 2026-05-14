import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, Award, RefreshCw, Crown, Flame, Infinity as InfinityIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { useEffect } from 'react';

type Entry = {
  va_id: string;
  va_name: string;
  calls_dialed: number;
  calls_answered: number;
  calls_closed: number;
  total_talk_time_seconds: number;
};

function aggregate(rows: any[]): Entry[] {
  const map = new Map<string, Entry>();
  for (const r of rows || []) {
    const id = r.va_id;
    const cur = map.get(id) || {
      va_id: id,
      va_name: r.profiles?.name || 'VA',
      calls_dialed: 0,
      calls_answered: 0,
      calls_closed: 0,
      total_talk_time_seconds: 0,
    };
    cur.calls_dialed += r.calls_dialed || 0;
    cur.calls_answered += r.calls_answered || 0;
    cur.calls_closed += r.calls_closed || 0;
    cur.total_talk_time_seconds += r.total_talk_time_seconds || 0;
    cur.va_name = r.profiles?.name || cur.va_name;
    map.set(id, cur);
  }
  return Array.from(map.values()).sort((a, b) => {
    if (b.calls_closed !== a.calls_closed) return b.calls_closed - a.calls_closed;
    return b.calls_answered - a.calls_answered;
  });
}

const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
};

const rankConfig = [
  { icon: Trophy, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  { icon: Medal, color: 'text-slate-300', bg: 'bg-slate-300/10' },
  { icon: Award, color: 'text-amber-600', bg: 'bg-amber-600/10' },
];

function ChampionBanner({ entry, label, accent }: { entry?: Entry; label: string; accent: string }) {
  if (!entry) {
    return (
      <div className="rounded-lg border border-dashed border-border/50 p-3 text-center">
        <p className="text-xs text-muted-foreground">No {label.toLowerCase()} champion yet</p>
      </div>
    );
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-lg border p-3"
      style={{ borderColor: `${accent}40`, background: `linear-gradient(135deg, ${accent}18, transparent 70%)` }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${accent}25`, border: `1px solid ${accent}50` }}
        >
          <Crown className="h-5 w-5" style={{ color: accent }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: accent }}>
            #1 {label}
          </p>
          <p className="text-sm font-bold text-foreground truncate">{entry.va_name}</p>
          <p className="text-[11px] text-muted-foreground">
            {entry.calls_closed} closed · {entry.calls_answered} answered · {entry.calls_dialed} dialed
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function LeaderboardColumn({
  title,
  icon: Icon,
  accent,
  badgeText,
  entries,
  meId,
  onRefresh,
  emptyText,
}: {
  title: string;
  icon: any;
  accent: string;
  badgeText: string;
  entries: Entry[];
  meId?: string;
  onRefresh: () => void;
  emptyText: string;
}) {
  const champion = entries[0];
  return (
    <Card className="glass-card border-border/50 overflow-hidden">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-foreground text-sm flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${accent}1a` }}>
            <Icon className="h-4 w-4" style={{ color: accent }} />
          </div>
          {title}
          <Badge variant="outline" className="text-[10px] ml-2">{badgeText}</Badge>
        </CardTitle>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRefresh}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <ChampionBanner entry={champion} label={title} accent={accent} />
        {entries.length === 0 ? (
          <div className="text-center py-8 space-y-2">
            <Trophy className="h-7 w-7 text-muted-foreground/30 mx-auto" />
            <p className="text-sm text-muted-foreground">{emptyText}</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground text-xs border-b border-border/50">
                  <th className="text-left p-2 pl-6 font-medium">#</th>
                  <th className="text-left p-2 font-medium">VA</th>
                  <th className="text-center p-2 font-medium">Dial</th>
                  <th className="text-center p-2 font-medium">Ans</th>
                  <th className="text-center p-2 font-medium">Close</th>
                  <th className="text-center p-2 pr-6 font-medium">Talk</th>
                </tr>
              </thead>
              <tbody>
                {entries.slice(0, 10).map((entry, idx) => {
                  const isMe = entry.va_id === meId;
                  const rank = rankConfig[idx];
                  return (
                    <motion.tr
                      key={entry.va_id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04, duration: 0.25 }}
                      className={`border-b border-border/30 hover:bg-accent/30 transition-colors
                        ${idx === 0 ? 'bg-accent/15' : ''}
                        ${isMe ? 'ring-1 ring-inset ring-primary/30 bg-primary/5' : ''}`}
                    >
                      <td className="p-2 pl-6">
                        {rank ? (
                          <div className={`w-6 h-6 rounded-md ${rank.bg} flex items-center justify-center`}>
                            <rank.icon className={`h-3.5 w-3.5 ${rank.color}`} />
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs font-mono pl-1">#{idx + 1}</span>
                        )}
                      </td>
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <span className="text-foreground font-medium truncate max-w-[140px]">{entry.va_name}</span>
                          {isMe && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-primary/30 text-primary bg-primary/10">
                              You
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="text-center p-2 text-muted-foreground tabular-nums">{entry.calls_dialed}</td>
                      <td className="text-center p-2 text-muted-foreground tabular-nums">{entry.calls_answered}</td>
                      <td className="text-center p-2 font-bold tabular-nums text-green-400">{entry.calls_closed}</td>
                      <td className="text-center p-2 pr-6 text-muted-foreground tabular-nums">{formatDuration(entry.total_talk_time_seconds)}</td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface VALeaderboardProps {
  dateFilter?: string;
}

export function VALeaderboard({ dateFilter }: VALeaderboardProps) {
  const { user } = useAuth();
  const targetDate = dateFilter || new Date().toISOString().split('T')[0];

  const dailyQuery = useQuery({
    queryKey: ['va-leaderboard-daily', targetDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('va_leaderboard_stats')
        .select('*, profiles(name)')
        .eq('session_date', targetDate);
      if (error) {
        console.error('Daily leaderboard error:', error);
        return [] as Entry[];
      }
      return aggregate(data || []);
    },
    refetchInterval: 30000,
  });

  const allTimeQuery = useQuery({
    queryKey: ['va-leaderboard-alltime'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('va_leaderboard_stats')
        .select('*, profiles(name)')
        .limit(10000);
      if (error) {
        console.error('All-time leaderboard error:', error);
        return [] as Entry[];
      }
      return aggregate(data || []);
    },
    refetchInterval: 60000,
  });

  useEffect(() => {
    const channel = supabase
      .channel('leaderboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'va_leaderboard_stats' }, () => {
        dailyQuery.refetch();
        allTimeQuery.refetch();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [dailyQuery, allTimeQuery]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <LeaderboardColumn
        title="Daily"
        icon={Flame}
        accent="hsl(var(--hud-amber, 38 92% 50%))"
        badgeText={targetDate}
        entries={dailyQuery.data || []}
        meId={user?.id}
        onRefresh={() => dailyQuery.refetch()}
        emptyText="No call data yet for today"
      />
      <LeaderboardColumn
        title="All-Time"
        icon={InfinityIcon}
        accent="hsl(var(--hud-cyan, 195 100% 50%))"
        badgeText="All-time"
        entries={allTimeQuery.data || []}
        meId={user?.id}
        onRefresh={() => allTimeQuery.refetch()}
        emptyText="No call history recorded yet"
      />
    </div>
  );
}
