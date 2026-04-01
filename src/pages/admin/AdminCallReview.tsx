import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { VACoachingReport } from '@/components/va/VACoachingReport';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Headset, ArrowLeft, Play, Flame, Sun, Snowflake, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AdminCallReview() {
  const navigate = useNavigate();
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [excitementFilter, setExcitementFilter] = useState<string>('all');
  const [selectedCall, setSelectedCall] = useState<any>(null);

  const { data: calls = [], isLoading } = useQuery({
    queryKey: ['admin-call-review', dateFilter, excitementFilter],
    queryFn: async () => {
      let query = (supabase as any)
        .from('va_call_logs')
        .select('*, profiles!va_call_logs_va_id_fkey(full_name)')
        .gte('called_at', `${dateFilter}T00:00:00`)
        .lte('called_at', `${dateFilter}T23:59:59`)
        .order('called_at', { ascending: false });

      if (excitementFilter !== 'all') {
        query = query.eq('excitement_level', excitementFilter);
      }

      const { data } = await query;
      return data || [];
    },
  });

  const excitementIcons: Record<string, JSX.Element> = {
    hot: <Flame className="h-3 w-3 text-red-400" />,
    warm: <Sun className="h-3 w-3 text-amber-400" />,
    cold: <Snowflake className="h-3 w-3 text-blue-400" />,
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4 flex-wrap">
          <Button variant="ghost" onClick={() => navigate(-1)} className="text-slate-400">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div className="flex items-center gap-2">
            <Headset className="h-6 w-6 text-cyan-400" />
            <h1 className="text-2xl font-bold text-white">Call Review</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
              className="bg-slate-800 border-slate-700 text-white w-40" />
            <Select value={excitementFilter} onValueChange={setExcitementFilter}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="hot">🔥 Hot</SelectItem>
                <SelectItem value="warm">🌤 Warm</SelectItem>
                <SelectItem value="cold">❄️ Cold</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Calls List */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm">Calls ({calls.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[70vh] overflow-y-auto">
              {calls.map((call: any) => (
                <div
                  key={call.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedCall?.id === call.id ? 'border-cyan-500 bg-cyan-500/10' : 'border-slate-700 bg-slate-800/30 hover:bg-slate-700/30'
                  }`}
                  onClick={() => setSelectedCall(call)}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white font-medium">{call.profiles?.full_name || 'VA'}</span>
                    <div className="flex items-center gap-1">
                      {call.excitement_level && excitementIcons[call.excitement_level]}
                      {call.ai_analysis?.overall_score && (
                        <Badge className="bg-yellow-500/20 text-yellow-400 text-[10px] gap-0.5">
                          <Star className="h-2.5 w-2.5" /> {call.ai_analysis.overall_score}/10
                        </Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 font-mono">{call.twilio_number} → {call.lead_id?.substring(0, 8)}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className="text-[10px] bg-slate-600/50 text-slate-300">{call.call_status}</Badge>
                    {call.disposition && (
                      <Badge className="text-[10px] bg-slate-600/50 text-slate-300">{call.disposition}</Badge>
                    )}
                    {call.duration_seconds && (
                      <span className="text-[10px] text-slate-500">{Math.floor(call.duration_seconds / 60)}m {call.duration_seconds % 60}s</span>
                    )}
                  </div>
                </div>
              ))}
              {calls.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No calls found</p>}
            </CardContent>
          </Card>

          {/* Selected Call Detail */}
          <div className="space-y-4">
            {selectedCall ? (
              <>
                {/* Recording */}
                {selectedCall.recording_url && (
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-white text-sm flex items-center gap-2">
                        <Play className="h-4 w-4 text-cyan-400" /> Recording
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <audio controls className="w-full" src={selectedCall.recording_url} />
                    </CardContent>
                  </Card>
                )}

                {/* Transcript */}
                {selectedCall.transcript && (
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-white text-sm">Transcript</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <pre className="text-xs text-slate-300 whitespace-pre-wrap max-h-60 overflow-y-auto">
                        {selectedCall.transcript}
                      </pre>
                    </CardContent>
                  </Card>
                )}

                {/* AI Coaching */}
                {selectedCall.ai_analysis && (
                  <VACoachingReport data={selectedCall.ai_analysis} onClose={() => {}} />
                )}

                {/* Notes */}
                {selectedCall.va_notes && (
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-white text-sm">VA Notes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-slate-300">{selectedCall.va_notes}</p>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
                Select a call to review
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
