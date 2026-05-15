import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Sparkles, Save, Play, Phone, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export type FollowUpStatus =
  | 'won_back'
  | 'callback_needed'
  | 'follow_up_later'
  | 'not_interested'
  | 'no_answer'
  | 'closed_deal'
  | 'nurture';

const STATUS_OPTIONS: { value: FollowUpStatus; label: string; color: string }[] = [
  { value: 'won_back',         label: '🏆 Won back the customer',  color: 'bg-emerald-500/15 text-emerald-300' },
  { value: 'closed_deal',      label: '✅ Closed deal',            color: 'bg-emerald-600/20 text-emerald-300' },
  { value: 'callback_needed',  label: '📞 Need to call again',     color: 'bg-orange-500/15 text-orange-300' },
  { value: 'follow_up_later',  label: '🗓 Follow up later',         color: 'bg-amber-500/15 text-amber-300' },
  { value: 'nurture',          label: '🌱 Nurture / long-term',     color: 'bg-cyan-500/15 text-cyan-300' },
  { value: 'no_answer',        label: '📵 No answer / voicemail',  color: 'bg-slate-500/20 text-slate-300' },
  { value: 'not_interested',   label: '❌ Not interested',          color: 'bg-red-500/15 text-red-300' },
];

interface VACallWrapUpModalProps {
  open: boolean;
  onClose: () => void;
  callLogId: string | null;
  leadName?: string;
  leadId?: string | null;
  durationSeconds?: number;
  /** Fires after a successful save with the resolved disposition code. */
  onSaved?: (resolvedDisposition: string | null) => void;
}

