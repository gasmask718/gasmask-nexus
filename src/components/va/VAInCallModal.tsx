import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Phone, PhoneOff, Mic, MicOff, Flame, Sun, Snowflake,
  FileText, MessageSquare, Voicemail, SkipForward,
} from 'lucide-react';
import { VAScripts } from './VAScripts';
import { VARebuttals } from './VARebuttals';
import { VAFAQs } from './VAFAQs';
import { VAServicesPricing } from './VAServicesPricing';
import { VALiveCoachPanel } from './VALiveCoachPanel';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Disposition = 'closed' | 'not_interested' | 'callback' | 'no_answer' | 'voicemail' | 'dnc';
type ExcitementLevel = 'hot' | 'warm' | 'cold';

interface VAInCallModalProps {
  open: boolean;
  leadName: string;
  leadPhone: string;
  callLogId: string | null;
  callStatus: 'dialing' | 'ringing' | 'connected' | 'ended' | 'machine_detected';
  seconds: number;
  isMuted: boolean;
  onToggleMute: () => void;
  onEndCall: () => void;
  onDropVoicemail: () => void;
  onSkip: () => void;
  onDisposition: (disp: Disposition, excitement: ExcitementLevel | null, notes: string, callbackDate: string) => void;
  onClose: () => void;
  onCreateInvoice: () => void;
  onSendSMS: () => void;
}

