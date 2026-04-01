import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Users, Phone, Flame, Target } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ActiveVA {
  va_id: string;
  va_name: string;
  twilio_number: string;
  language: string;
  is_active: boolean;
  started_at: string;
}

export default function AdminVAMonitor() {
  const navigate = useNavigate();
  const [activeVAs, setActiveVAs] = useState<ActiveVA[]>([]);
  const [todayStats, setTodayStats] = useState({ totalCalls: 0, hotLeads: 0 });

  const fetchData = async () => {
    // Active sessions
    const { data: sessions } = await (supabase as any)
      .from('va_sessions')
      .select('*, profiles!va_sessions_va_id_fkey(full_name)')
      .eq('is_active', true);

    if (sessions) {
      setActiveVAs(sessions.map((s: any) => ({
        va_id: s.va_id,
        va_name: s.profiles?.full_name || 'VA',
        twilio_number: s.twilio_number_id,
        language: s.language,
        is_active: s.is_active,
        started_at: s.started_at,
      })));
    }

    // Today's aggregate stats
    const today = new Date().toISOString().split('T')[0];
    const { data: stats } = await (supabase as any)
      .from('va_leaderboard_stats')
      .select('calls_dialed')
      .eq('session_date', today);

    const totalCalls = stats?.reduce((sum: number, s: any) => sum + (s.calls_dialed || 0), 0) || 0;

    const { count: hotCount } = await (supabase as any)
      .from('va_call_logs')
      .select('id', { count: 'exact', head: true })
      .eq('excitement_level', 'hot')
      .gte('called_at', `${today}T00:00:00`);

    setTodayStats({ totalCalls, hotLeads: hotCount || 0 });
  };

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('admin-monitor')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'va_sessions' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'va_leaderboard_stats' }, fetchData)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(-1)} className="text-slate-400">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div className="flex items-center gap-2">
            <Users className="h-6 w-6 text-cyan-400" />
            <h1 className="text-2xl font-bold text-white">Live VA Monitor</h1>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 text-center">
              <Users className="h-6 w-6 mx-auto text-cyan-400 mb-1" />
              <p className="text-3xl font-bold text-white">{activeVAs.length}</p>
              <p className="text-xs text-slate-400">Active VAs</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 text-center">
              <Phone className="h-6 w-6 mx-auto text-emerald-400 mb-1" />
              <p className="text-3xl font-bold text-white">{todayStats.totalCalls}</p>
              <p className="text-xs text-slate-400">Calls Today</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 text-center">
              <Flame className="h-6 w-6 mx-auto text-red-400 mb-1" />
              <p className="text-3xl font-bold text-white">{todayStats.hotLeads}</p>
              <p className="text-xs text-slate-400">HOT Leads Today</p>
            </CardContent>
          </Card>
        </div>

        {/* Active VA Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeVAs.map(va => (
            <Card key={va.va_id} className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-white font-medium">{va.va_name}</h3>
                  <Badge className="bg-emerald-500/20 text-emerald-400 text-xs animate-pulse">LIVE</Badge>
                </div>
                <p className="text-xs text-slate-400">Language: {va.language === 'en' ? '🇺🇸 EN' : '🇪🇸 ES'}</p>
                <p className="text-xs text-slate-400">Since: {new Date(va.started_at).toLocaleTimeString()}</p>
              </CardContent>
            </Card>
          ))}
          {activeVAs.length === 0 && (
            <p className="text-sm text-slate-400 col-span-3 text-center py-8">No active VA sessions</p>
          )}
        </div>
      </div>
    </div>
  );
}
