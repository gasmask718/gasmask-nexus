import { useState, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { Users, Plus, MessageSquare, Trophy, Activity, Settings, Eye, CheckCircle, XCircle, Clock, Camera, Upload, Loader2, AlertTriangle, Link2, Flame, TrendingUp, Target, Zap, Crown, DollarSign, Brain, ShieldAlert, Banknote, BarChart3, Lock, PlayCircle, PauseCircle, RefreshCw, Layers } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const SPORTS = ['NBA', 'WNBA', 'NFL', 'MLB', 'NHL', 'Soccer', 'UFC', 'Tennis', 'NCAAB', 'NCAAF'] as const;
const BET_TYPES = ['prop', 'moneyline', 'spread', 'total', 'futures', 'parlay'] as const;

const sportColors: Record<string, string> = {
  NBA: 'text-orange-500 border-orange-500/30 bg-orange-500/10',
  WNBA: 'text-orange-400 border-orange-400/30 bg-orange-400/10',
  NFL: 'text-green-500 border-green-500/30 bg-green-500/10',
  MLB: 'text-red-500 border-red-500/30 bg-red-500/10',
  NHL: 'text-blue-500 border-blue-500/30 bg-blue-500/10',
  Soccer: 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10',
  UFC: 'text-red-600 border-red-600/30 bg-red-600/10',
  Tennis: 'text-yellow-500 border-yellow-500/30 bg-yellow-500/10',
  NCAAB: 'text-purple-500 border-purple-500/30 bg-purple-500/10',
  NCAAF: 'text-purple-400 border-purple-400/30 bg-purple-400/10',
};
const tierColors: Record<string, string> = {
  elite: 'text-amber-500 border-amber-500/30 bg-amber-500/10',
  good: 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10',
  unproven: 'text-muted-foreground border-border bg-muted/50',
};
const gradeColors: Record<string, string> = {
  A: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10',
  B: 'text-blue-400 border-blue-400/30 bg-blue-400/10',
  C: 'text-amber-400 border-amber-400/30 bg-amber-400/10',
  D: 'text-red-400 border-red-400/30 bg-red-400/10',
};

// ─── Bulk Photo Upload Dialog ──────────────────────────────────────────
interface QueueImage {
  id: string;
  file: File;
  preview: string;
  base64: string;
  status: 'queued' | 'parsing' | 'done' | 'failed';
  picks: any[];
  error?: string;
  needsReview: number;
}

const MAX_BATCH = 20;
const MAX_PARALLEL = 2;

function PhotoUploadDialog({ cappers, onAdded }: { cappers: any[]; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [capperId, setCapperId] = useState('');
  const [images, setImages] = useState<QueueImage[]>([]);
  const [processing, setProcessing] = useState(false);
  const [step, setStep] = useState<'upload' | 'progress' | 'results'>('upload');
  const [autoProcess, setAutoProcess] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef(false);

  const stats = {
    total: images.length,
    completed: images.filter(i => i.status === 'done').length,
    failed: images.filter(i => i.status === 'failed').length,
    inProgress: images.filter(i => i.status === 'parsing').length,
    queued: images.filter(i => i.status === 'queued').length,
    totalPicks: images.reduce((s, i) => s + (Array.isArray(i.picks) ? i.picks.length : 0), 0),
    needsReview: images.reduce((s, i) => s + (i.needsReview || 0), 0),
  };
  const progressPct = stats.total > 0 ? Math.round(((stats.completed + stats.failed) / stats.total) * 100) : 0;

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + images.length > MAX_BATCH) {
      toast.error(`Max ${MAX_BATCH} images per batch`);
      return;
    }
    const valid = files.filter(f => {
      if (!f.type.startsWith('image/')) { toast.error(`${f.name} is not an image`); return false; }
      if (f.size > 10 * 1024 * 1024) { toast.error(`${f.name} exceeds 10MB`); return false; }
      return true;
    });
    valid.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setImages(prev => [...prev, {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          preview: base64,
          base64,
          status: 'queued',
          picks: [],
          needsReview: 0,
        }]);
      };
      reader.readAsDataURL(file);
    });
    if (inputRef.current) inputRef.current.value = '';
  };

  const removeImage = (id: string) => setImages(prev => prev.filter(i => i.id !== id));

  const parseOne = useCallback(async (img: QueueImage): Promise<QueueImage> => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);
      const { data, error } = await supabase.functions.invoke('sbo-parse-capper-image', {
        body: { image: img.base64, capper_id: capperId },
      });
      clearTimeout(timeout);
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Parse failed');
      const picks = Array.isArray(data.picks) ? data.picks : [];
      return { ...img, status: 'done', picks, needsReview: picks.filter((p: any) => p.parse_confidence < 70).length };
    } catch (err: any) {
      return { ...img, status: 'failed', error: err.message || 'Unknown error' };
    }
  }, [capperId]);

  const runQueue = useCallback(async () => {
    if (!capperId) { toast.error('Select a capper first'); return; }
    setProcessing(true);
    setStep('progress');
    abortRef.current = false;

    const queue = [...images.filter(i => i.status === 'queued' || i.status === 'failed')];
    let idx = 0;

    const processNext = async (): Promise<void> => {
      if (abortRef.current || idx >= queue.length) return;
      const current = queue[idx++];
      setImages(prev => prev.map(i => i.id === current.id ? { ...i, status: 'parsing' } : i));
      const result = await parseOne(current);
      setImages(prev => prev.map(i => i.id === result.id ? result : i));
    };

    // Run with controlled concurrency
    const workers = Array.from({ length: Math.min(MAX_PARALLEL, queue.length) }, () => {
      const work = async (): Promise<void> => {
        while (idx < queue.length && !abortRef.current) {
          await processNext();
        }
      };
      return work();
    });

    await Promise.all(workers);
    setProcessing(false);
    setStep('results');
    toast.success('Batch processing complete');
    onAdded();
  }, [images, capperId, parseOne, onAdded]);

  const retryFailed = () => {
    setImages(prev => prev.map(i => i.status === 'failed' ? { ...i, status: 'queued', error: undefined } : i));
    setTimeout(() => runQueue(), 100);
  };

  const reset = () => {
    setImages([]);
    setStep('upload');
    setCapperId('');
    setProcessing(false);
    abortRef.current = false;
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { abortRef.current = true; reset(); } }}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
          <Camera className="h-3 w-3" /> AI Photo Parse
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>📸 Bulk Capper Pick Parser</DialogTitle>
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Capper</Label>
              <Select value={capperId} onValueChange={setCapperId}>
                <SelectTrigger><SelectValue placeholder="Select capper" /></SelectTrigger>
                <SelectContent>{cappers.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <input ref={inputRef} type="file" accept="image/*" multiple onChange={handleFiles} className="hidden" />

            <Button variant="outline" className="w-full h-24 border-dashed flex-col gap-2" onClick={() => inputRef.current?.click()}>
              <Upload className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Upload multiple screenshots (max {MAX_BATCH})</span>
            </Button>

            {images.length > 0 && (
              <>
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs">{images.length} images queued</Badge>
                  <Button variant="ghost" size="sm" className="text-xs h-6 text-destructive" onClick={() => setImages([])}>Clear all</Button>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-48 overflow-y-auto">
                  {images.map(img => (
                    <div key={img.id} className="relative group">
                      <img src={img.preview} alt="" className="w-full aspect-square object-cover rounded-md border" />
                      <button
                        onClick={() => removeImage(img.id)}
                        className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full h-4 w-4 text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >✕</button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={autoProcess} onChange={e => setAutoProcess(e.target.checked)} className="rounded" />
                  <span className="text-muted-foreground">Auto-run match + consensus after batch</span>
                </div>
                <Button onClick={runQueue} disabled={!capperId || images.length === 0} className="w-full">
                  🧠 Parse {images.length} Images
                </Button>
              </>
            )}
          </div>
        )}

        {/* Step 2: Progress */}
        {step === 'progress' && (
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-sm font-medium">Processing {stats.completed + stats.failed + stats.inProgress} / {stats.total} images…</p>
            </div>
            <Progress value={progressPct} className="h-2" />
            <div className="flex justify-center gap-4 text-xs">
              <span className="text-emerald-500">✅ {stats.completed}</span>
              <span className="text-amber-500">⏳ {stats.queued + stats.inProgress}</span>
              <span className="text-destructive">❌ {stats.failed}</span>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {images.map(img => (
                <div key={img.id} className="flex items-center gap-2 p-1.5 rounded border text-xs">
                  <img src={img.preview} alt="" className="w-8 h-8 rounded object-cover" />
                  <span className="flex-1 truncate text-muted-foreground">{img.file.name}</span>
                  {img.status === 'parsing' && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                  {img.status === 'done' && <CheckCircle className="h-3 w-3 text-emerald-500" />}
                  {img.status === 'failed' && <XCircle className="h-3 w-3 text-destructive" />}
                  {img.status === 'queued' && <Clock className="h-3 w-3 text-muted-foreground" />}
                </div>
              ))}
            </div>
            <Button variant="destructive" size="sm" onClick={() => { abortRef.current = true; }} className="w-full">
              Stop Processing
            </Button>
          </div>
        )}

        {/* Step 3: Results */}
        {step === 'results' && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <Card><CardContent className="p-2">
                <div className="text-lg font-bold text-emerald-500">{stats.completed}</div>
                <div className="text-[10px] text-muted-foreground">Parsed</div>
              </CardContent></Card>
              <Card><CardContent className="p-2">
                <div className="text-lg font-bold">{stats.totalPicks}</div>
                <div className="text-[10px] text-muted-foreground">Total Picks</div>
              </CardContent></Card>
              <Card><CardContent className="p-2">
                <div className="text-lg font-bold text-amber-500">{stats.needsReview}</div>
                <div className="text-[10px] text-muted-foreground">Need Review</div>
              </CardContent></Card>
            </div>

            {stats.failed > 0 && (
              <Button variant="outline" size="sm" onClick={retryFailed} className="w-full gap-1.5 text-xs">
                <RefreshCw className="h-3 w-3" /> Retry {stats.failed} Failed
              </Button>
            )}

            <div className="space-y-2 max-h-[40vh] overflow-y-auto">
              {images.filter(i => i.status === 'done' && i.picks.length > 0).map(img => (
                <Card key={img.id} className="overflow-hidden">
                  <div className="flex items-center gap-2 p-2 bg-muted/30 border-b">
                    <img src={img.preview} alt="" className="w-6 h-6 rounded object-cover" />
                    <span className="text-xs font-medium truncate flex-1">{img.file.name}</span>
                    <Badge variant="outline" className="text-[10px]">{img.picks.length} picks</Badge>
                    {img.needsReview > 0 && <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/30">{img.needsReview} review</Badge>}
                  </div>
                  <CardContent className="p-2 space-y-1">
                    {img.picks.map((p: any, i: number) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs flex-wrap">
                        <Badge className={`text-[9px] ${sportColors[p.sport] || ''}`}>{p.sport}</Badge>
                        <span className="font-medium">{p.player_name || p.team}</span>
                        {p.direction && <Badge variant="outline" className={`text-[9px] ${p.direction === 'OVER' || p.direction === 'WIN' ? 'text-emerald-500 border-emerald-500/30' : 'text-blue-500 border-blue-500/30'}`}>{p.direction}</Badge>}
                        {p.line != null && <span className="text-[10px]">{p.line}</span>}
                        {p.stat_type && <span className="text-[10px] text-muted-foreground">{p.stat_type}</span>}
                        {p.parse_confidence < 70 && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                        <span className="text-[9px] text-muted-foreground ml-auto">{p.parse_confidence}%</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={reset} className="flex-1">Upload More</Button>
              <Button onClick={() => { setOpen(false); reset(); }} className="flex-1">Done ✅</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Add Capper Dialog ────────────────────────────────────────────────
function AddCapperDialog({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [source, setSource] = useState('telegram');
  const [sports, setSports] = useState<string[]>(['NBA']);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const toggleSport = (s: string) => setSports(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const handleAdd = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const { error } = await (supabase as any).from('sbo_cappers').insert({
      name: name.trim(), source, source_handle: handle.trim() || null, notes: notes.trim() || null, sports,
    });
    setSaving(false);
    if (error) { toast.error(error.message); } else {
      toast.success('Capper added'); setName(''); setHandle(''); setNotes(''); setSports(['NBA']); setOpen(false); onAdded();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline" className="gap-1.5"><Plus className="h-3 w-3" /> Add Capper</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Capper Source</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-xs">Name</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. SharpAction" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Source</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="telegram">📱 Telegram</SelectItem><SelectItem value="twitter">🐦 Twitter/X</SelectItem>
                  <SelectItem value="manual">✏️ Manual</SelectItem><SelectItem value="discord">💬 Discord</SelectItem>
                  <SelectItem value="instagram">📷 Instagram</SelectItem><SelectItem value="youtube">📺 YouTube</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Handle (optional)</Label><Input value={handle} onChange={e => setHandle(e.target.value)} placeholder="@handle" /></div>
          </div>
          <div><Label className="text-xs">Sports</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {SPORTS.map(s => <Badge key={s} variant="outline" className={`text-[10px] cursor-pointer transition-all ${sports.includes(s) ? sportColors[s] : 'opacity-40'}`} onClick={() => toggleSport(s)}>{s}</Badge>)}
            </div>
          </div>
          <div><Label className="text-xs">Notes (optional)</Label><Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Known for NBA props..." /></div>
          <Button onClick={handleAdd} disabled={saving || !name.trim()} className="w-full">{saving ? 'Adding…' : 'Add Capper'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Log Pick Dialog ──────────────────────────────────────────────────
function AddPickDialog({ cappers, onAdded }: { cappers: any[]; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [capperId, setCapperId] = useState('');
  const [pickText, setPickText] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [propType, setPropType] = useState('');
  const [line, setLine] = useState('');
  const [direction, setDirection] = useState('');
  const [odds, setOdds] = useState('');
  const [sport, setSport] = useState('NBA');
  const [betType, setBetType] = useState('prop');
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!capperId || !pickText.trim()) return;
    setSaving(true);
    const { error } = await (supabase as any).from('sbo_capper_picks').insert({
      capper_id: capperId, pick_text: pickText.trim(),
      player_name: playerName.trim() || null, prop_type: propType || null,
      line: line ? parseFloat(line) : null, direction: direction || null,
      odds: odds ? parseInt(odds) : null, sport, bet_type: betType,
      game_date: new Date().toISOString().split('T')[0],
      parse_confidence: 100, review_status: 'verified',
    });
    setSaving(false);
    if (error) { toast.error(error.message); } else {
      toast.success('Pick logged'); setPickText(''); setPlayerName(''); setPropType(''); setLine(''); setDirection(''); setOdds(''); setOpen(false); onAdded();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline" className="gap-1.5"><MessageSquare className="h-3 w-3" /> Manual Pick</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Log Capper Pick</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Capper</Label>
              <Select value={capperId} onValueChange={setCapperId}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{cappers.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
            </div>
            <div><Label className="text-xs">Sport</Label>
              <Select value={sport} onValueChange={setSport}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SPORTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
            </div>
          </div>
          <div><Label className="text-xs">Pick Text</Label><Textarea value={pickText} onChange={e => setPickText(e.target.value)} placeholder='e.g. "LeBron James over 27.5 points -110"' rows={2} /></div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label className="text-xs">Player</Label><Input value={playerName} onChange={e => setPlayerName(e.target.value)} placeholder="LeBron James" /></div>
            <div><Label className="text-xs">Stat</Label><Input value={propType} onChange={e => setPropType(e.target.value)} placeholder="points" /></div>
            <div><Label className="text-xs">Bet Type</Label>
              <Select value={betType} onValueChange={setBetType}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{BET_TYPES.map(bt => <SelectItem key={bt} value={bt}>{bt}</SelectItem>)}</SelectContent></Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label className="text-xs">Line</Label><Input type="number" value={line} onChange={e => setLine(e.target.value)} placeholder="25.5" /></div>
            <div><Label className="text-xs">Direction</Label>
              <Select value={direction} onValueChange={setDirection}><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent><SelectItem value="OVER">OVER</SelectItem><SelectItem value="UNDER">UNDER</SelectItem><SelectItem value="WIN">WIN</SelectItem><SelectItem value="LOSE">LOSE</SelectItem></SelectContent></Select>
            </div>
            <div><Label className="text-xs">Odds</Label><Input type="number" value={odds} onChange={e => setOdds(e.target.value)} placeholder="-110" /></div>
          </div>
          <Button onClick={handleAdd} disabled={saving || !capperId || !pickText.trim()} className="w-full">{saving ? 'Logging…' : 'Log Pick'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Settings Panel ───────────────────────────────────────────────────
function SettingsPanel({ cappers, refetch }: { cappers: any[]; refetch: () => void }) {
  const toggleActive = async (id: string, current: boolean) => {
    await (supabase as any).from('sbo_cappers').update({ is_active: !current }).eq('id', id);
    toast.success(!current ? 'Capper activated' : 'Capper deactivated'); refetch();
  };
  const removeCapper = async (id: string) => {
    await (supabase as any).from('sbo_cappers').delete().eq('id', id);
    toast.success('Capper removed'); refetch();
  };

  return (
    <div className="space-y-2">
      {cappers.length === 0 ? (
        <Card className="border-dashed"><CardContent className="p-6 text-center text-sm text-muted-foreground">No cappers tracked. Add one to begin.</CardContent></Card>
      ) : cappers.map((c: any) => (
        <Card key={c.id}><CardContent className="p-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2"><span className="font-medium text-sm">{c.name}</span><Badge variant="outline" className="text-[10px]">{c.source}</Badge></div>
            <div className="flex gap-1 mt-1">{(c.sports || ['NBA']).map((s: string) => <Badge key={s} variant="outline" className={`text-[8px] ${sportColors[s] || ''}`}>{s}</Badge>)}</div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge variant="outline" className={`text-[10px] ${c.is_active ? 'text-emerald-500 border-emerald-500/30' : 'text-muted-foreground'}`}>{c.is_active ? 'Active' : 'Inactive'}</Badge>
            <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => toggleActive(c.id, c.is_active)}>{c.is_active ? 'Deactivate' : 'Activate'}</Button>
            <Button size="sm" variant="ghost" className="h-6 text-[10px] text-destructive" onClick={() => removeCapper(c.id)}>Remove</Button>
          </div>
        </CardContent></Card>
      ))}
    </div>
  );
}

// ─── Review Queue ─────────────────────────────────────────────────────
function ReviewQueue({ onResolved }: { onResolved: () => void }) {
  const { data: picks = [] } = useQuery({
    queryKey: ['sbo-capper-picks-review'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('sbo_capper_picks')
        .select('*, sbo_cappers(name)').eq('review_status', 'needs_review')
        .order('created_at', { ascending: false }).limit(50);
      return data || [];
    },
  });

  const approve = async (id: string) => { await (supabase as any).from('sbo_capper_picks').update({ review_status: 'verified' }).eq('id', id); toast.success('Pick verified'); onResolved(); };
  const reject = async (id: string) => { await (supabase as any).from('sbo_capper_picks').delete().eq('id', id); toast.success('Pick removed'); onResolved(); };

  if (picks.length === 0) return (
    <Card className="border-dashed"><CardContent className="p-8 text-center">
      <CheckCircle className="h-8 w-8 mx-auto text-emerald-500/50 mb-2" /><p className="text-sm text-muted-foreground">All picks verified ✅</p>
    </CardContent></Card>
  );

  return (
    <div className="space-y-2">
      <Badge variant="outline" className="text-xs text-amber-500 border-amber-500/30">{picks.length} picks need review</Badge>
      {picks.map((p: any) => (
        <Card key={p.id} className="border-amber-500/20"><CardContent className="p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-[10px]">{p.sbo_cappers?.name}</Badge>
                <Badge className={`text-[10px] ${sportColors[p.sport] || ''}`}>{p.sport}</Badge>
                <span className="text-[10px] text-amber-500">{p.parse_confidence}% confidence</span>
              </div>
              <p className="text-sm mt-1">{p.player_name} {p.direction} {p.line} {p.prop_type}</p>
              <p className="text-[10px] text-muted-foreground truncate">{p.pick_text}</p>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button size="sm" variant="outline" className="h-7 text-emerald-500" onClick={() => approve(p.id)}>✅</Button>
              <Button size="sm" variant="outline" className="h-7 text-destructive" onClick={() => reject(p.id)}>❌</Button>
            </div>
          </div>
        </CardContent></Card>
      ))}
    </div>
  );
}

// ─── Consensus Meter ──────────────────────────────────────────────────
function ConsensusMeter({ over, under, signal }: { over: number; under: number; signal: string }) {
  const total = over + under;
  if (total === 0) return null;
  const overPct = (over / total) * 100;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-emerald-400">OVER {over}</span>
        <Badge variant="outline" className={`text-[8px] ${signal === 'STRONG' ? 'text-amber-400 border-amber-400/30 bg-amber-400/10' : signal === 'MEDIUM' ? 'text-blue-400 border-blue-400/30' : 'text-muted-foreground'}`}>
          {signal === 'STRONG' ? '🔥' : signal === 'MEDIUM' ? '📊' : '○'} {signal}
        </Badge>
        <span className="text-blue-400">UNDER {under}</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden flex">
        <div className="bg-emerald-500 transition-all" style={{ width: `${overPct}%` }} />
        <div className="bg-blue-500 transition-all" style={{ width: `${100 - overPct}%` }} />
      </div>
    </div>
  );
}

// ─── Top Play Card ────────────────────────────────────────────────────
function TopPlayCard({ play, rank }: { play: any; rank: number }) {
  const rankStyle = rank === 1 ? 'border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-amber-900/5' :
                    rank === 2 ? 'border-slate-400/30 bg-gradient-to-br from-slate-400/5 to-slate-900/5' :
                    rank === 3 ? 'border-orange-700/30 bg-gradient-to-br from-orange-700/5 to-orange-900/5' : '';
  const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;

  return (
    <Card className={`overflow-hidden ${rankStyle}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            <span className="text-2xl font-black leading-none mt-0.5">{rankEmoji}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-base">{play.player_name}</span>
                <Badge variant="outline" className="text-[10px]">{play.stat_type}</Badge>
                <Badge variant="outline" className={`text-[10px] font-bold ${
                  play.direction === 'OVER' ? 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10' : 'text-blue-400 border-blue-400/30 bg-blue-400/10'
                }`}>{play.direction} {play.line}</Badge>
                {play.sharp_indicator === 'SHARP' && <Badge className="text-[10px] bg-purple-500/20 text-purple-400 border-purple-500/30">🧠 SHARP</Badge>}
                {play.sharp_indicator === 'TRAP' && <Badge className="text-[10px] bg-red-500/20 text-red-400 border-red-500/30">🚨 TRAP</Badge>}
                {play.is_value_play && <Badge className="text-[10px] bg-emerald-500/20 text-emerald-400 border-emerald-500/30">💰 VALUE</Badge>}
              </div>
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {(play.play_reasons || []).map((r: string, i: number) => (
                  <span key={i} className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">{r}</span>
                ))}
              </div>
              {play.consensus_over != null && (
                <div className="mt-2">
                  <ConsensusMeter over={play.consensus_over || 0} under={play.consensus_under || 0} signal={play.signal_strength || 'LOW'} />
                </div>
              )}
            </div>
          </div>
          <div className="text-right shrink-0 space-y-1">
            <div className="text-2xl font-black text-primary">{play.composite_score}</div>
            <p className="text-[10px] text-muted-foreground">composite</p>
            <div className="mt-2 p-2 rounded-md bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-xs font-bold text-emerald-400">${play.bet_amount}</p>
              <p className="text-[9px] text-emerald-400/70">{play.bet_size_pct}% bankroll</p>
            </div>
          </div>
        </div>
        {/* Score breakdown */}
        <div className="flex gap-3 mt-3 pt-2 border-t border-border/50">
          <div className="text-center flex-1">
            <p className="text-xs font-bold">{play.consensus_score || 0}%</p>
            <p className="text-[9px] text-muted-foreground">Consensus</p>
          </div>
          <div className="text-center flex-1">
            <p className="text-xs font-bold">{play.value_score || 0}</p>
            <p className="text-[9px] text-muted-foreground">Value</p>
          </div>
          <div className="text-center flex-1">
            <p className="text-xs font-bold">{play.capper_confidence || 0}%</p>
            <p className="text-[9px] text-muted-foreground">Cappers</p>
          </div>
          <div className="text-center flex-1">
            <p className="text-xs font-bold">{play.ai_confidence || 0}%</p>
            <p className="text-[9px] text-muted-foreground">AI Model</p>
          </div>
          <div className="text-center flex-1">
            <p className="text-xs font-bold">{play.elite_count || 0}</p>
            <p className="text-[9px] text-muted-foreground">Elite</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Profit Center Panel ──────────────────────────────────────────────
function ProfitCenter({ bankroll, onBankrollChange }: { bankroll: number; onBankrollChange: (v: number) => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [placing, setPlacing] = useState(false);
  const [settling, setSettling] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [lockPlay, setLockPlay] = useState<any>(null);
  const [lockLoading, setLockLoading] = useState(false);

  const { data: wallet } = useQuery({
    queryKey: ['sbo-wallet', user?.id],
    queryFn: async () => {
      const { data } = await (supabase as any).from('sbo_betting_wallet').select('*').eq('user_id', user?.id).single();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: bets = [] } = useQuery({
    queryKey: ['sbo-bet-log', user?.id],
    queryFn: async () => {
      const { data } = await (supabase as any).from('sbo_bet_log').select('*').eq('user_id', user?.id).order('placed_at', { ascending: false }).limit(50);
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: strategies = [] } = useQuery({
    queryKey: ['sbo-strategies', user?.id],
    queryFn: async () => {
      const { data } = await (supabase as any).from('sbo_strategy_performance').select('*').eq('user_id', user?.id).order('roi_pct', { ascending: false });
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: reports = [] } = useQuery({
    queryKey: ['sbo-daily-reports', user?.id],
    queryFn: async () => {
      const { data } = await (supabase as any).from('sbo_daily_report').select('*').eq('user_id', user?.id).order('report_date', { ascending: false }).limit(14);
      return data || [];
    },
    enabled: !!user?.id,
  });

  const refetchProfit = () => {
    qc.invalidateQueries({ queryKey: ['sbo-wallet'] });
    qc.invalidateQueries({ queryKey: ['sbo-bet-log'] });
    qc.invalidateQueries({ queryKey: ['sbo-strategies'] });
    qc.invalidateQueries({ queryKey: ['sbo-daily-reports'] });
  };

  const runAutoBet = async () => {
    setPlacing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sbo-auto-bet', { body: { mode: 'auto_bet', bankroll, min_confidence: 70 } });
      if (error) throw error;
      if (!data.success) { toast.error(data.reason || 'No bets placed'); return; }
      toast.success(`🎰 ${data.bets_placed} bets placed ($${data.total_staked} wagered)`);
      if (data.lock_play) toast.success(`🔒 LOCK: ${data.lock_play.player} ${data.lock_play.direction} ${data.lock_play.line}`);
      refetchProfit();
    } catch (err: any) { toast.error(err.message); } finally { setPlacing(false); }
  };

  const settleBets = async () => {
    setSettling(true);
    try {
      const { data, error } = await supabase.functions.invoke('sbo-auto-bet', { body: { mode: 'settle' } });
      if (error) throw error;
      toast.success(`Settled ${data.settled}: ${data.wins}W/${data.losses}L | P/L: $${data.profit}`);
      refetchProfit();
    } catch (err: any) { toast.error(err.message); } finally { setSettling(false); }
  };

  const generateReport = async () => {
    setReportLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('sbo-auto-bet', { body: { mode: 'daily_report' } });
      if (error) throw error;
      toast.success(`📊 Report: ${data.report.wins}W/${data.report.losses}L | ROI: ${data.report.roi}`);
      refetchProfit();
    } catch (err: any) { toast.error(err.message); } finally { setReportLoading(false); }
  };

  const getLockPlay = async () => {
    setLockLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('sbo-auto-bet', { body: { mode: 'lock_play' } });
      if (error) throw error;
      if (!data.success) { toast.error(data.reason); return; }
      setLockPlay(data.lock_play);
      toast.success(`🔒 Lock play: ${data.lock_play.player_name}`);
    } catch (err: any) { toast.error(err.message); } finally { setLockLoading(false); }
  };

  const adjustWeights = async () => {
    try {
      const { error } = await supabase.functions.invoke('sbo-auto-bet', { body: { mode: 'adjust_weights' } });
      if (error) throw error;
      toast.success('Strategy weights auto-adjusted');
      refetchProfit();
    } catch (err: any) { toast.error(err.message); }
  };

  const totalProfit = wallet?.total_profit || 0;
  const roi = wallet?.total_wagered > 0 ? (totalProfit / wallet.total_wagered * 100).toFixed(1) : '0.0';
  const winRate = (wallet?.wins || 0) + (wallet?.losses || 0) > 0
    ? ((wallet.wins / (wallet.wins + wallet.losses)) * 100).toFixed(1) : '—';
  const pendingBets = bets.filter((b: any) => b.result === 'pending');
  const todayBets = bets.filter((b: any) => b.game_date === new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }));

  return (
    <div className="space-y-4">
      {/* Wallet KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        <Card className="border-emerald-500/20"><CardContent className="p-3 text-center">
          <Banknote className="h-4 w-4 mx-auto text-emerald-400 mb-1" />
          <p className="text-xl font-black text-emerald-400">${(wallet?.bankroll || bankroll).toFixed(0)}</p>
          <p className="text-[10px] text-muted-foreground">Bankroll</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className={`text-xl font-black ${totalProfit >= 0 ? 'text-emerald-400' : 'text-destructive'}`}>{totalProfit >= 0 ? '+' : ''}${totalProfit.toFixed(2)}</p>
          <p className="text-[10px] text-muted-foreground">Total P/L</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className={`text-xl font-black ${parseFloat(roi) > 0 ? 'text-emerald-400' : 'text-destructive'}`}>{roi}%</p>
          <p className="text-[10px] text-muted-foreground">ROI</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-xl font-black">{winRate}%</p>
          <p className="text-[10px] text-muted-foreground">Win Rate</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-xl font-black">{wallet?.total_bets || 0}</p>
          <p className="text-[10px] text-muted-foreground">Total Bets</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-xl font-black text-amber-400">{pendingBets.length}</p>
          <p className="text-[10px] text-muted-foreground">Pending</p>
        </CardContent></Card>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" onClick={runAutoBet} disabled={placing} className="gap-1.5 bg-gradient-to-r from-emerald-600 to-green-600">
          {placing ? <Loader2 className="h-3 w-3 animate-spin" /> : <PlayCircle className="h-3 w-3" />}
          {placing ? 'Placing...' : '🎰 Auto Bet'}
        </Button>
        <Button size="sm" variant="outline" onClick={settleBets} disabled={settling} className="gap-1.5">
          {settling ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          💰 Settle
        </Button>
        <Button size="sm" variant="outline" onClick={getLockPlay} disabled={lockLoading} className="gap-1.5">
          {lockLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Lock className="h-3 w-3" />}
          🔒 Lock Play
        </Button>
        <Button size="sm" variant="outline" onClick={generateReport} disabled={reportLoading} className="gap-1.5">
          {reportLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <BarChart3 className="h-3 w-3" />}
          📊 Report
        </Button>
        <Button size="sm" variant="ghost" onClick={adjustWeights} className="gap-1.5 text-xs">
          <Brain className="h-3 w-3" /> Auto-Adjust
        </Button>
      </div>

      {/* Lock Play */}
      {lockPlay && (
        <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-amber-900/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🔒</span>
              <div className="flex-1">
                <p className="text-xs text-amber-400 font-semibold uppercase">Daily Lock Play</p>
                <p className="text-lg font-black">{lockPlay.player_name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-[10px]">{lockPlay.stat_type}</Badge>
                  <Badge className={`text-[10px] ${lockPlay.direction === 'OVER' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-blue-500/20 text-blue-400 border-blue-500/30'}`}>
                    {lockPlay.direction} {lockPlay.line}
                  </Badge>
                  <span className="text-xs font-bold">Score: {lockPlay.composite_score}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xl font-black text-emerald-400">${lockPlay.bet_amount}</p>
                <p className="text-[10px] text-muted-foreground">{lockPlay.bet_pct?.toFixed(1)}% bankroll</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Strategy Analyzer */}
      {strategies.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-2"><BarChart3 className="h-4 w-4 text-blue-400" /> Strategy Performance</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {strategies.map((s: any) => {
              const color = s.strategy === 'SHARP' ? 'purple' : s.strategy === 'VALUE' ? 'emerald' : 'blue';
              return (
                <Card key={s.id} className={`border-${color}-500/20`}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className={`text-[10px] text-${color}-400 border-${color}-400/30`}>
                        {s.strategy === 'SHARP' ? '🧠' : s.strategy === 'VALUE' ? '💰' : '📊'} {s.strategy}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">Weight: {(s.current_weight * 100).toFixed(0)}%</span>
                    </div>
                    <p className={`text-xl font-black ${(s.roi_pct || 0) > 0 ? 'text-emerald-400' : 'text-destructive'}`}>{s.roi_pct > 0 ? '+' : ''}{s.roi_pct}% ROI</p>
                    <p className="text-[10px] text-muted-foreground">{s.wins}W/{s.losses}L · ${(s.total_profit || 0).toFixed(2)} P/L</p>
                    <Progress value={Math.max(0, Math.min(100, 50 + (s.roi_pct || 0)))} className="h-1 mt-2" />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Bets */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold flex items-center gap-2"><Activity className="h-4 w-4" /> Recent Bets</h3>
        {bets.length === 0 ? (
          <Card className="border-dashed"><CardContent className="p-6 text-center text-sm text-muted-foreground">
            No bets placed yet. Click 🎰 Auto Bet to start.
          </CardContent></Card>
        ) : bets.slice(0, 20).map((b: any) => (
          <Card key={b.id} className={b.is_lock_play ? 'border-amber-500/20' : ''}>
            <CardContent className="p-3 flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-medium text-sm">{b.player_name}</span>
                  <Badge variant="outline" className="text-[10px]">{b.stat_type}</Badge>
                  <Badge variant="outline" className={`text-[10px] ${b.direction === 'OVER' ? 'text-emerald-400 border-emerald-400/30' : 'text-blue-400 border-blue-400/30'}`}>{b.direction} {b.line}</Badge>
                  {b.is_lock_play && <Badge className="text-[8px] bg-amber-500/20 text-amber-400 border-amber-500/30">🔒 LOCK</Badge>}
                  {b.auto_placed && <Badge variant="outline" className="text-[8px] text-blue-400 border-blue-400/30">🤖 Auto</Badge>}
                  <Badge variant="outline" className="text-[8px]">{b.strategy}</Badge>
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{new Date(b.placed_at).toLocaleString()}</div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-medium">${b.stake}</p>
                {b.result === 'pending' ? (
                  <Badge variant="secondary" className="text-[10px]">⏳ Pending</Badge>
                ) : (
                  <div>
                    <Badge variant={b.result === 'won' ? 'default' : 'destructive'} className="text-[10px]">
                      {b.result === 'won' ? '✅' : b.result === 'push' ? '↔️' : '❌'} {b.result}
                    </Badge>
                    <p className={`text-[10px] font-bold ${(b.profit || 0) >= 0 ? 'text-emerald-400' : 'text-destructive'}`}>
                      {b.profit >= 0 ? '+' : ''}${(b.profit || 0).toFixed(2)}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Daily Reports */}
      {reports.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Daily Reports</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {reports.slice(0, 7).map((r: any) => (
              <Card key={r.id} className={r.stop_loss_hit ? 'border-destructive/30' : ''}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold">{r.report_date}</span>
                    {r.stop_loss_hit && <Badge variant="destructive" className="text-[8px]">⛔ Stop Loss</Badge>}
                  </div>
                  <div className="flex items-center gap-3 text-[11px]">
                    <span>{r.wins}W/{r.losses}L</span>
                    <span className={`font-bold ${r.total_profit >= 0 ? 'text-emerald-400' : 'text-destructive'}`}>
                      {r.total_profit >= 0 ? '+' : ''}${r.total_profit?.toFixed(2)}
                    </span>
                    <span className="text-muted-foreground">ROI: {r.roi_pct}%</span>
                    {r.best_strategy && <Badge variant="outline" className="text-[8px]">Best: {r.best_strategy}</Badge>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Risk Settings */}
      <Card>
        <CardContent className="p-4">
          <h4 className="text-xs font-semibold mb-3 flex items-center gap-2"><ShieldAlert className="h-3.5 w-3.5 text-amber-400" /> Risk Controls</h4>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <p className="text-muted-foreground text-[10px]">Max Daily Loss</p>
              <p className="font-bold">{wallet?.max_daily_loss_pct || 10}%</p>
            </div>
            <div>
              <p className="text-muted-foreground text-[10px]">Max Bets/Day</p>
              <p className="font-bold">{wallet?.max_bets_per_day || 15}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-[10px]">Streak Scaling</p>
              <p className="font-bold">{wallet?.streak_multiplier ? '✅ On' : '❌ Off'}</p>
            </div>
          </div>
          <div className="mt-2 text-[10px] text-muted-foreground">
            Today: {todayBets.length}/{wallet?.max_bets_per_day || 15} bets
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────
export default function SBOCapperTracker() {
  const qc = useQueryClient();
  const [sportFilter, setSportFilter] = useState<string>('all');
  const [matching, setMatching] = useState(false);
  const [runningConsensus, setRunningConsensus] = useState(false);
  const [runningTopPlays, setRunningTopPlays] = useState(false);
  const [topPlays, setTopPlays] = useState<any[]>([]);
  const [bankroll, setBankroll] = useState(1000);

  const { data: cappers = [] } = useQuery({
    queryKey: ['sbo-cappers'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('sbo_cappers').select('*').order('win_rate', { ascending: false });
      return data || [];
    },
  });

  const { data: picks = [] } = useQuery({
    queryKey: ['sbo-capper-picks', sportFilter],
    queryFn: async () => {
      let q = (supabase as any).from('sbo_capper_picks')
        .select('*, sbo_cappers(name, tier, source, group_type)')
        .order('created_at', { ascending: false }).limit(200);
      if (sportFilter !== 'all') q = q.eq('sport', sportFilter);
      const { data } = await q;
      return data || [];
    },
  });

  const { data: performances = [] } = useQuery({
    queryKey: ['sbo-capper-performance'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('sbo_capper_performance')
        .select('*').order('win_rate', { ascending: false });
      return data || [];
    },
  });

  const { data: valueProps = [] } = useQuery({
    queryKey: ['sbo-value-props'],
    queryFn: async () => {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
      const { data } = await (supabase as any).from('props_master')
        .select('id, player_name, stat_type, line, consensus_over, consensus_under, consensus_score, signal_strength, is_value_play, value_score, ai_confidence, ai_recommendation')
        .eq('game_date', today)
        .not('consensus_score', 'is', null)
        .order('consensus_score', { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  const { data: signalPerf = [] } = useQuery({
    queryKey: ['sbo-signal-performance'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('sbo_signal_performance')
        .select('*').not('result', 'eq', 'pending')
        .order('created_at', { ascending: false }).limit(200);
      return data || [];
    },
  });

  const { data: marketPerf = [] } = useQuery({
    queryKey: ['sbo-market-performance'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('sbo_market_performance')
        .select('*').order('win_rate', { ascending: false });
      return data || [];
    },
  });
  const [recalcingMarkets, setRecalcingMarkets] = useState(false);

  const refetchAll = () => {
    qc.invalidateQueries({ queryKey: ['sbo-cappers'] });
    qc.invalidateQueries({ queryKey: ['sbo-capper-picks'] });
    qc.invalidateQueries({ queryKey: ['sbo-capper-picks-review'] });
    qc.invalidateQueries({ queryKey: ['sbo-capper-performance'] });
    qc.invalidateQueries({ queryKey: ['sbo-value-props'] });
    qc.invalidateQueries({ queryKey: ['sbo-signal-performance'] });
    qc.invalidateQueries({ queryKey: ['sbo-market-performance'] });
  };

  const recalcMarkets = async () => {
    setRecalcingMarkets(true);
    try {
      const { data, error } = await supabase.functions.invoke('sbo-market-performance', { body: { mode: 'recalc' } });
      if (error) throw error;
      toast.success(`📊 ${data.markets_updated} market segments recalculated`);
      refetchAll();
    } catch (err: any) { toast.error(err.message); } finally { setRecalcingMarkets(false); }
  };

  const runMatchAndResolve = async () => {
    setMatching(true);
    try {
      const { data, error } = await supabase.functions.invoke('sbo-match-capper-picks', { body: { mode: 'match_and_resolve' } });
      if (error) throw error;
      toast.success(`Matched ${data.matched} picks, resolved ${data.resolved} results`);
      refetchAll();
    } catch (err: any) { toast.error(err.message || 'Match failed'); } finally { setMatching(false); }
  };

  const runConsensusEngine = async () => {
    setRunningConsensus(true);
    try {
      const { data, error } = await supabase.functions.invoke('sbo-consensus-engine', { body: {} });
      if (error) throw error;
      toast.success(`Consensus: ${data.consensus_updated} props scored, ${data.value_plays} value plays found`);
      refetchAll();
    } catch (err: any) { toast.error(err.message || 'Consensus failed'); } finally { setRunningConsensus(false); }
  };

  const runTopPlaysEngine = async () => {
    setRunningTopPlays(true);
    try {
      const { data, error } = await supabase.functions.invoke('sbo-top-plays', { body: { bankroll } });
      if (error) throw error;
      setTopPlays(data.top_plays || []);
      toast.success(`🏆 ${data.top_plays?.length || 0} top plays ranked from ${data.total_scored} props`);
      refetchAll();
    } catch (err: any) { toast.error(err.message || 'Top plays failed'); } finally { setRunningTopPlays(false); }
  };

  const updateResult = async (pickId: string, result: string) => {
    await (supabase as any).from('sbo_capper_picks').update({ result }).eq('id', pickId);
    const pick = picks.find((p: any) => p.id === pickId);
    if (pick) {
      const allPicks = picks.filter((p: any) => p.capper_id === pick.capper_id);
      const updated = allPicks.map((p: any) => p.id === pickId ? { ...p, result } : p);
      const resolved = updated.filter((p: any) => p.result !== 'pending');
      const wins = resolved.filter((p: any) => p.result === 'won').length;
      const winRate = resolved.length > 0 ? (wins / resolved.length) * 100 : 0;
      await (supabase as any).from('sbo_cappers').update({ total_picks: updated.length, win_rate: winRate, updated_at: new Date().toISOString() }).eq('id', pick.capper_id);
    }
    toast.success(`Marked ${result}`); refetchAll();
  };

  const pendingPicks = picks.filter((p: any) => p.result === 'pending');
  const resolvedPicks = picks.filter((p: any) => p.result !== 'pending');
  const overallWinRate = resolvedPicks.length > 0
    ? ((resolvedPicks.filter((p: any) => p.result === 'won').length / resolvedPicks.length) * 100).toFixed(1) : '—';

  const sportBreakdown = picks.reduce((acc: Record<string, { total: number; wins: number }>, p: any) => {
    const s = p.sport || 'NBA';
    if (!acc[s]) acc[s] = { total: 0, wins: 0 };
    if (p.result !== 'pending') { acc[s].total++; if (p.result === 'won') acc[s].wins++; }
    return acc;
  }, {} as Record<string, { total: number; wins: number }>);

  const topPerformers = performances.filter((p: any) => p.total_picks >= 5).slice(0, 5);
  const strongSignals = valueProps.filter((p: any) => p.signal_strength === 'STRONG');
  const valuePlays = valueProps.filter((p: any) => p.is_value_play);

  // Signal accuracy stats
  const signalStats = signalPerf.reduce((acc: Record<string, { total: number; wins: number }>, s: any) => {
    const key = s.signal_type || 'OTHER';
    if (!acc[key]) acc[key] = { total: 0, wins: 0 };
    acc[key].total++;
    if (s.result === 'won') acc[key].wins++;
    return acc;
  }, {} as Record<string, { total: number; wins: number }>);

  return (
    <TooltipProvider>
      <div className="p-4 space-y-4 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
              <Crown className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                Capper Intelligence
                <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400">Decision Engine</Badge>
              </h1>
              <p className="text-xs text-muted-foreground">Top plays · Bet sizing · Sharp detection · Signal learning</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <div className="flex items-center gap-1">
              <DollarSign className="h-3 w-3 text-muted-foreground" />
              <Input type="number" value={bankroll} onChange={e => setBankroll(Number(e.target.value) || 1000)} className="w-20 h-7 text-xs" />
            </div>
            <Button size="sm" className="gap-1.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700" onClick={runTopPlaysEngine} disabled={runningTopPlays}>
              {runningTopPlays ? <Loader2 className="h-3 w-3 animate-spin" /> : <Crown className="h-3 w-3" />}
              {runningTopPlays ? 'Ranking...' : '🏆 Top Plays'}
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={runConsensusEngine} disabled={runningConsensus}>
              {runningConsensus ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
              ⚡ Consensus
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={runMatchAndResolve} disabled={matching}>
              {matching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
              🔗 Match
            </Button>
            <PhotoUploadDialog cappers={cappers} onAdded={refetchAll} />
            <AddPickDialog cappers={cappers} onAdded={refetchAll} />
            <AddCapperDialog onAdded={refetchAll} />
          </div>
        </div>

        {/* Sport Filter */}
        <div className="flex gap-1.5 flex-wrap">
          <Badge variant="outline" className={`text-[10px] cursor-pointer ${sportFilter === 'all' ? 'bg-primary text-primary-foreground' : ''}`} onClick={() => setSportFilter('all')}>All Sports</Badge>
          {SPORTS.map(s => <Badge key={s} variant="outline" className={`text-[10px] cursor-pointer ${sportFilter === s ? sportColors[s] : 'opacity-50'}`} onClick={() => setSportFilter(s)}>{s}</Badge>)}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          <Card><CardContent className="p-3 text-center">
            <p className="text-lg font-bold">{cappers.length}</p><p className="text-[10px] text-muted-foreground">Cappers</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <p className="text-lg font-bold text-amber-500">{cappers.filter((c: any) => c.tier === 'elite').length}</p><p className="text-[10px] text-muted-foreground">Elite Tier</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <p className="text-lg font-bold">{pendingPicks.length}</p><p className="text-[10px] text-muted-foreground">Pending</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <p className={`text-lg font-bold ${parseFloat(String(overallWinRate)) >= 55 ? 'text-emerald-500' : ''}`}>{overallWinRate}%</p><p className="text-[10px] text-muted-foreground">Win Rate</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <p className="text-lg font-bold">{Object.keys(sportBreakdown).length}</p><p className="text-[10px] text-muted-foreground">Sports</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <p className="text-lg font-bold text-emerald-500">{picks.filter((p: any) => p.matched_prop_id).length}</p><p className="text-[10px] text-muted-foreground">🔗 Linked</p>
          </CardContent></Card>
          <Card className="border-amber-500/20"><CardContent className="p-3 text-center">
            <p className="text-lg font-bold text-amber-400">{topPlays.length || strongSignals.length}</p><p className="text-[10px] text-muted-foreground">🏆 Top Plays</p>
          </CardContent></Card>
          <Card className="border-emerald-500/20"><CardContent className="p-3 text-center">
            <p className="text-lg font-bold text-emerald-400">{valuePlays.length}</p><p className="text-[10px] text-muted-foreground">💰 Value</p>
          </CardContent></Card>
        </div>

        {/* Sport Breakdown */}
        {Object.keys(sportBreakdown).length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {(Object.entries(sportBreakdown) as [string, { total: number; wins: number }][]).map(([s, data]) => {
              const wr = data.total > 0 ? ((data.wins / data.total) * 100).toFixed(0) : '—';
              return <Badge key={s} variant="outline" className={`text-[10px] ${sportColors[s] || ''}`}>{s}: {wr}% ({data.wins}W/{data.total - data.wins}L)</Badge>;
            })}
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="profit">
          <TabsList className="w-full grid grid-cols-9">
            <TabsTrigger value="profit" className="text-xs gap-1"><Banknote className="h-3 w-3" /> Profit</TabsTrigger>
            <TabsTrigger value="top-plays" className="text-xs gap-1"><Crown className="h-3 w-3" /> Top Plays</TabsTrigger>
            <TabsTrigger value="markets" className="text-xs gap-1"><Layers className="h-3 w-3" /> Markets</TabsTrigger>
            <TabsTrigger value="signals" className="text-xs gap-1"><Target className="h-3 w-3" /> Signals</TabsTrigger>
            <TabsTrigger value="feed" className="text-xs gap-1"><Activity className="h-3 w-3" /> Feed</TabsTrigger>
            <TabsTrigger value="review" className="text-xs gap-1"><AlertTriangle className="h-3 w-3" /> Review</TabsTrigger>
            <TabsTrigger value="leaderboard" className="text-xs gap-1"><Trophy className="h-3 w-3" /> Board</TabsTrigger>
            <TabsTrigger value="learning" className="text-xs gap-1"><Brain className="h-3 w-3" /> Learning</TabsTrigger>
            <TabsTrigger value="settings" className="text-xs gap-1"><Settings className="h-3 w-3" /> Settings</TabsTrigger>
          </TabsList>

          {/* ── PROFIT CENTER TAB ── */}
          <TabsContent value="profit" className="mt-3">
            <ProfitCenter bankroll={bankroll} onBankrollChange={setBankroll} />
          </TabsContent>

          {/* ── TOP PLAYS TAB ── */}
          <TabsContent value="top-plays" className="mt-3 space-y-3">
            {topPlays.length > 0 ? (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <Crown className="h-4 w-4 text-amber-400" /> Today's Top Plays
                    <Badge variant="outline" className="text-[10px]">${bankroll} bankroll</Badge>
                  </h3>
                  <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-400/30">
                    Total suggested: ${topPlays.reduce((s: number, p: any) => s + (p.bet_amount || 0), 0)}
                  </Badge>
                </div>
                {topPlays.map((play: any, i: number) => (
                  <TopPlayCard key={play.id} play={play} rank={i + 1} />
                ))}
              </>
            ) : (
              <Card className="border-dashed border-amber-500/20"><CardContent className="p-8 text-center">
                <Crown className="h-10 w-10 mx-auto text-amber-500/30 mb-3" />
                <p className="font-semibold">No top plays generated yet</p>
                <p className="text-sm text-muted-foreground mt-1">Run ⚡ Consensus first, then click 🏆 Top Plays to rank</p>
              </CardContent></Card>
            )}
          </TabsContent>

          {/* ── MARKETS TAB ── */}
          <TabsContent value="markets" className="mt-3 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Layers className="h-4 w-4 text-blue-400" /> Market Performance by Sport
              </h3>
              <Button size="sm" variant="outline" onClick={recalcMarkets} disabled={recalcingMarkets} className="gap-1.5 text-xs">
                {recalcingMarkets ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                Recalculate
              </Button>
            </div>

            {marketPerf.length > 0 ? (
              <>
                {/* Summary by market type */}
                {(() => {
                  const byType: Record<string, { wins: number; losses: number; bets: number; profit: number }> = {};
                  for (const m of marketPerf as any[]) {
                    const mt = m.market_type || 'prop';
                    if (!byType[mt]) byType[mt] = { wins: 0, losses: 0, bets: 0, profit: 0 };
                    byType[mt].wins += m.wins || 0;
                    byType[mt].losses += m.losses || 0;
                    byType[mt].bets += m.total_bets || 0;
                    byType[mt].profit += (m.roi || 0) * (m.total_bets || 0);
                  }
                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                      {Object.entries(byType).map(([mt, d]) => {
                        const wr = d.wins + d.losses > 0 ? ((d.wins / (d.wins + d.losses)) * 100).toFixed(1) : '—';
                        const isGood = parseFloat(wr) >= 55;
                        const isBad = parseFloat(wr) < 48 && parseFloat(wr) > 0;
                        return (
                          <Card key={mt} className={isGood ? 'border-emerald-500/20' : isBad ? 'border-destructive/20' : ''}>
                            <CardContent className="p-3 text-center">
                              <Badge variant="outline" className="text-[10px] mb-1">{mt.toUpperCase()}</Badge>
                              <p className={`text-xl font-black ${isGood ? 'text-emerald-400' : isBad ? 'text-destructive' : ''}`}>{wr}%</p>
                              <p className="text-[10px] text-muted-foreground">{d.wins}W/{d.losses}L · {d.bets} bets</p>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* Detailed breakdown */}
                <div className="space-y-2">
                  {(marketPerf as any[]).map((m: any) => {
                    const isStrong = (m.win_rate || 0) >= 55;
                    const isWeak = (m.win_rate || 0) < 48 && (m.total_bets || 0) >= 10;
                    const weightLabel = m.current_weight >= 1.2 ? '🔥 Boosted' : m.current_weight <= 0.6 ? '⚠️ Reduced' : '○ Normal';
                    return (
                      <Card key={m.id} className={isStrong ? 'border-emerald-500/20' : isWeak ? 'border-destructive/20' : ''}>
                        <CardContent className="p-3 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 flex-1">
                            <Badge className={`text-[10px] ${sportColors[m.sport] || ''}`}>{m.sport}</Badge>
                            <Badge variant="outline" className="text-[10px]">{m.market_type}</Badge>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-bold ${isStrong ? 'text-emerald-400' : isWeak ? 'text-destructive' : ''}`}>
                                  {m.win_rate}% WR
                                </span>
                                <span className={`text-xs ${(m.roi || 0) > 0 ? 'text-emerald-400' : 'text-destructive'}`}>
                                  {m.roi > 0 ? '+' : ''}{m.roi}% ROI
                                </span>
                                <span className="text-[10px] text-muted-foreground">{m.wins}W/{m.losses}L</span>
                              </div>
                              <Progress value={Math.max(0, Math.min(100, m.win_rate || 0))} className="h-1 mt-1" />
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <Badge variant="outline" className={`text-[9px] ${
                              m.current_weight >= 1.2 ? 'text-emerald-400 border-emerald-400/30' :
                              m.current_weight <= 0.6 ? 'text-destructive border-destructive/30' : ''
                            }`}>{weightLabel}</Badge>
                            <p className="text-[9px] text-muted-foreground mt-0.5">Weight: {(m.current_weight * 100).toFixed(0)}%</p>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                <Card>
                  <CardContent className="p-4">
                    <h4 className="text-xs font-semibold mb-2">How Market Weighting Works</h4>
                    <div className="space-y-1.5 text-[11px] text-muted-foreground">
                      <p>🔥 <strong>Boosted (130%)</strong> — Market wins ≥ 58% over 10+ bets → system prioritizes these plays</p>
                      <p>📊 <strong>Normal (100%)</strong> — Market performing within expected range</p>
                      <p>⚠️ <strong>Reduced (50-70%)</strong> — Market wins &lt; 50% → system deprioritizes these plays</p>
                      <p className="pt-2 text-[10px]">Weights auto-adjust on recalculation and feed into the composite scoring engine.</p>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="border-dashed"><CardContent className="p-8 text-center">
                <Layers className="h-8 w-8 mx-auto text-blue-400/30 mb-2" />
                <p className="font-semibold">No market data yet</p>
                <p className="text-sm text-muted-foreground mt-1">Place and settle bets, then click Recalculate to see performance by market type</p>
              </CardContent></Card>
            )}
          </TabsContent>

          <TabsContent value="signals" className="mt-3 space-y-4">
            {valuePlays.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-2"><TrendingUp className="h-4 w-4 text-emerald-400" /> 💰 Value Plays</h3>
                {valuePlays.map((p: any) => (
                  <Card key={p.id} className="border-emerald-500/20 bg-emerald-500/5">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">{p.player_name}</span>
                            <Badge variant="outline" className="text-[10px]">{p.stat_type}</Badge>
                            <span className="text-xs font-medium">{p.line}</span>
                            <Badge className="text-[10px] bg-emerald-500/20 text-emerald-400 border-emerald-500/30">💰 VALUE</Badge>
                          </div>
                          <ConsensusMeter over={p.consensus_over || 0} under={p.consensus_under || 0} signal={p.signal_strength || 'LOW'} />
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-lg font-bold text-emerald-400">+{p.value_score}</p>
                          <p className="text-[10px] text-muted-foreground">edge score</p>
                          {p.ai_recommendation && <Badge variant="outline" className={`text-[10px] mt-1 ${p.ai_recommendation?.toUpperCase() === 'OVER' ? 'text-emerald-400 border-emerald-400/30' : 'text-blue-400 border-blue-400/30'}`}>AI: {p.ai_recommendation}</Badge>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {strongSignals.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-2"><Flame className="h-4 w-4 text-amber-400" /> 🔥 Strong Signals</h3>
                {strongSignals.filter((p: any) => !p.is_value_play).map((p: any) => (
                  <Card key={p.id} className="border-amber-500/20">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{p.player_name}</span>
                            <Badge variant="outline" className="text-[10px]">{p.stat_type}</Badge>
                            <span className="text-xs">{p.line}</span>
                            <Badge className="text-[10px] bg-amber-500/20 text-amber-400 border-amber-500/30">🔥 STRONG</Badge>
                          </div>
                          <ConsensusMeter over={p.consensus_over || 0} under={p.consensus_under || 0} signal={p.signal_strength} />
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold">{p.consensus_score}%</p>
                          <p className="text-[10px] text-muted-foreground">consensus</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {valueProps.filter((p: any) => p.signal_strength !== 'STRONG' && !p.is_value_play).length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground">Other Consensus Props</h3>
                {valueProps.filter((p: any) => p.signal_strength !== 'STRONG' && !p.is_value_play).map((p: any) => (
                  <Card key={p.id}><CardContent className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{p.player_name}</span>
                          <Badge variant="outline" className="text-[10px]">{p.stat_type}</Badge>
                          <span className="text-xs">{p.line}</span>
                        </div>
                        <ConsensusMeter over={p.consensus_over || 0} under={p.consensus_under || 0} signal={p.signal_strength} />
                      </div>
                      <span className="text-xs text-muted-foreground">{p.consensus_score}%</span>
                    </div>
                  </CardContent></Card>
                ))}
              </div>
            )}

            {valueProps.length === 0 && (
              <Card className="border-dashed"><CardContent className="p-8 text-center">
                <Target className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">Run ⚡ Consensus to generate signals</p>
              </CardContent></Card>
            )}
          </TabsContent>

          {/* Pick Feed */}
          <TabsContent value="feed" className="mt-3 space-y-2">
            {picks.length === 0 ? (
              <Card className="border-dashed"><CardContent className="p-8 text-center">
                <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No picks logged yet. Use 📸 AI Photo Parse to get started.</p>
              </CardContent></Card>
            ) : picks.map((p: any) => (
              <Card key={p.id} className="overflow-hidden hover:border-primary/20 transition-colors">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline" className={`text-[10px] ${tierColors[p.sbo_cappers?.tier] || ''}`}>{p.sbo_cappers?.name || 'Unknown'}</Badge>
                        <Badge className={`text-[10px] ${sportColors[p.sport] || sportColors.NBA}`}>{p.sport || 'NBA'}</Badge>
                        {p.bet_type && p.bet_type !== 'prop' && <Badge variant="outline" className="text-[10px]">{p.bet_type}</Badge>}
                        {p.parsed_by_ai && <Badge variant="outline" className="text-[8px] text-blue-400 border-blue-400/30">🤖 AI</Badge>}
                        {p.matched_prop_id && <Badge variant="outline" className="text-[8px] text-emerald-400 border-emerald-400/30">🔗 Linked</Badge>}
                        {p.sharp_flag && <Badge variant="outline" className="text-[8px] text-purple-400 border-purple-400/30">🧠 Sharp</Badge>}
                        {p.player_name && <span className="text-sm font-medium">{p.player_name}</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {p.direction && <Badge variant="outline" className={`text-[10px] ${p.direction === 'OVER' || p.direction === 'WIN' ? 'text-emerald-500 border-emerald-500/30' : 'text-blue-500 border-blue-500/30'}`}>{p.direction}</Badge>}
                        {p.prop_type && <Badge variant="outline" className="text-[10px]">{p.prop_type}</Badge>}
                        {p.line != null && <span className="text-xs font-medium">{p.line}</span>}
                        {p.odds && <span className="text-xs text-muted-foreground">{p.odds > 0 ? '+' : ''}{p.odds}</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                        <Clock className="h-3 w-3" /><span>{new Date(p.created_at).toLocaleString()}</span>
                        {p.game_date && <span>· {p.game_date}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {p.result === 'pending' ? (
                        <>
                          <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-emerald-500" onClick={() => updateResult(p.id, 'won')}><CheckCircle className="h-3.5 w-3.5" /></Button>
                          <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-destructive" onClick={() => updateResult(p.id, 'lost')}><XCircle className="h-3.5 w-3.5" /></Button>
                        </>
                      ) : (
                        <Badge variant={p.result === 'won' ? 'default' : 'destructive'} className="text-[10px]">
                          {p.result === 'won' ? '✅ Won' : p.result === 'push' ? '↔️ Push' : '❌ Lost'}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Review Queue */}
          <TabsContent value="review" className="mt-3"><ReviewQueue onResolved={refetchAll} /></TabsContent>

          {/* Leaderboard */}
          <TabsContent value="leaderboard" className="mt-3 space-y-2">
            {topPerformers.length > 0 && (
              <div className="space-y-2 mb-4">
                <h3 className="text-sm font-semibold flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-400" /> Top Performers (5+ picks)</h3>
                {topPerformers.map((perf: any, i: number) => {
                  const capper = cappers.find((c: any) => c.id === perf.capper_id);
                  return (
                    <Card key={perf.id} className={i === 0 ? 'border-amber-500/30' : ''}>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-lg font-bold text-muted-foreground w-6 text-center">#{i + 1}</span>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{capper?.name || 'Unknown'}</span>
                                <Badge variant="outline" className={`text-[10px] ${gradeColors[perf.confidence_grade] || ''}`}>Grade {perf.confidence_grade}</Badge>
                                <Badge className={`text-[10px] ${sportColors[perf.sport] || ''}`}>{perf.sport}</Badge>
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                                {perf.hot_streak > 2 && <span className="text-amber-400">🔥 {perf.hot_streak}W streak</span>}
                                {perf.cold_streak > 2 && <span className="text-red-400">❄️ {perf.cold_streak}L streak</span>}
                                <span>L7: {perf.last_7_win_rate}%</span>
                                <span>L30: {perf.last_30_win_rate}%</span>
                                {perf.roi !== 0 && <span className={perf.roi > 0 ? 'text-emerald-400' : 'text-red-400'}>ROI: {perf.roi > 0 ? '+' : ''}{perf.roi}%</span>}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold">{perf.win_rate}%</p>
                            <p className="text-[10px] text-muted-foreground">{perf.wins}W/{perf.losses}L</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {cappers.filter((c: any) => c.is_active).sort((a: any, b: any) => (b.win_rate || 0) - (a.win_rate || 0)).map((c: any, i: number) => {
              const capperPicks = picks.filter((p: any) => p.capper_id === c.id);
              const resolved = capperPicks.filter((p: any) => p.result !== 'pending');
              const wins = resolved.filter((p: any) => p.result === 'won').length;
              const wr = resolved.length > 0 ? ((wins / resolved.length) * 100) : 0;
              return (
                <Card key={c.id}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-muted-foreground w-6 text-center">#{i + 1}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-[10px] ${tierColors[c.tier]}`}>{c.tier}</Badge>
                          <span className="font-medium text-sm">{c.name}</span>
                        </div>
                        <div className="flex gap-1 mt-1">
                          {(c.sports || ['NBA']).map((s: string) => <Badge key={s} variant="outline" className={`text-[8px] ${sportColors[s] || ''}`}>{s}</Badge>)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-xs space-y-0.5">
                      <p className="text-sm font-bold">{wr.toFixed(1)}% WR</p>
                      <p className="text-muted-foreground">{capperPicks.length} picks · {wins}W/{resolved.length - wins}L</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          {/* ── LEARNING TAB ── */}
          <TabsContent value="learning" className="mt-3 space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2"><Brain className="h-4 w-4 text-purple-400" /> Signal Performance Tracker</h3>

            {Object.keys(signalStats).length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {Object.entries(signalStats).map(([type, stats]) => {
                  const s = stats as { total: number; wins: number };
                  const wr = s.total > 0 ? Math.round((s.wins / s.total) * 100) : 0;
                  const color = type === 'SHARP' ? 'purple' : type === 'VALUE' ? 'emerald' : 'blue';
                  return (
                    <Card key={type} className={`border-${color}-500/20`}>
                      <CardContent className="p-4 text-center space-y-2">
                        <Badge variant="outline" className={`text-xs text-${color}-400 border-${color}-400/30`}>
                          {type === 'SHARP' ? '🧠' : type === 'VALUE' ? '💰' : '📊'} {type}
                        </Badge>
                        <p className="text-3xl font-black">{wr}%</p>
                        <p className="text-[10px] text-muted-foreground">{s.wins}W / {s.total - s.wins}L ({s.total} total)</p>
                        <Progress value={wr} className="h-1.5" />
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="border-dashed"><CardContent className="p-8 text-center">
                <Brain className="h-8 w-8 mx-auto text-purple-400/30 mb-2" />
                <p className="text-sm text-muted-foreground">Signal data accumulates as picks are resolved</p>
                <p className="text-[10px] text-muted-foreground mt-1">Run 🏆 Top Plays → resolve results → learning begins</p>
              </CardContent></Card>
            )}

            {/* Signal accuracy over time hint */}
            <Card>
              <CardContent className="p-4">
                <h4 className="text-xs font-semibold mb-2">How Signal Learning Works</h4>
                <div className="space-y-1.5 text-[11px] text-muted-foreground">
                  <p>📊 <strong>CONSENSUS</strong> — Signals from capper agreement on a prop</p>
                  <p>💰 <strong>VALUE</strong> — Signals where model edge exceeds implied odds</p>
                  <p>🧠 <strong>SHARP</strong> — Signals where elite cappers disagree with the public</p>
                  <p className="pt-2 text-[10px]">As data accumulates, the system automatically weights stronger signal types higher in the composite score.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings */}
          <TabsContent value="settings" className="mt-3"><SettingsPanel cappers={cappers} refetch={refetchAll} /></TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