export function VAInCallModal({
  open, leadName, leadPhone, callLogId, callStatus, seconds,
  isMuted, onToggleMute, onEndCall, onDropVoicemail, onSkip,
  onDisposition, onClose, onCreateInvoice, onSendSMS,
}: VAInCallModalProps) {
  const [excitementLevel, setExcitementLevel] = useState<ExcitementLevel | null>(null);
  const [notes, setNotes] = useState('');
  const [callbackDate, setCallbackDate] = useState('');
  const [showDisposition, setShowDisposition] = useState(false);
  const [callStartedAt, setCallStartedAt] = useState<number | undefined>(undefined);
  const notesTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Track when call connects to anchor live coach timing
  useEffect(() => {
    if (callStatus === 'connected' && !callStartedAt) setCallStartedAt(Date.now());
    if (!open) setCallStartedAt(undefined);
  }, [callStatus, open, callStartedAt]);

  // Show disposition when call ends
  useEffect(() => {
    if (callStatus === 'ended') {
      setShowDisposition(true);
    }
  }, [callStatus]);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setExcitementLevel(null);
      setNotes('');
      setCallbackDate('');
      setShowDisposition(false);
    }
  }, [open]);

  // Auto-save notes
  useEffect(() => {
    if (notesTimerRef.current) clearTimeout(notesTimerRef.current);
    if (notes && callLogId) {
      notesTimerRef.current = setTimeout(async () => {
        await (supabase as any).from('va_call_logs').update({ va_notes: notes }).eq('id', callLogId);
      }, 8000);
    }
    return () => { if (notesTimerRef.current) clearTimeout(notesTimerRef.current); };
  }, [notes, callLogId]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const handleDisposition = (disp: Disposition) => {
    onDisposition(disp, excitementLevel, notes, callbackDate);
  };

  const statusConfig = {
    dialing: { label: '📞 Dialing...', cls: 'bg-caller/20 text-caller-glow' },
    ringing: { label: '📞 Ringing...', cls: 'bg-yellow-500/20 text-yellow-400 animate-pulse' },
    connected: { label: '🟢 Connected', cls: 'bg-emerald-500/20 text-emerald-400 animate-pulse' },
    ended: { label: '🔴 Ended', cls: 'bg-red-500/20 text-red-400' },
    machine_detected: { label: '🤖 Voicemail', cls: 'bg-purple-500/20 text-purple-400' },
  };

  const { label: statusLabel, cls: statusCls } = statusConfig[callStatus] || statusConfig.dialing;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && callStatus === 'ended' && !showDisposition) onClose(); }}>
      <DialogContent className="max-w-5xl h-[85vh] p-0 bg-slate-900 border-slate-700 text-white overflow-hidden [&>button]:text-white [&>button]:hover:text-white">
        <div className="flex h-full">
          {/* Left: Call Controls */}
          <div className="w-[55%] flex flex-col p-6 border-r border-slate-700">
            {/* Header */}
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-1">{leadName}</h2>
              <p className="text-sm text-slate-400 font-mono">{leadPhone}</p>
              <Badge className={`mt-2 ${statusCls}`}>{statusLabel}</Badge>
            </div>

            {/* Timer */}
            <div className="text-center mb-8">
              <span className="text-5xl font-mono text-white tabular-nums tracking-wider">
                {formatTime(seconds)}
              </span>
            </div>

            {/* Call Action Buttons */}
            <div className="flex gap-3 justify-center mb-6">
              {callStatus === 'connected' && (
                <>
                  <Button
                    size="lg"
                    variant={isMuted ? 'destructive' : 'secondary'}
                    className="h-14 w-14 rounded-full p-0"
                    onClick={onToggleMute}
                  >
                    {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                  </Button>
                  <Button
                    size="lg"
                    variant="destructive"
                    className="h-14 px-8 rounded-full gap-2 text-lg"
                    onClick={onEndCall}
                  >
                    <PhoneOff className="h-6 w-6" /> End Call
                  </Button>
                </>
              )}
              {callStatus === 'machine_detected' && (
                <>
                  <Button className="bg-purple-600 hover:bg-purple-700 gap-2 h-12 px-6" onClick={onDropVoicemail}>
                    <Voicemail className="h-5 w-5" /> Drop Voicemail
                  </Button>
                  <Button variant="secondary" onClick={onSkip} className="gap-2 h-12 px-6">
                    <SkipForward className="h-5 w-5" /> Skip
                  </Button>
                </>
              )}
              {(callStatus === 'dialing' || callStatus === 'ringing') && (
                <Button variant="destructive" className="h-12 px-8 gap-2" onClick={onEndCall}>
                  <PhoneOff className="h-5 w-5" /> Cancel
                </Button>
              )}
            </div>

            {/* Excitement Level */}
            {(callStatus === 'connected' || callStatus === 'ended') && (
              <div className="flex gap-2 justify-center mb-4">
                {([
                  { key: 'hot' as ExcitementLevel, icon: Flame, label: 'HOT', active: 'bg-red-600 ring-2 ring-red-400', inactive: 'bg-red-600/30 hover:bg-red-600/50 text-red-300' },
                  { key: 'warm' as ExcitementLevel, icon: Sun, label: 'WARM', active: 'bg-amber-600 ring-2 ring-amber-400', inactive: 'bg-amber-600/30 hover:bg-amber-600/50 text-amber-300' },
                  // Lead temperature stays semantic — GasMask red is the brand accent, not 'cold'.
                  { key: 'cold' as ExcitementLevel, icon: Snowflake, label: 'COLD', active: 'bg-slate-600 ring-2 ring-slate-400', inactive: 'bg-slate-600/30 hover:bg-slate-600/50 text-slate-300' },
                ] as const).map(e => (
                  <Button
                    key={e.key}
                    size="lg"
                    className={`gap-2 px-6 ${excitementLevel === e.key ? e.active : e.inactive}`}
                    onClick={() => setExcitementLevel(e.key)}
                  >
                    <e.icon className="h-5 w-5" /> {e.label}
                  </Button>
                ))}
              </div>
            )}

            {/* Disposition Panel */}
            {showDisposition && (
              <div className="space-y-3 border-t border-slate-700 pt-4 mt-2">
                <p className="text-sm text-slate-400 font-medium text-center">Select call disposition:</p>
                <div className="flex gap-2 flex-wrap justify-center">
                  {[
                    { key: 'closed' as Disposition, label: '✅ Closed', cls: 'bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300' },
                    { key: 'not_interested' as Disposition, label: '❌ Not Interested', cls: 'bg-red-600/30 hover:bg-red-600/50 text-red-300' },
                    { key: 'callback' as Disposition, label: '📅 Call Back', cls: 'bg-orange-600/30 hover:bg-orange-600/50 text-orange-300' },
                    { key: 'no_answer' as Disposition, label: '📵 No Answer', cls: 'bg-slate-600/30 hover:bg-slate-600/50 text-slate-300' },
                    { key: 'voicemail' as Disposition, label: '📧 Left VM', cls: 'bg-purple-600/30 hover:bg-purple-600/50 text-purple-300' },
                  ].map(d => (
                    <Button key={d.key} className={`text-sm ${d.cls}`} onClick={() => handleDisposition(d.key)}>
                      {d.label}
                    </Button>
                  ))}
                </div>
                <input
                  type="datetime-local"
                  value={callbackDate}
                  onChange={e => setCallbackDate(e.target.value)}
                  className="bg-slate-700 text-white text-xs rounded px-3 py-2 border border-slate-600 w-full mt-2"
                  placeholder="Callback date/time"
                />
              </div>
            )}

            {/* Notes */}
            {(callStatus === 'connected' || callStatus === 'ended') && (
              <div className="mt-auto pt-4">
                <Textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Call notes (auto-saves)..."
                  className="bg-slate-800/50 border-slate-600 text-white text-sm resize-none h-24"
                />
              </div>
            )}

            {/* Post-call actions */}
            {callStatus === 'ended' && !showDisposition && (
              <div className="flex gap-2 justify-center mt-3 pt-3 border-t border-slate-700">
                <Button size="sm" variant="outline" className="text-emerald-400 border-emerald-500/30 gap-1" onClick={onCreateInvoice}>
                  <FileText className="h-3.5 w-3.5" /> Create Invoice
                </Button>
                <Button size="sm" variant="outline" className="text-caller-glow border-caller/30 gap-1" onClick={onSendSMS}>
                  <MessageSquare className="h-3.5 w-3.5" /> Send Follow-Up SMS
                </Button>
              </div>
            )}
          </div>

          {/* Right: Live Coach + Scripts/FAQs */}
          <div className="w-[45%] flex flex-col bg-slate-800/50">
            <div className="p-3 border-b border-slate-700 shrink-0 max-h-[40%] overflow-y-auto">
              <VALiveCoachPanel
                active={callStatus === 'connected'}
                callLogId={callLogId}
                leadName={leadName}
                startedAt={callStartedAt}
              />
            </div>
            <Tabs defaultValue="services" className="flex-1 flex flex-col min-h-0">
              <TabsList className="w-full bg-slate-800 rounded-none border-b border-slate-700 shrink-0">
                <TabsTrigger value="services" className="flex-1 text-xs">Services</TabsTrigger>
                <TabsTrigger value="faqs" className="flex-1 text-xs">FAQs</TabsTrigger>
                <TabsTrigger value="scripts" className="flex-1 text-xs">Scripts</TabsTrigger>
                <TabsTrigger value="rebuttals" className="flex-1 text-xs">Rebuttals</TabsTrigger>
              </TabsList>
              <div className="flex-1 overflow-y-auto">
                <TabsContent value="services" className="p-4 mt-0"><VAServicesPricing /></TabsContent>
                <TabsContent value="faqs" className="p-4 mt-0"><VAFAQs /></TabsContent>
                <TabsContent value="scripts" className="p-4 mt-0"><VAScripts /></TabsContent>
                <TabsContent value="rebuttals" className="p-4 mt-0"><VARebuttals /></TabsContent>
              </div>
            </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
