import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Mic, RotateCcw, Square, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { VoiceCheckCardEditor } from './VoiceCheckCardEditor';
import { recordWav, type WavRecorder } from '@/lib/voice/recordWav';
import { emptyVoiceCheckCard, validateVoiceCheckCard, voiceSavedSummary, type VoiceCheckCard } from '@/lib/voice/voiceUpdate';
import { invalidateStoreInventoryQueries } from '@/lib/inventory/invalidation';
import { cn } from '@/lib/utils';

type Phase = 'idle' | 'recording' | 'processing' | 'review' | 'saving' | 'saved' | 'choose_store' | 'error';
type StoreChoice = { store_id: string; store_name: string; address: string | null; distance_m: number };

export function VoiceUpdateButton({ storeId, storeName = '', storeAddress = '', className, onOpenPayment }: {
  storeId?: string;
  storeName?: string;
  storeAddress?: string;
  className?: string;
  onOpenPayment?: (money: { amount: number | null; note: string | null }) => void;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [seconds, setSeconds] = useState(0);
  const [processStatus, setProcessStatus] = useState('');
  const [error, setError] = useState('');
  const [resolvedStore, setResolvedStore] = useState({ id: storeId || '', name: storeName, address: storeAddress });
  const [choices, setChoices] = useState<StoreChoice[]>([]);
  const [noteId, setNoteId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');
  const [card, setCard] = useState<VoiceCheckCard>(() => emptyVoiceCheckCard(storeId || '', storeName, storeAddress));
  const [saved, setSaved] = useState<any>(null);
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const recorderRef = useRef<WavRecorder | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stopRef = useRef<() => void>(() => {});

  useEffect(() => {
    setResolvedStore({ id: storeId || '', name: storeName, address: storeAddress });
  }, [storeId, storeName, storeAddress]);

  const capturePosition = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      p => setPosition({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => undefined,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  }, []);

  const resetDraft = useCallback(() => {
    abortRef.current?.abort();
    void recorderRef.current?.cancel();
    recorderRef.current = null;
    setPhase('idle');
    setSeconds(0);
    setError('');
    setProcessStatus('');
    setNoteId(null);
    setTranscript('');
    setSaved(null);
    setCard(emptyVoiceCheckCard(resolvedStore.id, resolvedStore.name, resolvedStore.address));
  }, [resolvedStore]);

  const beginRecording = useCallback(async (storeOverride?: { id: string; name: string; address: string }) => {
    const store = storeOverride || resolvedStore;
    try {
      setError('');
      setCard(emptyVoiceCheckCard(store.id, store.name, store.address));
      setTranscript('');
      setSaved(null);
      capturePosition();
      recorderRef.current = await recordWav();
      setSeconds(0);
      setPhase('recording');
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(`Microphone could not start: ${message}`);
      setPhase('error');
    }
  }, [capturePosition, resolvedStore]);

  const prepareAndRecord = useCallback(async () => {
    setOpen(true);
    if (resolvedStore.id) {
      await beginRecording();
      return;
    }
    if (!navigator.geolocation) {
      setError('Location is needed to find the nearest store.');
      setPhase('error');
      return;
    }
    setPhase('processing');
    setProcessStatus('Finding the nearest store…');
    navigator.geolocation.getCurrentPosition(async p => {
      const pos = { lat: p.coords.latitude, lng: p.coords.longitude };
      setPosition(pos);
      const { data, error: nearestError } = await (supabase.rpc as any)('store_voice_update_nearest', { p_lat: pos.lat, p_lng: pos.lng });
      if (nearestError) {
        setError(nearestError.message);
        setPhase('error');
        return;
      }
      const found = (data || []) as StoreChoice[];
      if (!found.length) {
        setError('No accessible store with a map location was found. Open the store profile first.');
        setPhase('error');
        return;
      }
      if (found.length > 1 && found[0].distance_m <= 50 && found[1].distance_m <= 50) {
        setChoices(found);
        setPhase('choose_store');
        return;
      }
      const chosen = found[0];
      setResolvedStore({ id: chosen.store_id, name: chosen.store_name, address: chosen.address || '' });
      setCard(emptyVoiceCheckCard(chosen.store_id, chosen.store_name, chosen.address || ''));
      setPhase('idle');
    }, e => {
      setError(`Location unavailable: ${e.message}`);
      setPhase('error');
    }, { enableHighAccuracy: true, timeout: 15000 });
  }, [beginRecording, resolvedStore.id]);

  useEffect(() => {
    if (phase === 'idle' && open && !resolvedStore.id && choices.length === 0) return;
    if (phase === 'idle' && open && resolvedStore.id && !noteId && !recorderRef.current && !saved && seconds === 0 && !error) {
      void beginRecording();
    }
  }, [phase, open, resolvedStore.id, choices.length, noteId, saved, seconds, error, beginRecording]);

  useEffect(() => {
    if (phase !== 'recording') return;
    const timer = window.setInterval(() => {
      setSeconds(current => {
        if (current >= 179) {
          window.setTimeout(() => stopRef.current(), 0);
          return 180;
        }
        return current + 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  const processAudio = useCallback(async (file: File, duration: number) => {
    if (file.size > 24 * 1024 * 1024) throw new Error('Recording is too large. Keep it under 3 minutes.');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Please sign in again.');
    const path = `${user.id}/${resolvedStore.id}/${crypto.randomUUID()}.wav`;
    const { error: uploadError } = await supabase.storage.from('store-voice-notes').upload(path, file, { contentType: 'audio/wav', upsert: false });
    if (uploadError) throw new Error(uploadError.message);
    const { data: createdId, error: createError } = await (supabase.rpc as any)('store_voice_update_create', {
      p_store_id: resolvedStore.id,
      p_file_url: path,
      p_duration_seconds: Math.max(1, duration),
    });
    if (createError) throw new Error(createError.message);
    setNoteId(createdId);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Please sign in again.');
    const controller = new AbortController();
    abortRef.current = controller;
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/store-voice-update-process`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ noteId: createdId }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(await response.text() || `Voice processing failed (${response.status})`);
    if (!response.body) throw new Error('Voice processing returned no response.');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let resultCard: VoiceCheckCard | null = null;
    const handleLine = (line: string) => {
      if (!line.trim()) return;
      const event = JSON.parse(line);
      if (event.type === 'status') setProcessStatus(event.message || 'Working…');
      if (event.type === 'transcript') setTranscript(event.transcript || '');
      if (event.type === 'result') resultCard = event.check_card as VoiceCheckCard;
      if (event.type === 'error') throw new Error(event.message || 'Voice processing failed.');
    };
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const lines = buffer.split('\n');
      buffer = done ? '' : lines.pop() || '';
      lines.forEach(handleLine);
      if (done) break;
    }
    if (buffer.trim()) handleLine(buffer);
    if (!resultCard) throw new Error('No check card was returned. Please speak again.');
    const merged = { ...emptyVoiceCheckCard(resolvedStore.id, resolvedStore.name, resolvedStore.address), ...resultCard! };
    setCard(merged);
    setPhase('review');
  }, [resolvedStore]);

  const stopRecording = useCallback(() => {
    if (phase !== 'recording') return;
    setPhase('processing');
    setProcessStatus('Uploading your recording…');
    void (async () => {
      try {
        const recorder = recorderRef.current;
        if (!recorder) throw new Error('Recording was not started.');
        const file = await recorder.stop();
        recorderRef.current = null;
        if (seconds < 1) throw new Error('Recording was too short. Please speak again.');
        await processAudio(file, seconds);
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setError(e instanceof Error ? e.message : String(e));
        setPhase('error');
      }
    })();
  }, [phase, processAudio, seconds]);
  stopRef.current = stopRecording;

  const confirm = async () => {
    if (!noteId) return;
    const validation = validateVoiceCheckCard(card);
    if (validation) {
      toast.error(validation);
      return;
    }
    setPhase('saving');
    setError('');
    const { data, error: confirmError } = await (supabase.rpc as any)('store_voice_update_confirm', {
      p_note_id: noteId,
      p_card: card,
      p_transcript: transcript,
      p_gps_lat: position?.lat ?? null,
      p_gps_lng: position?.lng ?? null,
    });
    if (confirmError) {
      setError(confirmError.message);
      setPhase('review');
      toast.error(confirmError.message);
      return;
    }
    setSaved(data);
    setPhase('saved');
    invalidateStoreInventoryQueries(qc, resolvedStore.id);
    qc.invalidateQueries({ queryKey: ['field-order-requests'] });
    qc.invalidateQueries({ queryKey: ['route-stop-facts'] });
    qc.invalidateQueries({ queryKey: ['store-voice-notes', resolvedStore.id] });
    qc.invalidateQueries({ queryKey: ['connected-stores'] });
    qc.invalidateQueries({ queryKey: ['ambassador-voice-updates'] });
    toast.success('Voice update saved');
  };

  const openPayment = () => {
    const money = card.money;
    setOpen(false);
    if (onOpenPayment) onOpenPayment(money);
    else navigate(`/stores/${resolvedStore.id}?tab=commercial&finance=invoices`);
  };

  const close = () => {
    if (phase === 'recording') void recorderRef.current?.cancel();
    if (phase === 'processing') abortRef.current?.abort();
    setOpen(false);
    setPhase('idle');
    setSeconds(0);
    setError('');
  };

  const busy = phase === 'processing' || phase === 'saving';
  return <>
    <Button type="button" size="lg" className={cn('h-14 w-full gap-2 text-base font-bold', className)} onClick={() => void prepareAndRecord()} data-testid="voice-update-button">
      <Mic className="h-6 w-6" />Voice update
    </Button>
    <Dialog open={open} onOpenChange={next => { if (!next && !busy) close(); else setOpen(next); }}>
      <DialogContent className="max-h-[94dvh] w-[calc(100vw-16px)] max-w-lg overflow-y-auto p-4 sm:p-6" onInteractOutside={e => { if (busy || phase === 'recording') e.preventDefault(); }}>
        <DialogHeader><DialogTitle>Voice update{resolvedStore.name ? ` · ${resolvedStore.name}` : ''}</DialogTitle><DialogDescription>Speak, check every line, then tap Confirm &amp; Save. Store changes do not save before confirmation.</DialogDescription></DialogHeader>

        {phase === 'choose_store' && <div className="space-y-3"><p className="font-medium">Two stores are within about 50 meters. Which one are you in?</p>{choices.map(choice => <Button key={choice.store_id} variant="outline" className="h-auto min-h-14 w-full whitespace-normal text-left" onClick={() => { setResolvedStore({ id: choice.store_id, name: choice.store_name, address: choice.address || '' }); setCard(emptyVoiceCheckCard(choice.store_id, choice.store_name, choice.address || '')); setPhase('idle'); }}>{choice.store_name}<span className="block text-xs text-muted-foreground">{choice.address} · {Math.round(choice.distance_m)}m</span></Button>)}</div>}

        {(phase === 'idle' || phase === 'recording') && <div className="flex flex-col items-center gap-4 py-5"><button type="button" aria-label={phase === 'recording' ? 'Stop recording' : 'Start recording'} onClick={phase === 'recording' ? stopRecording : () => void beginRecording()} className={cn('flex h-32 w-32 items-center justify-center rounded-full border-4 border-primary bg-primary/15 text-primary', phase === 'recording' && 'animate-pulse bg-primary/25')}><>{phase === 'recording' ? <Square className="h-12 w-12" /> : <Mic className="h-14 w-14" />}</></button><p className="text-lg font-semibold">{phase === 'recording' ? `Listening… ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : 'Tap the mic and speak'}</p><p className="text-center text-sm text-muted-foreground">English or Spanish. Tap the square when finished. Maximum 3 minutes.</p>{phase === 'recording' && <Button variant="ghost" onClick={close}><X className="h-4 w-4" />Cancel recording</Button>}</div>}

        {busy && <div className="flex min-h-52 flex-col items-center justify-center gap-3 py-8" data-testid="voice-processing"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="text-center font-medium">{phase === 'saving' ? 'Saving the confirmed update…' : processStatus || 'Transcribing and building your check card…'}</p>{transcript && <p className="max-h-32 overflow-y-auto rounded-md bg-muted p-3 text-sm text-muted-foreground">{transcript}</p>}</div>}

        {phase === 'error' && <div className="space-y-4" role="alert"><p className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{error}</p><Button className="h-12 w-full" onClick={() => void beginRecording()}><RotateCcw className="h-4 w-4" />Speak again</Button><Button variant="ghost" className="w-full" onClick={close}>Cancel</Button></div>}

        {(phase === 'review' || phase === 'saved') && <div className="space-y-4">
          <div><label htmlFor="voice-transcript" className="text-sm font-medium">Transcript</label><Textarea id="voice-transcript" rows={4} value={transcript} onChange={e => setTranscript(e.target.value)} disabled={phase === 'saved'} /></div>
          {phase === 'review' ? <>
            <VoiceCheckCardEditor card={card} onChange={setCard} onOpenPayment={openPayment} />
            {error && <p className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</p>}
            <div className="sticky bottom-0 -mx-1 grid grid-cols-1 gap-2 bg-background/95 p-1 pt-3 backdrop-blur sm:grid-cols-2"><Button className="h-14 text-base font-bold sm:col-span-2" onClick={() => void confirm()}>Confirm &amp; Save</Button><Button variant="outline" className="h-12" onClick={() => void beginRecording()}><RotateCcw className="h-4 w-4" />Speak again</Button><Button variant="ghost" className="h-12" onClick={close}>Cancel</Button></div>
          </> : <div className="space-y-3" data-testid="voice-saved"><h3 className="text-lg font-semibold text-success">Saved</h3>{voiceSavedSummary(saved).map(line => <p key={line} className="rounded-md bg-success/10 p-2 text-sm">{line}</p>)}{saved?.money_requires_normal_screen && <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">No payment was saved from voice.</div>}<div className="grid gap-2">{saved?.money_requires_normal_screen && <Button variant="destructive" className="h-12" onClick={openPayment}>Open normal payment screen</Button>}<Button className="h-12" onClick={close}>Done</Button></div></div>}
        </div>}
      </DialogContent>
    </Dialog>
  </>;
}
