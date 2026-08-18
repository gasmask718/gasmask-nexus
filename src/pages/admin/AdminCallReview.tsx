import { useEffect, useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { VACoachingReport } from '@/components/va/VACoachingReport';
import { VACallWrapUpModal } from '@/components/va/VACallWrapUpModal';
import { VALiveAnalysisHistory } from '@/components/va/VALiveAnalysisHistory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Headset, ArrowLeft, Play, Flame, Sun, Snowflake, Star, RefreshCw, Download,
  FileText, MessageSquare, Search, ChevronLeft, ChevronRight, Sparkles, Send,
  Pencil, RotateCcw,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { RecordingPlayer } from "@/components/phone/RecordingPlayer";

const PAGE_SIZE = 10;

export default function AdminCallReview() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Filters
  const [dateFilter, setDateFilter] = useState<string>(''); // empty = no date filter
  const [excitementFilter, setExcitementFilter] = useState<string>('all');
  const [recordingFilter, setRecordingFilter] = useState<string>('all'); // all | with | without
  const [transcriptFilter, setTranscriptFilter] = useState<string>('all'); // all | with | without
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [page, setPage] = useState(0);
  const [selectedCall, setSelectedCall] = useState<any>(null);
  const [wrapUpOpen, setWrapUpOpen] = useState(false);

  // Reset to first page when filters change
  useEffect(() => {
    setPage(0);
  }, [dateFilter, excitementFilter, recordingFilter, transcriptFilter, statusFilter, searchTerm]);

  const { data, isLoading } = useQuery({
    queryKey: [
      'admin-call-review', dateFilter, excitementFilter, recordingFilter,
      transcriptFilter, statusFilter, searchTerm, page,
    ],
    queryFn: async () => {
      let query = (supabase as any)
        .from('va_call_logs')
        .select('*, profiles!va_call_logs_va_id_fkey(name)', { count: 'exact' })
        .order('called_at', { ascending: false });

      if (dateFilter) {
        query = query
          .gte('called_at', `${dateFilter}T00:00:00`)
          .lte('called_at', `${dateFilter}T23:59:59`);
      }
      if (excitementFilter !== 'all') query = query.eq('excitement_level', excitementFilter);
      if (recordingFilter === 'with') query = query.not('recording_url', 'is', null);
      if (recordingFilter === 'without') query = query.is('recording_url', null);
      if (transcriptFilter === 'with') query = query.not('transcript', 'is', null);
      if (transcriptFilter === 'without') query = query.is('transcript', null);
      if (statusFilter !== 'all') query = query.eq('call_status', statusFilter);
      if (searchTerm.trim()) {
        const term = searchTerm.trim();
        query = query.or(`twilio_number.ilike.%${term}%,call_sid.ilike.%${term}%`);
      }

      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;
      return { rows: data || [], count: count || 0 };
    },
  });

  const calls = data?.rows ?? [];
  const totalCount = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // Sync recordings from Twilio Brandaro (last 10)
  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('brandaro-sync-recordings', {
        body: { page_size: 10, batch: 10, transcript_batch: 10 },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const synced = data?.synced ?? 0;
      const transcribed = data?.transcribed ?? 0;
      if (synced > 0 || transcribed > 0) {
        toast.success(`Synced ${synced} recording${synced === 1 ? '' : 's'}, ${transcribed} transcript${transcribed === 1 ? '' : 's'}`);
      } else {
        toast.info('No new recordings — all caught up');
      }
      queryClient.invalidateQueries({ queryKey: ['admin-call-review'] });
    },
    onError: (err: any) => {
      toast.error('Sync failed: ' + (err.message || 'Unknown error'));
    },
  });

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

  // AI analyzer — runs Lovable AI on the transcript/notes and saves to ai_analysis
  const analyzeMutation = useMutation({
    mutationFn: async (callLogId: string) => {
      const { data, error } = await supabase.functions.invoke('analyze-va-call', {
        body: { call_log_id: callLogId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: (data: any) => {
      toast.success('AI analysis complete');
      // Refresh selected call from server so updated ai_analysis shows immediately
      if (selectedCall?.id) {
        supabase
          .from('va_call_logs')
          .select('*, profiles!va_call_logs_va_id_fkey(name)')
          .eq('id', selectedCall.id)
          .maybeSingle()
          .then(({ data: fresh }) => {
            if (fresh) setSelectedCall(fresh);
          });
      }
      queryClient.invalidateQueries({ queryKey: ['admin-call-review'] });
    },
    onError: (err: any) => {
      toast.error('Analysis failed: ' + (err.message || 'Unknown error'));
    },
  });

  // Send the coaching report to the VA so it appears on their dashboard
  const sendToVAMutation = useMutation({
    mutationFn: async (callLogId: string) => {
      const { data, error } = await supabase.functions.invoke('send-coaching-to-va', {
        body: { call_log_id: callLogId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      toast.success('Coaching sent to VA — they will see it on their dashboard');
    },
    onError: (err: any) => {
      toast.error('Send failed: ' + (err.message || 'Unknown error'));
    },
  });

  // Auto-sync on mount (pulls latest 10 from Twilio Brandaro)
  useEffect(() => {
    syncMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Realtime: refresh list when va_call_logs changes (new calls / sync updates)
  useEffect(() => {
    const channel = supabase
      .channel('admin-call-review-feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'va_call_logs' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['admin-call-review'] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const excitementIcons: Record<string, JSX.Element> = {
    hot: <Flame className="h-3 w-3 text-red-400" />,
    warm: <Sun className="h-3 w-3 text-amber-400" />,
    cold: <Snowflake className="h-3 w-3 text-blue-400" />,
  };

  const formatTranscript = (transcript: string) => {
    if (!transcript) return null;
    const lines = transcript.split(/\n|(?<=[.!?])\s+/);
    return lines.map((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return null;
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
      return <p key={i} className="text-sm text-slate-300 mb-1">{trimmed}</p>;
    });
  };

  // Stats — over current page only (totals come from server count)
  const withRecording = calls.filter((c: any) => c.recording_url).length;
  const withTranscript = calls.filter((c: any) => c.transcript).length;
  const avgDuration = calls.length > 0
    ? Math.round(calls.reduce((sum: number, c: any) => sum + (c.duration_seconds || 0), 0) / calls.length)
    : 0;

  const clearFilters = () => {
    setDateFilter('');
    setExcitementFilter('all');
    setRecordingFilter('all');
    setTranscriptFilter('all');
    setStatusFilter('all');
    setSearchTerm('');
  };

  const hasActiveFilters = useMemo(
    () => !!dateFilter || excitementFilter !== 'all' || recordingFilter !== 'all'
      || transcriptFilter !== 'all' || statusFilter !== 'all' || !!searchTerm.trim(),
    [dateFilter, excitementFilter, recordingFilter, transcriptFilter, statusFilter, searchTerm],
  );

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
          </div>
        </div>

        {/* Filters */}
        <Card className="bg-slate-800/30 border-slate-700">
          <CardContent className="p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                <Input
                  placeholder="Search number or call SID…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-7 bg-slate-900 border-slate-700 text-white h-9"
                />
              </div>
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="bg-slate-900 border-slate-700 text-white w-40 h-9"
              />
              <Select value={excitementFilter} onValueChange={setExcitementFilter}>
                <SelectTrigger className="bg-slate-900 border-slate-700 text-white w-32 h-9">
                  <SelectValue placeholder="Excitement" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="hot">🔥 Hot</SelectItem>
                  <SelectItem value="warm">🌤 Warm</SelectItem>
                  <SelectItem value="cold">❄️ Cold</SelectItem>
                </SelectContent>
              </Select>
              <Select value={recordingFilter} onValueChange={setRecordingFilter}>
                <SelectTrigger className="bg-slate-900 border-slate-700 text-white w-36 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any recording</SelectItem>
                  <SelectItem value="with">With recording</SelectItem>
                  <SelectItem value="without">No recording</SelectItem>
                </SelectContent>
              </Select>
              <Select value={transcriptFilter} onValueChange={setTranscriptFilter}>
                <SelectTrigger className="bg-slate-900 border-slate-700 text-white w-36 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any transcript</SelectItem>
                  <SelectItem value="with">With transcript</SelectItem>
                  <SelectItem value="without">No transcript</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-slate-900 border-slate-700 text-white w-32 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="no-answer">No answer</SelectItem>
                  <SelectItem value="busy">Busy</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
              {hasActiveFilters && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-slate-400 h-9"
                  onClick={clearFilters}
                >
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stats Bar */}
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
            <p className="text-xs text-slate-400">Total (filtered)</p>
            <p className="text-xl font-bold text-white">{totalCount}</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
            <p className="text-xs text-slate-400">With Recording (page)</p>
            <p className="text-xl font-bold text-emerald-400">{withRecording}</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
            <p className="text-xs text-slate-400">With Transcript (page)</p>
            <p className="text-xl font-bold text-cyan-400">{withTranscript}</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
            <p className="text-xs text-slate-400">Avg Duration (page)</p>
            <p className="text-xl font-bold text-white">{Math.floor(avgDuration / 60)}m {avgDuration % 60}s</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Calls List */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-white text-sm">
                Calls — page {page + 1} of {totalPages}
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-slate-400"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-slate-400"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
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
                    <span className="text-sm text-white font-medium">{call.profiles?.name || 'VA'}</span>
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
                      {call.called_at ? new Date(call.called_at).toLocaleString() : ''}
                    </span>
                  </div>
                </div>
              ))}
              {!isLoading && calls.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-4">
                  No calls found{hasActiveFilters ? ' — try clearing filters' : ''}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Selected Call Detail */}
          <div className="space-y-4">
            {selectedCall ? (
              <>
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-white text-sm">Call Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">VA:</span>
                      <span className="text-white">{selectedCall.profiles?.name || 'Unknown'}</span>
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

                {selectedCall.recording_url ? (
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-white text-sm flex items-center gap-2">
                        <Play className="h-4 w-4 text-emerald-400" /> Recording
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <RecordingPlayer recordingUrl={selectedCall.recording_url} />
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
                        {selectedCall.recording_url ? 'Transcript processing — try Sync again in a few minutes' : 'No transcript available'}
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* AI Analyzer toolbar */}
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="p-3 flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2 mr-auto">
                      <Sparkles className="h-4 w-4 text-purple-400" />
                      <div>
                        <p className="text-sm text-white font-medium">AI Call Analyzer</p>
                        <p className="text-[11px] text-slate-400">
                          {selectedCall.ai_analysis
                            ? 'Analyzed — review the coaching report below'
                            : selectedCall.transcript || selectedCall.va_notes
                              ? 'Run AI to score the call and surface coaching tips'
                              : 'No transcript or notes available to analyze'}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-purple-300 border-purple-500/40 hover:bg-purple-500/10"
                      disabled={
                        analyzeMutation.isPending ||
                        (!selectedCall.transcript && !selectedCall.va_notes)
                      }
                      onClick={() => analyzeMutation.mutate(selectedCall.id)}
                    >
                      <Sparkles className={`h-3.5 w-3.5 ${analyzeMutation.isPending ? 'animate-pulse' : ''}`} />
                      {selectedCall.ai_analysis ? 'Re-analyze' : 'Analyze with AI'}
                    </Button>
                    {selectedCall.ai_analysis && (
                      <Button
                        size="sm"
                        className="gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-white"
                        disabled={sendToVAMutation.isPending || !selectedCall.va_id}
                        onClick={() => sendToVAMutation.mutate(selectedCall.id)}
                      >
                        <Send className="h-3.5 w-3.5" />
                        Send Results to VA
                      </Button>
                    )}
                  </CardContent>
                </Card>

                {selectedCall.ai_analysis && (
                  <VACoachingReport data={selectedCall.ai_analysis} onClose={() => {}} />
                )}

                <VALiveAnalysisHistory callLogId={selectedCall.id} />

                {/* Post-Call Wrap-Up */}
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-white text-sm flex items-center gap-2">
                      <RotateCcw className="h-4 w-4 text-cyan-400" />
                      Call Wrap-Up & Next-Call Context
                    </CardTitle>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 text-cyan-300 border-cyan-500/40"
                      onClick={() => setWrapUpOpen(true)}
                    >
                      <Pencil className="h-3 w-3" />
                      {selectedCall.wrap_up_completed_at ? 'Edit' : 'Add'}
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {selectedCall.follow_up_status ? (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-xs">Status:</span>
                        <Badge className="bg-cyan-500/20 text-cyan-300">
                          {selectedCall.follow_up_status.replace(/_/g, ' ')}
                        </Badge>
                        {selectedCall.follow_up_at && (
                          <span className="text-xs text-amber-300">
                            ↻ {new Date(selectedCall.follow_up_at).toLocaleString()}
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic">No outcome captured yet.</p>
                    )}
                    {selectedCall.call_summary && (
                      <div>
                        <p className="text-[10px] uppercase text-slate-500 font-bold">Conversation overview</p>
                        <p className="text-slate-300 whitespace-pre-wrap text-xs leading-relaxed">{selectedCall.call_summary}</p>
                      </div>
                    )}
                    {selectedCall.next_call_context && (
                      <div className="rounded-md border border-cyan-500/20 bg-cyan-500/5 p-2">
                        <p className="text-[10px] uppercase text-cyan-300 font-bold mb-1">Context for next call</p>
                        <p className="text-slate-300 whitespace-pre-wrap text-xs leading-relaxed">{selectedCall.next_call_context}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>


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

      <VACallWrapUpModal
        open={wrapUpOpen}
        onClose={() => {
          setWrapUpOpen(false);
          if (selectedCall?.id) {
            (supabase as any)
              .from('va_call_logs')
              .select('*, profiles!va_call_logs_va_id_fkey(name)')
              .eq('id', selectedCall.id)
              .maybeSingle()
              .then(({ data }: any) => { if (data) setSelectedCall(data); });
          }
          queryClient.invalidateQueries({ queryKey: ['admin-call-review'] });
        }}
        callLogId={selectedCall?.id ?? null}
        leadName={selectedCall?.profiles?.name}
        leadId={selectedCall?.lead_id}
        durationSeconds={selectedCall?.duration_seconds}
      />
    </div>
  );
}
