import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { VACoachingReport } from '@/components/va/VACoachingReport';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Headset, ArrowLeft, Play, Flame, Sun, Snowflake, Star, RefreshCw, Download, FileText, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export default function AdminCallReview() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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

  // Sync recordings from Twilio
  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('brandaro-sync-recordings', {
        body: {},
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Synced ${data.synced} recordings, ${data.transcribed} transcripts`);
      queryClient.invalidateQueries({ queryKey: ['admin-call-review'] });
    },
    onError: (err: any) => {
      toast.error('Sync failed: ' + (err.message || 'Unknown error'));
    },
  });

  // Sync single call recording
  const syncSingleMutation = useMutation({
    mutationFn: async (callSid: string) => {
      const { data, error } = await supabase.functions.invoke('brandaro-sync-recordings', {
        body: { call_sid: callSid },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Recording synced!');
      queryClient.invalidateQueries({ queryKey: ['admin-call-review'] });
    },
  });

  const excitementIcons: Record<string, JSX.Element> = {
    hot: <Flame className="h-3 w-3 text-red-400" />,
    warm: <Sun className="h-3 w-3 text-amber-400" />,
    cold: <Snowflake className="h-3 w-3 text-blue-400" />,
  };

  const formatTranscript = (transcript: string) => {
    if (!transcript) return null;
    
    // Try to identify speakers and format
    const lines = transcript.split(/\n|(?<=[.!?])\s+/);
    return lines.map((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return null;
      
      // Check for speaker labels
      const speakerMatch = trimmed.match(/^(Agent|VA|Customer|Caller|Rep|Lead|Speaker\s*\d*):\s*/i);
      if (speakerMatch) {
        const speaker = speakerMatch[1];
        const text = trimmed.slice(speakerMatch[0].length);
        const isAgent = /^(agent|va|rep)/i.test(speaker);
        return (
          <div key={i} className={`mb-2 ${isAgent ? 'pl-0' : 'pl-4'}`}>
            <span className={`text-[10px] font-bold uppercase ${isAgent ? 'text-cyan-400' : 'text-amber-400'}`}>
              {speaker}
            </span>
            <p className="text-sm text-slate-300">{text}</p>
          </div>
        );
      }
      
      // Alternate speaker detection by sentence position
      return (
        <p key={i} className="text-sm text-slate-300 mb-1">{trimmed}</p>
      );
    });
  };

  // Stats
  const totalCalls = calls.length;
  const withRecording = calls.filter((c: any) => c.recording_url).length;
  const withTranscript = calls.filter((c: any) => c.transcript).length;
  const avgDuration = totalCalls > 0 
    ? Math.round(calls.reduce((sum: number, c: any) => sum + (c.duration_seconds || 0), 0) / totalCalls)
    : 0;

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 flex-wrap">
          <Button variant="ghost" onClick={() => navigate(-1)} className="text-slate-400">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div className="flex items-center gap-2">
            <Headset className="h-6 w-6 text-cyan-400" />
            <h1 className="text-2xl font-bold text-white">Brandaro Call Review</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-cyan-400 border-cyan-500/30"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
              Sync Recordings
            </Button>
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

        {/* Stats Bar */}
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
            <p className="text-xs text-slate-400">Total Calls</p>
            <p className="text-xl font-bold text-white">{totalCalls}</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
            <p className="text-xs text-slate-400">With Recording</p>
            <p className="text-xl font-bold text-emerald-400">{withRecording}</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
            <p className="text-xs text-slate-400">With Transcript</p>
            <p className="text-xl font-bold text-cyan-400">{withTranscript}</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
            <p className="text-xs text-slate-400">Avg Duration</p>
            <p className="text-xl font-bold text-white">{Math.floor(avgDuration / 60)}m {avgDuration % 60}s</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Calls List */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm">Calls ({calls.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[70vh] overflow-y-auto">
              {isLoading && <p className="text-sm text-slate-400 text-center py-4">Loading...</p>}
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
                      {call.recording_url && <Play className="h-3 w-3 text-emerald-400" />}
                      {call.transcript && <FileText className="h-3 w-3 text-cyan-400" />}
                      {call.excitement_level && excitementIcons[call.excitement_level]}
                      {call.ai_analysis?.overall_score && (
                        <Badge className="bg-yellow-500/20 text-yellow-400 text-[10px] gap-0.5">
                          <Star className="h-2.5 w-2.5" /> {call.ai_analysis.overall_score}/10
                        </Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 font-mono">{call.twilio_number} → {call.lead_id?.substring(0, 8) || 'manual'}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className="text-[10px] bg-slate-600/50 text-slate-300">{call.call_status || 'unknown'}</Badge>
                    {call.disposition && (
                      <Badge className={`text-[10px] ${
                        call.disposition === 'closed' ? 'bg-emerald-600/30 text-emerald-300' :
                        call.disposition === 'callback' ? 'bg-orange-600/30 text-orange-300' :
                        call.disposition === 'not_interested' ? 'bg-red-600/30 text-red-300' :
                        call.disposition === 'voicemail' ? 'bg-purple-600/30 text-purple-300' :
                        'bg-slate-600/50 text-slate-300'
                      }`}>{call.disposition}</Badge>
                    )}
                    {call.duration_seconds != null && (
                      <span className="text-[10px] text-slate-500">{Math.floor(call.duration_seconds / 60)}m {call.duration_seconds % 60}s</span>
                    )}
                    <span className="text-[10px] text-slate-600 ml-auto">
                      {call.called_at ? new Date(call.called_at).toLocaleTimeString() : ''}
                    </span>
                  </div>
                </div>
              ))}
              {!isLoading && calls.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No calls found</p>}
            </CardContent>
          </Card>

          {/* Selected Call Detail */}
          <div className="space-y-4">
            {selectedCall ? (
              <>
                {/* Call Info */}
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-white text-sm">Call Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">VA:</span>
                      <span className="text-white">{selectedCall.profiles?.full_name || 'Unknown'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Number:</span>
                      <span className="text-white font-mono">{selectedCall.twilio_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Duration:</span>
                      <span className="text-white">{selectedCall.duration_seconds ? `${Math.floor(selectedCall.duration_seconds / 60)}m ${selectedCall.duration_seconds % 60}s` : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Status:</span>
                      <span className="text-white">{selectedCall.call_status}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Disposition:</span>
                      <span className="text-white">{selectedCall.disposition || 'None'}</span>
                    </div>
                    {selectedCall.call_sid && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Call SID:</span>
                        <div className="flex items-center gap-1">
                          <span className="text-slate-500 font-mono text-xs">{selectedCall.call_sid.substring(0, 16)}...</span>
                          {!selectedCall.recording_url && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-xs text-cyan-400"
                              onClick={() => syncSingleMutation.mutate(selectedCall.call_sid)}
                              disabled={syncSingleMutation.isPending}
                            >
                              <RefreshCw className={`h-3 w-3 ${syncSingleMutation.isPending ? 'animate-spin' : ''}`} />
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Recording */}
                {selectedCall.recording_url ? (
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-white text-sm flex items-center gap-2">
                        <Play className="h-4 w-4 text-emerald-400" /> Recording
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <audio controls className="w-full" src={selectedCall.recording_url} />
                      <a
                        href={selectedCall.recording_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 mt-2"
                      >
                        <Download className="h-3 w-3" /> Download Recording
                      </a>
                    </CardContent>
                  </Card>
                ) : selectedCall.call_sid ? (
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardContent className="py-4 text-center">
                      <p className="text-sm text-slate-400 mb-2">No recording synced yet</p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-cyan-400 border-cyan-500/30"
                        onClick={() => syncSingleMutation.mutate(selectedCall.call_sid)}
                        disabled={syncSingleMutation.isPending}
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${syncSingleMutation.isPending ? 'animate-spin' : ''}`} />
                        Fetch Recording
                      </Button>
                    </CardContent>
                  </Card>
                ) : null}

                {/* Transcript */}
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-white text-sm flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-cyan-400" /> Transcript
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedCall.transcript ? (
                      <div className="max-h-60 overflow-y-auto space-y-1 bg-slate-900/50 rounded-lg p-3">
                        {formatTranscript(selectedCall.transcript)}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 text-center py-3">
                        {selectedCall.recording_url ? 'Transcript processing...' : 'No transcript available'}
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* AI Coaching */}
                {selectedCall.ai_analysis && (
                  <VACoachingReport data={selectedCall.ai_analysis} onClose={() => {}} />
                )}

                {/* VA Notes */}
                {selectedCall.va_notes && (
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-white text-sm">VA Notes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-slate-300 whitespace-pre-wrap">{selectedCall.va_notes}</p>
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
