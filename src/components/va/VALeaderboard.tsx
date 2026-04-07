import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, Award } from 'lucide-react';
import { motion } from 'framer-motion';

interface LeaderboardEntry {
  va_id: string;
  session_date: string;
  calls_dialed: number;
  calls_answered: number;
  calls_closed: number;
  total_talk_time_seconds: number;
  va_name?: string;
}

interface VALeaderboardProps {
  dateFilter?: string;
}

export function VALeaderboard({ dateFilter }: VALeaderboardProps) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

  const fetchLeaderboard = async () => {
    const targetDate = dateFilter || new Date().toISOString().split('T')[0];
    const { data } = await (supabase as any)
      .from('va_leaderboard_stats')
      .select('*, profiles!va_leaderboard_stats_va_id_fkey(name)')
      .eq('session_date', targetDate)
      .order('calls_closed', { ascending: false });

    if (data) {
      setEntries(data.map((d: any) => ({
        ...d,
        va_name: d.profiles?.name || 'VA',
      })));
    }
  };

  useEffect(() => {
    fetchLeaderboard();
    const channel = supabase
      .channel('leaderboard-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'va_leaderboard_stats' }, () => fetchLeaderboard())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [dateFilter]);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  const rankConfig = [
    { icon: Trophy, color: "text-yellow-400", bg: "bg-yellow-400/10", ring: "ring-yellow-400/20" },
    { icon: Medal, color: "text-slate-300", bg: "bg-slate-300/10", ring: "ring-slate-300/20" },
    { icon: Award, color: "text-amber-600", bg: "bg-amber-600/10", ring: "ring-amber-600/20" },
  ];

  return (
    <Card className="glass-card border-border/50 overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-foreground text-sm flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-yellow-400/10 flex items-center justify-center">
            <Trophy className="h-4 w-4 text-yellow-400" />
          </div>
          Live Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {entries.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <Trophy className="h-8 w-8 text-muted-foreground/30 mx-auto" />
            <p className="text-sm text-muted-foreground">No data yet for today</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground text-xs border-b border-border/50">
                  <th className="text-left p-3 pl-5 font-medium">#</th>
                  <th className="text-left p-3 font-medium">VA</th>
                  <th className="text-center p-3 font-medium">Dialed</th>
                  <th className="text-center p-3 font-medium">Answered</th>
                  <th className="text-center p-3 font-medium">Closed</th>
                  <th className="text-center p-3 font-medium">Answer %</th>
                  <th className="text-center p-3 font-medium">Close %</th>
                  <th className="text-center p-3 pr-5 font-medium">Talk Time</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, idx) => {
                  const answerRate = entry.calls_dialed > 0 ? Math.round((entry.calls_answered / entry.calls_dialed) * 100) : 0;
                  const closeRate = entry.calls_answered > 0 ? Math.round((entry.calls_closed / entry.calls_answered) * 100) : 0;
                  const isMe = entry.va_id === user?.id;
                  const rank = rankConfig[idx];

                  return (
                    <motion.tr
                      key={entry.va_id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05, duration: 0.3 }}
                      className={`border-b border-border/30 transition-colors duration-200 hover:bg-accent/30
                        ${idx < 3 ? 'bg-accent/10' : ''} 
                        ${isMe ? 'ring-1 ring-inset ring-primary/30 bg-primary/5' : ''}`}
                    >
                      <td className="p-3 pl-5">
                        {rank ? (
                          <div className={`w-7 h-7 rounded-lg ${rank.bg} flex items-center justify-center`}>
                            <rank.icon className={`h-4 w-4 ${rank.color}`} />
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs font-mono pl-1.5">#{idx + 1}</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="text-foreground font-medium">{entry.va_name}</span>
                          {isMe && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-primary/30 text-primary bg-primary/10">
                              You
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="text-center p-3 text-muted-foreground tabular-nums">{entry.calls_dialed}</td>
                      <td className="text-center p-3 text-muted-foreground tabular-nums">{entry.calls_answered}</td>
                      <td className="text-center p-3 font-bold tabular-nums" style={{ color: "hsl(var(--success))" }}>
                        {entry.calls_closed}
                      </td>
                      <td className="text-center p-3 text-muted-foreground tabular-nums">{answerRate}%</td>
                      <td className="text-center p-3 text-muted-foreground tabular-nums">{closeRate}%</td>
                      <td className="text-center p-3 pr-5 text-muted-foreground tabular-nums">{formatDuration(entry.total_talk_time_seconds)}</td>
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