export function VACallWrapUpModal({
  open, onClose, callLogId, leadName, leadId, durationSeconds, onSaved,
}: VACallWrapUpModalProps) {
  const [summary, setSummary] = useState('');
  const [status, setStatus] = useState<FollowUpStatus | ''>('');
  const [nextContext, setNextContext] = useState('');
  const [followUpAt, setFollowUpAt] = useState('');
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [loadingCall, setLoadingCall] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load existing call data when opened
  useEffect(() => {
    if (!open || !callLogId) return;
    let cancelled = false;
    setLoadingCall(true);
    (async () => {
      const { data } = await (supabase as any)
        .from('va_call_logs')
        .select('recording_url, transcript, ai_analysis, call_summary, follow_up_status, next_call_context, follow_up_at')
        .eq('id', callLogId)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setRecordingUrl(data.recording_url ?? null);
        setTranscript(data.transcript ?? null);
        setAiAnalysis(data.ai_analysis ?? null);
        setSummary(data.call_summary ?? data.ai_analysis?.summary ?? '');
        setStatus((data.follow_up_status as FollowUpStatus) ?? '');
        setNextContext(data.next_call_context ?? '');
        setFollowUpAt(data.follow_up_at ? new Date(data.follow_up_at).toISOString().slice(0, 16) : '');
      }
      setLoadingCall(false);
    })();
    return () => { cancelled = true; };
  }, [open, callLogId]);

  const generateAISummary = async () => {
    if (!callLogId) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-va-call', {
        body: { call_log_id: callLogId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      // Refetch the analysis
      const { data: fresh } = await (supabase as any)
        .from('va_call_logs')
        .select('ai_analysis, transcript, recording_url')
        .eq('id', callLogId)
        .maybeSingle();
      if (fresh?.ai_analysis) {
        setAiAnalysis(fresh.ai_analysis);
        if (!summary) setSummary(fresh.ai_analysis.summary || '');
        if (!nextContext && fresh.ai_analysis.va_improvements?.length) {
          setNextContext(
            `Last call notes:\n${fresh.ai_analysis.summary || ''}\n\nWhat to do next time:\n` +
            (fresh.ai_analysis.va_improvements || []).slice(0, 3).map((s: string) => `• ${s}`).join('\n')
          );
        }
        setTranscript(fresh.transcript ?? transcript);
        setRecordingUrl(fresh.recording_url ?? recordingUrl);
      }
      toast.success('AI summary generated');
    } catch (err: any) {
      toast.error('AI summary failed: ' + (err.message || 'unknown'));
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!callLogId) return;
    setSaving(true);
    try {
      const update: any = {
        call_summary: summary.trim() || null,
        follow_up_status: status || null,
        next_call_context: nextContext.trim() || null,
        follow_up_at: followUpAt ? new Date(followUpAt).toISOString() : null,
        wrap_up_completed_at: new Date().toISOString(),
      };
      // Mirror to disposition for back-compat
      if (status === 'callback_needed' || status === 'follow_up_later') update.disposition = 'callback';
      if (status === 'closed_deal' || status === 'won_back') update.disposition = 'closed';
      if (status === 'not_interested') update.disposition = 'not_interested';
      if (status === 'no_answer') update.disposition = 'no_answer';

      const { error } = await (supabase as any)
        .from('va_call_logs')
        .update(update)
        .eq('id', callLogId);
      if (error) throw error;
      toast.success('Wrap-up saved — next call will have this context');
      onClose();
    } catch (err: any) {
      toast.error('Save failed: ' + (err.message || 'unknown'));
    } finally {
      setSaving(false);
    }
  };

  const fmtDuration = (s?: number) => {
    if (!s) return '';
    const m = Math.floor(s / 60);
    return `${m}m ${s % 60}s`;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl bg-slate-900 text-white border-slate-700 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-cyan-400" />
            Call Wrap-Up
            {leadName && <span className="text-cyan-300 font-normal">— {leadName}</span>}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Capture what happened so the next call starts where you left off.
            {durationSeconds ? <span className="ml-1 text-slate-500">• {fmtDuration(durationSeconds)}</span> : null}
          </DialogDescription>
        </DialogHeader>

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4 py-2"
        >
          {/* Recording */}
          <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Play className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-medium">Recording</span>
            </div>
            {recordingUrl ? (
              <audio
                controls
                src={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/play-twilio-recording?url=${encodeURIComponent(recordingUrl)}`}
                className="w-full"
              />
            ) : (
              <p className="text-xs text-slate-500">
                {loadingCall ? 'Loading…' : 'Recording will appear after Twilio finishes processing (usually 1–2 min). Refresh the call list to fetch it.'}
              </p>
            )}
          </div>

          {/* AI Summary */}
          <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-300" />
                <span className="text-sm font-medium">AI Conversation Overview</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1 text-purple-300 border-purple-500/40 hover:bg-purple-500/10"
                disabled={generating || (!transcript && !recordingUrl)}
                onClick={generateAISummary}
              >
                <Sparkles className={`h-3 w-3 ${generating ? 'animate-pulse' : ''}`} />
                {aiAnalysis ? 'Re-generate' : 'Generate'}
              </Button>
            </div>
            {aiAnalysis ? (
              <div className="space-y-2 text-xs text-slate-300">
                {aiAnalysis.summary && <p>{aiAnalysis.summary}</p>}
                {aiAnalysis.overall_score != null && (
                  <Badge className="bg-yellow-500/20 text-yellow-300">Score: {aiAnalysis.overall_score}/10</Badge>
                )}
                {aiAnalysis.coaching_note && (
                  <p className="text-purple-200 italic">💡 {aiAnalysis.coaching_note}</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                Click <strong>Generate</strong> to have AI summarise the conversation. Requires a transcript or recording.
              </p>
            )}
          </div>

          {/* Status */}
          <div>
            <Label className="text-sm text-slate-200">Outcome / Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as FollowUpStatus)}>
              <SelectTrigger className="bg-slate-800 border-slate-700 mt-1">
                <SelectValue placeholder="Select an outcome…" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Summary */}
          <div>
            <Label className="text-sm text-slate-200">What was the call about?</Label>
            <Textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Quick overview of the conversation…"
              className="bg-slate-800 border-slate-700 mt-1 min-h-[70px]"
            />
          </div>

          {/* Next call context */}
          <div>
            <Label className="text-sm text-slate-200 flex items-center gap-1">
              <RotateCcw className="h-3 w-3 text-cyan-400" />
              Context for the next call
            </Label>
            <p className="text-[11px] text-slate-500 mb-1">
              This will appear when anyone calls this lead again — so it never starts from scratch.
            </p>
            <Textarea
              value={nextContext}
              onChange={(e) => setNextContext(e.target.value)}
              placeholder="e.g. Owner asked us to call back Friday after 2pm. Already pitched silver tier; pricing concerns."
              className="bg-slate-800 border-slate-700 min-h-[90px]"
            />
          </div>

          {/* Follow up datetime */}
          {(status === 'callback_needed' || status === 'follow_up_later' || status === 'won_back') && (
            <div>
              <Label className="text-sm text-slate-200">Schedule follow-up</Label>
              <Input
                type="datetime-local"
                value={followUpAt}
                onChange={(e) => setFollowUpAt(e.target.value)}
                className="bg-slate-800 border-slate-700 mt-1"
              />
            </div>
          )}
        </motion.div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} className="text-slate-400">Skip</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-cyan-600 hover:bg-cyan-500 gap-1.5">
            <Save className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save Wrap-Up'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
