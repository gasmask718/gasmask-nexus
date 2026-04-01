import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, Award, Flame, Sun, Snowflake } from 'lucide-react';

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
  dateFilter?: string; // ISO date string
}

export function VALeaderboard({ dateFilter }: VALeaderboardProps) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

  const fetchLeaderboard = async () => {
    const targetDate = dateFilter || new Date().toISOString().split('T')[0];
    const { data } = await (supabase as any)
      .from('va_leaderboard_stats')
      .select('*, profiles!va_leaderboard_stats_va_id_fkey(full_name)')
      .eq('session_date', targetDate)
      .order('calls_closed', { ascending: false });

    if (data) {
      setEntries(data.map((d: any) => ({
        ...d,
        va_name: d.profiles?.full_name || 'VA',
      })));
    }
  };

  useEffect(() => {
    fetchLeaderboard();

    // Real-time subscription
    const channel = supabase
      .channel('leaderboard-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'va_leaderboard_stats',
      }, () => fetchLeaderboard())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [dateFilter]);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  const rankIcons = [
    <Trophy className="h-5 w-5 text-yellow-400" />,
    <Medal className="h-5 w-5 text-slate-300" />,
    <Award className="h-5 w-5 text-amber-600" />,
  ];

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader className="pb-2">
        <CardTitle className="text-white text-sm flex items-center gap-2">
          <Trophy className="h-4 w-4 text-yellow-400" />
          Live Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {entries.length === 0 ? (
          <p className="text-sm text-slate-400 p-4 text-center">No data yet for today</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-slate-700">
                  <th className="text-left p-2 pl-4">#</th>
                  <th className="text-left p-2">VA</th>
                  <th className="text-center p-2">Dialed</th>
                  <th className="text-center p-2">Answered</th>
                  <th className="text-center p-2">Closed</th>
                  <th className="text-center p-2">Answer %</th>
                  <th className="text-center p-2">Close %</th>
                  <th className="text-center p-2">Talk Time</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, idx) => {
                  const answerRate = entry.calls_dialed > 0 ? Math.round((entry.calls_answered / entry.calls_dialed) * 100) : 0;
                  const closeRate = entry.calls_answered > 0 ? Math.round((entry.calls_closed / entry.calls_answered) * 100) : 0;
                  const isMe = entry.va_id === user?.id;
                  const rowCls = idx < 3 ? 'bg-slate-700/30' : '';

                  return (
                    <tr key={entry.va_id} className={`border-b border-slate-700/50 ${rowCls} ${isMe ? 'ring-1 ring-cyan-500/30' : ''}`}>
                      <td className="p-2 pl-4">
                        {idx < 3 ? rankIcons[idx] : <span className="text-slate-500">#{idx + 1}</span>}
                      </td>
                      <td className="p-2 text-white font-medium">
                        {entry.va_name}
                        {isMe && <Badge className="ml-1 bg-cyan-500/20 text-cyan-400 text-[10px]">You</Badge>}
                      </td>
                      <td className="text-center p-2 text-slate-300">{entry.calls_dialed}</td>
                      <td className="text-center p-2 text-slate-300">{entry.calls_answered}</td>
                      <td className="text-center p-2 text-emerald-400 font-bold">{entry.calls_closed}</td>
                      <td className="text-center p-2 text-slate-300">{answerRate}%</td>
                      <td className="text-center p-2 text-slate-300">{closeRate}%</td>
                      <td className="text-center p-2 text-slate-400">{formatDuration(entry.total_talk_time_seconds)}</td>
                    </tr>
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
